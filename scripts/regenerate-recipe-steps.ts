/**
 * Regenerate cookable recipes with current recipe-generation rules
 * (structured steps; amounts only in per-step ingredients, not step text).
 *
 * Run: node --env-file=.env.local --import tsx scripts/regenerate-recipe-steps.ts
 * Optional: --missing-only  (only recipes without instruction_steps)
 */
import { and, eq, isNotNull, ne } from "drizzle-orm";

import { generateAndSaveRecipe } from "@/lib/ai/recipes";
import { getDb } from "@/lib/db";
import { recipes } from "@/lib/db/schema";
import { getFirstHouseholdId } from "@/lib/household/context";
import { parseStoredInstructionSteps } from "@/lib/recipes/instruction-steps";

const missingOnly = process.argv.includes("--missing-only");

async function main() {
  const householdId =
    process.env.HOUSEHOLD_ID?.trim() || (await getFirstHouseholdId());
  const db = getDb();

  const rows = await db
    .select()
    .from(recipes)
    .where(
      and(
        eq(recipes.householdId, householdId),
        isNotNull(recipes.ingredientsText),
        ne(recipes.ingredientsText, ""),
        isNotNull(recipes.instructionsText),
        ne(recipes.instructionsText, ""),
      ),
    );

  const targets = missingOnly
    ? rows.filter((recipe) => {
        const steps = parseStoredInstructionSteps(recipe.instructionSteps);
        return !steps || steps.length === 0;
      })
    : rows;

  console.log(
    `Found ${rows.length} cookable recipes; regenerating ${targets.length}` +
      (missingOnly ? " (missing structured steps only)." : " (all)."),
  );

  for (const recipe of targets) {
    console.log(`Regenerating: ${recipe.name}`);
    try {
      const result = await generateAndSaveRecipe({
        householdId,
        prompt: `Create a full dinner recipe for: ${recipe.name}`,
        context: [
          recipe.summary ? `Previous summary: ${recipe.summary}` : null,
          recipe.ingredientsText
            ? `Previous ingredients (keep similar):\n${recipe.ingredientsText}`
            : null,
          "Rewrite steps so action text has NO measurements — put every amount only in each step's ingredients list.",
        ]
          .filter(Boolean)
          .join("\n\n"),
        preferredName: recipe.name,
        markFavorite: recipe.isFavorite,
      });
      console.log(`  ✓ saved ${result.recipeId}`);
    } catch (error) {
      console.error(`  ✗ failed:`, error);
    }
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
