import { describe, expect, it } from "vitest";

import type { Preference } from "@/lib/db/schema";
import {
  buildPlanningProfile,
  detectMeatsInTitle,
  formatMenuPreferencesForPrompt,
  formatStructuralPlanningRulesForPrompt,
  isMenuPreference,
  isStructuralPlanningPreference,
  resolveServingsPerMeal,
  validateWeeklyDinners,
} from "@/lib/preferences/planning-rules";

function pref(partial: Partial<Preference> & Pick<Preference, "kind" | "key" | "value">): Preference {
  return {
    id: "test",
    householdId: "household",
    strength: "explicit",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  };
}

const allPrefs: Preference[] = [
  pref({
    kind: "note",
    key: "weekly bulk meals",
    value: "5 meals per week",
  }),
  pref({
    kind: "constraint",
    key: "max meats per week",
    value: "3",
  }),
  pref({
    kind: "constraint",
    key: "max pork per week",
    value: "Never 3 pork meals in one week; max 2 pork meals per week",
  }),
  pref({
    kind: "constraint",
    key: "meat required",
    value: "All meals should include a meat component",
  }),
  pref({
    kind: "constraint",
    key: "meat granularity",
    value: "Count different cuts/products as separate meats",
  }),
  pref({
    kind: "constraint",
    key: "servings per meal",
    value: "6-8 servings",
  }),
  pref({
    kind: "dislike",
    key: "pasta and meatballs",
    value: "Do not suggest",
  }),
  pref({
    kind: "dislike",
    key: "olives",
    value: "Gabby dislikes olives",
  }),
];

describe("preference classification", () => {
  it("treats meat caps and servings as structural", () => {
    expect(
      isStructuralPlanningPreference(
        pref({ kind: "constraint", key: "max meats per week", value: "3" }),
      ),
    ).toBe(true);
    expect(
      isStructuralPlanningPreference(
        pref({ kind: "constraint", key: "servings per meal", value: "6-8" }),
      ),
    ).toBe(true);
  });

  it("treats pork cap and weekly bulk count as menu prefs", () => {
    expect(
      isMenuPreference(
        pref({ kind: "constraint", key: "max pork per week", value: "max 2" }),
      ),
    ).toBe(true);
    expect(
      isStructuralPlanningPreference(
        pref({ kind: "note", key: "weekly bulk meals", value: "5 meals" }),
      ),
    ).toBe(false);
  });
});

describe("buildPlanningProfile", () => {
  it("derives only structural fields", () => {
    const profile = buildPlanningProfile(allPrefs);
    expect(profile.maxDistinctMeats).toBe(3);
    expect(profile.meatRequired).toBe(true);
    expect(profile.servingsPerMeal).toBe("6-8 servings");
    expect(profile.countMeatsGranularly).toBe(true);
  });
});

describe("resolveServingsPerMeal", () => {
  it("uses the saved servings preference", () => {
    expect(resolveServingsPerMeal(allPrefs)).toBe("6-8");
  });

  it("defaults to 6-8 when no servings preference exists", () => {
    expect(resolveServingsPerMeal([])).toBe("6-8");
  });

  it("reads preferred serving size notes", () => {
    expect(
      resolveServingsPerMeal([
        pref({
          kind: "note",
          key: "Preferred serving size",
          value: "6-8 servings for leftovers",
        }),
      ]),
    ).toBe("6-8");
  });
});

describe("formatStructuralPlanningRulesForPrompt", () => {
  it("starts with meat picker then meal batch steps", () => {
    const text = formatStructuralPlanningRulesForPrompt([]);
    expect(text).toContain("proposeWeeklyMeatOptions");
    expect(text).toContain("Step 1");
    expect(text).toContain("Step 2");
    expect(text).toContain("6-8 servings");
    expect(text).toContain("Meal 1");
  });

  it("echoes a saved servings preference", () => {
    const text = formatStructuralPlanningRulesForPrompt(allPrefs);
    expect(text).toContain("6-8 servings");
    expect(text).not.toContain("Pork cap");
  });
});

describe("formatMenuPreferencesForPrompt", () => {
  it("includes pork cap from DB without hardcoding in structural rules", () => {
    const text = formatMenuPreferencesForPrompt(allPrefs);
    expect(text).toContain("max pork per week");
    expect(text).toContain("pasta and meatballs");
    expect(text).not.toContain("olives");
  });
});

describe("validateWeeklyDinners", () => {
  it("does not enforce a fixed dinner count", () => {
    const profile = buildPlanningProfile(allPrefs);
    const violations = validateWeeklyDinners({
      profile,
      dinners: Array.from({ length: 7 }, () => ({
        title: "Chicken thigh bake",
      })),
    });
    expect(violations.some((item) => item.includes("bulk dinners"))).toBe(false);
  });

  it("does not enforce pork cap (menu pref only)", () => {
    const profile = buildPlanningProfile(allPrefs);
    const violations = validateWeeklyDinners({
      profile,
      dinners: [
        { title: "Pork sausage and peppers" },
        { title: "Honey garlic pork tenderloin" },
        { title: "Pork sausage skillet" },
      ],
    });
    expect(violations.some((item) => item.includes("pork"))).toBe(false);
  });

  it("enforces max distinct meats structurally", () => {
    const profile = buildPlanningProfile(allPrefs);
    const violations = validateWeeklyDinners({
      profile,
      dinners: [
        { title: "Chicken thigh bake" },
        { title: "Chicken breast stir-fry" },
        { title: "Pork tenderloin" },
        { title: "Ground beef skillet" },
      ],
    });
    expect(violations.some((item) => item.includes("different meats"))).toBe(true);
  });

  it("does not double-count a cut plus its generic animal class", () => {
    const profile = buildPlanningProfile(allPrefs);
    const violations = validateWeeklyDinners({
      profile,
      dinners: [
        {
          title:
            "Pesto-baked chicken breasts with mozzarella, roasted bell pepper & quinoa",
        },
        {
          title:
            "Balsamic-glazed pork tenderloin with roasted potatoes & sautéed green beans",
        },
        {
          title:
            "BBQ sheet-pan pork tenderloin with corn, bell pepper & red potatoes",
        },
        {
          title:
            "Ground beef taco bowls with rice, black beans, salsa & shredded cheddar",
        },
      ],
    });
    expect(violations.some((item) => item.includes("different meats"))).toBe(
      false,
    );
  });
});

describe("detectMeatsInTitle", () => {
  it("counts granular cuts separately", () => {
    expect(detectMeatsInTitle("Chicken thigh pasta bake", true)).toContain(
      "chicken-thighs",
    );
  });

  it("returns only the specific cut, not also the generic animal", () => {
    expect(detectMeatsInTitle("Pesto-baked chicken breasts", true)).toEqual([
      "chicken-breasts",
    ]);
    expect(detectMeatsInTitle("Balsamic-glazed pork tenderloin", true)).toEqual([
      "pork-tenderloin",
    ]);
    expect(detectMeatsInTitle("Ground beef taco bowls", true)).toEqual([
      "ground-beef",
    ]);
  });
});