import { describe, expect, it } from "vitest";

import {
  cleanStepText,
  formatInstructionStepsText,
  parseStoredInstructionSteps,
} from "@/lib/recipes/instruction-steps";

describe("cleanStepText", () => {
  it("strips leading step numbers", () => {
    expect(cleanStepText("1. Preheat oven")).toBe("Preheat oven");
    expect(cleanStepText("2) Season chicken")).toBe("Season chicken");
    expect(cleanStepText("  Bake 20 minutes")).toBe("Bake 20 minutes");
  });
});

describe("formatInstructionStepsText", () => {
  it("formats numbered steps with nested ingredients", () => {
    const text = formatInstructionStepsText([
      {
        text: "1. Season the chicken.",
        ingredients: [
          { name: "Chicken thighs", quantityText: "2 lb" },
          { name: "Salt", quantityText: "" },
        ],
      },
      { text: "Heat the pan.", ingredients: [] },
    ]);
    expect(text).toBe(
      [
        "1. Season the chicken.",
        "   · Chicken thighs — 2 lb",
        "   · Salt",
        "2. Heat the pan.",
      ].join("\n"),
    );
  });
});

describe("parseStoredInstructionSteps", () => {
  it("returns null for invalid payloads", () => {
    expect(parseStoredInstructionSteps(null)).toBeNull();
    expect(parseStoredInstructionSteps("nope")).toBeNull();
    expect(parseStoredInstructionSteps([{ text: 1 }])).toBeNull();
  });

  it("normalizes valid steps", () => {
    expect(
      parseStoredInstructionSteps([
        {
          text: "1. Mix.",
          ingredients: [{ name: "Flour", quantityText: "1 cup" }],
        },
      ]),
    ).toEqual([
      {
        text: "Mix.",
        ingredients: [{ name: "Flour", quantityText: "1 cup" }],
      },
    ]);
  });
});
