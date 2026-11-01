import type { RecipeInstructionStep } from "@/lib/recipes/instruction-steps";
import { cleanStepText } from "@/lib/recipes/instruction-steps";
import { tidyRecipeIngredient } from "@/lib/recipes/shopping-format";

export type RecipeIngredient = {
  name: string;
  quantityText: string;
};

export type RecipeTweakPatch = {
  mode: "patch" | "rewrite";
  servings?: number;
  summary?: string;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;
  setIngredients?: RecipeIngredient[];
  replaceSteps?: Array<{
    index: number;
    text: string;
    ingredients: RecipeIngredient[];
  }>;
  insertSteps?: Array<{
    afterIndex: number;
    text: string;
    ingredients: RecipeIngredient[];
  }>;
  removeStepIndexes?: number[];
  ingredients?: RecipeIngredient[];
  instructions?: Array<{
    text: string;
    ingredients: RecipeIngredient[];
  }>;
};

export type TweakedRecipeContent = {
  servings?: number;
  summary?: string;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;
  ingredients: RecipeIngredient[];
  steps: RecipeInstructionStep[];
};

function tidyStep(step: {
  text: string;
  ingredients?: RecipeIngredient[];
}): RecipeInstructionStep {
  return {
    text: cleanStepText(step.text),
    ingredients: (step.ingredients ?? [])
      .map((ingredient) => tidyRecipeIngredient(ingredient))
      .filter((ingredient) => ingredient.name.length > 0),
  };
}

function hasPatchOps(patch: RecipeTweakPatch): boolean {
  return Boolean(
    patch.setIngredients?.length ||
      patch.replaceSteps?.length ||
      patch.insertSteps?.length ||
      patch.removeStepIndexes?.length ||
      patch.ingredients?.length ||
      patch.instructions?.length ||
      patch.servings != null ||
      patch.summary ||
      patch.prepTimeMinutes != null ||
      patch.cookTimeMinutes != null ||
      patch.totalTimeMinutes != null,
  );
}

/**
 * Apply a model tweak patch onto the current recipe.
 * Returns null when the patch is empty so the caller can fall back to a full rewrite.
 */
export function applyRecipeTweakPatch(
  current: TweakedRecipeContent,
  patch: RecipeTweakPatch,
): TweakedRecipeContent | null {
  if (!hasPatchOps(patch)) return null;

  if (
    patch.mode === "rewrite" &&
    patch.ingredients?.length &&
    patch.instructions?.length
  ) {
    return {
      servings: patch.servings ?? current.servings,
      summary: patch.summary ?? current.summary,
      prepTimeMinutes: patch.prepTimeMinutes ?? current.prepTimeMinutes,
      cookTimeMinutes: patch.cookTimeMinutes ?? current.cookTimeMinutes,
      totalTimeMinutes: patch.totalTimeMinutes ?? current.totalTimeMinutes,
      ingredients: patch.ingredients.map((ingredient) =>
        tidyRecipeIngredient(ingredient),
      ),
      steps: patch.instructions.map((step) => tidyStep(step)),
    };
  }

  let ingredients = current.ingredients.map((ingredient) =>
    tidyRecipeIngredient(ingredient),
  );
  if (patch.setIngredients?.length) {
    ingredients = patch.setIngredients.map((ingredient) =>
      tidyRecipeIngredient(ingredient),
    );
  }

  let steps = current.steps.map((step) => tidyStep(step));
  const remove = new Set(
    (patch.removeStepIndexes ?? []).filter((index) => index >= 1),
  );
  if (remove.size > 0) {
    steps = steps.filter((_, index) => !remove.has(index + 1));
  }

  for (const replacement of patch.replaceSteps ?? []) {
    const index = replacement.index - 1;
    if (index < 0 || index >= steps.length) continue;
    steps[index] = tidyStep(replacement);
  }

  const inserts = [...(patch.insertSteps ?? [])].sort(
    (a, b) => b.afterIndex - a.afterIndex,
  );
  for (const insert of inserts) {
    const at = Math.min(Math.max(insert.afterIndex, 0), steps.length);
    steps.splice(at, 0, tidyStep(insert));
  }

  return {
    servings: patch.servings ?? current.servings,
    summary: patch.summary ?? current.summary,
    prepTimeMinutes: patch.prepTimeMinutes ?? current.prepTimeMinutes,
    cookTimeMinutes: patch.cookTimeMinutes ?? current.cookTimeMinutes,
    totalTimeMinutes: patch.totalTimeMinutes ?? current.totalTimeMinutes,
    ingredients,
    steps,
  };
}
