import { generateText, Output } from "ai";
import { z } from "zod";

import { assertAiAllowed, isAiBudgetExceededError } from "@/lib/ai/budget";
import { getPlanningModel } from "@/lib/ai/models";
import {
  getRecipeGenerationPrompt,
  getRecipeTweakPrompt,
} from "@/lib/ai/prompts";
import {
  estimateCostUsd,
  recordAiUsage,
  type AiUsageCategory,
} from "@/lib/conversation/service";
import { saveFavoriteRecipe, findRecipeByName } from "@/lib/meals/service";
import { getDb } from "@/lib/db";
import { recipes, type Recipe } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { formatRecipe } from "@/lib/kitchen/format";
import { parseIngredientLines } from "@/lib/panel/recipe-format";
import { listPreferences } from "@/lib/preferences/service";
import { resolveServingsPerMeal } from "@/lib/preferences/planning-rules";
import {
  applyRecipeTweakPatch,
  type RecipeTweakPatch,
} from "@/lib/recipes/apply-tweak";
import {
  formatInstructionStepsText,
  cleanStepText,
  parseStoredInstructionSteps,
  type RecipeInstructionStep,
} from "@/lib/recipes/instruction-steps";
import {
  tidyRecipeIngredient,
  toIngredientsText,
} from "@/lib/recipes/shopping-format";

const ingredientSchema = z.object({
  name: z.string(),
  quantityText: z.string(),
});

const instructionSchema = z.object({
  text: z.string(),
  ingredients: z.array(ingredientSchema),
});

const generatedRecipeSchema = z.object({
  name: z.string(),
  servings: z.number().int().positive(),
  prepTimeMinutes: z.number().int().nonnegative(),
  cookTimeMinutes: z.number().int().nonnegative(),
  totalTimeMinutes: z.number().int().positive(),
  summary: z.string(),
  ingredients: z.array(ingredientSchema),
  instructions: z.array(instructionSchema),
});

const recipeTweakSchema = z.object({
  mode: z.enum(["patch", "rewrite"]),
  servings: z.number().int().positive().optional(),
  summary: z.string().optional(),
  prepTimeMinutes: z.number().int().nonnegative().optional(),
  cookTimeMinutes: z.number().int().nonnegative().optional(),
  totalTimeMinutes: z.number().int().positive().optional(),
  setIngredients: z.array(ingredientSchema).optional(),
  replaceSteps: z
    .array(
      z.object({
        index: z.number().int().positive(),
        text: z.string(),
        ingredients: z.array(ingredientSchema),
      }),
    )
    .optional(),
  insertSteps: z
    .array(
      z.object({
        afterIndex: z.number().int().nonnegative(),
        text: z.string(),
        ingredients: z.array(ingredientSchema),
      }),
    )
    .optional(),
  removeStepIndexes: z.array(z.number().int().positive()).optional(),
  ingredients: z.array(ingredientSchema).optional(),
  instructions: z.array(instructionSchema).optional(),
});

export async function generateAndSaveRecipe(input: {
  householdId: string;
  prompt: string;
  context?: string;
  markFavorite?: boolean;
  /** Persist under this name (e.g. meal title) so stubs get filled in. */
  preferredName?: string;
}): Promise<{
  recipeId: string;
  formatted: string;
  name: string;
}> {
  await assertAiAllowed(input.householdId, "generation");
  const prefs = await listPreferences(input.householdId);
  const servingsTarget = resolveServingsPerMeal(prefs);
  const model = getPlanningModel();
  const result = await generateText({
    model,
    output: Output.object({ schema: generatedRecipeSchema }),
    prompt: getRecipeGenerationPrompt({
      userRequest: input.prompt,
      context: [
        `Household servings target: ${servingsTarget} servings. Scale ingredients for that yield.`,
        input.context?.trim() || null,
      ]
        .filter(Boolean)
        .join("\n\n"),
      servingsTarget,
    }),
  });

  await trackUsage({
    householdId: input.householdId,
    model,
    category: "recipe",
    inputTokens: result.totalUsage?.inputTokens ?? 0,
    outputTokens: result.totalUsage?.outputTokens ?? 0,
    gatewayCost:
      (result.providerMetadata as { gateway?: { cost?: number } } | undefined)
        ?.gateway?.cost ?? null,
  });

  const generated = result.output;
  if (!generated) {
    throw new Error("Recipe generation returned no structured output");
  }

  return persistGeneratedRecipe({
    householdId: input.householdId,
    preferredName: input.preferredName,
    markFavorite: input.markFavorite ?? false,
    generated,
  });
}

/** Rewrite a saved recipe so household feedback is baked into steps/ingredients. */
export async function regenerateRecipeFromFeedback(input: {
  householdId: string;
  recipeName: string;
  feedback: string;
}): Promise<{
  recipeId: string;
  formatted: string;
  name: string;
}> {
  await assertAiAllowed(input.householdId, "generation");

  const existing = await findRecipeByName(input.householdId, input.recipeName);
  const feedback = input.feedback.trim();
  if (!feedback) {
    throw new Error("Feedback is required to regenerate a recipe");
  }

  if (existing && parseStoredInstructionSteps(existing.instructionSteps)?.length) {
    try {
      return await applyRecipeTweak({
        householdId: input.householdId,
        existing,
        feedback,
      });
    } catch (error) {
      if (isAiBudgetExceededError(error)) throw error;
      // Fall through to a full rewrite when the patch path fails.
    }
  }

  return generateAndSaveRecipe({
    householdId: input.householdId,
    preferredName: existing?.name ?? input.recipeName.trim(),
    markFavorite: existing?.isFavorite ?? false,
    prompt: `Revise the recipe "${existing?.name ?? input.recipeName}" so this household feedback is built into the recipe itself: ${feedback}`,
    context: compactRecipeContext(existing),
  });
}

async function applyRecipeTweak(input: {
  householdId: string;
  existing: Recipe;
  feedback: string;
}): Promise<{
  recipeId: string;
  formatted: string;
  name: string;
}> {
  await assertAiAllowed(input.householdId, "generation");

  const currentIngredients = parseIngredientLines(input.existing.ingredientsText).map(
    (row) => ({
      name: row.name,
      quantityText: row.quantity ?? "",
    }),
  );
  const currentSteps =
    parseStoredInstructionSteps(input.existing.instructionSteps) ?? [];

  const model = getPlanningModel();
  const result = await generateText({
    model,
    maxOutputTokens: 1800,
    output: Output.object({ schema: recipeTweakSchema }),
    prompt: getRecipeTweakPrompt({
      feedback: input.feedback,
      recipeJson: JSON.stringify(
        {
          name: input.existing.name,
          servings: input.existing.servings,
          summary: input.existing.summary,
          prepTimeMinutes: input.existing.prepTimeMinutes,
          cookTimeMinutes: input.existing.cookTimeMinutes,
          totalTimeMinutes: input.existing.totalTimeMinutes,
          ingredients: currentIngredients,
          instructions: currentSteps,
        },
        null,
        2,
      ),
    }),
  });

  await trackUsage({
    householdId: input.householdId,
    model,
    category: "recipe",
    inputTokens: result.totalUsage?.inputTokens ?? 0,
    outputTokens: result.totalUsage?.outputTokens ?? 0,
    gatewayCost:
      (result.providerMetadata as { gateway?: { cost?: number } } | undefined)
        ?.gateway?.cost ?? null,
  });

  const patch = result.output as RecipeTweakPatch | undefined;
  if (!patch) {
    throw new Error("Recipe tweak returned no structured output");
  }

  const tweaked = applyRecipeTweakPatch(
    {
      servings: input.existing.servings ?? undefined,
      summary: input.existing.summary ?? undefined,
      prepTimeMinutes: input.existing.prepTimeMinutes ?? undefined,
      cookTimeMinutes: input.existing.cookTimeMinutes ?? undefined,
      totalTimeMinutes: input.existing.totalTimeMinutes ?? undefined,
      ingredients: currentIngredients,
      steps: currentSteps,
    },
    patch,
  );
  if (!tweaked || tweaked.steps.length === 0) {
    throw new Error("Recipe tweak patch was empty");
  }

  return persistGeneratedRecipe({
    householdId: input.householdId,
    preferredName: input.existing.name,
    markFavorite: input.existing.isFavorite,
    generated: {
      name: input.existing.name,
      servings: tweaked.servings ?? input.existing.servings ?? 6,
      prepTimeMinutes:
        tweaked.prepTimeMinutes ?? input.existing.prepTimeMinutes ?? 0,
      cookTimeMinutes:
        tweaked.cookTimeMinutes ?? input.existing.cookTimeMinutes ?? 0,
      totalTimeMinutes:
        tweaked.totalTimeMinutes ??
        input.existing.totalTimeMinutes ??
        Math.max(
          1,
          (tweaked.prepTimeMinutes ?? input.existing.prepTimeMinutes ?? 0) +
            (tweaked.cookTimeMinutes ?? input.existing.cookTimeMinutes ?? 0),
        ),
      summary: tweaked.summary ?? input.existing.summary ?? "",
      ingredients: tweaked.ingredients,
      instructions: tweaked.steps,
    },
  });
}

async function persistGeneratedRecipe(input: {
  householdId: string;
  preferredName?: string;
  markFavorite: boolean;
  generated: z.infer<typeof generatedRecipeSchema>;
}): Promise<{
  recipeId: string;
  formatted: string;
  name: string;
}> {
  const ingredients = input.generated.ingredients.map((item) =>
    tidyRecipeIngredient(item),
  );
  const ingredientsText = toIngredientsText(ingredients);
  const instructionSteps: RecipeInstructionStep[] =
    input.generated.instructions.map((step) => ({
      text: cleanStepText(step.text),
      ingredients: (step.ingredients ?? [])
        .map((ingredient) => tidyRecipeIngredient(ingredient))
        .filter((ingredient) => ingredient.name.length > 0),
    }));
  const instructionsText = formatInstructionStepsText(instructionSteps);
  const recipeName = (input.preferredName?.trim() || input.generated.name).trim();

  const recipe = await saveFavoriteRecipe({
    householdId: input.householdId,
    name: recipeName,
    summary: input.generated.summary,
    servings: input.generated.servings,
    ingredientsText,
    instructionsText,
    isFavorite: input.markFavorite,
  });

  const db = getDb();
  const [updated] = await db
    .update(recipes)
    .set({
      prepTimeMinutes: input.generated.prepTimeMinutes,
      cookTimeMinutes: input.generated.cookTimeMinutes,
      totalTimeMinutes: input.generated.totalTimeMinutes,
      instructionSteps,
      isFavorite: input.markFavorite ?? recipe.isFavorite,
      updatedAt: new Date(),
    })
    .where(eq(recipes.id, recipe.id))
    .returning();

  if (!updated) {
    throw new Error("Failed to save generated recipe details");
  }

  return {
    recipeId: updated.id,
    formatted: formatRecipe(updated),
    name: updated.name,
  };
}

function compactRecipeContext(existing: Recipe | null): string {
  return [
    "Do not keep a separate notes list. Change ingredients, amounts, technique, and steps so the recipe produces the requested result next time.",
    "Keep the household servings target (dinner + leftovers) unless the feedback explicitly changes portion size.",
    "Ingredient names must be short shopping names; quantities must be simple amounts.",
    existing?.servings ? `Current servings: ${existing.servings}` : null,
    existing?.summary ? `Current summary: ${existing.summary}` : null,
    existing?.ingredientsText
      ? `Current ingredients:\n${existing.ingredientsText}`
      : null,
    existing?.instructionsText
      ? `Current steps:\n${existing.instructionsText}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function trackUsage(input: {
  householdId: string;
  model: string;
  category: AiUsageCategory;
  inputTokens: number;
  outputTokens: number;
  gatewayCost: number | null;
}) {
  await recordAiUsage({
    householdId: input.householdId,
    model: input.model,
    category: input.category,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    estimatedCostUsd: estimateCostUsd({
      model: input.model,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      gatewayCostUsd: input.gatewayCost,
    }),
  });
}
