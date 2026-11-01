import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  groceryListItems,
  groceryLists,
  mealPlanItems,
  mealPlans,
  recipes,
  scheduleEvents,
  type GroceryList,
  type GroceryListItem,
  type MealPlan,
  type MealPlanItem,
  type Recipe,
  type ScheduleEvent,
} from "@/lib/db/schema";
import {
  ensureDefaultGroceryCategory,
  resolveGroceryCategoryId,
} from "@/lib/planning/grocery-categories";
import {
  addDaysToIsoDate,
  consolidateGroceryNeeds,
  groceryMatchKey,
  groceryNeedsFromRecipe,
  isNonShoppableGroceryName,
  looksLikeInstructionLine,
  looksLikeMealTitleLine,
  mergeQuantityTexts,
  mondayOfWeek,
  stripCulinaryPrep,
  type GroceryNeed,
} from "@/lib/grocery/calculate";
import { getEnv } from "@/lib/env";
import { normalizeIngredientName } from "@/lib/kitchen/normalize";
import {
  baseNormalizedGroceryName,
  cleanGroceryItemName,
  findGroceryItemByName,
  isGroceryVariantLine,
} from "@/lib/kitchen/grocery-list";
import {
  attachCookedAtToMealItems,
  findRecipeByName,
  listCookedMealsSince,
  saveFavoriteRecipe,
} from "@/lib/meals/service";
import { parseStoredInstructionSteps } from "@/lib/recipes/instruction-steps";
import { generateAndSaveRecipe } from "@/lib/ai/recipes";

export type MealSlotType = "breakfast" | "lunch" | "dinner";
export type MealPlanStatus = "active" | "completed";

export async function listActiveMealPlans(
  householdId: string,
): Promise<MealPlan[]> {
  const db = getDb();
  return db
    .select()
    .from(mealPlans)
    .where(
      and(
        eq(mealPlans.householdId, householdId),
        eq(mealPlans.status, "active"),
      ),
    )
    .orderBy(asc(mealPlans.createdAt), asc(mealPlans.weekStartDate));
}

/**
 * Pick CURRENT (oldest active) and optional UPCOMING (second active).
 * Cap: at most two active batches.
 */
export function selectCurrentAndUpcomingPlans(active: MealPlan[]): {
  current: MealPlan | null;
  upcoming: MealPlan | null;
} {
  const sorted = [...active].sort((a, b) => {
    const byCreated = a.createdAt.getTime() - b.createdAt.getTime();
    if (byCreated !== 0) return byCreated;
    return a.weekStartDate.localeCompare(b.weekStartDate);
  });
  return {
    current: sorted[0] ?? null,
    upcoming: sorted[1] ?? null,
  };
}

export type NewMealBatchMode =
  | "create_current"
  | "create_upcoming"
  | "replace_current"
  | "replace_upcoming";

/** How generating a new batch should interact with existing active plans. */
export function resolveNewMealBatchMode(
  active: MealPlan[],
  options: { replaceExisting?: boolean } = {},
): NewMealBatchMode {
  const { current, upcoming } = selectCurrentAndUpcomingPlans(active);
  if (!current) return "create_current";
  if (upcoming) return "replace_upcoming";
  if (options.replaceExisting) return "replace_current";
  return "create_upcoming";
}

async function loadPlanItems(plan: MealPlan): Promise<{
  plan: MealPlan;
  items: MealPlanItem[];
}> {
  const db = getDb();
  const items = await db
    .select()
    .from(mealPlanItems)
    .where(eq(mealPlanItems.mealPlanId, plan.id))
    .orderBy(asc(mealPlanItems.mealDate), asc(mealPlanItems.sortOrder));
  return { plan, items };
}

/** CURRENT batch: oldest active plan (the one you’re cooking through). */
export async function getCurrentWeeklyPlan(
  householdId: string,
): Promise<{ plan: MealPlan; items: MealPlanItem[] } | null> {
  const active = await listActiveMealPlans(householdId);
  const { current } = selectCurrentAndUpcomingPlans(active);
  if (!current) return null;
  return loadPlanItems(current);
}

/**
 * UPCOMING batch: second active plan for planning ahead / grocery foresight.
 */
export async function getUpcomingWeeklyPlan(
  householdId: string,
): Promise<{ plan: MealPlan; items: MealPlanItem[] } | null> {
  const active = await listActiveMealPlans(householdId);
  const { upcoming } = selectCurrentAndUpcomingPlans(active);
  if (!upcoming) return null;
  return loadPlanItems(upcoming);
}

/**
 * Prefer UPCOMING for edits when present, else CURRENT.
 * Both active batches are editable; this is the default edit target.
 */
export async function getEditableWeeklyPlan(
  householdId: string,
): Promise<{ plan: MealPlan; items: MealPlanItem[] } | null> {
  const upcoming = await getUpcomingWeeklyPlan(householdId);
  if (upcoming) return upcoming;
  return getCurrentWeeklyPlan(householdId);
}

/**
 * Free a slot for a new active batch. With one active, creates UPCOMING unless
 * replaceExisting archives the current. With two actives, replace upcoming only.
 */
export async function prepareSlotForNewMealBatch(
  householdId: string,
  options: { replaceExisting?: boolean } = {},
): Promise<
  | { ok: true; mode: NewMealBatchMode }
  | { ok: false; mode: NewMealBatchMode; needsReplaceConfirm: true; error: string }
> {
  const active = await listActiveMealPlans(householdId);
  const mode = resolveNewMealBatchMode(active, options);

  if (mode === "create_current" || mode === "create_upcoming") {
    return { ok: true, mode };
  }

  if (!options.replaceExisting) {
    const error =
      mode === "replace_upcoming"
        ? "An upcoming meal batch already exists. Confirm to replace it."
        : "A meal batch already exists. Confirm to replace it.";
    return { ok: false, mode, needsReplaceConfirm: true, error };
  }

  if (mode === "replace_upcoming") {
    const { upcoming } = selectCurrentAndUpcomingPlans(active);
    if (upcoming) {
      await completeMealPlanById(householdId, upcoming.id);
    }
  } else {
    await archiveActiveMealPlans(householdId);
  }
  return { ok: true, mode };
}

export async function createWeeklyPlan(input: {
  householdId: string;
  weekStartDate?: string;
  title?: string;
  notes?: string;
  status?: MealPlanStatus;
  items: Array<{
    mealDate: string;
    mealType?: MealSlotType;
    title: string;
    recipeName?: string;
    notes?: string;
    sortOrder?: number;
  }>;
}): Promise<{ plan: MealPlan; items: MealPlanItem[] }> {
  const db = getDb();
  const weekStart =
    input.weekStartDate ?? mondayOfWeek(new Date(), getEnv().HOUSEHOLD_TIMEZONE);

  const [plan] = await db
    .insert(mealPlans)
    .values({
      householdId: input.householdId,
      weekStartDate: weekStart,
      title: input.title ?? `Week of ${weekStart}`,
      notes: input.notes ?? null,
      status: input.status ?? "active",
    })
    .returning();

  const createdItems: MealPlanItem[] = [];
  for (const [index, item] of input.items.entries()) {
    let recipeId: string | null = null;
    if (item.recipeName) {
      const recipe =
        (await findRecipeByName(input.householdId, item.recipeName)) ??
        (await saveFavoriteRecipe({
          householdId: input.householdId,
          name: item.recipeName,
        }));
      recipeId = recipe.id;
    }

    const [row] = await db
      .insert(mealPlanItems)
      .values({
        mealPlanId: plan.id,
        householdId: input.householdId,
        mealDate: item.mealDate,
        mealType: item.mealType ?? "dinner",
        title: item.title,
        recipeId,
        notes: item.notes ?? null,
        sortOrder: item.sortOrder ?? index,
      })
      .returning();
    createdItems.push(row);
  }

  return { plan, items: createdItems };
}

export async function modifyWeeklyPlanItem(input: {
  householdId: string;
  mealPlanId?: string;
  /** Prefer for numbered meal batches (“Meal 2”). */
  mealNumber?: number;
  mealDate?: string;
  mealType?: MealSlotType;
  title?: string | null;
  notes?: string | null;
  remove?: boolean;
  recipeName?: string | null;
}): Promise<MealPlanItem | null> {
  const current = input.mealPlanId
    ? await getPlanById(input.householdId, input.mealPlanId)
    : (await getEditableWeeklyPlan(input.householdId)) ??
      (await getCurrentWeeklyPlan(input.householdId));
  if (!current) {
    return null;
  }

  const mealType = input.mealType ?? "dinner";
  let mealDate = input.mealDate?.trim() || null;

  if (input.mealNumber != null) {
    const dinners = current.items
      .filter((item) => item.mealType === "dinner")
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder || a.mealDate.localeCompare(b.mealDate),
      );
    const target = dinners[input.mealNumber - 1];
    if (!target) return null;
    mealDate = target.mealDate;
  }

  if (!mealDate) return null;

  const existing = current.items.find(
    (item) => item.mealDate === mealDate && item.mealType === mealType,
  );

  const db = getDb();
  if (input.remove) {
    if (!existing) return null;
    await db.delete(mealPlanItems).where(eq(mealPlanItems.id, existing.id));
    return existing;
  }

  let recipeId = existing?.recipeId ?? null;
  if (input.recipeName) {
    const recipe =
      (await findRecipeByName(input.householdId, input.recipeName)) ??
      (await saveFavoriteRecipe({
        householdId: input.householdId,
        name: input.recipeName,
      }));
    recipeId = recipe.id;
  }

  if (existing) {
    const [updated] = await db
      .update(mealPlanItems)
      .set({
        title: input.title ?? existing.title,
        notes: input.notes === undefined ? existing.notes : input.notes,
        recipeId,
        updatedAt: new Date(),
      })
      .where(eq(mealPlanItems.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(mealPlanItems)
    .values({
      mealPlanId: current.plan.id,
      householdId: input.householdId,
      mealDate,
      mealType,
      title: input.title ?? "TBD",
      notes: input.notes ?? null,
      recipeId,
    })
    .returning();
  return created;
}

/** Count dinner slots that still lack ingredient text after recipe ensure. */
async function countDinnerMealsMissingRecipes(
  householdId: string,
  mealPlanId?: string,
): Promise<number> {
  const target = mealPlanId
    ? await getPlanById(householdId, mealPlanId)
    : await getEditableWeeklyPlan(householdId);
  if (!target) return 0;

  const dinners = target.items.filter((item) => item.mealType === "dinner");
  const recipeIds = dinners
    .map((item) => item.recipeId)
    .filter((id): id is string => Boolean(id));
  const db = getDb();
  const recipeRows =
    recipeIds.length > 0
      ? await db
          .select({ id: recipes.id, ingredientsText: recipes.ingredientsText })
          .from(recipes)
          .where(inArray(recipes.id, recipeIds))
      : [];
  const readyIds = new Set(
    recipeRows
      .filter((row) => Boolean(row.ingredientsText?.trim()))
      .map((row) => row.id),
  );
  return dinners.filter(
    (item) => !item.recipeId || !readyIds.has(item.recipeId),
  ).length;
}

/**
 * Generate full recipes for every dinner in a meal batch that still needs one.
 * Safe to call repeatedly — ready recipes are skipped.
 */
export async function ensureRecipesForCurrentMealBatch(
  householdId: string,
  mealPlanId?: string,
): Promise<{ recipesGenerated: number; mealsMissingRecipes: number }> {
  const target = mealPlanId
    ? await getPlanById(householdId, mealPlanId)
    : await getEditableWeeklyPlan(householdId);
  if (!target) {
    return { recipesGenerated: 0, mealsMissingRecipes: 0 };
  }

  const dinners = target.items.filter((item) => item.mealType === "dinner");
  const results = await Promise.all(
    dinners.map((dinner) =>
      ensureFullRecipeForMealPlanItem(householdId, dinner.id),
    ),
  );
  const recipesGenerated = results.filter((row) => row?.generated).length;
  const mealsMissingRecipes = await countDinnerMealsMissingRecipes(
    householdId,
    target.plan.id,
  );
  return { recipesGenerated, mealsMissingRecipes };
}

/**
 * Ensure recipes for a batch and return grocery candidates (no status change).
 */
export async function prepareGroceryCandidatesFromPlan(
  householdId: string,
  mealPlanId?: string,
): Promise<{
  plan: MealPlan;
  recipesGenerated: number;
  mealsMissingRecipes: number;
  candidates: GroceryNeed[];
} | null> {
  const target = mealPlanId
    ? await getPlanById(householdId, mealPlanId)
    : await getEditableWeeklyPlan(householdId);
  if (!target) return null;

  const ensured = await ensureRecipesForCurrentMealBatch(
    householdId,
    target.plan.id,
  );
  const preview = await previewGroceryNeedsFromPlan(
    householdId,
    target.plan.id,
  );
  const mealsMissingRecipes = await countDinnerMealsMissingRecipes(
    householdId,
    target.plan.id,
  );

  return {
    plan: target.plan,
    recipesGenerated: ensured.recipesGenerated,
    mealsMissingRecipes,
    candidates: preview.candidates,
  };
}

/** Ensure recipes and replace the default Grocery category from this batch. */
export async function mergeGroceriesFromMealPlan(
  householdId: string,
  mealPlanId?: string,
): Promise<{
  plan: MealPlan;
  groceryItems: GroceryListItem[];
  added: string[];
  skipped: string[];
  recipesGenerated: number;
  mealsMissingRecipes: number;
} | null> {
  const prepared = await prepareGroceryCandidatesFromPlan(
    householdId,
    mealPlanId,
  );
  if (!prepared) return null;

  const generated = await generateGroceryListFromPlan(
    householdId,
    prepared.plan.id,
  );

  return {
    plan: prepared.plan,
    groceryItems: generated.items,
    added: generated.added,
    skipped: generated.skipped,
    recipesGenerated: prepared.recipesGenerated,
    mealsMissingRecipes: prepared.mealsMissingRecipes,
  };
}

/** Mark a meal plan completed (archived). */
export async function completeMealPlanById(
  householdId: string,
  mealPlanId: string,
): Promise<MealPlan | null> {
  const db = getDb();
  const [updated] = await db
    .update(mealPlans)
    .set({ status: "completed", updatedAt: new Date() })
    .where(
      and(eq(mealPlans.id, mealPlanId), eq(mealPlans.householdId, householdId)),
    )
    .returning();
  return updated ?? null;
}

/** Finish CURRENT so UPCOMING (if any) becomes the new current. */
export async function completeCurrentMealBatch(
  householdId: string,
): Promise<MealPlan | null> {
  const current = await getCurrentWeeklyPlan(householdId);
  if (!current) return null;
  return completeMealPlanById(householdId, current.plan.id);
}

/** Archive all active plans. */
export async function archiveActiveMealPlans(
  householdId: string,
): Promise<number> {
  const db = getDb();
  const updated = await db
    .update(mealPlans)
    .set({ status: "completed", updatedAt: new Date() })
    .where(
      and(
        eq(mealPlans.householdId, householdId),
        eq(mealPlans.status, "active"),
      ),
    )
    .returning({ id: mealPlans.id });
  return updated.length;
}

export async function removeMealPlanItemById(
  householdId: string,
  mealPlanItemId: string,
): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .delete(mealPlanItems)
    .where(
      and(
        eq(mealPlanItems.id, mealPlanItemId),
        eq(mealPlanItems.householdId, householdId),
      ),
    )
    .returning({ id: mealPlanItems.id });
  return deleted.length > 0;
}

export async function addDinnerToCurrentPlan(input: {
  householdId: string;
  title: string;
}): Promise<MealPlanItem | null> {
  const current = await getEditableWeeklyPlan(input.householdId);
  if (!current) return null;

  const title = input.title.trim();
  if (!title) return null;

  const dinners = current.items.filter((item) => item.mealType === "dinner");
  const weekStart = current.plan.weekStartDate;
  const mealDate = addDaysToIsoDate(weekStart, dinners.length);
  const maxSort = dinners.reduce(
    (max, item) => Math.max(max, item.sortOrder),
    -1,
  );

  const recipe =
    (await findRecipeByName(input.householdId, title)) ??
    (await saveFavoriteRecipe({
      householdId: input.householdId,
      name: title,
    }));

  const db = getDb();
  const [created] = await db
    .insert(mealPlanItems)
    .values({
      mealPlanId: current.plan.id,
      householdId: input.householdId,
      mealDate,
      mealType: "dinner",
      title,
      recipeId: recipe.id,
      sortOrder: maxSort + 1,
    })
    .returning();
  return created ?? null;
}

async function getPlanById(householdId: string, mealPlanId: string) {
  const db = getDb();
  const plans = await db
    .select()
    .from(mealPlans)
    .where(
      and(eq(mealPlans.id, mealPlanId), eq(mealPlans.householdId, householdId)),
    )
    .limit(1);
  const plan = plans[0];
  if (!plan) return null;
  const items = await db
    .select()
    .from(mealPlanItems)
    .where(eq(mealPlanItems.mealPlanId, plan.id))
    .orderBy(asc(mealPlanItems.mealDate), asc(mealPlanItems.sortOrder));
  return { plan, items };
}

export function formatWeeklyPlanForPrompt(
  plan: MealPlan,
  items: MealPlanItem[],
): string {
  const lines = [
    `Plan: ${plan.title ?? plan.weekStartDate} [${plan.status}]`,
  ];
  const dinners = items
    .filter((item) => item.mealType === "dinner")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.mealDate.localeCompare(b.mealDate));

  dinners.forEach((item, index) => {
    lines.push(
      `- Meal ${index + 1} [${item.mealDate}]: ${item.title}${item.notes ? ` — ${item.notes}` : ""}`,
    );
  });

  for (const item of items.filter((row) => row.mealType !== "dinner")) {
    lines.push(
      `- ${item.mealType}: ${item.title}${item.notes ? ` — ${item.notes}` : ""}`,
    );
  }

  return lines.join("\n");
}

export async function addScheduleEvent(input: {
  householdId: string;
  eventDate: string;
  title: string;
  notes?: string | null;
  skipDinner?: boolean;
  skipLunch?: boolean;
  skipBreakfast?: boolean;
}): Promise<ScheduleEvent> {
  const db = getDb();
  const [created] = await db
    .insert(scheduleEvents)
    .values({
      householdId: input.householdId,
      eventDate: input.eventDate,
      title: input.title,
      notes: input.notes ?? null,
      skipDinner: input.skipDinner ?? false,
      skipLunch: input.skipLunch ?? false,
      skipBreakfast: input.skipBreakfast ?? false,
    })
    .returning();
  return created;
}

export async function listScheduleEvents(
  householdId: string,
  fromDate?: string,
  toDate?: string,
): Promise<ScheduleEvent[]> {
  const db = getDb();
  const start =
    fromDate ?? mondayOfWeek(new Date(), getEnv().HOUSEHOLD_TIMEZONE);
  const end = toDate ?? addDaysToIsoDate(start, 14);
  return db
    .select()
    .from(scheduleEvents)
    .where(
      and(
        eq(scheduleEvents.householdId, householdId),
        gte(scheduleEvents.eventDate, start),
        lte(scheduleEvents.eventDate, end),
      ),
    )
    .orderBy(asc(scheduleEvents.eventDate));
}

export async function removeScheduleEvent(
  householdId: string,
  eventDate: string,
  title?: string,
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select()
    .from(scheduleEvents)
    .where(
      and(
        eq(scheduleEvents.householdId, householdId),
        eq(scheduleEvents.eventDate, eventDate),
      ),
    );
  const targets = title
    ? rows.filter(
        (row) =>
          normalizeIngredientName(row.title) === normalizeIngredientName(title),
      )
    : rows;
  for (const row of targets) {
    await db.delete(scheduleEvents).where(eq(scheduleEvents.id, row.id));
  }
  return targets.length;
}

export async function getActiveGroceryList(
  householdId: string,
): Promise<{ list: GroceryList; items: GroceryListItem[] } | null> {
  await ensureDefaultGroceryCategory(householdId);
  const db = getDb();
  const lists = await db
    .select()
    .from(groceryLists)
    .where(
      and(
        eq(groceryLists.householdId, householdId),
        eq(groceryLists.status, "active"),
      ),
    )
    .orderBy(desc(groceryLists.updatedAt))
    .limit(1);
  const list = lists[0];
  if (!list) return null;
  const items = await db
    .select()
    .from(groceryListItems)
    .where(eq(groceryListItems.groceryListId, list.id))
    .orderBy(asc(groceryListItems.name));
  return { list, items };
}

export async function addGroceryItem(input: {
  householdId: string;
  name: string;
  quantityText?: string | null;
  notes?: string | null;
  category?: string | null;
}): Promise<GroceryListItem> {
  const db = getDb();
  const categoryId = await resolveGroceryCategoryId(
    input.householdId,
    input.category,
  );
  let active = await getActiveGroceryList(input.householdId);
  if (!active) {
    const [list] = await db
      .insert(groceryLists)
      .values({
        householdId: input.householdId,
        title: "Grocery list",
        status: "active",
      })
      .returning();
    active = { list, items: [] };
  }

  const normalizedName = baseNormalizedGroceryName(input.name);
  const displayName =
    stripCulinaryPrep(cleanGroceryItemName(input.name)) ||
    cleanGroceryItemName(input.name);
  if (
    !displayName ||
    isGroceryVariantLine(displayName) ||
    looksLikeInstructionLine(displayName) ||
    looksLikeMealTitleLine(displayName) ||
    isNonShoppableGroceryName(displayName)
  ) {
    throw new Error(`Invalid grocery list item: "${input.name}"`);
  }

  const existing = active.items.find(
    (item) => item.normalizedName === normalizedName,
  );
  if (existing) {
    const [updated] = await db
      .update(groceryListItems)
      .set({
        name: displayName,
        quantityText: input.quantityText ?? existing.quantityText,
        notes: input.notes ?? existing.notes,
        categoryId: input.category != null ? categoryId : existing.categoryId,
        updatedAt: new Date(),
      })
      .where(eq(groceryListItems.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(groceryListItems)
    .values({
      groceryListId: active.list.id,
      householdId: input.householdId,
      categoryId,
      name: displayName,
      normalizedName,
      quantityText: input.quantityText ?? null,
      notes: input.notes ?? null,
    })
    .returning();
  return created;
}

export async function removeGroceryItem(
  householdId: string,
  name: string,
): Promise<boolean> {
  const active = await getActiveGroceryList(householdId);
  if (!active) return false;
  const existing = findGroceryItemByName(active.items, name);
  if (!existing) return false;
  const db = getDb();
  await db.delete(groceryListItems).where(eq(groceryListItems.id, existing.id));
  return true;
}

export async function removeGroceryItemById(
  householdId: string,
  itemId: string,
): Promise<boolean> {
  const active = await getActiveGroceryList(householdId);
  if (!active) return false;
  const existing = active.items.find((item) => item.id === itemId);
  if (!existing) return false;
  const db = getDb();
  await db.delete(groceryListItems).where(eq(groceryListItems.id, existing.id));
  return true;
}

/** Remove multiple grocery lines in one pass (exact or fuzzy normalized match). */
export async function removeGroceryItems(
  householdId: string,
  names: string[],
): Promise<{ removed: string[]; notFound: string[] }> {
  const removed: string[] = [];
  const notFound: string[] = [];
  for (const name of names) {
    const didRemove = await removeGroceryItem(householdId, name);
    if (didRemove) removed.push(name);
    else notFound.push(name);
  }
  return { removed, notFound };
}

/** Clear default-category grocery lines; optionally keep only named items. Other categories are untouched. */
export async function clearGroceryList(
  householdId: string,
  keepNames: string[] = [],
): Promise<{ removed: number; items: GroceryListItem[] }> {
  const active = await getActiveGroceryList(householdId);
  if (!active) return { removed: 0, items: [] };

  const defaultCategory = await ensureDefaultGroceryCategory(householdId);
  const keep = new Set(
    keepNames.flatMap((name) => [
      normalizeIngredientName(name),
      baseNormalizedGroceryName(name),
    ]),
  );

  const db = getDb();
  let removed = 0;
  for (const item of active.items) {
    if (item.categoryId !== defaultCategory.id) continue;
    if (keep.has(item.normalizedName)) continue;
    await db.delete(groceryListItems).where(eq(groceryListItems.id, item.id));
    removed += 1;
  }

  const updated = await getActiveGroceryList(householdId);
  return { removed, items: updated?.items ?? [] };
}

/** Replace default-category items only; preserve other categories on the active list. */
export async function setGroceryList(
  householdId: string,
  items: Array<{
    name: string;
    quantityText?: string | null;
    notes?: string | null;
  }>,
): Promise<{ list: GroceryList; items: GroceryListItem[] }> {
  const db = getDb();
  const defaultCategory = await ensureDefaultGroceryCategory(householdId);

  let active = await getActiveGroceryList(householdId);
  if (!active) {
    const [list] = await db
      .insert(groceryLists)
      .values({
        householdId,
        title: "Grocery list",
        status: "active",
      })
      .returning();
    active = { list, items: [] };
  }

  for (const item of active.items) {
    if (item.categoryId !== defaultCategory.id) continue;
    await db.delete(groceryListItems).where(eq(groceryListItems.id, item.id));
  }

  const seen = new Set(
    active.items
      .filter((item) => item.categoryId !== defaultCategory.id)
      .map((item) => item.normalizedName),
  );

  for (const item of items) {
    const name = cleanGroceryItemName(item.name);
    if (!name || isGroceryVariantLine(name)) continue;
    const normalizedName = baseNormalizedGroceryName(name);
    if (seen.has(normalizedName)) continue;
    seen.add(normalizedName);

    await db.insert(groceryListItems).values({
      groceryListId: active.list.id,
      householdId,
      categoryId: defaultCategory.id,
      name,
      normalizedName,
      quantityText: item.quantityText ?? null,
      notes: item.notes ?? null,
    });
  }

  const updated = await getActiveGroceryList(householdId);
  return { list: active.list, items: updated?.items ?? [] };
}

/** Collapse duplicate lines and strip catalog-variant junk from the grocery list. */
export async function tidyGroceryList(householdId: string): Promise<{
  merged: string[];
  removed: string[];
  items: GroceryListItem[];
}> {
  const active = await getActiveGroceryList(householdId);
  if (!active) return { merged: [], removed: [], items: [] };

  const db = getDb();
  const groups = new Map<string, GroceryListItem[]>();

  for (const item of active.items) {
    const key = groceryMatchKey(item.name);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  const merged: string[] = [];
  const removed: string[] = [];

  for (const [, group] of groups) {
    const sorted = [...group].sort((a, b) => {
      const aJunk =
        (isGroceryVariantLine(a.name) ? 1 : 0) +
        (looksLikeInstructionLine(a.name) ? 2 : 0) +
        (looksLikeMealTitleLine(a.name) ? 2 : 0);
      const bJunk =
        (isGroceryVariantLine(b.name) ? 1 : 0) +
        (looksLikeInstructionLine(b.name) ? 2 : 0) +
        (looksLikeMealTitleLine(b.name) ? 2 : 0);
      if (aJunk !== bJunk) return aJunk - bJunk;
      return a.name.length - b.name.length;
    });
    const keeper = sorted[0]!;

    if (
      looksLikeMealTitleLine(keeper.name) ||
      looksLikeInstructionLine(keeper.name)
    ) {
      for (const item of sorted) {
        await db
          .delete(groceryListItems)
          .where(eq(groceryListItems.id, item.id));
        removed.push(item.name);
      }
      continue;
    }

    const cleanName =
      stripCulinaryPrep(cleanGroceryItemName(keeper.name)) || keeper.name;
    let quantityText = keeper.quantityText;
    for (const duplicate of sorted.slice(1)) {
      quantityText = mergeQuantityTexts(quantityText, duplicate.quantityText);
    }
    const normalizedName = baseNormalizedGroceryName(cleanName);

    if (
      keeper.name !== cleanName ||
      keeper.normalizedName !== normalizedName ||
      keeper.quantityText !== quantityText
    ) {
      await db
        .update(groceryListItems)
        .set({
          name: cleanName,
          normalizedName,
          quantityText,
          updatedAt: new Date(),
        })
        .where(eq(groceryListItems.id, keeper.id));
    }

    for (const duplicate of sorted.slice(1)) {
      await db
        .delete(groceryListItems)
        .where(eq(groceryListItems.id, duplicate.id));
      removed.push(duplicate.name);
    }

    if (sorted.length > 1) merged.push(cleanName);
  }

  const updated = await getActiveGroceryList(householdId);
  return { merged, removed, items: updated?.items ?? [] };
}

export async function updateGroceryListItemById(
  householdId: string,
  itemId: string,
  input: {
    name: string;
    quantityText?: string | null;
    notes?: string | null;
    categoryId?: string | null;
  },
): Promise<GroceryListItem | null> {
  const active = await getActiveGroceryList(householdId);
  if (!active) return null;

  const existing = active.items.find((item) => item.id === itemId);
  if (!existing) return null;

  const displayName = cleanGroceryItemName(input.name);
  if (!displayName || isGroceryVariantLine(displayName)) {
    throw new Error(`Invalid grocery list item: "${input.name}"`);
  }

  let categoryId = existing.categoryId;
  if (input.categoryId != null && input.categoryId !== "") {
    categoryId = await resolveGroceryCategoryId(householdId, input.categoryId);
  }

  const db = getDb();
  const [updated] = await db
    .update(groceryListItems)
    .set({
      name: displayName,
      normalizedName: baseNormalizedGroceryName(displayName),
      quantityText: input.quantityText ?? existing.quantityText,
      notes: input.notes ?? existing.notes,
      categoryId,
      updatedAt: new Date(),
    })
    .where(eq(groceryListItems.id, itemId))
    .returning();

  return updated;
}

export async function moveGroceryItem(input: {
  householdId: string;
  name: string;
  category: string;
}): Promise<GroceryListItem | null> {
  const active = await getActiveGroceryList(input.householdId);
  if (!active) return null;

  const existing = findGroceryItemByName(active.items, input.name);
  if (!existing) return null;

  const categoryId = await resolveGroceryCategoryId(
    input.householdId,
    input.category,
  );
  const db = getDb();
  const [updated] = await db
    .update(groceryListItems)
    .set({ categoryId, updatedAt: new Date() })
    .where(eq(groceryListItems.id, existing.id))
    .returning();
  return updated ?? null;
}

export async function getWeeklyPlanWithRecipes(
  householdId: string,
  planBundle: { plan: MealPlan; items: MealPlanItem[] },
): Promise<{
  plan: MealPlan;
  items: Array<
    MealPlanItem & { recipe: Recipe | null; cookedAt: Date | null }
  >;
}> {
  const db = getDb();
  const recipeIds = [
    ...new Set(
      planBundle.items
        .map((item) => item.recipeId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const recipeRows =
    recipeIds.length > 0
      ? await db
          .select()
          .from(recipes)
          .where(
            and(
              eq(recipes.householdId, householdId),
              inArray(recipes.id, recipeIds),
            ),
          )
      : [];

  const recipeById = new Map(recipeRows.map((recipe) => [recipe.id, recipe]));

  const cookedHistory = await listCookedMealsSince(
    householdId,
    planBundle.plan.weekStartDate,
  );

  const withRecipes = planBundle.items.map((item) => ({
    ...item,
    recipe: item.recipeId ? recipeById.get(item.recipeId) ?? null : null,
  }));

  return {
    plan: planBundle.plan,
    items: attachCookedAtToMealItems(withRecipes, cookedHistory),
  };
}

export async function getCurrentWeeklyPlanWithRecipes(
  householdId: string,
): Promise<{
  plan: MealPlan;
  items: Array<
    MealPlanItem & { recipe: Recipe | null; cookedAt: Date | null }
  >;
} | null> {
  const current = await getCurrentWeeklyPlan(householdId);
  if (!current) return null;
  return getWeeklyPlanWithRecipes(householdId, current);
}

export async function getUpcomingWeeklyPlanWithRecipes(
  householdId: string,
): Promise<{
  plan: MealPlan;
  items: Array<
    MealPlanItem & { recipe: Recipe | null; cookedAt: Date | null }
  >;
} | null> {
  const upcoming = await getUpcomingWeeklyPlan(householdId);
  if (!upcoming) return null;
  return getWeeklyPlanWithRecipes(householdId, upcoming);
}

function recipeHasCookableContent(recipe: Recipe): boolean {
  return Boolean(
    recipe.ingredientsText?.trim() && recipe.instructionsText?.trim(),
  );
}

function recipeHasStructuredSteps(recipe: Recipe): boolean {
  const steps = parseStoredInstructionSteps(recipe.instructionSteps);
  return Boolean(steps && steps.length > 0);
}

function recipeIsReady(recipe: Recipe): boolean {
  return recipeHasCookableContent(recipe) && recipeHasStructuredSteps(recipe);
}

async function loadMealPlanItemWithRecipe(
  householdId: string,
  mealPlanItemId: string,
): Promise<{
  item: MealPlanItem;
  recipe: Recipe | null;
  planNotes: string | null;
} | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(mealPlanItems)
    .where(
      and(
        eq(mealPlanItems.id, mealPlanItemId),
        eq(mealPlanItems.householdId, householdId),
      ),
    )
    .limit(1);
  const item = rows[0];
  if (!item) return null;

  const planRows = await db
    .select({ notes: mealPlans.notes })
    .from(mealPlans)
    .where(
      and(eq(mealPlans.id, item.mealPlanId), eq(mealPlans.householdId, householdId)),
    )
    .limit(1);
  const planNotes = planRows[0]?.notes?.trim() || null;

  let recipe: Recipe | null = null;
  if (item.recipeId) {
    const found = await db
      .select()
      .from(recipes)
      .where(
        and(eq(recipes.id, item.recipeId), eq(recipes.householdId, householdId)),
      )
      .limit(1);
    recipe = found[0] ?? null;
  }
  if (!recipe) {
    recipe = await findRecipeByName(householdId, item.title);
  }

  return { item, recipe, planNotes };
}

/** Fast read for the panel — never calls the AI. */
export async function getMealPlanItemRecipeSnapshot(
  householdId: string,
  mealPlanItemId: string,
): Promise<{
  item: MealPlanItem;
  recipe: Recipe | null;
  ready: boolean;
  cookedAt: Date | null;
} | null> {
  const loaded = await loadMealPlanItemWithRecipe(householdId, mealPlanItemId);
  if (!loaded) return null;

  const { item, recipe } = loaded;
  const current = await getCurrentWeeklyPlan(householdId);
  const cookedHistory = current
    ? await listCookedMealsSince(householdId, current.plan.weekStartDate)
    : [];
  const [{ cookedAt }] = attachCookedAtToMealItems(
    [{ ...item, recipe }],
    cookedHistory,
  );

  if (recipe && recipeIsReady(recipe)) {
    if (item.recipeId !== recipe.id) {
      const db = getDb();
      await db
        .update(mealPlanItems)
        .set({ recipeId: recipe.id, updatedAt: new Date() })
        .where(eq(mealPlanItems.id, item.id));
    }
    return { item, recipe, ready: true, cookedAt };
  }

  return { item, recipe, ready: false, cookedAt };
}

/** Load a meal-batch item and ensure a full recipe exists (generate if missing). */
export async function ensureFullRecipeForMealPlanItem(
  householdId: string,
  mealPlanItemId: string,
): Promise<{
  item: MealPlanItem;
  recipe: Recipe;
  generated: boolean;
} | null> {
  const loaded = await loadMealPlanItemWithRecipe(householdId, mealPlanItemId);
  if (!loaded) return null;

  const { item } = loaded;
  const { recipe } = loaded;

  if (recipe && recipeIsReady(recipe)) {
    if (item.recipeId !== recipe.id) {
      const db = getDb();
      await db
        .update(mealPlanItems)
        .set({ recipeId: recipe.id, updatedAt: new Date() })
        .where(eq(mealPlanItems.id, item.id));
    }
    return { item, recipe, generated: false };
  }

  const generated = await generateAndSaveRecipe({
    householdId,
    prompt: `Create a full dinner recipe for: ${item.title}`,
    context: [
      item.notes ? `Meal notes: ${item.notes}` : null,
      loaded.planNotes
        ? `Meal batch planning notes (honor Use: items when relevant to this dish): ${loaded.planNotes}`
        : null,
      recipe?.summary ? `Previous summary: ${recipe.summary}` : null,
      recipe?.ingredientsText
        ? `Previous ingredients:\n${recipe.ingredientsText}`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n") || undefined,
    preferredName: item.title,
    markFavorite: recipe?.isFavorite ?? false,
  });

  const db = getDb();
  const savedRows = await db
    .select()
    .from(recipes)
    .where(eq(recipes.id, generated.recipeId))
    .limit(1);
  const saved = savedRows[0];
  if (!saved) {
    throw new Error("Recipe was generated but could not be loaded from the database.");
  }

  await db
    .update(mealPlanItems)
    .set({ recipeId: saved.id, updatedAt: new Date() })
    .where(eq(mealPlanItems.id, item.id));

  return { item, recipe: saved, generated: true };
}

/**
 * Every shoppable recipe need for a meal batch, consolidated.
 * Defaults to the CURRENT batch when mealPlanId is omitted.
 * Does not look at the existing grocery list.
 */
export async function previewGroceryNeedsFromPlan(
  householdId: string,
  mealPlanId?: string,
): Promise<{
  candidates: GroceryNeed[];
}> {
  const target = mealPlanId
    ? await getPlanById(householdId, mealPlanId)
    : await getCurrentWeeklyPlan(householdId);

  const needs: GroceryNeed[] = [];
  if (target) {
    const db = getDb();
    const dinners = target.items
      .filter((item) => item.mealType === "dinner")
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder || a.mealDate.localeCompare(b.mealDate),
      );
    const mealLabel = new Map(
      dinners.map((item, index) => [item.id, `Meal ${index + 1}`]),
    );

    for (const item of target.items) {
      let recipe: Recipe | null = null;
      if (item.recipeId) {
        const recipeRows = await db
          .select()
          .from(recipes)
          .where(eq(recipes.id, item.recipeId))
          .limit(1);
        recipe = recipeRows[0] ?? null;
      }
      if (!recipe) {
        recipe = await findRecipeByName(householdId, item.title);
      }
      if (!recipe) continue;
      const label = mealLabel.get(item.id) ?? item.title;
      needs.push(
        ...groceryNeedsFromRecipe(recipe).map((need) => ({
          ...need,
          meals: [label],
        })),
      );
    }
  }

  return {
    candidates: consolidateGroceryNeeds(needs),
  };
}

/**
 * Replace the default Grocery category with this batch's full ingredient list.
 * Other categories stay. Each generation is a fresh list.
 */
export async function generateGroceryListFromPlan(
  householdId: string,
  mealPlanId?: string,
): Promise<{
  list: GroceryList;
  items: GroceryListItem[];
  needs: GroceryNeed[];
  added: string[];
  skipped: string[];
}> {
  const preview = await previewGroceryNeedsFromPlan(householdId, mealPlanId);
  const db = getDb();
  const target = mealPlanId
    ? await getPlanById(householdId, mealPlanId)
    : await getCurrentWeeklyPlan(householdId);

  let active = await getActiveGroceryList(householdId);
  if (!active) {
    const [list] = await db
      .insert(groceryLists)
      .values({
        householdId,
        mealPlanId: target?.plan.id ?? null,
        title: target
          ? `Groceries for ${target.plan.weekStartDate}`
          : "Grocery list",
        status: "active",
      })
      .returning();
    active = { list, items: [] };
  } else if (target?.plan.id) {
    await db
      .update(groceryLists)
      .set({
        mealPlanId: target.plan.id,
        title: `Groceries for ${target.plan.weekStartDate}`,
        updatedAt: new Date(),
      })
      .where(eq(groceryLists.id, active.list.id));
  }

  const written = await setGroceryList(
    householdId,
    preview.candidates.map((need) => ({
      name: need.name,
      quantityText: need.quantityText,
    })),
  );

  return {
    list: written.list,
    items: written.items,
    needs: preview.candidates,
    added: preview.candidates.map((item) => item.name),
    skipped: [],
  };
}

export function formatGroceryListForPrompt(items: GroceryListItem[]): string {
  if (items.length === 0) return "Grocery list is empty.";
  return items
    .map((item) => {
      const qty = item.quantityText ? ` — ${item.quantityText}` : "";
      return `- ${item.name}${qty}`;
    })
    .join("\n");
}
