import { tool } from "ai";
import { z } from "zod";

import type { HouseholdToolContext } from "@/lib/ai/tools/context";
import { generateAndSaveRecipe } from "@/lib/ai/recipes";
import {
  findRecipeByName,
  saveFavoriteRecipe,
} from "@/lib/meals/service";
import { formatRecipe } from "@/lib/kitchen/format";
import { getDb } from "@/lib/db";
import { recipes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export function createRecipeTools(ctx: HouseholdToolContext) {
  return {
    generateRecipe: tool({
      description:
        "Generate a simple household recipe with AI and save it to household memory.",
      inputSchema: z.object({
        prompt: z.string().min(1),
        context: z.string().optional(),
        markFavorite: z.boolean().optional(),
      }),
      execute: async (input) => {
        const generated = await generateAndSaveRecipe({
          householdId: ctx.householdId,
          prompt: input.prompt,
          context: input.context,
          markFavorite: input.markFavorite,
        });
        return {
          ok: true,
          recipeId: generated.recipeId,
          name: generated.name,
          recipeText: generated.formatted,
        };
      },
    }),

    modifyRecipe: tool({
      description: "Update an existing saved recipe's content or details.",
      inputSchema: z.object({
        recipeName: z.string().min(1),
        summary: z.string().optional(),
        servings: z.number().int().optional(),
        ingredientsText: z.string().optional(),
        instructionsText: z.string().optional(),
        prepTimeMinutes: z.number().int().optional(),
        cookTimeMinutes: z.number().int().optional(),
        totalTimeMinutes: z.number().int().optional(),
      }),
      execute: async (input) => {
        let recipe = await findRecipeByName(ctx.householdId, input.recipeName);
        if (!recipe) {
          recipe = await saveFavoriteRecipe({
            householdId: ctx.householdId,
            name: input.recipeName,
          });
        }
        const db = getDb();
        const [updated] = await db
          .update(recipes)
          .set({
            summary: input.summary ?? recipe.summary,
            servings: input.servings ?? recipe.servings,
            ingredientsText: input.ingredientsText ?? recipe.ingredientsText,
            instructionsText: input.instructionsText ?? recipe.instructionsText,
            prepTimeMinutes: input.prepTimeMinutes ?? recipe.prepTimeMinutes,
            cookTimeMinutes: input.cookTimeMinutes ?? recipe.cookTimeMinutes,
            totalTimeMinutes: input.totalTimeMinutes ?? recipe.totalTimeMinutes,
            updatedAt: new Date(),
          })
          .where(eq(recipes.id, recipe.id))
          .returning();
        return {
          ok: true,
          recipeText: formatRecipe(updated),
        };
      },
    }),

    getRecipe: tool({
      description: "Fetch a saved recipe to show the household.",
      inputSchema: z.object({
        recipeName: z.string().min(1),
      }),
      execute: async (input) => {
        const recipe = await findRecipeByName(ctx.householdId, input.recipeName);
        if (!recipe) {
          return { ok: false, error: `No recipe named "${input.recipeName}"` };
        }
        return {
          ok: true,
          recipeText: formatRecipe(recipe),
        };
      },
    }),
  };
}
