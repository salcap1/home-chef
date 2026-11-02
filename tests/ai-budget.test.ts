import { describe, expect, it } from "vitest";

import {
  AiBudgetExceededError,
  isAiBudgetExceededError,
} from "@/lib/ai/budget";

describe("AiBudgetExceededError", () => {
  it("is detectable via type guard", () => {
    const error = new AiBudgetExceededError(
      "household_budget",
      "This kitchen’s AI budget for the month is used up ($5.00).",
    );
    expect(isAiBudgetExceededError(error)).toBe(true);
    expect(isAiBudgetExceededError(new Error("nope"))).toBe(false);
    expect(error.code).toBe("household_budget");
  });

  it("supports demo_chat_limit code", () => {
    const error = new AiBudgetExceededError(
      "demo_chat_limit",
      "This demo kitchen’s 3 chef messages are used up.",
    );
    expect(isAiBudgetExceededError(error)).toBe(true);
    expect(error.code).toBe("demo_chat_limit");
  });
});
