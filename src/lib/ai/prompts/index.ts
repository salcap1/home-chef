import { loadPrompt, renderPrompt } from "@/lib/ai/prompts/loader";

type LayerHintKey =
  | "grocery_list"
  | "meals"
  | "recipe"
  | "preference"
  | "general";

let layerHintsCache: Partial<Record<LayerHintKey, string>> | null = null;

function parseLayerHints(markdown: string): Partial<Record<LayerHintKey, string>> {
  const hints: Partial<Record<LayerHintKey, string>> = {};
  const sections = markdown.split(/^## /m).filter(Boolean);

  for (const section of sections) {
    const newline = section.indexOf("\n");
    if (newline === -1) continue;
    const key = section.slice(0, newline).trim() as LayerHintKey;
    const body = section.slice(newline + 1).trim();
    if (body) hints[key] = body;
  }

  return hints;
}

function getLayerHints(): Partial<Record<LayerHintKey, string>> {
  if (!layerHintsCache) {
    layerHintsCache = parseLayerHints(loadPrompt("layer-hints"));
  }
  return layerHintsCache;
}

export function getChefSystemInstructions(): string {
  return loadPrompt("chef-system");
}

export function getFoodKnowledgePrompt(): string {
  return loadPrompt("food-knowledge");
}

export function getPlanningWorkflowBasePrompt(): string {
  return loadPrompt("planning-workflow-base");
}

export function getActivePlanningPrompt(): string {
  return loadPrompt("active-planning");
}

export function getLayerToolHintPrompt(layer: LayerHintKey): string {
  const hints = getLayerHints();
  return hints[layer] ?? hints.general ?? "";
}

export function getRecipeGenerationPrompt(input: {
  userRequest: string;
  context?: string | null;
  servingsTarget: string;
}): string {
  return renderPrompt(loadPrompt("recipe-generation"), {
    userRequest: input.userRequest,
    context: input.context?.trim() || "None",
    servingsTarget: input.servingsTarget,
  });
}

export function getRecipeTweakPrompt(input: {
  feedback: string;
  recipeJson: string;
}): string {
  return renderPrompt(loadPrompt("recipe-tweak"), {
    feedback: input.feedback,
    recipeJson: input.recipeJson,
  });
}
