import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { preferences, type Preference } from "@/lib/db/schema";
import { normalizeIngredientName } from "@/lib/kitchen/normalize";
import {
  formatFoodPreferencesForPrompt,
  formatMenuPreferencesForPrompt,
  formatStructuralPlanningRulesForPrompt,
} from "@/lib/preferences/planning-rules";

export type PreferenceKind = "like" | "dislike" | "constraint" | "note";
export type PreferenceStrength = "explicit" | "inferred";

export async function listPreferences(
  householdId: string,
): Promise<Preference[]> {
  const db = getDb();
  return db
    .select()
    .from(preferences)
    .where(eq(preferences.householdId, householdId))
    .orderBy(desc(preferences.updatedAt));
}

export type SavePreferenceInput = {
  householdId: string;
  kind: PreferenceKind;
  key: string;
  value: string;
  strength?: PreferenceStrength;
};

export async function savePreference(
  input: SavePreferenceInput,
): Promise<Preference> {
  const db = getDb();
  const key = normalizeIngredientName(input.key) || input.key.trim().toLowerCase();

  const [saved] = await db
    .insert(preferences)
    .values({
      householdId: input.householdId,
      kind: input.kind,
      key,
      value: input.value.trim(),
      strength: input.strength ?? "explicit",
    })
    .onConflictDoUpdate({
      target: [preferences.householdId, preferences.kind, preferences.key],
      set: {
        value: input.value.trim(),
        strength: input.strength ?? "explicit",
        updatedAt: new Date(),
      },
    })
    .returning();

  return saved;
}

export async function removePreference(
  householdId: string,
  kind: PreferenceKind,
  key: string,
): Promise<boolean> {
  const db = getDb();
  const normalizedKey =
    normalizeIngredientName(key) || key.trim().toLowerCase();
  const deleted = await db
    .delete(preferences)
    .where(
      and(
        eq(preferences.householdId, householdId),
        eq(preferences.kind, kind),
        eq(preferences.key, normalizedKey),
      ),
    )
    .returning({ id: preferences.id });

  return deleted.length > 0;
}

export function formatPreferencesContextForPrompt(items: Preference[]): {
  structuralPlanningRules: string;
  menuPreferences: string;
  foodPreferences: string;
} {
  return {
    structuralPlanningRules: formatStructuralPlanningRulesForPrompt(items),
    menuPreferences: formatMenuPreferencesForPrompt(items),
    foodPreferences: formatFoodPreferencesForPrompt(items),
  };
}
