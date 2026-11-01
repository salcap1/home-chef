import { describe, expect, it } from "vitest";

import { normalizeIngredientName } from "@/lib/kitchen/normalize";
import { estimateCostUsd } from "@/lib/conversation/service";

describe("normalizeIngredientName", () => {
  it("normalizes casing and punctuation", () => {
    expect(normalizeIngredientName("  Chicken Thighs! ")).toBe("chicken thighs");
  });
});

describe("estimateCostUsd", () => {
  it("prefers gateway-provided cost", () => {
    expect(
      estimateCostUsd({
        model: "openai/gpt-5-mini",
        inputTokens: 1000,
        outputTokens: 1000,
        gatewayCostUsd: 0.012345,
      }),
    ).toBe(0.012345);
  });

  it("estimates from token rates", () => {
    const cost = estimateCostUsd({
      model: "openai/gpt-5-mini",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).toBe(2.25);
  });
});
