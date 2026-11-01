import { and, asc, eq, ne, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  groceryListCategories,
  groceryListItems,
  type GroceryListCategory,
} from "@/lib/db/schema";

export const DEFAULT_GROCERY_CATEGORY_NAME = "Grocery";

/** Ensure the undeletable default category exists for the household. */
export async function ensureDefaultGroceryCategory(
  householdId: string,
): Promise<GroceryListCategory> {
  const db = getDb();
  const existing = await db
    .select()
    .from(groceryListCategories)
    .where(
      and(
        eq(groceryListCategories.householdId, householdId),
        eq(groceryListCategories.isDefault, true),
      ),
    )
    .limit(1);

  if (existing[0]) return existing[0];

  const [created] = await db
    .insert(groceryListCategories)
    .values({
      householdId,
      name: DEFAULT_GROCERY_CATEGORY_NAME,
      sortOrder: 0,
      isDefault: true,
    })
    .returning();
  return created;
}

export async function listGroceryCategories(
  householdId: string,
): Promise<GroceryListCategory[]> {
  await ensureDefaultGroceryCategory(householdId);
  const db = getDb();
  return db
    .select()
    .from(groceryListCategories)
    .where(eq(groceryListCategories.householdId, householdId))
    .orderBy(
      sql`CASE WHEN ${groceryListCategories.isDefault} THEN 0 ELSE 1 END`,
      asc(groceryListCategories.sortOrder),
      asc(groceryListCategories.name),
    );
}

export async function findGroceryCategoryByName(
  householdId: string,
  name: string,
): Promise<GroceryListCategory | null> {
  const categories = await listGroceryCategories(householdId);
  const needle = name.trim().toLowerCase();
  return (
    categories.find((category) => category.name.toLowerCase() === needle) ??
    null
  );
}

export async function resolveGroceryCategoryId(
  householdId: string,
  categoryNameOrId?: string | null,
): Promise<string> {
  const defaultCategory = await ensureDefaultGroceryCategory(householdId);
  if (!categoryNameOrId?.trim()) return defaultCategory.id;

  const raw = categoryNameOrId.trim();
  const categories = await listGroceryCategories(householdId);
  const byId = categories.find((category) => category.id === raw);
  if (byId) return byId.id;

  const byName = categories.find(
    (category) => category.name.toLowerCase() === raw.toLowerCase(),
  );
  if (byName) return byName.id;

  throw new Error(`Unknown grocery category: "${raw}"`);
}

export async function createGroceryCategory(input: {
  householdId: string;
  name: string;
}): Promise<GroceryListCategory> {
  const name = input.name.trim();
  if (!name) throw new Error("Category name is required.");

  await ensureDefaultGroceryCategory(input.householdId);
  const existing = await findGroceryCategoryByName(input.householdId, name);
  if (existing) {
    throw new Error(`Category "${existing.name}" already exists.`);
  }

  const db = getDb();
  const categories = await listGroceryCategories(input.householdId);
  const maxSort = categories.reduce(
    (max, category) => Math.max(max, category.sortOrder),
    0,
  );

  const [created] = await db
    .insert(groceryListCategories)
    .values({
      householdId: input.householdId,
      name,
      sortOrder: maxSort + 1,
      isDefault: false,
    })
    .returning();
  return created;
}

export async function renameGroceryCategory(input: {
  householdId: string;
  categoryId: string;
  name: string;
}): Promise<GroceryListCategory | null> {
  const name = input.name.trim();
  if (!name) throw new Error("Category name is required.");

  const categories = await listGroceryCategories(input.householdId);
  const target = categories.find((category) => category.id === input.categoryId);
  if (!target) return null;

  const clash = categories.find(
    (category) =>
      category.id !== target.id &&
      category.name.toLowerCase() === name.toLowerCase(),
  );
  if (clash) {
    throw new Error(`Category "${clash.name}" already exists.`);
  }

  const db = getDb();
  const [updated] = await db
    .update(groceryListCategories)
    .set({ name, updatedAt: new Date() })
    .where(
      and(
        eq(groceryListCategories.id, target.id),
        eq(groceryListCategories.householdId, input.householdId),
      ),
    )
    .returning();
  return updated ?? null;
}

/**
 * Delete a non-default category after reassigning its items to the default.
 * Rejects deleting the default category.
 */
export async function deleteGroceryCategory(input: {
  householdId: string;
  categoryId: string;
}): Promise<{ ok: true; reassigned: number } | { ok: false; reason: string }> {
  const categories = await listGroceryCategories(input.householdId);
  const target = categories.find((category) => category.id === input.categoryId);
  if (!target) return { ok: false, reason: "Category not found." };
  if (target.isDefault) {
    return { ok: false, reason: "Cannot delete the default Grocery category." };
  }

  const defaultCategory = categories.find((category) => category.isDefault);
  if (!defaultCategory) {
    return { ok: false, reason: "Default category missing." };
  }

  const db = getDb();
  const moved = await db
    .update(groceryListItems)
    .set({ categoryId: defaultCategory.id, updatedAt: new Date() })
    .where(
      and(
        eq(groceryListItems.householdId, input.householdId),
        eq(groceryListItems.categoryId, target.id),
      ),
    )
    .returning({ id: groceryListItems.id });

  await db
    .delete(groceryListCategories)
    .where(
      and(
        eq(groceryListCategories.id, target.id),
        eq(groceryListCategories.householdId, input.householdId),
        ne(groceryListCategories.isDefault, true),
      ),
    );

  return { ok: true, reassigned: moved.length };
}
