import { describe, expect, it } from "vitest";

import { attachCookedAtToMealItems } from "@/lib/meals/service";
import type { MealHistory } from "@/lib/db/schema";

function history(
  partial: Pick<MealHistory, "id" | "name" | "recipeId" | "cookedAt">,
): MealHistory {
  return {
    householdId: "hh",
    memberId: null,
    mealType: "dinner",
    servingsText: null,
    wasPlanned: true,
    actuallyCooked: true,
    notes: null,
    createdAt: partial.cookedAt,
    ...partial,
  };
}

describe("attachCookedAtToMealItems", () => {
  it("matches by recipe id first", () => {
    const cookedAt = new Date("2026-09-01T18:00:00Z");
    const result = attachCookedAtToMealItems(
      [
        {
          id: "1",
          title: "Honey garlic chicken",
          recipeId: "r1",
          recipe: { id: "r1", name: "Honey garlic chicken" },
        },
      ],
      [history({ id: "h1", name: "Something else", recipeId: "r1", cookedAt })],
    );
    expect(result[0].cookedAt).toEqual(cookedAt);
  });

  it("matches by title when recipe id is missing", () => {
    const cookedAt = new Date("2026-09-02T18:00:00Z");
    const result = attachCookedAtToMealItems(
      [{ id: "1", title: "Beef fried rice", recipeId: null, recipe: null }],
      [
        history({
          id: "h1",
          name: "beef fried rice",
          recipeId: null,
          cookedAt,
        }),
      ],
    );
    expect(result[0].cookedAt).toEqual(cookedAt);
  });

  it("uses each history row only once", () => {
    const cookedAt = new Date("2026-09-02T18:00:00Z");
    const result = attachCookedAtToMealItems(
      [
        { id: "1", title: "Tacos", recipeId: null, recipe: null },
        { id: "2", title: "Tacos", recipeId: null, recipe: null },
      ],
      [history({ id: "h1", name: "Tacos", recipeId: null, cookedAt })],
    );
    expect(result[0].cookedAt).toEqual(cookedAt);
    expect(result[1].cookedAt).toBeNull();
  });
});
