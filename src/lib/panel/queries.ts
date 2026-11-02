import { requirePanelSession } from "@/lib/panel/auth";
import {
  getActiveGroceryList,
  getCurrentWeeklyPlanWithRecipes,
  getMealPlanItemRecipeSnapshot,
  getUpcomingWeeklyPlanWithRecipes,
} from "@/lib/planning/service";
import { listGroceryCategories } from "@/lib/planning/grocery-categories";
import { listPreferences } from "@/lib/preferences/service";
import {
  getMealHistoryWithDetails,
  getRecipeById,
} from "@/lib/meals/service";
import { getMonthlyCostSummary } from "@/lib/conversation/service";
import { canUseHarrisTeeterShop } from "@/lib/kroger/access";
import { getKrogerConnection } from "@/lib/kroger/connection";
import {
  listPanelMeatOptions,
  type MeatOption,
} from "@/lib/planning/meat-options";
import { buildPlanningProfile } from "@/lib/preferences/planning-rules";

export async function loadPanelHouseholdId(): Promise<string> {
  const { householdId } = await requirePanelSession();
  return householdId;
}

export async function loadGroceries() {
  const householdId = await loadPanelHouseholdId();
  const [active, categories, kroger, shopAllowed] = await Promise.all([
    getActiveGroceryList(householdId),
    listGroceryCategories(householdId),
    getKrogerConnection(householdId),
    canUseHarrisTeeterShop(householdId),
  ]);
  const harrisTeeter = !shopAllowed
    ? ({ available: false as const } as const)
    : kroger
      ? ({
          available: true as const,
          linked: true as const,
          locationName: kroger.locationName,
        } as const)
      : ({ available: true as const, linked: false as const } as const);

  if (!active) {
    return {
      list: null,
      items: [],
      categories,
      harrisTeeter,
    };
  }
  return {
    list: active.list,
    items: active.items,
    categories,
    harrisTeeter,
  };
}

export async function loadPreferences() {
  const householdId = await loadPanelHouseholdId();
  return listPreferences(householdId);
}

export async function loadCurrentMeals() {
  const householdId = await loadPanelHouseholdId();
  return getCurrentWeeklyPlanWithRecipes(householdId);
}

export async function loadUpcomingMeals() {
  const householdId = await loadPanelHouseholdId();
  return getUpcomingWeeklyPlanWithRecipes(householdId);
}

export async function loadMealBatches() {
  const householdId = await loadPanelHouseholdId();
  const [current, upcoming] = await Promise.all([
    getCurrentWeeklyPlanWithRecipes(householdId),
    getUpcomingWeeklyPlanWithRecipes(householdId),
  ]);
  return { current, upcoming };
}

export async function loadMeatPickerOptions(): Promise<{
  options: MeatOption[];
  pickCount: number;
  defaultMealCount: number;
}> {
  const householdId = await loadPanelHouseholdId();
  const prefs = await listPreferences(householdId);
  const profile = buildPlanningProfile(prefs);
  const excludeSeafood = prefs.some((pref) =>
    /exclude fish|do not include fish|no fish/i.test(
      `${pref.key} ${pref.value}`,
    ),
  );
  const bulkPref = prefs.find((pref) =>
    pref.key.toLowerCase().includes("weekly bulk"),
  );
  const bulkFromPref = bulkPref
    ? Number.parseInt(bulkPref.value, 10)
    : Number.NaN;
  const defaultMealCount =
    Number.isFinite(bulkFromPref) && bulkFromPref > 0 ? bulkFromPref : 4;

  return {
    options: listPanelMeatOptions({ excludeSeafood }),
    pickCount: profile.maxDistinctMeats ?? 3,
    defaultMealCount,
  };
}

/** Recent unique cooked meals for the generate-batch “include past” step. */
export async function loadPastMealsForBatch(): Promise<
  Array<{
    id: string;
    name: string;
    cookedAt: string | null;
    starsDisplay: string | null;
  }>
> {
  const householdId = await loadPanelHouseholdId();
  const { items } = await getMealHistoryWithDetails(householdId, {
    limit: 30,
    sort: "date",
  });

  const seen = new Set<string>();
  const unique: Array<{
    id: string;
    name: string;
    cookedAt: string | null;
    starsDisplay: string | null;
  }> = [];

  for (const row of items) {
    const key = row.meal.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push({
      id: row.meal.id,
      name: row.meal.name,
      cookedAt: row.meal.cookedAt?.toISOString() ?? null,
      starsDisplay: row.starsDisplay,
    });
    if (unique.length >= 20) break;
  }

  return unique;
}

export async function loadRecipe(recipeId: string) {
  const householdId = await loadPanelHouseholdId();
  return getRecipeById(householdId, recipeId);
}

export async function loadMealPlanItemRecipe(mealPlanItemId: string) {
  const householdId = await loadPanelHouseholdId();
  return getMealPlanItemRecipeSnapshot(householdId, mealPlanItemId);
}

export async function loadMealHistory(
  offset: number,
  options: {
    sort?: "date" | "rating";
    meat?: string | null;
  } = {},
) {
  const householdId = await loadPanelHouseholdId();
  const { isHistoryMeatFilter } = await import("@/lib/meals/history-display");
  return getMealHistoryWithDetails(householdId, {
    limit: 10,
    offset,
    sort: options.sort === "rating" ? "rating" : "date",
    meat: isHistoryMeatFilter(options.meat) ? options.meat : null,
  });
}

export async function loadCostSummary() {
  const householdId = await loadPanelHouseholdId();
  return getMonthlyCostSummary(householdId);
}
