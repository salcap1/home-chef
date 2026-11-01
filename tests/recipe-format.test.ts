import { describe, expect, it } from "vitest";

import {
  parseIngredientLines,
  parseInstructionSteps,
} from "@/lib/panel/recipe-format";

describe("parseIngredientLines", () => {
  it("splits name and quantity on em dash", () => {
    expect(
      parseIngredientLines("Chicken thighs — 2.5 lb\nRice — 2 cups"),
    ).toEqual([
      { name: "Chicken thighs", quantity: "2.5 lb" },
      { name: "Rice", quantity: "2 cups" },
    ]);
  });

  it("keeps plain lines without quantity", () => {
    expect(parseIngredientLines("salt to taste")).toEqual([
      { name: "salt to taste", quantity: null },
    ]);
  });
});

describe("parseInstructionSteps", () => {
  it("numbers steps and strips existing numbers", () => {
    expect(
      parseInstructionSteps(
        "1. Preheat oven\n2. Season chicken\nBake 25 minutes",
      ),
    ).toEqual([
      { number: 1, text: "Preheat oven", ingredients: [] },
      { number: 2, text: "Season chicken", ingredients: [] },
      { number: 3, text: "Bake 25 minutes", ingredients: [] },
    ]);
  });

  it("attaches nested ingredient lines to the step", () => {
    expect(
      parseInstructionSteps(
        [
          "1. Season the chicken.",
          "   · Chicken thighs — 2.5 lb",
          "   · Salt — 1 tsp",
          "2. Heat the oil.",
          "   · Olive oil — 2 tbsp",
        ].join("\n"),
      ),
    ).toEqual([
      {
        number: 1,
        text: "Season the chicken.",
        ingredients: [
          { name: "Chicken thighs", quantity: "2.5 lb" },
          { name: "Salt", quantity: "1 tsp" },
        ],
      },
      {
        number: 2,
        text: "Heat the oil.",
        ingredients: [{ name: "Olive oil", quantity: "2 tbsp" }],
      },
    ]);
  });

  it("strips duplicated leading numbers from step text", () => {
    expect(
      parseInstructionSteps("1. 1. Preheat oven\n2. 2) Season chicken"),
    ).toEqual([
      { number: 1, text: "Preheat oven", ingredients: [] },
      { number: 2, text: "Season chicken", ingredients: [] },
    ]);
  });
});
