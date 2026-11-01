import { and, asc, eq, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { households } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { computePasscodeLookup } from "@/lib/panel/passcode";

export async function findHouseholdIdByPasscodeLookup(
  passcodeLookup: string,
): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ id: households.id })
    .from(households)
    .where(eq(households.passcodeLookup, passcodeLookup))
    .limit(1);
  return rows[0]?.id ?? null;
}

/** Attach a passcode to the oldest household that has none (one-time legacy migrate). */
export async function claimLegacyHouseholdPasscode(
  passcodeLookup: string,
): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ id: households.id })
    .from(households)
    .where(isNull(households.passcodeLookup))
    .orderBy(asc(households.createdAt))
    .limit(1);

  const existing = rows[0];
  if (!existing) return null;

  const updated = await db
    .update(households)
    .set({ passcodeLookup, updatedAt: new Date() })
    .where(
      and(eq(households.id, existing.id), isNull(households.passcodeLookup)),
    )
    .returning({ id: households.id });

  return updated[0]?.id ?? null;
}

export async function createHouseholdWithPasscode(input: {
  name: string;
  passcode: string;
  sessionPepper: string;
  monthlyBudgetUsd?: number | null;
}): Promise<{ id: string; passcodeLookup: string }> {
  const passcodeLookup = computePasscodeLookup(
    input.passcode,
    input.sessionPepper,
  );
  const db = getDb();

  const existing = await findHouseholdIdByPasscodeLookup(passcodeLookup);
  if (existing) {
    throw new Error("That passcode is already in use.");
  }

  const [created] = await db
    .insert(households)
    .values({
      name: input.name,
      passcodeLookup,
      monthlyBudgetUsd:
        input.monthlyBudgetUsd != null
          ? String(input.monthlyBudgetUsd)
          : null,
    })
    .returning({ id: households.id });

  if (!created) {
    throw new Error("Could not create household.");
  }

  return { id: created.id, passcodeLookup };
}

export async function setHouseholdPasscode(input: {
  householdId: string;
  passcode: string;
  sessionPepper: string;
}): Promise<void> {
  const passcodeLookup = computePasscodeLookup(
    input.passcode,
    input.sessionPepper,
  );
  const clash = await findHouseholdIdByPasscodeLookup(passcodeLookup);
  if (clash && clash !== input.householdId) {
    throw new Error("That passcode is already in use.");
  }

  const db = getDb();
  const updated = await db
    .update(households)
    .set({ passcodeLookup, updatedAt: new Date() })
    .where(eq(households.id, input.householdId))
    .returning({ id: households.id });

  if (!updated[0]) {
    throw new Error(`Household not found: ${input.householdId}`);
  }
}

export async function getHouseholdMonthlyBudgetUsd(
  householdId: string,
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ monthlyBudgetUsd: households.monthlyBudgetUsd })
    .from(households)
    .where(eq(households.id, householdId))
    .limit(1);

  const raw = rows[0]?.monthlyBudgetUsd;
  if (raw != null && raw !== "") {
    const value = Number(raw);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return getEnv().AI_MONTHLY_BUDGET_USD;
}
