import { describe, expect, it } from "vitest";

import {
  tidyRecipeIngredient,
  toIngredientsText,
} from "@/lib/recipes/shopping-format";

describe("tidyRecipeIngredient", () => {
  it("strips culinary prep from names", () => {
    const tidied = tidyRecipeIngredient({
      name: "onion, diced",
      quantityText: "1 large",
    });
    expect(tidied.name.toLowerCase()).toContain("onion");
    expect(tidied.name.toLowerCase()).not.toContain("diced");
  });
});

describe("toIngredientsText", () => {
  it("formats shoppable lines and drops water", () => {
    const text = toIngredientsText([
      { name: "Chicken thighs", quantityText: "2 lb" },
      { name: "water", quantityText: "1 cup" },
      { name: "Salt", quantityText: "" },
    ]);
    expect(text).toContain("Chicken thighs");
    expect(text.toLowerCase()).not.toContain("water");
    expect(text).toMatch(/Salt/);
  });
});
