import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { groceryProductPreferences } from "@/lib/db/schema";
import { normalizeIngredientName } from "@/lib/kitchen/normalize";

export type PurchaseMemorySource =
  | "user_pick"
  | "cart_add"
  | "purchase";

export async function getProductPreference(
  householdId: string,
  groceryName: string,
) {
  const db = getDb();
  const normalizedName = normalizeIngredientName(groceryName);
  const rows = await db
    .select()
    .from(groceryProductPreferences)
    .where(eq(groceryProductPreferences.householdId, householdId));

  return (
    rows.find((row) => row.normalizedName === normalizedName) ??
    rows.find(
      (row) =>
        normalizedName.includes(row.normalizedName) ||
        row.normalizedName.includes(normalizedName),
    ) ??
    null
  );
}

export async function saveProductPreference(input: {
  householdId: string;
  groceryName: string;
  preferredUpc: string;
  preferredBrand?: string | null;
  productDescription?: string | null;
  source?: PurchaseMemorySource;
  brandLocked?: boolean;
}) {
  const db = getDb();
  const normalizedName = normalizeIngredientName(input.groceryName);
  const source = input.source ?? "cart_add";
  const brandLocked =
    input.brandLocked ?? (source === "user_pick" ? true : false);

  const existing = await getProductPreference(
    input.householdId,
    input.groceryName,
  );

  if (existing && existing.normalizedName === normalizedName) {
    const [updated] = await db
      .update(groceryProductPreferences)
      .set({
        preferredUpc: input.preferredUpc,
        preferredBrand: input.preferredBrand ?? existing.preferredBrand,
        productDescription:
          input.productDescription ?? existing.productDescription,
        source,
        brandLocked: brandLocked || existing.brandLocked,
        timesChosen: existing.timesChosen + 1,
        lastChosenAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(groceryProductPreferences.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(groceryProductPreferences)
    .values({
      householdId: input.householdId,
      normalizedName,
      preferredUpc: input.preferredUpc,
      preferredBrand: input.preferredBrand ?? null,
      productDescription: input.productDescription ?? null,
      source,
      brandLocked,
    })
    .onConflictDoUpdate({
      target: [
        groceryProductPreferences.householdId,
        groceryProductPreferences.normalizedName,
      ],
      set: {
        preferredUpc: input.preferredUpc,
        preferredBrand: input.preferredBrand ?? null,
        productDescription: input.productDescription ?? null,
        source,
        brandLocked,
        timesChosen: 1,
        lastChosenAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();

  return created;
}
