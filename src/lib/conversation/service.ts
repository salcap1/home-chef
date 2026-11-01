import { and, desc, eq, gte, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { aiUsage, conversationMessages } from "@/lib/db/schema";
import { getHouseholdMonthlyBudgetUsd } from "@/lib/household/accounts";

export async function recordConversationMessage(input: {
  householdId: string;
  memberId?: string | null;
  role: "user" | "assistant" | "system";
  content: string;
}): Promise<void> {
  const db = getDb();

  await db.insert(conversationMessages).values({
    householdId: input.householdId,
    memberId: input.memberId ?? null,
    role: input.role,
    content: input.content,
  });
}

export async function getRecentConversation(
  householdId: string,
  limit = 8,
): Promise<Array<{ role: "user" | "assistant" | "system"; content: string }>> {
  const db = getDb();
  const rows = await db
    .select({
      role: conversationMessages.role,
      content: conversationMessages.content,
    })
    .from(conversationMessages)
    .where(eq(conversationMessages.householdId, householdId))
    .orderBy(desc(conversationMessages.createdAt))
    .limit(limit);

  return rows.reverse();
}

export type AiUsageCategory =
  | "conversation"
  | "planning"
  | "recipe"
  | "grocery"
  | "memory"
  | "cost";

/** Rough USD estimates for common AI Gateway models. Overridden when Gateway returns cost. */
const MODEL_COST_PER_MILLION: Record<
  string,
  { input: number; output: number }
> = {
  "openai/gpt-5-nano": { input: 0.05, output: 0.4 },
  "openai/gpt-5-mini": { input: 0.25, output: 2 },
  "openai/gpt-5": { input: 1.25, output: 10 },
  "google/gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "google/gemini-3-flash": { input: 0.3, output: 2.5 },
  "anthropic/claude-haiku-4.5": { input: 1, output: 5 },
};

export function estimateCostUsd(input: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  gatewayCostUsd?: number | null;
}): number {
  if (
    input.gatewayCostUsd !== undefined &&
    input.gatewayCostUsd !== null &&
    Number.isFinite(input.gatewayCostUsd)
  ) {
    return Number(input.gatewayCostUsd.toFixed(6));
  }

  const rates =
    MODEL_COST_PER_MILLION[input.model] ??
    MODEL_COST_PER_MILLION["openai/gpt-5-mini"];

  const cost =
    (input.inputTokens / 1_000_000) * rates.input +
    (input.outputTokens / 1_000_000) * rates.output;

  return Number(cost.toFixed(6));
}

export async function recordAiUsage(input: {
  householdId: string;
  model: string;
  category: AiUsageCategory;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}): Promise<void> {
  const db = getDb();
  await db.insert(aiUsage).values({
    householdId: input.householdId,
    model: input.model,
    category: input.category,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    estimatedCostUsd: String(input.estimatedCostUsd),
  });
}

export type CostSummary = {
  month: string;
  totalUsd: number;
  budgetUsd: number;
  byCategory: Record<string, number>;
};

export async function getMonthlyCostSummary(
  householdId: string,
  now = new Date(),
): Promise<CostSummary> {
  const db = getDb();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const month = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;

  const rows = await db
    .select({
      category: aiUsage.category,
      total: sql<string>`coalesce(sum(${aiUsage.estimatedCostUsd}), 0)`,
    })
    .from(aiUsage)
    .where(
      and(
        eq(aiUsage.householdId, householdId),
        gte(aiUsage.createdAt, start),
      ),
    )
    .groupBy(aiUsage.category);

  const byCategory: Record<string, number> = {};
  let totalUsd = 0;

  for (const row of rows) {
    const value = Number(row.total);
    byCategory[row.category] = value;
    totalUsd += value;
  }

  return {
    month,
    totalUsd: Number(totalUsd.toFixed(4)),
    budgetUsd: await getHouseholdMonthlyBudgetUsd(householdId),
    byCategory,
  };
}
