import { describe, expect, it } from "vitest";

import {
  baseNormalizedGroceryName,
  cleanGroceryItemName,
  isGroceryVariantLine,
} from "@/lib/kitchen/grocery-list";
import {
  conversationLimitForLayer,
  filterToolsForLayer,
  inferKitchenLayer,
} from "@/lib/kitchen/layer-router";

describe("cleanGroceryItemName", () => {
  it("strips variant suffixes", () => {
    expect(cleanGroceryItemName("Shredded mozzarella — organic — 8 oz")).toBe(
      "Shredded mozzarella — 8 oz",
    );
    expect(cleanGroceryItemName("Chimichurri sauce — store brand")).toBe(
      "Chimichurri sauce",
    );
  });

  it("normalizes duplicate variant bases", () => {
    const a = baseNormalizedGroceryName("Shredded mozzarella — organic — 8 oz");
    const b = baseNormalizedGroceryName("Shredded mozzarella — store brand — 8 oz");
    expect(a).toBe(b);
  });
});

describe("isGroceryVariantLine", () => {
  it("detects catalog alternative lines", () => {
    expect(isGroceryVariantLine("Pasta sauce — sale/large jar — 24 oz")).toBe(
      true,
    );
    expect(isGroceryVariantLine("Soy sauce — 1 bottle")).toBe(false);
  });
});

describe("inferKitchenLayer", () => {
  it("routes grocery list edits", () => {
    expect(
      inferKitchenLayer("Remove chicken from the grocery list"),
    ).toBe("grocery_list");
    expect(inferKitchenLayer("Add soy sauce and ketchup to the list")).toBe(
      "grocery_list",
    );
    expect(
      inferKitchenLayer("Clear the rest — only soy sauce and ketchup"),
    ).toBe("grocery_list");
    expect(inferKitchenLayer("We finished the chicken")).toBe("grocery_list");
  });

  it("routes meal and recipe requests", () => {
    expect(inferKitchenLayer("Plan our week")).toBe("meals");
    expect(inferKitchenLayer("Give me the recipe for meal 1")).toBe("recipe");
  });
});

describe("filterToolsForLayer", () => {
  const tools = {
    getGroceryList: {},
    addGroceryItem: {},
    removeGroceryItem: {},
    clearGroceryList: {},
    createWeeklyPlan: {},
  };

  it("blocks meal writes on grocery layer", () => {
    const filtered = filterToolsForLayer(tools, "grocery_list");
    expect(filtered).toHaveProperty("addGroceryItem");
    expect(filtered).not.toHaveProperty("createWeeklyPlan");
  });

  it("blocks grocery writes on meals layer", () => {
    const filtered = filterToolsForLayer(tools, "meals");
    expect(filtered).toHaveProperty("createWeeklyPlan");
    expect(filtered).not.toHaveProperty("addGroceryItem");
  });
});

describe("conversationLimitForLayer", () => {
  it("widens history during active meal planning", () => {
    expect(conversationLimitForLayer("meals", "active")).toBe(16);
    expect(conversationLimitForLayer("meals", "completed")).toBe(8);
  });

  it("keeps grocery and general at 16", () => {
    expect(conversationLimitForLayer("grocery_list")).toBe(16);
    expect(conversationLimitForLayer("general")).toBe(16);
  });
});
