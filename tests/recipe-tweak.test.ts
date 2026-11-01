import { describe, expect, it } from "vitest";

import { applyRecipeTweakPatch } from "@/lib/recipes/apply-tweak";

describe("applyRecipeTweakPatch", () => {
  const current = {
    servings: 6,
    summary: "Crockpot BBQ chicken tacos",
    prepTimeMinutes: 15,
    cookTimeMinutes: 240,
    totalTimeMinutes: 255,
    ingredients: [
      { name: "chicken breasts", quantityText: "3 lb" },
      { name: "BBQ sauce", quantityText: "1 1/2 cups" },
    ],
    steps: [
      { text: "Add the chicken to the crockpot", ingredients: [] },
      {
        text: "Stir in the BBQ sauce",
        ingredients: [{ name: "BBQ sauce", quantityText: "1 1/2 cups" }],
      },
    ],
  };

  it("returns null when the patch has no operations", () => {
    expect(applyRecipeTweakPatch(current, { mode: "patch" })).toBeNull();
  });

  it("replaces one step and leaves the rest unchanged", () => {
    const next = applyRecipeTweakPatch(current, {
      mode: "patch",
      replaceSteps: [
        {
          index: 1,
          text: "Pat the chicken dry and add it to the crockpot",
          ingredients: [
            { name: "chicken breasts", quantityText: "3 lb" },
          ],
        },
      ],
    });

    expect(next?.steps[0]?.text).toBe(
      "Pat the chicken dry and add it to the crockpot",
    );
    expect(next?.steps[1]?.text).toBe("Stir in the BBQ sauce");
    expect(next?.ingredients.map((item) => item.name)).toEqual([
      "chicken breasts",
      "BBQ sauce",
    ]);
  });

  it("replaces the ingredient list when setIngredients is provided", () => {
    const next = applyRecipeTweakPatch(current, {
      mode: "patch",
      setIngredients: [
        { name: "chicken breasts", quantityText: "3 lb" },
        { name: "BBQ sauce", quantityText: "2 cups" },
      ],
    });

    expect(
      next?.ingredients.find((item) => item.name === "BBQ sauce")?.quantityText,
    ).toBe("2 cups");
    expect(next?.steps).toHaveLength(2);
  });
});
