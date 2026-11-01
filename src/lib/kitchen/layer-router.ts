import { getLayerToolHintPrompt } from "@/lib/ai/prompts";

export type KitchenLayer =
  | "grocery_list"
  | "meals"
  | "recipe"
  | "preference"
  | "general";

const GROCERY_WRITE_TOOLS = new Set([
  "addGroceryItem",
  "removeGroceryItem",
  "removeGroceryItems",
  "setGroceryList",
  "clearGroceryList",
  "tidyGroceryList",
  "generateGroceryList",
  "createGroceryCategory",
  "renameGroceryCategory",
  "deleteGroceryCategory",
  "moveGroceryItem",
]);

const MEAL_WRITE_TOOLS = new Set([
  "createWeeklyPlan",
  "modifyWeeklyPlan",
  "completeCurrentMealBatch",
  "proposeWeeklyMeatOptions",
  "addScheduleEvent",
  "removeScheduleEvent",
]);

/** Infer which kitchen layer the user is editing. */
export function inferKitchenLayer(userText: string): KitchenLayer {
  const lower = userText.toLowerCase().trim();

  if (
    lower.includes("grocery list") ||
    lower.includes("shopping list") ||
    lower.includes("grocery category") ||
    lower.includes("list category") ||
    lower.includes("to buy") ||
    /\b(clear|tidy|clean)\b/.test(lower) ||
    (/\bonly\b/.test(lower) && /\b(list|ketchup|sauce|grocery)\b/.test(lower)) ||
    /\b(add|remove|clear|tidy|clean|print|show|create|rename|delete|move).*(grocery|shopping|list|category)\b/.test(
      lower,
    ) ||
    /\b(grocery|shopping|list|category).*(add|remove|clear|only|except|create|rename|delete|move)\b/.test(
      lower,
    ) ||
    lower.includes("we bought") ||
    lower.includes("we finished") ||
    lower.includes("used up") ||
    lower.includes("finished the")
  ) {
    return "grocery_list";
  }

  if (
    lower.includes("what can we make") ||
    lower.includes("recipe") ||
    lower.includes("how do i make") ||
    lower.includes("what's for dinner") ||
    lower.includes("whats for dinner") ||
    lower.includes("start cooking") ||
    (lower.includes("give me the") && lower.includes("recipe"))
  ) {
    return "recipe";
  }

  if (
    lower.includes("plan our week") ||
    lower.includes("plan next week") ||
    lower.includes("weekly plan") ||
    /\bmeal\s+\d+\b/.test(lower) ||
    lower.includes("finish the batch") ||
    lower.includes("finish this batch")
  ) {
    return "meals";
  }

  if (
    lower.includes("don't like") ||
    lower.includes("dont like") ||
    lower.includes("loved") ||
    lower.includes("favorite") ||
    lower.includes("don't make") ||
    lower.includes("save preference")
  ) {
    return "preference";
  }

  if (lower.includes("add ") && !lower.includes("plan")) {
    return "grocery_list";
  }

  if (lower.includes("remove ") && lower.includes("from the list")) {
    return "grocery_list";
  }

  return "general";
}

export function layerToolHint(layer: KitchenLayer): string {
  return getLayerToolHintPrompt(layer);
}

export function filterToolsForLayer<T extends Record<string, unknown>>(
  tools: T,
  layer: KitchenLayer,
): T {
  if (layer === "general") return tools;

  const filtered = { ...tools } as T;
  const keys = Object.keys(tools);

  if (layer === "grocery_list") {
    for (const key of keys) {
      if (MEAL_WRITE_TOOLS.has(key)) {
        delete filtered[key as keyof T];
      }
    }
  }

  if (layer === "meals") {
    for (const key of keys) {
      if (GROCERY_WRITE_TOOLS.has(key)) {
        delete filtered[key as keyof T];
      }
    }
  }

  if (layer === "recipe" || layer === "preference") {
    for (const key of keys) {
      if (GROCERY_WRITE_TOOLS.has(key) || MEAL_WRITE_TOOLS.has(key)) {
        delete filtered[key as keyof T];
      }
    }
  }

  return filtered;
}

export function conversationLimitForLayer(
  layer: KitchenLayer,
  planStatus?: string | null,
): number {
  if (layer === "grocery_list" || layer === "general") return 16;
  if (layer === "meals" && planStatus === "active") {
    return 16;
  }
  return 8;
}
