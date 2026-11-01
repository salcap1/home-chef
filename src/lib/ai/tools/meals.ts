import { tool } from "ai";
import { z } from "zod";

import type { HouseholdToolContext } from "@/lib/ai/tools/context";
import { regenerateRecipeFromFeedback } from "@/lib/ai/recipes";
import {
  findRecipeByName,
  getRecentMeals,
  listFavoriteRecipes,
  recordMeal,
  saveFavoriteRecipe,
  saveMealFeedback,
  type FeedbackSentiment,
  type FeedbackTarget,
} from "@/lib/meals/service";

const sentimentSchema = z.enum([
  "loved",
  "liked",
  "okay",
  "disliked",
  "never_again",
]);

const targetSchema = z.enum([
  "meal",
  "recipe",
  "ingredient",
  "sauce",
  "method",
  "other",
]);

function isConstructiveRecipeTweak(
  sentiment: FeedbackSentiment,
  target: FeedbackTarget,
): boolean {
  if (sentiment === "disliked" || sentiment === "never_again") return false;
  return (
    target === "ingredient" ||
    target === "sauce" ||
    target === "method" ||
    target === "other" ||
    target === "recipe"
  );
}

export function createMealMemoryTools(ctx: HouseholdToolContext) {
  return {
    getRecentMeals: tool({
      description: "Get recently cooked or recorded meals for variety and memory.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(20).default(8),
      }),
      execute: async (input) => {
        const meals = await getRecentMeals(ctx.householdId, input.limit);
        return {
          count: meals.length,
          meals: meals.map((meal) => ({
            name: meal.name,
            mealType: meal.mealType,
            cookedAt: meal.cookedAt,
            actuallyCooked: meal.actuallyCooked,
            wasPlanned: meal.wasPlanned,
            notes: meal.notes,
          })),
        };
      },
    }),

    recordMeal: tool({
      description:
        "Record that the household cooked (or skipped) a meal. Use for actual consumption, not just plans.",
      inputSchema: z.object({
        name: z.string().min(1),
        mealType: z.string().default("dinner"),
        servingsText: z.string().optional(),
        wasPlanned: z.boolean().default(false),
        actuallyCooked: z.boolean().default(true),
        notes: z.string().optional(),
        markFavorite: z.boolean().optional(),
      }),
      execute: async (input) => {
        const meal = await recordMeal({
          householdId: ctx.householdId,
          memberId: ctx.memberId,
          name: input.name,
          mealType: input.mealType,
          servingsText: input.servingsText,
          wasPlanned: input.wasPlanned,
          actuallyCooked: input.actuallyCooked,
          notes: input.notes,
          markFavorite: input.markFavorite,
        });
        return {
          ok: true,
          meal: {
            id: meal.id,
            name: meal.name,
            actuallyCooked: meal.actuallyCooked,
          },
        };
      },
    }),

    getFavoriteRecipes: tool({
      description: "List household favorite recipes.",
      inputSchema: z.object({}),
      execute: async () => {
        const favorites = await listFavoriteRecipes(ctx.householdId);
        return {
          count: favorites.length,
          favorites: favorites.map((recipe) => ({
            name: recipe.name,
            summary: recipe.summary,
            servings: recipe.servings,
            timesCooked: recipe.timesCooked,
          })),
        };
      },
    }),

    saveFavoriteRecipe: tool({
      description: "Save or mark a recipe as a household favorite.",
      inputSchema: z.object({
        name: z.string().min(1),
        summary: z.string().optional(),
        servings: z.number().int().optional(),
        ingredientsText: z.string().optional(),
        instructionsText: z.string().optional(),
      }),
      execute: async (input) => {
        const recipe = await saveFavoriteRecipe({
          householdId: ctx.householdId,
          name: input.name,
          summary: input.summary,
          servings: input.servings,
          ingredientsText: input.ingredientsText,
          instructionsText: input.instructionsText,
        });
        return {
          ok: true,
          recipe: { id: recipe.id, name: recipe.name, isFavorite: recipe.isFavorite },
        };
      },
    }),

    applyRecipeFeedback: tool({
      description:
        "Apply household cooking feedback by regenerating the saved recipe (ingredients/steps) so the tweak is baked in. Use for 'make it crispier', 'less salt', 'double the sauce', etc. Do not store notes.",
      inputSchema: z.object({
        recipeName: z.string().min(1),
        feedback: z.string().min(1),
      }),
      execute: async (input) => {
        const generated = await regenerateRecipeFromFeedback({
          householdId: ctx.householdId,
          recipeName: input.recipeName,
          feedback: input.feedback,
        });
        return {
          ok: true,
          recipeId: generated.recipeId,
          name: generated.name,
          recipeText: generated.formatted,
        };
      },
    }),

    saveMealFeedback: tool({
      description:
        "Save conversational meal feedback (loved it, don't make again). For constructive cooking tweaks on a known recipe (crispier, less salt, etc.), also regenerates that recipe — do not store notes.",
      inputSchema: z.object({
        feedbackText: z.string().min(1),
        sentiment: sentimentSchema,
        target: targetSchema.default("meal"),
        targetDetail: z.string().optional(),
        recipeName: z.string().optional(),
        saveAsFavorite: z.boolean().optional(),
      }),
      execute: async (input) => {
        const sentiment = input.sentiment as FeedbackSentiment;
        const target = input.target as FeedbackTarget;
        const feedback = await saveMealFeedback({
          householdId: ctx.householdId,
          memberId: ctx.memberId,
          recipeName: input.recipeName,
          sentiment,
          target,
          targetDetail: input.targetDetail,
          feedbackText: input.feedbackText,
          saveAsFavorite:
            input.saveAsFavorite ??
            (sentiment === "loved" || sentiment === "liked"),
        });

        let recipeText: string | undefined;
        if (
          input.recipeName &&
          isConstructiveRecipeTweak(sentiment, target)
        ) {
          const existing = await findRecipeByName(
            ctx.householdId,
            input.recipeName,
          );
          if (existing) {
            const generated = await regenerateRecipeFromFeedback({
              householdId: ctx.householdId,
              recipeName: input.recipeName,
              feedback: input.feedbackText,
            });
            recipeText = generated.formatted;
          }
        }

        return {
          ok: true,
          feedback: {
            id: feedback.id,
            sentiment: feedback.sentiment,
            target: feedback.target,
          },
          ...(recipeText ? { recipeText } : {}),
        };
      },
    }),
  };
}
