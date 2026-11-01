import { detectProteinsInText } from "@/lib/kitchen/food-knowledge";

const PROTEIN_EMOJI: Record<string, string> = {
  chicken: "🍗",
  turkey: "🦃",
  beef: "🥩",
  pork: "🐷",
  lamb: "🐑",
  fish: "🐟",
  seafood: "🦐",
};

export const HISTORY_MEAT_FILTERS = [
  "chicken",
  "turkey",
  "beef",
  "pork",
  "lamb",
  "fish",
  "seafood",
] as const;

export type HistoryMeatFilter = (typeof HISTORY_MEAT_FILTERS)[number];

/** Substring patterns for SQL ILIKE meal-title filters by protein class. */
const MEAT_ILIKE_PATTERNS: Record<HistoryMeatFilter, string[]> = {
  chicken: ["%chicken%"],
  turkey: ["%turkey%"],
  beef: ["%beef%", "%steak%", "%brisket%", "%chuck%"],
  pork: ["%pork%", "%sausage%", "%bacon%"],
  lamb: ["%lamb%"],
  fish: ["%salmon%", "%fish%", "%cod%", "%tilapia%", "%tuna%"],
  seafood: ["%shrimp%", "%prawn%", "%seafood%", "%scallop%"],
};

export function primaryProteinClass(mealName: string): string | null {
  const classes = detectProteinsInText(mealName, false);
  return classes[0] ?? null;
}

export function meatEmojiForProteinClass(
  proteinClass: string | null | undefined,
): string {
  if (!proteinClass) return "🥗";
  return PROTEIN_EMOJI[proteinClass] ?? "🥗";
}

export function meatEmojiForMeal(mealName: string): string {
  return meatEmojiForProteinClass(primaryProteinClass(mealName));
}

export function isHistoryMeatFilter(
  value: string | null | undefined,
): value is HistoryMeatFilter {
  return (
    typeof value === "string" &&
    (HISTORY_MEAT_FILTERS as readonly string[]).includes(value)
  );
}

export function meatFilterIlikePatterns(proteinClass: string): string[] {
  if (!isHistoryMeatFilter(proteinClass)) return [];
  return MEAT_ILIKE_PATTERNS[proteinClass];
}
