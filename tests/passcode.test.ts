import { describe, expect, it } from "vitest";

import { computePasscodeLookup } from "@/lib/panel/passcode";

describe("computePasscodeLookup", () => {
  it("is deterministic for the same passcode and pepper", () => {
    const a = computePasscodeLookup("secret-pass", "pepper-one");
    const b = computePasscodeLookup("secret-pass", "pepper-one");
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(20);
  });

  it("trims passcode whitespace before hashing", () => {
    expect(computePasscodeLookup("  abc  ", "pepper")).toBe(
      computePasscodeLookup("abc", "pepper"),
    );
  });

  it("changes when pepper or passcode changes", () => {
    const base = computePasscodeLookup("secret-pass", "pepper-one");
    expect(computePasscodeLookup("other-pass", "pepper-one")).not.toBe(base);
    expect(computePasscodeLookup("secret-pass", "pepper-two")).not.toBe(base);
  });
});
