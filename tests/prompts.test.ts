import { describe, expect, it } from "vitest";

import {
  getActivePlanningPrompt,
  getChefSystemInstructions,
  getFoodKnowledgePrompt,
  getLayerToolHintPrompt,
  getPlanningWorkflowBasePrompt,
  getRecipeGenerationPrompt,
  getRecipeTweakPrompt,
} from "@/lib/ai/prompts";
import { renderPrompt } from "@/lib/ai/prompts/loader";

describe("runtime prompts", () => {
  it("loads chef system instructions from markdown", () => {
    const text = getChefSystemInstructions();
    expect(text).toContain("Chef Carmela");
    expect(text).toContain("Do NOT end replies with questions");
    expect(text).toContain('No "use soon"');
  });

  it("loads food knowledge rules without use-soon", () => {
    const text = getFoodKnowledgePrompt();
    expect(text).toContain("CANONICAL");
    expect(text).toContain("Do not track, infer, or mention");
  });

  it("loads planning workflow base", () => {
    const text = getPlanningWorkflowBasePrompt();
    expect(text).toContain("Step 1");
    expect(text).toContain("proposeWeeklyMeatOptions");
  });

  it("renders recipe generation template", () => {
    const text = getRecipeGenerationPrompt({
      userRequest: "easy chicken dinner",
      context: "have thighs",
      servingsTarget: "6-8",
    });
    expect(text).toContain("easy chicken dinner");
    expect(text).toContain("have thighs");
    expect(text).toContain("6-8 servings");
    expect(text).toContain("Do NOT use 4 servings");
    expect(text).toContain("short shopping name");
    expect(text).toContain("Do NOT list: water");
  });

  it("renders recipe tweak template", () => {
    const text = getRecipeTweakPrompt({
      feedback: "make it crispier",
      recipeJson: '{"name":"chicken"}',
    });
    expect(text).toContain("make it crispier");
    expect(text).toContain("mode \"patch\"");
    expect(text).toContain("chicken");
  });

  it("loads layer hints by key", () => {
    expect(getLayerToolHintPrompt("grocery_list")).toContain("GROCERY LIST");
    expect(getLayerToolHintPrompt("meals")).toContain("MEALS");
  });

  it("loads active planning prompt", () => {
    expect(getActivePlanningPrompt()).toContain("ACTIVE PLANNING");
  });

  it("renderPrompt replaces placeholders", () => {
    expect(renderPrompt("Hello {{name}}", { name: "Chef" })).toBe(
      "Hello Chef",
    );
  });
});
