import { describe, expect, it } from "vitest";

import {
  consolidateGroceryNeeds,
  groceryMatchKey,
  groceryNeedsFromRecipe,
  isNonShoppableGroceryName,
  looksLikeInstructionLine,
  looksLikeMealTitleLine,
  mergeQuantityTexts,
  parseIngredientsTextToNeeds,
  simplifyQuantityText,
  shoppingNeedFromParts,
  stripCulinaryPrep,
} from "@/lib/grocery/calculate";
import { findGroceryItemByName } from "@/lib/kitchen/grocery-list";

describe("grocery calculations", () => {
  it("parses and consolidates ingredient lines by summing qty", () => {
    const needs = parseIngredientsTextToNeeds(
      "Chicken thighs — 2 lb\nRice — 1 cup\nchicken thighs — 1 lb",
    );
    const consolidated = consolidateGroceryNeeds(needs);
    expect(consolidated.some((item) => item.normalizedName === "chicken-thighs")).toBe(
      true,
    );
    const chicken = consolidated.find(
      (item) => item.normalizedName === "chicken-thighs",
    );
    expect(chicken?.quantityText).toBe("3 lb");
    expect(consolidated.filter((item) => item.normalizedName === "chicken-thighs")).toHaveLength(
      1,
    );
  });

  it("merges prep-variant names into one grocery line", () => {
    const needs = parseIngredientsTextToNeeds(
      [
        "garlic, minced — 2 cloves",
        "minced garlic — 1 clove",
        "garlic — 3 cloves",
      ].join("\n"),
    );
    const consolidated = consolidateGroceryNeeds(needs);
    expect(consolidated).toHaveLength(1);
    expect(consolidated[0]?.normalizedName).toBe("garlic");
    expect(consolidated[0]?.name.toLowerCase()).toBe("garlic");
    expect(consolidated[0]?.quantityText).toBe("6 cloves");
  });

  it("keeps commas inside ingredient names (does not split on them)", () => {
    const needs = parseIngredientsTextToNeeds(
      [
        "beef, thinly sliced across the grain (flank, sirloin, or similar) — 1 1/4 lb",
        "garlic, minced — 2 cloves",
        "green beans, trimmed (fresh) — 12 oz",
        "quinoa, rinsed — 1 cup",
      ].join("\n"),
    );

    expect(needs.map((need) => need.name)).toEqual([
      "beef",
      "garlic",
      "green beans",
      "quinoa",
    ]);
    expect(needs.some((need) => need.name === "minced")).toBe(false);
    expect(needs.some((need) => need.name === "sirloin")).toBe(false);
    expect(needs.some((need) => need.name === "rinsed")).toBe(false);
  });

  it("rejects instruction steps and meal titles", () => {
    const needs = parseIngredientsTextToNeeds(
      [
        "1. Preheat the oven to 425°F",
        "Toss the chicken with oil and salt",
        "Bake until golden, about 25 minutes",
        "Meanwhile, whisk the sauce",
        "In a large bowl combine the rice",
        "Honey-garlic pork tenderloin with mashed sweet potatoes & sautéed green beans",
        "chicken thighs — 2 lb",
        "Preheat oven — 425°F",
      ].join("\n"),
    );

    expect(needs).toHaveLength(1);
    expect(needs[0]?.normalizedName).toBe("chicken-thighs");
  });
});

describe("looksLikeInstructionLine", () => {
  it("flags cooking verbs without requiring 'the'", () => {
    expect(looksLikeInstructionLine("Bake until crispy")).toBe(true);
    expect(looksLikeInstructionLine("Meanwhile, rest the meat")).toBe(true);
    expect(looksLikeInstructionLine("Add salt and pepper")).toBe(true);
    expect(looksLikeInstructionLine("chicken thighs")).toBe(false);
  });
});

describe("stripCulinaryPrep / groceryMatchKey", () => {
  it("normalizes prep wording to the same key", () => {
    expect(stripCulinaryPrep("garlic, minced")).toBe("garlic");
    expect(groceryMatchKey("garlic, minced")).toBe(groceryMatchKey("garlic"));
    expect(groceryMatchKey("Chicken thighs")).toBe("chicken-thighs");
    expect(groceryMatchKey("chicken-thighs")).toBe("chicken-thighs");
    expect(groceryMatchKey("sweet-potato")).toBe("sweet-potato");
    expect(groceryMatchKey("pasta-sauce")).toBe("pasta-sauce");
  });

  it("keeps distinct products off the protein or produce they contain", () => {
    expect(groceryMatchKey("chicken broth")).toBe("chicken-broth");
    expect(groceryMatchKey("chicken stock")).toBe("chicken-broth");
    expect(groceryMatchKey("garlic powder")).toBe("garlic-powder");
    expect(groceryMatchKey("onion powder")).not.toBe("onion");
    expect(groceryMatchKey("fish sauce")).toBe("fish-sauce");
    expect(groceryMatchKey("rice vinegar")).toBe("rice-vinegar");
    expect(groceryMatchKey("coconut milk")).toBe("coconut-milk");
    expect(groceryMatchKey("egg noodles")).not.toBe("pasta");
  });

  it("strips optional, size, and canned noise", () => {
    expect(stripCulinaryPrep("cilantro (optional, chopped)")).toBe("cilantro");
    expect(stripCulinaryPrep("yellow onions, medium")).toBe("yellow onions");
    expect(stripCulinaryPrep("pinto beans (canned, 15 oz)")).toBe("pinto beans");
    expect(stripCulinaryPrep("onion (medium, diced)")).toBe("onion");
    expect(stripCulinaryPrep("medium flour tortillas")).toBe("flour tortillas");
    expect(groceryMatchKey("cilantro (optional)")).toBe(
      groceryMatchKey("cilantro"),
    );
  });
});

describe("mergeQuantityTexts", () => {
  it("adds compatible units", () => {
    expect(mergeQuantityTexts("2 lb", "1 lb")).toBe("3 lb");
    expect(mergeQuantityTexts("8 oz", "8 oz")).toBe("1 lb");
    expect(mergeQuantityTexts("1 cup", "1 cup")).toBe("2 cups");
    expect(mergeQuantityTexts("2 cloves", "1 clove")).toBe("3 cloves");
    expect(mergeQuantityTexts("1/4 cup", "1/4 cup")).toBe("1/2 cup");
    expect(mergeQuantityTexts("1 tbsp", "1 tsp")).toBe("1 1/3 tbsp");
    expect(mergeQuantityTexts("3 tsp", "1")).toBe("3 tsp");
  });

  it("falls back to join when units differ", () => {
    expect(mergeQuantityTexts("2 lb", "1 cup")).toBe("2 lb + 1 cup");
  });
});

describe("looksLikeMealTitleLine", () => {
  it("flags long with-style meal titles", () => {
    expect(
      looksLikeMealTitleLine(
        "Sheet-pan roasted chicken thighs with chimichurri, roasted broccoli & quinoa",
      ),
    ).toBe(true);
    expect(looksLikeMealTitleLine("chicken thighs")).toBe(false);
  });
});

describe("shopping names from messy recipe lines", () => {
  it("simplifies quantities and drops water / leftovers", () => {
    expect(simplifyQuantityText("2 lb (about 900 g) carrots, peeled")).toBe("2 lb");
    expect(simplifyQuantityText("3 cans (drained and rinsed)")).toBe("3 cans");
    expect(simplifyQuantityText("about 2 tbsp kosher salt, divided")).toBe("2 tbsp");
    expect(simplifyQuantityText("2 (15-oz) cans")).toBe("2 cans");
    expect(isNonShoppableGroceryName("Water for cooking lentils")).toBe(true);
    expect(isNonShoppableGroceryName("pasta cooking water (reserved)")).toBe(true);
    expect(
      isNonShoppableGroceryName(
        "Shredded cooked chicken breasts (from Meal 1)",
      ),
    ).toBe(true);
    expect(shoppingNeedFromParts("carrots", "2 lb")).not.toBeNull();
    expect(shoppingNeedFromParts("beef broth or water", "2 cups")?.name).toBe(
      "beef broth",
    );
    expect(
      shoppingNeedFromParts("sour cream or plain yogurt", "1 cup")?.name,
    ).toBe("sour cream");
    expect(simplifyQuantityText("1/4 cup")).toBe("1/4 cup");
  });

  it("parses a real recipe block into shoppable lines", () => {
    const needs = parseIngredientsTextToNeeds(
      [
        "green cabbage, shredded — 4 cups (about 1 small head)",
        "carrots, shredded — 1 cup (about 2 medium)",
        "cilantro (optional) — 1/2 cup chopped",
        "cilantro (optional, chopped) — 1/4 cup",
        "pinto beans (canned, 15 oz) — 3 cans (drained and rinsed)",
        "optional extra BBQ sauce for serving — 1/4 cup",
        "bottled BBQ sauce — 1 1/2 cups",
        "Water for cooking lentils — 4 cups",
        "Shredded cooked chicken breasts (from Meal 1) — 3 lb",
        "yellow onions, medium — 2",
        "yellow onions — 2 large",
      ].join("\n"),
    );
    const consolidated = consolidateGroceryNeeds(needs);

    expect(consolidated.some((item) => /water/i.test(item.name))).toBe(false);
    expect(
      consolidated.some((item) => /from meal/i.test(item.name)),
    ).toBe(false);
    expect(
      consolidated.filter((item) => item.normalizedName === "cilantro"),
    ).toHaveLength(1);
    expect(
      consolidated.filter((item) => item.normalizedName === "onion"),
    ).toHaveLength(1);
    expect(
      consolidated.filter((item) => item.normalizedName === "bbq-sauce"),
    ).toHaveLength(1);
    expect(
      consolidated.find((item) => item.normalizedName === "carrot")?.quantityText,
    ).toBe("1 cup");
  });

  it("picks up ingredients that only appear in steps", () => {
    const needs = groceryNeedsFromRecipe({
      name: "Tacos",
      ingredientsText: "flour tortillas — 12",
      instructionSteps: [
        {
          text: "Warm the beans",
          ingredients: [
            { name: "black beans (drained and rinsed)", quantityText: "2 cans" },
          ],
        },
        {
          text: "Add leftover chicken",
          ingredients: [
            {
              name: "Shredded cooked chicken (from Meal 1)",
              quantityText: "2 lb",
            },
          ],
        },
      ],
    });

    expect(needs.map((item) => item.normalizedName).sort()).toEqual([
      "black beans",
      "flour-tortilla",
    ]);
  });

  it("keeps numbered ingredient lines and does not double step amounts", () => {
    const needs = groceryNeedsFromRecipe({
      name: "Garlic",
      ingredientsText: [
        "1. chicken thighs — 2 lb",
        "2. garlic — 2 cloves",
        "3. Preheat the oven to 425°F",
      ].join("\n"),
      instructionSteps: [
        {
          text: "Season the chicken",
          ingredients: [
            { name: "garlic", quantityText: "2 cloves" },
            { name: "paprika", quantityText: "1 tsp" },
            { name: "chicken broth", quantityText: "1 cup" },
          ],
        },
      ],
    });

    const garlic = needs.find((item) => item.normalizedName === "garlic");
    expect(garlic?.quantityText).toBe("2 cloves");
    expect(needs.map((item) => item.normalizedName).sort()).toEqual([
      "chicken-broth",
      "chicken-thighs",
      "garlic",
      "paprika",
    ]);
  });

  it("reads step-only bullets when steps are not structured", () => {
    const needs = groceryNeedsFromRecipe({
      name: "Beans",
      ingredientsText: "olive oil — 1 tbsp",
      instructionsText: [
        "1. Warm the beans",
        "   · black beans — 2 cans",
        "   · olive oil — 1 tbsp",
      ].join("\n"),
    });

    expect(needs.map((item) => item.normalizedName).sort()).toEqual([
      "black beans",
      "olive-oil",
    ]);
    expect(
      needs.find((item) => item.normalizedName === "olive-oil")?.quantityText,
    ).toBe("1 tbsp");
  });

  it("parses quantity-first lines", () => {
    const needs = parseIngredientsTextToNeeds(
      "2 lb chicken thighs\n12 flour tortillas",
    );
    expect(needs.map((item) => item.normalizedName)).toEqual([
      "chicken-thighs",
      "flour-tortilla",
    ]);
    expect(needs[0]?.quantityText).toBe("2 lb");
    expect(needs[1]?.quantityText).toBe("12");
  });
});

describe("findGroceryItemByName", () => {
  const items = [
    { name: "bell pepper", normalizedName: "bell-pepper" },
    { name: "chicken thighs", normalizedName: "chicken-thighs" },
    { name: "shredded cheddar cheese", normalizedName: "cheddar-shredded" },
    { name: "chili powder", normalizedName: "chili powder" },
    { name: "yellow onion", normalizedName: "onion" },
  ];

  it("matches meal-generated canonical keys from the row label", () => {
    expect(findGroceryItemByName(items, "bell pepper")?.normalizedName).toBe(
      "bell-pepper",
    );
    expect(findGroceryItemByName(items, "chicken thighs")?.normalizedName).toBe(
      "chicken-thighs",
    );
    expect(
      findGroceryItemByName(items, "shredded cheddar cheese")?.normalizedName,
    ).toBe("cheddar-shredded");
    expect(findGroceryItemByName(items, "chili powder")?.normalizedName).toBe(
      "chili powder",
    );
    expect(findGroceryItemByName(items, "yellow onion")?.normalizedName).toBe(
      "onion",
    );
  });

  it("does not treat a cut as the whole animal", () => {
    expect(findGroceryItemByName(items, "chicken")?.normalizedName).toBeUndefined();
  });
});
