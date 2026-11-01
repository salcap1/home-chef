import type { CostSummary } from "@/lib/conversation/service";
import type {
  GroceryListCategory,
  GroceryListItem,
  MealPlan,
  MealPlanItem,
  Recipe,
} from "@/lib/db/schema";
import { listGroceryCategories } from "@/lib/planning/grocery-categories";

function bulletLines(text: string, bullet = "•"): string {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `${bullet} ${line}`)
    .join("\n");
}

export function formatWeeklyPlan(
  plan: MealPlan,
  items: MealPlanItem[],
): string {
  const title = plan.title ?? `Week of ${plan.weekStartDate}`;
  const lines = [`🍳 ${title} [${plan.status}]`];

  if (items.length === 0) {
    lines.push("No meals yet.");
    return lines.join("\n");
  }

  const dinners = items
    .filter((item) => item.mealType === "dinner")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.mealDate.localeCompare(b.mealDate));
  const other = items
    .filter((item) => item.mealType !== "dinner")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.mealDate.localeCompare(b.mealDate));

  dinners.forEach((item, index) => {
    const note = item.notes ? ` — ${item.notes}` : "";
    lines.push(`Meal ${index + 1} — ${item.title}${note}`);
  });

  for (const item of other) {
    const note = item.notes ? ` — ${item.notes}` : "";
    lines.push(`${item.mealType} — ${item.title}${note}`);
  }

  return lines.join("\n");
}

export function formatGroceryList(
  items: GroceryListItem[],
  categories: Pick<GroceryListCategory, "id" | "name" | "isDefault" | "sortOrder">[] = [],
): string {
  if (items.length === 0) {
    return "🛒 Grocery list\nEmpty — add items anytime, or pull needs from a meal batch.";
  }

  const lines = ["🛒 Grocery list", ""];

  if (categories.length === 0) {
    const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
    for (const item of sorted) {
      lines.push(formatGroceryLine(item));
    }
    return lines.join("\n").trim();
  }

  const byCategory = new Map<string, GroceryListItem[]>();
  for (const item of items) {
    const group = byCategory.get(item.categoryId) ?? [];
    group.push(item);
    byCategory.set(item.categoryId, group);
  }

  const ordered = [...categories].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name);
  });

  const seen = new Set<string>();
  for (const category of ordered) {
    const group = byCategory.get(category.id);
    if (!group || group.length === 0) continue;
    seen.add(category.id);
    lines.push(category.name);
    for (const item of [...group].sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(formatGroceryLine(item));
    }
    lines.push("");
  }

  for (const [categoryId, group] of byCategory) {
    if (seen.has(categoryId) || group.length === 0) continue;
    lines.push("Other");
    for (const item of [...group].sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(formatGroceryLine(item));
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

/** Load household categories and format a grouped grocery list. */
export async function formatHouseholdGroceryList(
  householdId: string,
  items: GroceryListItem[],
): Promise<string> {
  const categories = await listGroceryCategories(householdId);
  return formatGroceryList(items, categories);
}

function formatGroceryLine(item: GroceryListItem): string {
  const qty = item.quantityText ? ` — ${item.quantityText}` : "";
  return `• ${item.name}${qty}`;
}

export function formatRecipe(recipe: Recipe): string {
  const meta: string[] = [];
  if (recipe.servings) meta.push(`${recipe.servings} servings`);
  if (recipe.totalTimeMinutes) meta.push(`~${recipe.totalTimeMinutes} min`);
  else if (recipe.prepTimeMinutes || recipe.cookTimeMinutes) {
    meta.push(
      `prep ${recipe.prepTimeMinutes ?? "?"} / cook ${recipe.cookTimeMinutes ?? "?"}`,
    );
  }

  const lines = [
    `🍳 ${recipe.name}`,
    recipe.summary ?? null,
    meta.length > 0 ? meta.join(" · ") : null,
    "",
    "Ingredients",
    recipe.ingredientsText
      ? bulletLines(recipe.ingredientsText)
      : "(none saved)",
    "",
    "Steps",
    recipe.instructionsText
      ? bulletLines(recipe.instructionsText)
      : "(none saved)",
  ];

  return lines.filter((line) => line !== null).join("\n");
}

export function formatCostSummary(summary: CostSummary): string {
  const lines = [
    "💰 AI usage this month",
    "",
    `Total: $${summary.totalUsd.toFixed(2)}`,
    `Budget: $${summary.budgetUsd.toFixed(2)}`,
    "",
  ];

  const categories = Object.entries(summary.byCategory).sort(
    (a, b) => b[1] - a[1],
  );
  if (categories.length === 0) {
    lines.push("No AI usage recorded yet this month.");
  } else {
    for (const [category, amount] of categories) {
      const label = category.charAt(0).toUpperCase() + category.slice(1);
      lines.push(`• ${label}: $${amount.toFixed(2)}`);
    }
  }

  return lines.join("\n");
}
