import { ToolLoopAgent, stepCountIs } from "ai";

import {
  getActivePlanningPrompt,
  getChefSystemInstructions,
  getFoodKnowledgePrompt,
} from "@/lib/ai/prompts";
import { getConversationModel, getPlanningModel } from "@/lib/ai/models";
import { createCostTools } from "@/lib/ai/tools/cost";
import { type HouseholdToolContext } from "@/lib/ai/tools/context";
import { createMealMemoryTools } from "@/lib/ai/tools/meals";
import { createPlanningTools } from "@/lib/ai/tools/planning";
import { createPreferenceTools } from "@/lib/ai/tools/preferences";
import { createRecipeTools } from "@/lib/ai/tools/recipes";
import { assertAiAllowed } from "@/lib/ai/budget";
import {
  estimateCostUsd,
  getRecentConversation,
  recordAiUsage,
  recordConversationMessage,
  type AiUsageCategory,
} from "@/lib/conversation/service";
import { getEnv } from "@/lib/env";
import { dateInTimeZone, mondayOfWeek } from "@/lib/grocery/calculate";
import {
  conversationLimitForLayer,
  filterToolsForLayer,
  inferKitchenLayer,
  layerToolHint,
} from "@/lib/kitchen/layer-router";
import { formatKitchenSnapshot } from "@/lib/kitchen/snapshot";
import {
  formatFavoritesForPrompt,
  formatRecentMealsForPrompt,
  getRecentMeals,
  listFavoriteRecipes,
} from "@/lib/meals/service";
import {
  getActiveGroceryList,
  getCurrentWeeklyPlan,
  getEditableWeeklyPlan,
  getUpcomingWeeklyPlan,
  listScheduleEvents,
} from "@/lib/planning/service";
import {
  formatPreferencesContextForPrompt,
  listPreferences,
} from "@/lib/preferences/service";

function inferCategory(userText: string): AiUsageCategory {
  const lower = userText.toLowerCase();
  if (lower.includes("cost")) return "cost";
  if (lower.includes("grocery") || lower.includes("shopping list")) return "grocery";
  if (lower.includes("plan our week") || lower.includes("weekly plan")) {
    return "planning";
  }
  if (lower.includes("recipe") || lower.includes("how do i make")) return "recipe";
  if (
    lower.includes("don't like") ||
    lower.includes("loved") ||
    lower.includes("favorite") ||
    lower.includes("don't make")
  ) {
    return "memory";
  }
  return "conversation";
}

function pickModel(userText: string): string {
  const lower = userText.toLowerCase();
  if (
    lower.includes("plan our week") ||
    lower.includes("weekly plan") ||
    lower.includes("generate a recipe") ||
    lower.includes("make a recipe")
  ) {
    return getPlanningModel();
  }
  return getConversationModel();
}

function notablePrefs(prefs: Awaited<ReturnType<typeof listPreferences>>): string[] {
  return prefs
    .filter((pref) => pref.kind === "dislike" || pref.kind === "constraint")
    .slice(0, 8)
    .map((pref) => `${pref.key}: ${pref.value}`);
}

export async function runHouseholdChefAgent(input: {
  householdId: string;
  memberId?: string | null;
  userText: string;
  timezone?: string;
}): Promise<string> {
  await assertAiAllowed(input.householdId, "chat");

  const ctx: HouseholdToolContext = {
    householdId: input.householdId,
    memberId: input.memberId ?? null,
  };

  const tz = input.timezone ?? getEnv().HOUSEHOLD_TIMEZONE;
  const weekStart = mondayOfWeek(new Date(), tz);
  const layer = inferKitchenLayer(input.userText);
  const [currentPlan, upcomingPlan, editablePlan] = await Promise.all([
    getCurrentWeeklyPlan(input.householdId),
    getUpcomingWeeklyPlan(input.householdId),
    getEditableWeeklyPlan(input.householdId),
  ]);
  const historyLimit = conversationLimitForLayer(
    layer,
    editablePlan?.plan.status ?? currentPlan?.plan.status,
  );
  const includeFullKitchenLists = layer === "grocery_list";
  const activePlanning = Boolean(editablePlan);

  const [
    prefs,
    recentMeals,
    favorites,
    grocery,
    schedule,
    recent,
  ] = await Promise.all([
    listPreferences(input.householdId),
    getRecentMeals(input.householdId, 8),
    listFavoriteRecipes(input.householdId),
    getActiveGroceryList(input.householdId),
    listScheduleEvents(input.householdId, weekStart),
    getRecentConversation(input.householdId, historyLimit),
  ]);

  const preferenceContext = formatPreferencesContextForPrompt(prefs);
  const model = pickModel(input.userText);

  const allTools = {
    ...createPreferenceTools(ctx),
    ...createMealMemoryTools(ctx),
    ...createRecipeTools(ctx),
    ...createPlanningTools(ctx),
    ...createCostTools(ctx),
  };
  const tools = filterToolsForLayer(allTools, layer);

  const agent = new ToolLoopAgent({
    model,
    instructions: getChefSystemInstructions(),
    tools,
    stopWhen: stepCountIs(12),
    temperature: 0.4,
  });

  const kitchenSnapshot = formatKitchenSnapshot({
    groceryItems: grocery?.items ?? [],
    plan: currentPlan,
    upcomingPlan,
    notablePrefs: notablePrefs(prefs),
    detail: includeFullKitchenLists ? "full" : "compact",
  });

  const contextBlock = [
    `Today (${tz}): ${dateInTimeZone(new Date(), tz)}`,
    `Week start: ${weekStart}`,
    `Detected layer: ${layer}`,
    layerToolHint(layer),
    activePlanning ? getActivePlanningPrompt() : null,
    "",
    getFoodKnowledgePrompt(),
    "",
    kitchenSnapshot,
    "",
    preferenceContext.structuralPlanningRules,
    "",
    "Saved menu preferences:",
    preferenceContext.menuPreferences,
    "",
    "Ingredient & food preferences:",
    preferenceContext.foodPreferences,
    "",
    "Recent meals:",
    formatRecentMealsForPrompt(recentMeals),
    "",
    "Favorite recipes:",
    formatFavoritesForPrompt(favorites.slice(0, 8)),
    "",
    "Schedule:",
    schedule.length === 0
      ? "No schedule constraints."
      : schedule
        .map(
          (event) =>
            `- ${event.eventDate}: ${event.title}${event.skipDinner ? " (skip dinner)" : ""}`,
        )
        .join("\n"),
  ]
    .filter((line) => line !== null && line !== "")
    .join("\n");

  const messages = [
    ...recent.map((message) => ({
      role: message.role as "user" | "assistant" | "system",
      content: message.content,
    })),
    {
      role: "user" as const,
      content: `${contextBlock}\n\nUser message:\n${input.userText}`,
    },
  ];

  await recordConversationMessage({
    householdId: input.householdId,
    memberId: input.memberId,
    role: "user",
    content: input.userText,
  });

  const result = await agent.generate({ messages });

  const inputTokens = result.totalUsage?.inputTokens ?? 0;
  const outputTokens = result.totalUsage?.outputTokens ?? 0;
  const gatewayCost =
    (
      result.providerMetadata as
      | { gateway?: { cost?: number } }
      | undefined
    )?.gateway?.cost ?? null;

  await recordAiUsage({
    householdId: input.householdId,
    model,
    category: inferCategory(input.userText),
    inputTokens,
    outputTokens,
    estimatedCostUsd: estimateCostUsd({
      model,
      inputTokens,
      outputTokens,
      gatewayCostUsd: gatewayCost,
    }),
  });

  const reply =
    result.text?.trim() ||
    "👨‍🍳 Hit a snag in the kitchen — try again in a moment.";

  await recordConversationMessage({
    householdId: input.householdId,
    memberId: input.memberId,
    role: "assistant",
    content: reply,
  });

  return reply;
}
