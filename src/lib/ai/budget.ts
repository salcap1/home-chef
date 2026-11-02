import { and, count, eq, gte, sql } from "drizzle-orm";

import {
  getHouseholdAiChatLifetimeLimit,
  getHouseholdMonthlyBudgetUsd,
} from "@/lib/household/accounts";
import { getDb } from "@/lib/db";
import { aiUsage, conversationMessages } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";

export type AiGateKind = "chat" | "generation";

export type AiBudgetCode =
  | "household_budget"
  | "global_budget"
  | "rate_limit_hour"
  | "rate_limit_day"
  | "demo_chat_limit";

export class AiBudgetExceededError extends Error {
  readonly code: AiBudgetCode;

  constructor(code: AiBudgetCode, message: string) {
    super(message);
    this.name = "AiBudgetExceededError";
    this.code = code;
  }
}

export function isAiBudgetExceededError(
  error: unknown,
): error is AiBudgetExceededError {
  return error instanceof AiBudgetExceededError;
}

function monthStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getHouseholdSpendUsd(
  householdId: string,
  now = new Date(),
): Promise<number> {
  const db = getDb();
  const start = monthStartUtc(now);
  const rows = await db
    .select({
      total: sql<string>`coalesce(sum(${aiUsage.estimatedCostUsd}), 0)`,
    })
    .from(aiUsage)
    .where(
      and(eq(aiUsage.householdId, householdId), gte(aiUsage.createdAt, start)),
    );

  return Number(Number(rows[0]?.total ?? 0).toFixed(6));
}

export async function getGlobalSpendUsd(now = new Date()): Promise<number> {
  const db = getDb();
  const start = monthStartUtc(now);
  const rows = await db
    .select({
      total: sql<string>`coalesce(sum(${aiUsage.estimatedCostUsd}), 0)`,
    })
    .from(aiUsage)
    .where(gte(aiUsage.createdAt, start));

  return Number(Number(rows[0]?.total ?? 0).toFixed(6));
}

async function countUserChatMessagesSince(
  householdId: string,
  since: Date,
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ value: count() })
    .from(conversationMessages)
    .where(
      and(
        eq(conversationMessages.householdId, householdId),
        eq(conversationMessages.role, "user"),
        gte(conversationMessages.createdAt, since),
      ),
    );
  return Number(rows[0]?.value ?? 0);
}

async function countUserChatMessagesAllTime(
  householdId: string,
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ value: count() })
    .from(conversationMessages)
    .where(
      and(
        eq(conversationMessages.householdId, householdId),
        eq(conversationMessages.role, "user"),
      ),
    );
  return Number(rows[0]?.value ?? 0);
}

/**
 * Hard gate before any paid model call.
 * Chat also enforces hourly/daily message caps and demo lifetime caps.
 */
export async function assertAiAllowed(
  householdId: string,
  kind: AiGateKind = "generation",
  now = new Date(),
): Promise<void> {
  const env = getEnv();

  if (kind === "chat") {
    const lifetimeLimit = await getHouseholdAiChatLifetimeLimit(householdId);
    if (lifetimeLimit != null) {
      const lifetime = await countUserChatMessagesAllTime(householdId);
      if (lifetime >= lifetimeLimit) {
        throw new AiBudgetExceededError(
          "demo_chat_limit",
          `This demo kitchen’s ${lifetimeLimit} chef messages are used up.`,
        );
      }
    }

    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [hourly, daily] = await Promise.all([
      countUserChatMessagesSince(householdId, hourAgo),
      countUserChatMessagesSince(householdId, dayAgo),
    ]);

    if (hourly >= env.AI_CHAT_HOURLY_LIMIT) {
      throw new AiBudgetExceededError(
        "rate_limit_hour",
        `Too many chef messages this hour (limit ${env.AI_CHAT_HOURLY_LIMIT}). Try again later.`,
      );
    }
    if (daily >= env.AI_CHAT_DAILY_LIMIT) {
      throw new AiBudgetExceededError(
        "rate_limit_day",
        `Too many chef messages today (limit ${env.AI_CHAT_DAILY_LIMIT}). Try again tomorrow.`,
      );
    }
  }

  const [spent, budget] = await Promise.all([
    getHouseholdSpendUsd(householdId, now),
    getHouseholdMonthlyBudgetUsd(householdId),
  ]);

  if (spent >= budget) {
    throw new AiBudgetExceededError(
      "household_budget",
      `This kitchen’s AI budget for the month is used up ($${budget.toFixed(2)}).`,
    );
  }

  const globalBudget = env.AI_GLOBAL_MONTHLY_BUDGET_USD;
  if (globalBudget != null) {
    const globalSpent = await getGlobalSpendUsd(now);
    if (globalSpent >= globalBudget) {
      throw new AiBudgetExceededError(
        "global_budget",
        "AI is paused site-wide for the rest of the month.",
      );
    }
  }
}
