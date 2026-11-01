import { describe, expect, it } from "vitest";

import { parseUseIngredients } from "@/lib/ai/meal-batch";

describe("parseUseIngredients", () => {
  it("splits commas, newlines, and semicolons", () => {
    expect(parseUseIngredients("spinach, ricotta\nlemon; garlic")).toEqual([
      "spinach",
      "ricotta",
      "lemon",
      "garlic",
    ]);
  });

  it("dedupes case-insensitively and caps length", () => {
    expect(parseUseIngredients(["Spinach", "spinach", "  ricotta  "])).toEqual([
      "Spinach",
      "ricotta",
    ]);
  });

  it("returns empty for blank input", () => {
    expect(parseUseIngredients("")).toEqual([]);
    expect(parseUseIngredients(null)).toEqual([]);
  });
});
