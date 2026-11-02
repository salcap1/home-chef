"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAnyHouseholdMemberId } from "@/lib/household/context";
import { requirePanelSession } from "@/lib/panel/auth";
import { runHouseholdChefAgent } from "@/lib/ai/agent";
import {
  addDinnerToCurrentPlan,
  addGroceryItem,
  completeCurrentMealBatch,
  createWeeklyPlan,
  ensureFullRecipeForMealPlanItem,
  getActiveGroceryList,
  getMealPlanItemRecipeSnapshot,
  mergeGroceriesFromMealPlan,
  removeGroceryItem,
  removeGroceryItemById,
  removeMealPlanItemById,
  updateGroceryListItemById,
} from "@/lib/planning/service";
import {
  createGroceryCategory,
  deleteGroceryCategory,
  ensureDefaultGroceryCategory,
  renameGroceryCategory,
} from "@/lib/planning/grocery-categories";
import {
  savePreference,
  removePreference,
  type PreferenceKind,
  type PreferenceStrength,
} from "@/lib/preferences/service";
import { addDaysToIsoDate, mondayOfWeek } from "@/lib/grocery/calculate";
import { getEnv } from "@/lib/env";
import { generateMealBatchTitles } from "@/lib/ai/meal-batch";
import { assertHarrisTeeterAllowed } from "@/lib/kroger/access";
import {
  buildKrogerLinkUrl,
  createKrogerOAuthState,
  getValidKrogerAccessToken,
} from "@/lib/kroger/connection";
import {
  addHarrisTeeterProductToCart,
  searchHarrisTeeterCandidates,
  type ShopProductCandidate,
} from "@/lib/kroger/shop";

async function panelContext() {
  const { householdId } = await requirePanelSession();
  return { householdId };
}

export async function loginAction(formData: FormData) {
  const { loginWithPasscode } = await import("@/lib/panel/auth");
  const passcode = String(formData.get("passcode") ?? "");
  const next = String(formData.get("next") ?? "/panel/meals");

  const ok = await loginWithPasscode(passcode);
  if (!ok) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }

  redirect(next.startsWith("/") ? next : "/panel/meals");
}

export async function createAccountAction(formData: FormData) {
  const { createAccountWithPasscode } = await import("@/lib/panel/auth");
  const passcode = String(formData.get("passcode") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const next = String(formData.get("next") ?? "/panel/meals");
  const nextQ = encodeURIComponent(next);

  const result = await createAccountWithPasscode(passcode, confirm);
  if (!result.ok) {
    redirect(`/login?mode=create&error=${result.error}&next=${nextQ}`);
  }

  redirect(next.startsWith("/") ? next : "/panel/meals");
}

export async function logoutAction() {
  const { logoutPanelSession } = await import("@/lib/panel/auth");
  await logoutPanelSession();
  redirect("/login");
}

export async function addGroceryAction(formData: FormData) {
  const { householdId } = await panelContext();
  const name = String(formData.get("name") ?? "").trim();
  const quantityText = String(formData.get("quantityText") ?? "").trim();
  const category = String(formData.get("categoryId") ?? "").trim();

  if (!name) return;

  await addGroceryItem({
    householdId,
    name,
    quantityText: quantityText || null,
    category: category || null,
  });

  revalidatePath("/panel/groceries");
}

export async function updateGroceryAction(formData: FormData) {
  const { householdId } = await panelContext();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const quantityText = String(formData.get("quantityText") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim();

  if (!id || !name) return;

  await updateGroceryListItemById(householdId, id, {
    name,
    quantityText: quantityText || null,
    categoryId: categoryId || null,
  });

  revalidatePath("/panel/groceries");
}

export async function removeGroceryAction(formData: FormData) {
  const { householdId } = await panelContext();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!id && !name) return;

  if (id) await removeGroceryItemById(householdId, id);
  else await removeGroceryItem(householdId, name);
  revalidatePath("/panel/groceries");
}

export async function createGroceryCategoryAction(formData: FormData) {
  const { householdId } = await panelContext();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await createGroceryCategory({ householdId, name });
  revalidatePath("/panel/groceries");
}

export async function renameGroceryCategoryAction(formData: FormData) {
  const { householdId } = await panelContext();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!categoryId || !name) return;

  await renameGroceryCategory({ householdId, categoryId, name });
  revalidatePath("/panel/groceries");
}

export async function deleteGroceryCategoryAction(formData: FormData) {
  const { householdId } = await panelContext();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  if (!categoryId) return;

  await deleteGroceryCategory({ householdId, categoryId });
  revalidatePath("/panel/groceries");
}

export async function savePreferenceAction(formData: FormData) {
  const { householdId } = await panelContext();
  const kind = String(formData.get("kind") ?? "note") as PreferenceKind;
  const key = String(formData.get("key") ?? "").trim();
  const value = String(formData.get("value") ?? "").trim();
  const strength = String(
    formData.get("strength") ?? "explicit",
  ) as PreferenceStrength;

  if (!key || !value) return;

  await savePreference({
    householdId,
    kind,
    key,
    value,
    strength,
  });

  revalidatePath("/panel/preferences");
}

export async function removePreferenceAction(formData: FormData) {
  const { householdId } = await panelContext();
  const kind = String(formData.get("kind") ?? "note") as PreferenceKind;
  const key = String(formData.get("key") ?? "").trim();
  if (!key) return;

  await removePreference(householdId, kind, key);
  revalidatePath("/panel/preferences");
}

export type GeneratedMealRecipePayload = {
  name: string;
  summary: string | null;
  servings: number | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  totalTimeMinutes: number | null;
  ingredientsText: string | null;
  instructionsText: string | null;
  instructionSteps: unknown;
  isFavorite: boolean;
};

export async function generateMealPlanItemRecipeAction(
  mealPlanItemId: string,
): Promise<
  | { ok: true; recipe: GeneratedMealRecipePayload; generated: boolean }
  | { ok: false; error: string }
> {
  try {
    const { householdId } = await panelContext();
    const data = await ensureFullRecipeForMealPlanItem(
      householdId,
      mealPlanItemId,
    );
    if (!data) {
      return { ok: false, error: "Meal not found." };
    }

    revalidatePath("/panel/meals");
    revalidatePath(`/panel/meals/item/${mealPlanItemId}`);

    return {
      ok: true,
      generated: data.generated,
      recipe: {
        name: data.recipe.name,
        summary: data.recipe.summary,
        servings: data.recipe.servings,
        prepTimeMinutes: data.recipe.prepTimeMinutes,
        cookTimeMinutes: data.recipe.cookTimeMinutes,
        totalTimeMinutes: data.recipe.totalTimeMinutes,
        ingredientsText: data.recipe.ingredientsText,
        instructionsText: data.recipe.instructionsText,
        instructionSteps: data.recipe.instructionSteps,
        isFavorite: data.recipe.isFavorite,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Recipe generation failed.";
    return { ok: false, error: message };
  }
}

function toRecipePayload(recipe: {
  name: string;
  summary: string | null;
  servings: number | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  totalTimeMinutes: number | null;
  ingredientsText: string | null;
  instructionsText: string | null;
  instructionSteps: unknown;
  isFavorite: boolean;
}): GeneratedMealRecipePayload {
  return {
    name: recipe.name,
    summary: recipe.summary,
    servings: recipe.servings,
    prepTimeMinutes: recipe.prepTimeMinutes,
    cookTimeMinutes: recipe.cookTimeMinutes,
    totalTimeMinutes: recipe.totalTimeMinutes,
    ingredientsText: recipe.ingredientsText,
    instructionsText: recipe.instructionsText,
    instructionSteps: recipe.instructionSteps,
    isFavorite: recipe.isFavorite,
  };
}

export async function markMealPlanItemCookedAction(input: {
  mealPlanItemId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  feedback?: string | null;
}): Promise<
  | {
      ok: true;
      cookedAt: string;
      regenerated: boolean;
      recipe: GeneratedMealRecipePayload;
      stars: 1 | 2 | 3 | 4 | 5;
    }
  | { ok: false; error: string }
> {
  try {
    const { householdId } = await panelContext();
    if (![1, 2, 3, 4, 5].includes(input.rating)) {
      return { ok: false, error: "Pick a rating from 1 to 5 stars." };
    }

    const snapshot = await getMealPlanItemRecipeSnapshot(
      householdId,
      input.mealPlanItemId,
    );
    if (!snapshot) {
      return { ok: false, error: "Meal not found." };
    }

    let recipe = snapshot.recipe;
    if (!recipe || !snapshot.ready) {
      const ensured = await ensureFullRecipeForMealPlanItem(
        householdId,
        input.mealPlanItemId,
      );
      if (!ensured) {
        return { ok: false, error: "Meal not found." };
      }
      recipe = ensured.recipe;
    }

    const feedback = input.feedback?.trim() || "";
    let regenerated = false;
    if (feedback) {
      const { regenerateRecipeFromFeedback } = await import("@/lib/ai/recipes");
      const generated = await regenerateRecipeFromFeedback({
        householdId,
        recipeName: recipe.name,
        feedback,
      });
      const { getRecipeById } = await import("@/lib/meals/service");
      const updated = await getRecipeById(householdId, generated.recipeId);
      if (!updated) {
        return { ok: false, error: "Recipe was updated but could not be reloaded." };
      }
      recipe = updated;
      regenerated = true;
    }

    const {
      recordMeal,
      saveMealFeedback,
    } = await import("@/lib/meals/service");
    const {
      starsToSentiment,
      shouldMarkFavoriteFromStars,
    } = await import("@/lib/meals/rating");

    const meal = await recordMeal({
      householdId,
      name: snapshot.item.title,
      mealType: snapshot.item.mealType,
      servingsText: recipe.servings ? String(recipe.servings) : null,
      wasPlanned: true,
      actuallyCooked: true,
      notes: null,
      markFavorite: shouldMarkFavoriteFromStars(input.rating),
    });

    await saveMealFeedback({
      householdId,
      recipeName: recipe.name,
      mealHistoryId: meal.id,
      sentiment: starsToSentiment(input.rating),
      feedbackText: `Rated ${input.rating}/5`,
      saveAsFavorite: shouldMarkFavoriteFromStars(input.rating),
    });

    // Skip revalidating the current meal-item route — the client applies the
    // returned recipe/cooked state. Revalidating it mid-action can hang the UI.
    revalidatePath("/panel/meals");
    revalidatePath("/panel/history");

    return {
      ok: true,
      cookedAt: meal.cookedAt.toISOString(),
      regenerated,
      recipe: toRecipePayload(recipe),
      stars: input.rating,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not mark meal as cooked.";
    return { ok: false, error: message };
  }
}

/** Rewrite a saved recipe so cooking feedback is baked into ingredients/steps. */
export async function regenerateRecipeFeedbackAction(input: {
  recipeName: string;
  feedback: string;
  mealPlanItemId?: string | null;
}): Promise<
  | { ok: true; recipe: GeneratedMealRecipePayload }
  | { ok: false; error: string }
> {
  try {
    const { householdId } = await panelContext();
    const recipeName = input.recipeName.trim();
    const feedback = input.feedback.trim();
    if (!recipeName) {
      return { ok: false, error: "Recipe name is required." };
    }
    if (!feedback) {
      return { ok: false, error: "Describe what should change." };
    }

    const { regenerateRecipeFromFeedback } = await import("@/lib/ai/recipes");
    const generated = await regenerateRecipeFromFeedback({
      householdId,
      recipeName,
      feedback,
    });
    const { getRecipeById } = await import("@/lib/meals/service");
    const updated = await getRecipeById(householdId, generated.recipeId);
    if (!updated) {
      return { ok: false, error: "Recipe was updated but could not be reloaded." };
    }

    // Refresh list/history caches, but not the page that invoked this action —
    // revalidating the current route while the action is in-flight can hang the
    // client promise. The panel already applies `recipe` from the return value.
    revalidatePath("/panel/meals");
    revalidatePath("/panel/history");
    revalidatePath(`/panel/meals/recipe/${updated.id}`);

    return { ok: true, recipe: toRecipePayload(updated) };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not update the recipe from your notes.";
    return { ok: false, error: message };
  }
}

export async function generateMealBatchAction(input: {
  selectedMeats: string[];
  mealCount: number;
  includePastMeals?: string[];
  /** Pantry / on-hand items to try to use in new meals. */
  useIngredients?: string[];
  replaceExisting?: boolean;
}): Promise<
  | { ok: true; planId: string; titles: string[]; mode: string }
  | {
      ok: false;
      error: string;
      needsReplaceConfirm?: boolean;
      mode?: string;
    }
> {
  try {
    const { householdId } = await panelContext();
    const meats = input.selectedMeats.map((m) => m.trim()).filter(Boolean);
    const { parseUseIngredients } = await import("@/lib/ai/meal-batch");
    const useIngredients = parseUseIngredients(input.useIngredients);
    const includePastMeals = [
      ...new Map(
        (input.includePastMeals ?? [])
          .map((title) => title.trim())
          .filter(Boolean)
          .map((title) => [title.toLowerCase(), title] as const),
      ).values(),
    ].slice(0, 10);
    const mealCount = Math.min(
      10,
      Math.max(1, includePastMeals.length, Math.round(input.mealCount)),
    );

    const { prepareSlotForNewMealBatch } = await import(
      "@/lib/planning/service"
    );
    const slot = await prepareSlotForNewMealBatch(householdId, {
      replaceExisting: input.replaceExisting,
    });
    if (!slot.ok) {
      return {
        ok: false,
        error: slot.error,
        needsReplaceConfirm: true,
        mode: slot.mode,
      };
    }

    const titles = await generateMealBatchTitles({
      householdId,
      selectedMeats: meats,
      mealCount,
      includePastMeals,
      useIngredients,
    });

    const weekStart = mondayOfWeek(new Date(), getEnv().HOUSEHOLD_TIMEZONE);
    const notesParts: string[] = [];
    if (meats.length > 0) {
      notesParts.push(`Proteins: ${meats.join(", ")}`);
    }
    if (useIngredients.length > 0) {
      notesParts.push(`Use: ${useIngredients.join(", ")}`);
    }
    if (includePastMeals.length > 0) {
      notesParts.push(`Included past: ${includePastMeals.join("; ")}`);
    }
    const created = await createWeeklyPlan({
      householdId,
      weekStartDate: weekStart,
      title: `Week of ${weekStart}`,
      notes: notesParts.join(" · "),
      status: "active",
      items: titles.map((title, index) => ({
        mealDate: addDaysToIsoDate(weekStart, index),
        mealType: "dinner" as const,
        title,
        recipeName: title,
        sortOrder: index,
      })),
    });

    revalidatePath("/panel/meals");
    revalidatePath("/panel/groceries");

    return {
      ok: true,
      planId: created.plan.id,
      titles: created.items.map((item) => item.title),
      mode: slot.mode,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not generate meals.";
    return { ok: false, error: message };
  }
}

export async function removeMealPlanItemAction(
  mealPlanItemId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { householdId } = await panelContext();
    const removed = await removeMealPlanItemById(householdId, mealPlanItemId);
    if (!removed) {
      return { ok: false, error: "Meal not found." };
    }
    revalidatePath("/panel/meals");
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not remove meal.";
    return { ok: false, error: message };
  }
}

export async function addMealPlanItemAction(input: {
  title: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const { householdId } = await panelContext();
    const created = await addDinnerToCurrentPlan({
      householdId,
      title: input.title,
    });
    if (!created) {
      return {
        ok: false,
        error: "No active meal batch to add to — generate a batch first.",
      };
    }
    revalidatePath("/panel/meals");
    return { ok: true, id: created.id };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not add meal.";
    return { ok: false, error: message };
  }
}

export async function completeCurrentMealBatchAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    const { householdId } = await panelContext();
    const completed = await completeCurrentMealBatch(householdId);
    if (!completed) {
      return { ok: false, error: "No current meal batch to finish." };
    }
    revalidatePath("/panel/meals");
    revalidatePath("/panel/groceries");
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not finish meal batch.";
    return { ok: false, error: message };
  }
}

/** Replace the default Grocery category with this batch's full ingredient list. */
export async function rebuildGroceriesFromMealsAction(input?: {
  mealPlanId?: string;
}): Promise<
  | {
      ok: true;
      added: string[];
      groceryCount: number;
      recipesGenerated: number;
      mealsMissingRecipes: number;
    }
  | { ok: false; error: string }
> {
  try {
    const { householdId } = await panelContext();
    const rebuilt = await mergeGroceriesFromMealPlan(
      householdId,
      input?.mealPlanId,
    );
    if (!rebuilt) {
      return { ok: false, error: "No meal batch to build a grocery list from." };
    }
    revalidatePath("/panel/groceries");
    revalidatePath("/panel/meals");
    return {
      ok: true,
      added: rebuilt.added,
      groceryCount: rebuilt.added.length,
      recipesGenerated: rebuilt.recipesGenerated,
      mealsMissingRecipes: rebuilt.mealsMissingRecipes,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not build the grocery list from meals.";
    return { ok: false, error: message };
  }
}

/** Conversational meal (and kitchen) edits from the panel chef chat. */
export async function panelChefChatAction(input: {
  message: string;
}): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
  try {
    const { householdId } = await panelContext();
    const message = input.message.trim();
    if (!message) {
      return { ok: false, error: "Say what you’d like to change." };
    }
    if (message.length > 2000) {
      return { ok: false, error: "Keep it under 2000 characters." };
    }

    const memberId = await getAnyHouseholdMemberId(householdId);
    const reply = await runHouseholdChefAgent({
      householdId,
      memberId,
      userText: message,
    });

    revalidatePath("/panel/meals");
    revalidatePath("/panel/groceries");
    revalidatePath("/panel/preferences");

    return { ok: true, reply };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not reach the chef.";
    return { ok: false, error: message };
  }
}

export async function createHarrisTeeterLinkAction(): Promise<
  | { ok: true; url: string }
  | { ok: false; error: string }
> {
  try {
    const { householdId } = await panelContext();
    await assertHarrisTeeterAllowed(householdId);
    const stateToken = await createKrogerOAuthState(householdId);
    return { ok: true, url: buildKrogerLinkUrl(stateToken) };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not start Harris Teeter link.";
    return { ok: false, error: message };
  }
}

export async function searchHarrisTeeterProductsAction(
  groceryItemId: string,
): Promise<
  | {
      ok: true;
      name: string;
      quantityText: string | null;
      candidates: ShopProductCandidate[];
    }
  | { ok: false; error: string; reason?: "not_linked" | "invalid" | "error" }
> {
  try {
    const { householdId } = await panelContext();
    await assertHarrisTeeterAllowed(householdId);
    const itemId = groceryItemId.trim();
    if (!itemId) {
      return { ok: false, error: "Missing grocery item.", reason: "invalid" };
    }

    const [active, defaultCategory, auth] = await Promise.all([
      getActiveGroceryList(householdId),
      ensureDefaultGroceryCategory(householdId),
      getValidKrogerAccessToken(householdId),
    ]);

    if (!auth) {
      return {
        ok: false,
        error:
          "Harris Teeter account not linked. Link from the Groceries page.",
        reason: "not_linked",
      };
    }

    const item = active?.items.find((row) => row.id === itemId);
    if (!item) {
      return {
        ok: false,
        error: "Grocery item not found.",
        reason: "invalid",
      };
    }
    if (item.categoryId !== defaultCategory.id) {
      return {
        ok: false,
        error: "Shop is only available on the default Grocery category.",
        reason: "invalid",
      };
    }

    const candidates = await searchHarrisTeeterCandidates({
      householdId,
      itemName: item.name,
      quantityText: item.quantityText,
      locationId: auth.locationId,
      limit: 10,
    });

    return {
      ok: true,
      name: item.name,
      quantityText: item.quantityText,
      candidates,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not search Harris Teeter products.";
    return { ok: false, error: message, reason: "error" };
  }
}

export async function addHarrisTeeterProductAction(input: {
  groceryItemId: string;
  upc: string;
  packageSize?: string | null;
  description?: string | null;
  brand?: string | null;
  quantity?: number;
}): Promise<
  | {
      ok: true;
      name: string;
      productDescription: string;
      quantity: number;
      locationName: string;
    }
  | { ok: false; error: string; reason?: "not_linked" | "invalid" | "error" }
> {
  try {
    const { householdId } = await panelContext();
    await assertHarrisTeeterAllowed(householdId);
    const itemId = input.groceryItemId.trim();
    const upc = input.upc.trim();
    if (!itemId || !upc) {
      return {
        ok: false,
        error: "Missing grocery item or product.",
        reason: "invalid",
      };
    }

    const [active, defaultCategory] = await Promise.all([
      getActiveGroceryList(householdId),
      ensureDefaultGroceryCategory(householdId),
    ]);

    const item = active?.items.find((row) => row.id === itemId);
    if (!item) {
      return {
        ok: false,
        error: "Grocery item not found.",
        reason: "invalid",
      };
    }
    if (item.categoryId !== defaultCategory.id) {
      return {
        ok: false,
        error: "Shop is only available on the default Grocery category.",
        reason: "invalid",
      };
    }

    const added = await addHarrisTeeterProductToCart({
      householdId,
      groceryName: item.name,
      quantityText: item.quantityText,
      upc,
      packageSize: input.packageSize,
      description: input.description,
      brand: input.brand,
      quantity: input.quantity,
    });

    await removeGroceryItem(householdId, item.name);
    revalidatePath("/panel/groceries");

    return {
      ok: true,
      name: item.name,
      productDescription: added.description,
      quantity: added.quantity,
      locationName: added.locationName,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not add product to Harris Teeter cart.";
    const reason =
      message.toLowerCase().includes("not linked") ? "not_linked" : "error";
    return { ok: false, error: message, reason };
  }
}
