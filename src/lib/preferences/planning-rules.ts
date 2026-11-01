import type { Preference } from "@/lib/db/schema";
import { getPlanningWorkflowBasePrompt } from "@/lib/ai/prompts";
import { detectProteinsInText } from "@/lib/kitchen/food-knowledge";

/** Hard structural rules derived from saved preferences (not menu taste/caps). */
export type HouseholdPlanningProfile = {
  servingsPerMeal: string | null;
  maxDistinctMeats: number | null;
  meatRequired: boolean;
  countMeatsGranularly: boolean;
  balanceMeatsWeekly: boolean;
  structuralPreferences: Preference[];
};

/** Product default when no servings preference is saved. */
export const DEFAULT_SERVINGS_PER_MEAL = "6-8";

const STRUCTURAL_KEY_HINT =
  /^(max meats|meat granularity|meat required|servings|weekly meat balance)/i;

/** Structural weekly menu rules — enforced in prompts and plan validation. */
export function isStructuralPlanningPreference(preference: Preference): boolean {
  if (preference.key === "prefer sale") return false;
  if (preference.kind !== "constraint" && preference.kind !== "note") {
    return false;
  }
  if (preference.key.includes("weekly bulk")) return false;
  if (/servings?/i.test(preference.key)) return true;
  return STRUCTURAL_KEY_HINT.test(preference.key);
}

/** Saved menu/food preferences (pork cap, fish, sourdough, etc.) — DB only, not hardcoded. */
export function isMenuPreference(preference: Preference): boolean {
  if (preference.key === "prefer sale") return false;
  if (isStructuralPlanningPreference(preference)) return false;
  if (preference.kind === "like" || preference.kind === "dislike") {
    return /pasta.*meatball|meatball.*pasta|do not suggest/i.test(
      `${preference.key} ${preference.value}`,
    );
  }
  return preference.kind === "constraint" || preference.kind === "note";
}

export function buildPlanningProfile(
  preferences: Preference[],
): HouseholdPlanningProfile {
  const structuralPreferences = preferences.filter(isStructuralPlanningPreference);

  const find = (keyPart: string) =>
    structuralPreferences.find((item) =>
      item.key.toLowerCase().includes(keyPart.toLowerCase()),
    );

  const maxMeatsPref = find("max meats");
  const maxDistinctMeats = maxMeatsPref
    ? Number.parseInt(maxMeatsPref.value, 10) || null
    : null;

  const servingsPref =
    find("servings") ??
    preferences.find(
      (item) =>
        (item.kind === "constraint" || item.kind === "note") &&
        /servings?/i.test(item.key),
    );
  let servingsPerMeal: string | null = servingsPref?.value ?? null;
  if (!servingsPerMeal) {
    for (const pref of preferences) {
      const match = `${pref.key} ${pref.value}`.match(
        /(\d+\s*[-–]\s*\d+)\s*servings?/i,
      );
      if (match) {
        servingsPerMeal = match[1];
        break;
      }
    }
  }

  const meatRequired = structuralPreferences.some(
    (item) =>
      item.key.includes("meat required") ||
      /all meals should include a meat/i.test(item.value),
  );

  const countMeatsGranularly = structuralPreferences.some((item) =>
    item.key.includes("meat granularity"),
  );

  const balanceMeatsWeekly = structuralPreferences.some((item) =>
    item.key.includes("weekly meat balance"),
  );

  return {
    servingsPerMeal,
    maxDistinctMeats,
    meatRequired,
    countMeatsGranularly,
    balanceMeatsWeekly,
    structuralPreferences,
  };
}

/** Servings target for recipes — saved preference, else product default 6–8. */
export function resolveServingsPerMeal(preferences: Preference[]): string {
  const raw = buildPlanningProfile(preferences).servingsPerMeal;
  if (!raw?.trim()) return DEFAULT_SERVINGS_PER_MEAL;
  const range = raw.match(/(\d+\s*[-–]\s*\d+)/);
  if (range) return range[1].replace(/\s+/g, "");
  return raw.trim();
}

export function detectMeatsInTitle(
  title: string,
  granular: boolean,
): string[] {
  return detectProteinsInText(title, granular);
}

/** Validate only structural rules for a meal batch. */
export function validateWeeklyDinners(input: {
  profile: HouseholdPlanningProfile;
  dinners: Array<{ title: string }>;
}): string[] {
  const { profile, dinners } = input;
  const violations: string[] = [];
  const titles = dinners.map((item) => item.title);

  if (profile.meatRequired) {
    for (const title of titles) {
      const meats = detectMeatsInTitle(title, profile.countMeatsGranularly);
      if (meats.length === 0) {
        violations.push(`"${title}" has no meat component — all meals need meat.`);
      }
    }
  }

  const distinctMeats = new Set<string>();
  for (const title of titles) {
    for (const meat of detectMeatsInTitle(title, profile.countMeatsGranularly)) {
      distinctMeats.add(meat);
    }
  }

  if (
    profile.maxDistinctMeats !== null &&
    distinctMeats.size > profile.maxDistinctMeats
  ) {
    violations.push(
      `Plan uses ${distinctMeats.size} different meats (${[...distinctMeats].join(", ")}) but max is ${profile.maxDistinctMeats}.`,
    );
  }

  return violations;
}

export function formatStructuralPlanningRulesForPrompt(
  preferences: Preference[],
): string {
  const profile = buildPlanningProfile(preferences);

  const lines = [getPlanningWorkflowBasePrompt(), ""];

  if (profile.servingsPerMeal) {
    lines.push(
      `• Scale each bulk meal to ${profile.servingsPerMeal} servings for recipes and grocery lists.`,
    );
  } else {
    lines.push(
      `• Scale each bulk meal to ${DEFAULT_SERVINGS_PER_MEAL} servings for recipes and grocery lists.`,
    );
  }

  if (profile.meatRequired) {
    lines.push("• Every meal must include a meat component.");
  }

  if (profile.maxDistinctMeats !== null) {
    lines.push(
      `• Use at most ${profile.maxDistinctMeats} different meats across the batch${
        profile.countMeatsGranularly
          ? " — count cuts separately (chicken thighs ≠ chicken breasts; pork chops ≠ pork tenderloin)"
          : ""
      }.`,
    );
  }

  if (profile.balanceMeatsWeekly) {
    lines.push("• Balance meat variety across the batch — avoid all-one-protein weeks.");
  }

  for (const pref of profile.structuralPreferences) {
    const summary = `- ${pref.key}: ${pref.value}`;
    if (!lines.some((line) => line.includes(pref.key))) {
      lines.push(summary);
    }
  }

  return lines.join("\n");
}

export function formatMenuPreferencesForPrompt(
  preferences: Preference[],
): string {
  const menu = preferences.filter(isMenuPreference);
  if (menu.length === 0) {
    return "No saved menu preferences.";
  }
  return menu
    .map(
      (item) =>
        `- [${item.strength}] ${item.kind}: ${item.key} — ${item.value}`,
    )
    .join("\n");
}

export function formatFoodPreferencesForPrompt(
  preferences: Preference[],
): string {
  const food = preferences.filter(
    (item) =>
      item.kind === "like" ||
      item.kind === "dislike" ||
      item.key === "prefer sale",
  );
  if (food.length === 0) {
    return "No ingredient/food preferences saved.";
  }
  return food
    .map(
      (item) =>
        `- [${item.strength}] ${item.kind}: ${item.key} — ${item.value}`,
    )
    .join("\n");
}
