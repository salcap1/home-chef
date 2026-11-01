import { describe, expect, it } from "vitest";

import {
  formatGroceryList,
  formatRecipe,
  formatWeeklyPlan,
} from "@/lib/kitchen/format";
import type { GroceryListItem, MealPlan, MealPlanItem, Recipe } from "@/lib/db/schema";

describe("formatWeeklyPlan", () => {
  it("renders compact plan lines", () => {
    const plan = {
      id: "1",
      householdId: "h",
      weekStartDate: "2026-09-01",
      title: "This week",
      status: "active",
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as MealPlan;

    const items = [
      {
        id: "i1",
        mealPlanId: "1",
        householdId: "h",
        mealDate: "2026-09-01",
        mealType: "dinner",
        title: "Honey garlic chicken",
        notes: null,
        recipeId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as MealPlanItem[];

    const text = formatWeeklyPlan(plan, items);
    expect(text).toContain("🍳 This week [active]");
    expect(text).toContain("Meal 1");
    expect(text).toContain("Honey garlic chicken");
  });
});

describe("formatRecipe", () => {
  it("uses headers and bullets", () => {
    const recipe = {
      id: "r1",
      householdId: "h",
      name: "Test Pasta",
      normalizedName: "test pasta",
      summary: "Easy",
      servings: 4,
      prepTimeMinutes: 10,
      cookTimeMinutes: 20,
      totalTimeMinutes: 30,
      ingredientsText: "pasta — 1 lb\nsauce — 1 jar",
      instructionsText: "Boil pasta\nAdd sauce",
      instructionSteps: null,
      isFavorite: false,
      source: null,
      timesCooked: 0,
      lastCookedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Recipe;

    const text = formatRecipe(recipe);
    expect(text).toContain("🍳 Test Pasta");
    expect(text).toContain("Ingredients");
    expect(text).toContain("• pasta — 1 lb");
    expect(text).not.toContain("Notes");
    expect(text).not.toContain("Leftovers");
    expect(text).not.toContain("Storage");
  });
});

describe("formatGroceryList", () => {
  it("formats a flat list of items", () => {
    const items = [
      {
        id: "g1",
        groceryListId: "l1",
        householdId: "h",
        categoryId: "c-default",
        name: "Chicken",
        normalizedName: "chicken",
        quantityText: "2 lb",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "g2",
        groceryListId: "l1",
        householdId: "h",
        categoryId: "c-default",
        name: "Milk",
        normalizedName: "milk",
        quantityText: "1 gallon",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as GroceryListItem[];

    const text = formatGroceryList(items);
    expect(text).toContain("🛒 Grocery list");
    expect(text).toContain("Chicken");
    expect(text).toContain("Milk");
    expect(text).not.toContain("meat");
    expect(text).not.toContain("dairy");
  });

  it("groups items under category headers", () => {
    const items = [
      {
        id: "g1",
        groceryListId: "l1",
        householdId: "h",
        categoryId: "c-default",
        name: "Soy sauce",
        normalizedName: "soy sauce",
        quantityText: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "g2",
        groceryListId: "l1",
        householdId: "h",
        categoryId: "c-amazon",
        name: "Paper towels",
        normalizedName: "paper towels",
        quantityText: "1 pack",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as GroceryListItem[];

    const text = formatGroceryList(items, [
      { id: "c-default", name: "Grocery", isDefault: true, sortOrder: 0 },
      { id: "c-amazon", name: "Amazon", isDefault: false, sortOrder: 1 },
    ]);

    expect(text).toContain("Grocery");
    expect(text).toContain("Amazon");
    expect(text.indexOf("Grocery")).toBeLessThan(text.indexOf("Amazon"));
    expect(text).toContain("Soy sauce");
    expect(text).toContain("Paper towels");
  });
});
