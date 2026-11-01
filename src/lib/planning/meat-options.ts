import { detectMeatsInTitle } from "@/lib/preferences/planning-rules";

export type MeatOption = {
  id: string;
  label: string;
  category: "poultry" | "beef" | "pork" | "other";
  isSeafood: boolean;
};

/** Granular meat cuts the household shops/cooks as separate proteins. */
export const MEAT_OPTION_POOL: MeatOption[] = [
  { id: "chicken-thighs", label: "Chicken thighs", category: "poultry", isSeafood: false },
  { id: "chicken-breasts", label: "Chicken breasts", category: "poultry", isSeafood: false },
  { id: "ground-beef", label: "Ground beef", category: "beef", isSeafood: false },
  { id: "beef-chuck", label: "Beef chuck roast", category: "beef", isSeafood: false },
  { id: "beef-strips", label: "Beef strips / stir-fry beef", category: "beef", isSeafood: false },
  { id: "steak", label: "Steak (sirloin or flank)", category: "beef", isSeafood: false },
  { id: "pork-chops", label: "Pork chops", category: "pork", isSeafood: false },
  { id: "pork-tenderloin", label: "Pork tenderloin", category: "pork", isSeafood: false },
  { id: "pork-shoulder", label: "Pork shoulder / butt", category: "pork", isSeafood: false },
  { id: "pork-sausage", label: "Pork sausage", category: "pork", isSeafood: false },
  { id: "ground-turkey", label: "Ground turkey", category: "poultry", isSeafood: false },
  { id: "turkey-breast", label: "Turkey breast", category: "poultry", isSeafood: false },
  { id: "lamb", label: "Lamb", category: "other", isSeafood: false },
  { id: "salmon", label: "Salmon", category: "other", isSeafood: true },
  { id: "shrimp", label: "Shrimp", category: "other", isSeafood: true },
];

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap]!, copy[index]!];
  }
  return copy;
}

function recentMeatUseScore(option: MeatOption, recentMealTitles: string[]): number {
  let score = 0;
  for (const title of recentMealTitles) {
    const meats = detectMeatsInTitle(title, true);
    if (meats.includes(option.id)) score += 2;
    else if (meats.some((meat) => option.id.startsWith(meat.split("-")[0] ?? meat))) {
      score += 1;
    }
  }
  return score;
}

function filterMeatPool(input: {
  excludeSeafood?: boolean;
  excludeIds?: string[];
}): MeatOption[] {
  return MEAT_OPTION_POOL.filter((option) => {
    if (input.excludeSeafood && option.isSeafood) return false;
    if (input.excludeIds?.includes(option.id)) return false;
    return true;
  });
}

/** Full protein list for the panel picker (stable pool order). */
export function listPanelMeatOptions(input?: {
  excludeSeafood?: boolean;
  excludeIds?: string[];
}): MeatOption[] {
  return filterMeatPool(input ?? {});
}

export function proposeWeeklyMeatOptions(input: {
  /** How many options to show (default random 5–7). */
  optionCount?: number;
  recentMealTitles?: string[];
  excludeSeafood?: boolean;
  excludeIds?: string[];
}): MeatOption[] {
  const targetCount = input.optionCount ?? 5 + Math.floor(Math.random() * 3);

  let pool = filterMeatPool(input);

  pool = [...pool].sort(
    (a, b) =>
      recentMeatUseScore(a, input.recentMealTitles ?? []) -
      recentMeatUseScore(b, input.recentMealTitles ?? []),
  );

  const diversified: MeatOption[] = [];
  const usedCategories = new Set<string>();

  for (const option of pool) {
    if (diversified.length >= targetCount) break;
    if (usedCategories.has(option.category) && diversified.length < targetCount - 2) {
      continue;
    }
    diversified.push(option);
    usedCategories.add(option.category);
  }

  for (const option of shuffle(pool)) {
    if (diversified.length >= targetCount) break;
    if (diversified.some((entry) => entry.id === option.id)) continue;
    diversified.push(option);
  }

  return shuffle(diversified.slice(0, targetCount));
}

export function formatMeatOptions(
  options: MeatOption[],
  pickCount: number,
): string {
  const lines = [
    "🥩 Pick your proteins",
    "",
    `Here are ${options.length} options — pick ${pickCount} you're in the mood for this week:`,
    "",
  ];

  options.forEach((option, index) => {
    lines.push(`• ${index + 1}. ${option.label}`);
  });

  lines.push(
    "",
    "Reply with the numbers or names (e.g. “1, 3, 5” or “chicken thighs, ground beef, pork tenderloin”).",
  );

  return lines.join("\n");
}
