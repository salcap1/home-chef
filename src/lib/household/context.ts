import { asc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { households, householdMembers } from "@/lib/db/schema";

/**
 * First household by creation time — for offline scripts only.
 * Panel requests must use the householdId from the signed session.
 */
export async function getFirstHouseholdId(): Promise<string> {
  const db = getDb();
  const existing = await db
    .select({ id: households.id })
    .from(households)
    .orderBy(asc(households.createdAt))
    .limit(1);

  if (existing[0]) {
    return existing[0].id;
  }

  throw new Error(
    "No household found. Create one with: npx tsx --env-file=.env.local scripts/create-household.ts --passcode=…",
  );
}

/** Any household member — panel has no per-user identity within a household. */
export async function getAnyHouseholdMemberId(
  householdId: string,
): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ id: householdMembers.id })
    .from(householdMembers)
    .where(eq(householdMembers.householdId, householdId))
    .limit(1);

  if (rows[0]) {
    return rows[0].id;
  }

  const [created] = await db
    .insert(householdMembers)
    .values({
      householdId,
      displayName: "Household",
    })
    .returning({ id: householdMembers.id });

  if (!created) {
    throw new Error("Could not create household member.");
  }

  return created.id;
}
