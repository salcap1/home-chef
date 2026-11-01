import { and, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  mealFeedback,
  mealHistory,
  recipes,
  type MealFeedback,
  type MealHistory,
  type Recipe,
} from "@/lib/db/schema";
import { normalizeIngredientName } from "@/lib/kitchen/normalize";
import {
  meatEmojiForMeal,
  meatFilterIlikePatterns,
  primaryProteinClass,
  type HistoryMeatFilter,
} from "@/lib/meals/history-display";
import {
  formatStarsDisplay,
  sentimentToStars,
  type FeedbackSentiment,
  type StarRating,
} from "@/lib/meals/rating";

export type { FeedbackSentiment };

export async function findRecipeByName(
  householdId: string,
  name: string,
): Promise<Recipe | null> {
  const db = getDb();
  const normalizedName = normalizeIngredientName(name);
  const rows = await db
    .select()
    .from(recipes)
    .where(
      and(
        eq(recipes.householdId, householdId),
        eq(recipes.normalizedName, normalizedName),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listFavoriteRecipes(
  householdId: string,
): Promise<Recipe[]> {
  const db = getDb();
  return db
    .select()
    .from(recipes)
    .where(
      and(eq(recipes.householdId, householdId), eq(recipes.isFavorite, true)),
    )
    .orderBy(desc(recipes.updatedAt));
}

export async function saveFavoriteRecipe(input: {
  householdId: string;
  name: string;
  summary?: string | null;
  servings?: number | null;
  ingredientsText?: string | null;
  instructionsText?: string | null;
  isFavorite?: boolean;
}): Promise<Recipe> {
  const db = getDb();
  const existing = await findRecipeByName(input.householdId, input.name);
  const isFavorite = input.isFavorite ?? true;

  let recipe: Recipe;
  if (existing) {
    const [updated] = await db
      .update(recipes)
      .set({
        name: input.name.trim(),
        isFavorite: input.isFavorite ?? existing.isFavorite,
        summary: input.summary ?? existing.summary,
        servings: input.servings ?? existing.servings,
        ingredientsText: input.ingredientsText ?? existing.ingredientsText,
        instructionsText: input.instructionsText ?? existing.instructionsText,
        updatedAt: new Date(),
      })
      .where(eq(recipes.id, existing.id))
      .returning();
    if (!updated) {
      throw new Error("Failed to update recipe");
    }
    recipe = updated;
  } else {
    const [created] = await db
      .insert(recipes)
      .values({
        householdId: input.householdId,
        name: input.name.trim(),
        normalizedName: normalizeIngredientName(input.name),
        summary: input.summary ?? null,
        servings: input.servings ?? null,
        ingredientsText: input.ingredientsText ?? null,
        instructionsText: input.instructionsText ?? null,
        isFavorite,
      })
      .returning();
    if (!created) {
      throw new Error("Failed to create recipe");
    }
    recipe = created;
  }

  return recipe;
}

export async function getRecipeById(
  householdId: string,
  recipeId: string,
): Promise<Recipe | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.householdId, householdId)))
    .limit(1);
  return rows[0] ?? null;
}

export type MealHistoryDetail = {
  meal: MealHistory;
  recipe: Recipe | null;
  feedback: MealFeedback[];
  stars: StarRating | null;
  starsDisplay: string;
  proteinClass: string | null;
  meatEmoji: string;
};

export type MealHistorySort = "date" | "rating";

const ratingRankSql = sql`COALESCE((
  SELECT CASE mf.sentiment
    WHEN 'loved' THEN 5
    WHEN 'liked' THEN 4
    WHEN 'okay' THEN 3
    WHEN 'disliked' THEN 2
    WHEN 'never_again' THEN 1
    ELSE 0
  END
  FROM ${mealFeedback} mf
  WHERE mf.meal_history_id = ${mealHistory.id}
  ORDER BY mf.created_at DESC
  LIMIT 1
), 0)`;

export async function getMealHistoryWithDetails(
  householdId: string,
  options: {
    limit?: number;
    offset?: number;
    sort?: MealHistorySort;
    meat?: HistoryMeatFilter | null;
  } = {},
): Promise<{ items: MealHistoryDetail[]; hasMore: boolean }> {
  const db = getDb();
  const limit = options.limit ?? 10;
  const offset = options.offset ?? 0;
  const sort = options.sort ?? "date";

  const filters = [eq(mealHistory.householdId, householdId)];
  if (options.meat) {
    const patterns = meatFilterIlikePatterns(options.meat);
    if (patterns.length > 0) {
      filters.push(
        or(...patterns.map((pattern) => ilike(mealHistory.name, pattern)))!,
      );
    }
  }

  const whereClause = and(...filters);

  const meals =
    sort === "rating"
      ? await db
          .select()
          .from(mealHistory)
          .where(whereClause)
          .orderBy(desc(ratingRankSql), desc(mealHistory.cookedAt))
          .limit(limit + 1)
          .offset(offset)
      : await db
          .select()
          .from(mealHistory)
          .where(whereClause)
          .orderBy(desc(mealHistory.cookedAt))
          .limit(limit + 1)
          .offset(offset);

  const hasMore = meals.length > limit;
  const page = hasMore ? meals.slice(0, limit) : meals;

  const recipeIds = [
    ...new Set(
      page.map((meal) => meal.recipeId).filter((id): id is string => Boolean(id)),
    ),
  ];
  const mealIds = page.map((meal) => meal.id);

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

  const feedbackRows =
    mealIds.length > 0
      ? await db
          .select()
          .from(mealFeedback)
          .where(
            and(
              eq(mealFeedback.householdId, householdId),
              inArray(mealFeedback.mealHistoryId, mealIds),
            ),
          )
          .orderBy(desc(mealFeedback.createdAt))
      : [];

  const recipeById = new Map(recipeRows.map((recipe) => [recipe.id, recipe]));
  const feedbackByMealId = new Map<string, MealFeedback[]>();
  for (const row of feedbackRows) {
    if (!row.mealHistoryId) continue;
    const bucket = feedbackByMealId.get(row.mealHistoryId) ?? [];
    bucket.push(row);
    feedbackByMealId.set(row.mealHistoryId, bucket);
  }

  return {
    hasMore,
    items: page.map((meal) => {
      const feedback = feedbackByMealId.get(meal.id) ?? [];
      const stars = sentimentToStars(feedback[0]?.sentiment);
      return {
        meal,
        recipe: meal.recipeId ? recipeById.get(meal.recipeId) ?? null : null,
        feedback,
        stars,
        starsDisplay: formatStarsDisplay(stars),
        proteinClass: primaryProteinClass(meal.name),
        meatEmoji: meatEmojiForMeal(meal.name),
      };
    }),
  };
}

export async function recordMeal(input: {
  householdId: string;
  memberId?: string | null;
  name: string;
  mealType?: string;
  servingsText?: string | null;
  wasPlanned?: boolean;
  actuallyCooked?: boolean;
  notes?: string | null;
  markFavorite?: boolean;
  recipeSummary?: string | null;
}): Promise<MealHistory> {
  const db = getDb();
  let recipe = await findRecipeByName(input.householdId, input.name);

  if (!recipe && (input.markFavorite || input.recipeSummary)) {
    recipe = await saveFavoriteRecipe({
      householdId: input.householdId,
      name: input.name,
      summary: input.recipeSummary,
    });
  } else if (recipe && input.actuallyCooked !== false) {
    const [updated] = await db
      .update(recipes)
      .set({
        timesCooked: recipe.timesCooked + 1,
        lastCookedAt: new Date(),
        isFavorite: input.markFavorite ? true : recipe.isFavorite,
        updatedAt: new Date(),
      })
      .where(eq(recipes.id, recipe.id))
      .returning();
    recipe = updated;
  } else if (recipe && input.markFavorite) {
    const [updated] = await db
      .update(recipes)
      .set({ isFavorite: true, updatedAt: new Date() })
      .where(eq(recipes.id, recipe.id))
      .returning();
    recipe = updated;
  }

  const [created] = await db
    .insert(mealHistory)
    .values({
      householdId: input.householdId,
      recipeId: recipe?.id ?? null,
      memberId: input.memberId ?? null,
      name: input.name.trim(),
      mealType: input.mealType ?? "dinner",
      servingsText: input.servingsText ?? null,
      wasPlanned: input.wasPlanned ?? false,
      actuallyCooked: input.actuallyCooked ?? true,
      notes: input.notes ?? null,
    })
    .returning();

  return created;
}

export async function getRecentMeals(
  householdId: string,
  limit = 10,
): Promise<MealHistory[]> {
  const db = getDb();
  return db
    .select()
    .from(mealHistory)
    .where(eq(mealHistory.householdId, householdId))
    .orderBy(desc(mealHistory.cookedAt))
    .limit(limit);
}

/** Cooked meal history on/after an ISO date (YYYY-MM-DD), newest first. */
export async function listCookedMealsSince(
  householdId: string,
  sinceIsoDate: string,
): Promise<MealHistory[]> {
  const db = getDb();
  const since = new Date(`${sinceIsoDate}T00:00:00.000Z`);
  if (Number.isNaN(since.getTime())) return [];

  return db
    .select()
    .from(mealHistory)
    .where(
      and(
        eq(mealHistory.householdId, householdId),
        eq(mealHistory.actuallyCooked, true),
        gte(mealHistory.cookedAt, since),
      ),
    )
    .orderBy(desc(mealHistory.cookedAt));
}

function mealTitlesMatch(a: string, b: string): boolean {
  const na = normalizeIngredientName(a);
  const nb = normalizeIngredientName(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/**
 * Attach the latest matching cook event to each meal-batch item.
 * Prefers recipeId matches, then title/name matches. Each history row used once.
 */
export function attachCookedAtToMealItems<
  T extends {
    id: string;
    title: string;
    recipeId: string | null;
    recipe?: { id: string; name: string } | null;
  },
>(
  items: T[],
  cookedHistory: MealHistory[],
): Array<T & { cookedAt: Date | null }> {
  const remaining = [...cookedHistory];

  return items.map((item) => {
    let matchIndex = -1;

    if (item.recipeId) {
      matchIndex = remaining.findIndex(
        (row) => row.recipeId && row.recipeId === item.recipeId,
      );
    }

    if (matchIndex < 0) {
      matchIndex = remaining.findIndex((row) => {
        if (mealTitlesMatch(item.title, row.name)) return true;
        if (item.recipe?.name && mealTitlesMatch(item.recipe.name, row.name)) {
          return true;
        }
        return false;
      });
    }

    if (matchIndex < 0) {
      return { ...item, cookedAt: null };
    }

    const [matched] = remaining.splice(matchIndex, 1);
    return { ...item, cookedAt: matched.cookedAt };
  });
}

export type FeedbackTarget =
  | "meal"
  | "recipe"
  | "ingredient"
  | "sauce"
  | "method"
  | "other";

export async function saveMealFeedback(input: {
  householdId: string;
  memberId?: string | null;
  recipeName?: string | null;
  mealHistoryId?: string | null;
  sentiment: FeedbackSentiment;
  target?: FeedbackTarget;
  targetDetail?: string | null;
  feedbackText: string;
  saveAsFavorite?: boolean;
}): Promise<MealFeedback> {
  const db = getDb();
  let recipeId: string | null = null;

  if (input.recipeName) {
    if (input.saveAsFavorite || input.sentiment === "loved") {
      const recipe = await saveFavoriteRecipe({
        householdId: input.householdId,
        name: input.recipeName,
      });
      recipeId = recipe.id;
    } else {
      const recipe = await findRecipeByName(input.householdId, input.recipeName);
      recipeId = recipe?.id ?? null;
    }

    if (
      recipeId &&
      (input.sentiment === "disliked" || input.sentiment === "never_again")
    ) {
      await db
        .update(recipes)
        .set({ isFavorite: false, updatedAt: new Date() })
        .where(eq(recipes.id, recipeId));
    }
  }

  const [created] = await db
    .insert(mealFeedback)
    .values({
      householdId: input.householdId,
      recipeId,
      mealHistoryId: input.mealHistoryId ?? null,
      memberId: input.memberId ?? null,
      sentiment: input.sentiment,
      target: input.target ?? "meal",
      targetDetail: input.targetDetail ?? null,
      feedbackText: input.feedbackText.trim(),
    })
    .returning();

  return created;
}

export function formatRecentMealsForPrompt(meals: MealHistory[]): string {
  if (meals.length === 0) {
    return "No recent meals recorded.";
  }
  return meals
    .map((meal) => {
      const cooked = meal.actuallyCooked ? "cooked" : "not cooked";
      const when = meal.cookedAt.toISOString().slice(0, 10);
      return `- ${when}: ${meal.name} (${meal.mealType}, ${cooked})${meal.notes ? ` — ${meal.notes}` : ""}`;
    })
    .join("\n");
}

export function formatFavoritesForPrompt(favorites: Recipe[]): string {
  if (favorites.length === 0) {
    return "No favorite recipes saved yet.";
  }
  return favorites
    .map((recipe) => {
      return `- ${recipe.name}${recipe.summary ? ` — ${recipe.summary}` : ""}`;
    })
    .join("\n");
}
