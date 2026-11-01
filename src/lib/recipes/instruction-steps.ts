import { z } from "zod";

/** Structured cook-mode steps stored on recipes.instruction_steps */
export const recipeInstructionStepSchema = z.object({
  text: z.string(),
  ingredients: z.array(
    z.object({
      name: z.string(),
      quantityText: z.string(),
    }),
  ),
});

export const recipeInstructionStepsSchema = z.array(recipeInstructionStepSchema);

export type RecipeInstructionStep = z.infer<typeof recipeInstructionStepSchema>;

/** Strip leading "1." / "2)" so UI numbered badges aren't duplicated. */
export function cleanStepText(text: string): string {
  return text.replace(/^\s*\d+[.)]\s+/, "").trim();
}

export function formatInstructionStepsText(
  steps: RecipeInstructionStep[],
): string {
  return steps
    .map((step, index) => {
      const lines = [`${index + 1}. ${cleanStepText(step.text)}`];
      for (const ingredient of step.ingredients ?? []) {
        const name = ingredient.name.trim();
        const qty = ingredient.quantityText.trim();
        if (!name) continue;
        lines.push(`   · ${name}${qty ? ` — ${qty}` : ""}`);
      }
      return lines.join("\n");
    })
    .join("\n");
}

export function parseStoredInstructionSteps(
  value: unknown,
): RecipeInstructionStep[] | null {
  const parsed = recipeInstructionStepsSchema.safeParse(value);
  if (!parsed.success) return null;
  return parsed.data.map((step) => ({
    ...step,
    text: cleanStepText(step.text),
    ingredients: step.ingredients ?? [],
  }));
}
