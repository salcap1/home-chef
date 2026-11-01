import { describe, expect, it } from "vitest";

import {
  detectProteinsInText,
  foodNamesMatch,
  resolveFoodIdentity,
} from "@/lib/kitchen/food-knowledge";

describe("resolveFoodIdentity", () => {
  it("merges brand variants to same canonical mozzarella", () => {
    const a = resolveFoodIdentity("Harris Teeter Mozzarella Shredded Cheese");
    const b = resolveFoodIdentity("shredded mozzarella");
    expect(a.canonicalId).toBe("mozzarella-shredded");
    expect(b.canonicalId).toBe("mozzarella-shredded");
    expect(foodNamesMatch(a.label, b.label, "canonical")).toBe(true);
  });

  it("distinguishes pork cuts", () => {
    const chop = resolveFoodIdentity("boneless pork chops");
    const tenderloin = resolveFoodIdentity("pork tenderloin");
    expect(chop.specificId).toBe("pork-chops");
    expect(tenderloin.specificId).toBe("pork-tenderloin");
    expect(chop.proteinClass).toBe("pork");
    expect(tenderloin.proteinClass).toBe("pork");
    expect(chop.specificId).not.toBe(tenderloin.specificId);
  });

  it("does not merge green onions with yellow onions or sweet potatoes with potatoes", () => {
    expect(resolveFoodIdentity("green onions").canonicalId).toBe("green-onion");
    expect(resolveFoodIdentity("yellow onions").canonicalId).toBe("onion");
    expect(resolveFoodIdentity("sweet potatoes").canonicalId).toBe(
      "sweet-potato",
    );
    expect(resolveFoodIdentity("baby potatoes").canonicalId).toBe("potato");
  });
});

describe("detectProteinsInText", () => {
  it("detects granular pork tenderloin in meal title", () => {
    expect(
      detectProteinsInText("Honey garlic pork tenderloin with green beans", true),
    ).toContain("pork-tenderloin");
  });

  it("collapses to protein class when not granular", () => {
    expect(
      detectProteinsInText("Honey garlic pork tenderloin", false),
    ).toEqual(["pork"]);
  });
});
