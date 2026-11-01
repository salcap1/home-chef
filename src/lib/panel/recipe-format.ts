/**
 * Parse recipe free-text into structured display rows.
 * Prefer recipes.instruction_steps (JSONB) when present; fall back to parsing
 * instructions_text (including nested · ingredient lines from generation).
 */

import {
  cleanStepText,
  parseStoredInstructionSteps,
  type RecipeInstructionStep,
} from "@/lib/recipes/instruction-steps";

export type IngredientRow = {
  name: string;
  quantity: string | null;
};

export type InstructionStep = {
  number: number;
  text: string;
  ingredients: IngredientRow[];
};

export function parseIngredientLines(
  ingredientsText: string | null | undefined,
): IngredientRow[] {
  if (!ingredientsText?.trim()) return [];

  return ingredientsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseIngredientLine)
    .filter((row): row is IngredientRow => Boolean(row?.name));
}

function parseIngredientLine(line: string): IngredientRow | null {
  const cleaned = line
    .replace(/^[-•*·]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .trim();
  if (!cleaned) return null;

  const emDash = cleaned.split(/\s+[—–]\s+/);
  if (emDash.length >= 2) {
    return {
      name: emDash[0].trim(),
      quantity: emDash.slice(1).join(" — ").trim(),
    };
  }
  const hyphen = cleaned.split(/\s+-\s+/);
  if (hyphen.length >= 2 && hyphen[1].length < 40) {
    return {
      name: hyphen[0].trim(),
      quantity: hyphen.slice(1).join(" - ").trim(),
    };
  }
  return { name: cleaned, quantity: null };
}

function isStepIngredientLine(line: string): boolean {
  return /^\s*[-•*·]/.test(line) || /^\s{2,}\S/.test(line);
}

export function parseInstructionSteps(
  instructionsText: string | null | undefined,
): InstructionStep[] {
  if (!instructionsText?.trim()) return [];

  const lines = instructionsText.split(/\r?\n/).filter((line) => line.trim());
  const steps: InstructionStep[] = [];

  for (const line of lines) {
    const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (numbered) {
      steps.push({
        number: steps.length + 1,
        text: cleanStepText(numbered[2]),
        ingredients: [],
      });
      continue;
    }

    if (steps.length > 0 && isStepIngredientLine(line)) {
      const ingredient = parseIngredientLine(line.trim());
      if (ingredient) {
        steps[steps.length - 1].ingredients.push(ingredient);
      }
      continue;
    }

    steps.push({
      number: steps.length + 1,
      text: cleanStepText(line),
      ingredients: [],
    });
  }

  return steps;
}

function storedStepsToDisplay(
  steps: RecipeInstructionStep[],
): InstructionStep[] {
  return steps.map((step, index) => ({
    number: index + 1,
    text: cleanStepText(step.text),
    ingredients: (step.ingredients ?? []).map((ingredient) => ({
      name: ingredient.name,
      quantity: ingredient.quantityText || null,
    })),
  }));
}

/** Prefer JSONB instruction_steps; fall back to parsing instructions_text. */
export function resolveInstructionSteps(recipe: {
  instructionSteps?: unknown;
  instructionsText?: string | null;
}): InstructionStep[] {
  const stored = parseStoredInstructionSteps(recipe.instructionSteps ?? null);
  if (stored && stored.length > 0) {
    return storedStepsToDisplay(stored);
  }
  return parseInstructionSteps(recipe.instructionsText);
}
