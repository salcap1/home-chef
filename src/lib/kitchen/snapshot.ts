import type { GroceryListItem, MealPlan, MealPlanItem } from "@/lib/db/schema";
import {
  formatGroceryListForPrompt,
  formatWeeklyPlanForPrompt,
} from "@/lib/planning/service";

function compactItemNames(
  items: Array<{ name: string }>,
  max = 14,
): string {
  if (items.length === 0) return "(empty)";
  const names = items.map((item) => item.name);
  if (names.length <= max) return names.join("; ");
  return `${names.slice(0, max).join("; ")}; …+${names.length - max} more`;
}

export function formatKitchenSnapshot(input: {
  groceryItems: GroceryListItem[];
  plan: { plan: MealPlan; items: MealPlanItem[] } | null;
  upcomingPlan?: { plan: MealPlan; items: MealPlanItem[] } | null;
  notablePrefs?: string[];
  /** compact = one-line summaries; full = append the full grocery list */
  detail?: "compact" | "full";
}): string {
  const toBuy = input.groceryItems;
  const mealSummary = input.plan
    ? `${input.plan.items.length} meal(s), ${input.plan.plan.status}`
    : "none";
  const upcomingSummary = input.upcomingPlan
    ? `${input.upcomingPlan.items.length} meal(s), ${input.upcomingPlan.plan.status}`
    : null;

  const lines = [
    "KITCHEN SNAPSHOT (parallel state — edit one layer at a time)",
    "",
    `TO BUY (${toBuy.length}): ${compactItemNames(toBuy)}`,
    "",
    `CURRENT MEALS (${mealSummary}):`,
    input.plan
      ? formatWeeklyPlanForPrompt(input.plan.plan, input.plan.items)
      : "No saved meal batch.",
  ];

  if (upcomingSummary) {
    lines.push(
      "",
      `UPCOMING MEALS (${upcomingSummary}):`,
      formatWeeklyPlanForPrompt(
        input.upcomingPlan!.plan,
        input.upcomingPlan!.items,
      ),
    );
  }

  if (input.notablePrefs && input.notablePrefs.length > 0) {
    lines.push("", "NOTABLE PREFS:", input.notablePrefs.join("; "));
  }

  if (input.detail === "full") {
    lines.push(
      "",
      "Full detail:",
      "Grocery list:",
      formatGroceryListForPrompt(input.groceryItems),
    );
  }

  return lines.join("\n");
}
