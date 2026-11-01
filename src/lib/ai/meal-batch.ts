import { generateText, Output } from "ai";
import { z } from "zod";

import { assertAiAllowed } from "@/lib/ai/budget";
import { getPlanningModel } from "@/lib/ai/models";
import {
  getPlanningWorkflowBasePrompt,
} from "@/lib/ai/prompts";
import {
  estimateCostUsd,
  recordAiUsage,
} from "@/lib/conversation/service";
import { getRecentMeals } from "@/lib/meals/service";
import {
  formatStructuralPlanningRulesForPrompt,
  isMenuPreference,
} from "@/lib/preferences/planning-rules";
import { listPreferences } from "@/lib/preferences/service";

const mealBatchSchema = z.object({
  meals: z
    .array(
      z.object({
        title: z
          .string()
          .describe("Short dinner name including the protein, e.g. Honey garlic chicken thighs"),
      }),
    )
    .min(1)
    .max(10),
});

/** Parse free-text pantry items (comma / newline / semicolon separated). */
export function parseUseIngredients(raw: string | string[] | null | undefined): string[] {
  const chunks = Array.isArray(raw)
    ? raw
    : String(raw ?? "")
        .split(/[\n,;]+/)
        .map((part) => part.trim())
        .filter(Boolean);

  const seen = new Map<string, string>();
  for (const chunk of chunks) {
    const name = chunk.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, name);
    if (seen.size >= 20) break;
  }
  return [...seen.values()];
}

/** Propose numbered dinner titles for a meal batch. */
export async function generateMealBatchTitles(input: {
  householdId: string;
  selectedMeats?: string[];
  mealCount: number;
  /** Past meal titles the household wants included as fixed slots. */
  includePastMeals?: string[];
  /** Pantry / on-hand items to weave into new meals (not inventory — one-shot planning hint). */
  useIngredients?: string[];
}): Promise<string[]> {
  await assertAiAllowed(input.householdId, "generation");

  const mealCount = Math.min(10, Math.max(1, Math.round(input.mealCount)));
  const meats = (input.selectedMeats ?? []).map((m) => m.trim()).filter(Boolean);
  const useIngredients = parseUseIngredients(input.useIngredients);

  const included = [
    ...new Map(
      (input.includePastMeals ?? [])
        .map((title) => title.trim())
        .filter(Boolean)
        .map((title) => [title.toLowerCase(), title] as const),
    ).values(),
  ].slice(0, mealCount);

  const generateCount = mealCount - included.length;
  if (generateCount <= 0) {
    return included.slice(0, mealCount);
  }

  const [prefs, recentMeals] = await Promise.all([
    listPreferences(input.householdId),
    getRecentMeals(input.householdId, 12),
  ]);

  const menuPrefs = prefs
    .filter(isMenuPreference)
    .map((pref) => `${pref.kind}: ${pref.key} — ${pref.value}`)
    .slice(0, 24);

  const structuralRules = formatStructuralPlanningRulesForPrompt(prefs);

  const recentBlock =
    recentMeals.length > 0
      ? recentMeals.map((meal) => meal.name).join("; ")
      : "(none)";

  const includedBlock =
    included.length > 0
      ? included.map((title, index) => `${index + 1}. ${title}`).join("\n")
      : null;

  const proteinGuidance =
    meats.length > 0
      ? `Protein picks (use ONLY these meats for the NEW meals you propose): ${meats.join(", ")}`
      : "No specific proteins were requested — choose sensible proteins from household preferences, with variety across the new meals.";

  const useGuidance =
    useIngredients.length > 0
      ? `MUST USE across the NEW meals (household wants these used up — weave them into titles/dishes where natural; do not invent a separate "use everything" casserole unless it fits): ${useIngredients.join(", ")}`
      : null;

  const model = getPlanningModel();
  const result = await generateText({
    model,
    output: Output.object({ schema: mealBatchSchema }),
    prompt: [
      getPlanningWorkflowBasePrompt(),
      "",
      structuralRules,
      "",
      "TASK: Propose additional bulk dinners to complete a household meal batch.",
      proteinGuidance,
      useGuidance,
      `Total batch size: ${mealCount} dinners.`,
      `Already included (fixed — do NOT repeat or rename these): ${
        included.length > 0 ? included.join("; ") : "(none)"
      }`,
      includedBlock
        ? `Included meals:\n${includedBlock}`
        : null,
      `Propose exactly ${generateCount} NEW dinner title(s) to fill the remaining slots.`,
      "Each title should be a simple, cookable dinner name that includes its protein.",
      "Prefer easy weeknight meals, ingredient reuse, and good leftovers (6–8 servings when recipes are generated later).",
      "Do not assign weekdays. Do not include breakfast or lunch slots.",
      "Avoid repeating recent meals and the already-included meals when reasonable.",
      "Complement the included meals (variety of protein/prep when possible).",
      "",
      `Recent meals: ${recentBlock}`,
      "",
      "Menu preferences:",
      menuPrefs.length > 0 ? menuPrefs.join("\n") : "(none notable)",
      "",
      `Return exactly ${generateCount} new meal(s).`,
    ]
      .filter((line): line is string => line != null)
      .join("\n"),
  });

  await recordAiUsage({
    householdId: input.householdId,
    model,
    category: "planning",
    inputTokens: result.totalUsage?.inputTokens ?? 0,
    outputTokens: result.totalUsage?.outputTokens ?? 0,
    estimatedCostUsd: estimateCostUsd({
      model,
      inputTokens: result.totalUsage?.inputTokens ?? 0,
      outputTokens: result.totalUsage?.outputTokens ?? 0,
      gatewayCostUsd:
        (result.providerMetadata as { gateway?: { cost?: number } } | undefined)
          ?.gateway?.cost ?? null,
    }),
  });

  const output = result.output;
  if (!output?.meals?.length) {
    throw new Error("Meal generation returned no meals.");
  }

  const includedKeys = new Set(included.map((title) => title.toLowerCase()));
  const generated = output.meals
    .map((meal) => meal.title.trim())
    .filter(Boolean)
    .filter((title) => !includedKeys.has(title.toLowerCase()))
    .slice(0, generateCount);

  if (generated.length < generateCount) {
    throw new Error(
      `Expected ${generateCount} new meals but only got ${generated.length}.`,
    );
  }

  return [...included, ...generated];
}
