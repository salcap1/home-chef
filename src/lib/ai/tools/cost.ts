import { tool } from "ai";
import { z } from "zod";

import { getMonthlyCostSummary } from "@/lib/conversation/service";
import { formatCostSummary } from "@/lib/kitchen/format";

import type { HouseholdToolContext } from "@/lib/ai/tools/context";

export function createCostTools(ctx: HouseholdToolContext) {
  return {
    getAICostSummary: tool({
      description:
        "Get estimated AI usage cost for the current calendar month.",
      inputSchema: z.object({}),
      execute: async () => {
        const summary = await getMonthlyCostSummary(ctx.householdId);
        return {
          ...summary,
          formatted: formatCostSummary(summary),
        };
      },
    }),
  };
}
