import { describe, expect, it } from "vitest";

import {
  buildProductSearchTerm,
  computeCartUnits,
  normalizeGroceryItemForCart,
  parseGroceryAmount,
  parsePackageSize,
  scoreProductMatch,
} from "@/lib/kroger/match";

describe("parseGroceryAmount", () => {
  it("parses pound weights", () => {
    expect(parseGroceryAmount("3 lb")).toEqual({ unit: "lb", value: 3 });
  });

  it("parses count ranges", () => {
    expect(parseGroceryAmount("2-3 medium")).toEqual({ unit: "each", value: 3 });
  });
});

describe("parsePackageSize", () => {
  it("parses lb packages", () => {
    expect(parsePackageSize("3 lb")).toEqual({ unit: "lb", value: 3 });
  });

  it("parses ea packages", () => {
    expect(parsePackageSize("1 ea")).toEqual({ unit: "each", value: 1 });
  });
});

describe("computeCartUnits", () => {
  it("maps 3 lb need to one 3 lb package", () => {
    expect(
      computeCartUnits(
        { unit: "lb", value: 3 },
        { unit: "lb", value: 3 },
      ),
    ).toBe(1);
  });

  it("maps 3 lb need to two 1.5 lb packages", () => {
    expect(
      computeCartUnits(
        { unit: "lb", value: 3 },
        { unit: "lb", value: 1.5 },
      ),
    ).toBe(2);
  });

  it("maps 2 lemons to quantity 2 for ea products", () => {
    expect(
      computeCartUnits(
        { unit: "each", value: 2 },
        { unit: "each", value: 1 },
      ),
    ).toBe(2);
  });
});

describe("normalizeGroceryItemForCart", () => {
  it("strips leading brand names", () => {
    expect(normalizeGroceryItemForCart("PERDUE Fresh Chicken Breasts — 3 lb")).toBe(
      "Chicken Breasts",
    );
  });
});

describe("buildProductSearchTerm", () => {
  it("strips parenthetical notes and quantities", () => {
    expect(buildProductSearchTerm("Ground beef — 1 lb")).toBe("Ground beef");
  });
});

describe("scoreProductMatch", () => {
  it("boosts remembered UPC strongly", () => {
    const remembered = scoreProductMatch({
      searchTerm: "chicken breasts",
      description: "PERDUE Fresh Chicken Breasts",
      upc: "0027082900000",
      preferredUpc: "0027082900000",
    });
    const other = scoreProductMatch({
      searchTerm: "chicken breasts",
      description: "PERDUE Fresh Chicken Breasts",
      upc: "0007274506839",
      preferredUpc: "0027082900000",
    });
    expect(remembered).toBeGreaterThan(other);
  });
});
