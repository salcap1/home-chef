import { describe, expect, it } from "vitest";

import {
  MEAT_OPTION_POOL,
  listPanelMeatOptions,
  proposeWeeklyMeatOptions,
} from "@/lib/planning/meat-options";

describe("listPanelMeatOptions", () => {
  it("returns the full pool in stable order", () => {
    const options = listPanelMeatOptions();
    expect(options.map((option) => option.id)).toEqual(
      MEAT_OPTION_POOL.map((option) => option.id),
    );
  });

  it("always includes chicken cuts and pork tenderloin", () => {
    const options = listPanelMeatOptions();
    const ids = new Set(options.map((option) => option.id));
    expect(ids.has("chicken-thighs")).toBe(true);
    expect(ids.has("chicken-breasts")).toBe(true);
    expect(ids.has("pork-tenderloin")).toBe(true);
  });

  it("excludes seafood when requested", () => {
    const options = listPanelMeatOptions({ excludeSeafood: true });
    expect(options.every((option) => !option.isSeafood)).toBe(true);
  });
});

describe("proposeWeeklyMeatOptions", () => {
  it("returns between 5 and 7 options by default", () => {
    const options = proposeWeeklyMeatOptions({});
    expect(options.length).toBeGreaterThanOrEqual(5);
    expect(options.length).toBeLessThanOrEqual(7);
  });

  it("excludes seafood when requested", () => {
    const options = proposeWeeklyMeatOptions({ excludeSeafood: true, optionCount: 7 });
    expect(options.every((option) => !option.isSeafood)).toBe(true);
    expect(options.some((option) => option.id === "salmon")).toBe(false);
  });

  it("deprioritizes recently used meats", () => {
    const options = proposeWeeklyMeatOptions({
      optionCount: 6,
      recentMealTitles: [
        "Honey garlic chicken thighs",
        "Roasted chicken thighs with broccoli",
        "Chicken thigh pasta bake",
      ],
    });
    expect(options.some((option) => option.id === "chicken-thighs")).toBe(false);
  });

  it("respects a fixed option count", () => {
    const options = proposeWeeklyMeatOptions({ optionCount: 5 });
    expect(options).toHaveLength(5);
  });

  it("draws from the configured pool", () => {
    const poolIds = new Set(MEAT_OPTION_POOL.map((option) => option.id));
    const options = proposeWeeklyMeatOptions({ optionCount: 6 });
    expect(options.every((option) => poolIds.has(option.id))).toBe(true);
  });
});
