import { describe, expect, it } from "vitest";

import {
  HarrisTeeterDeniedError,
  isHarrisTeeterDeniedError,
} from "@/lib/kroger/access";

describe("HarrisTeeterDeniedError", () => {
  it("is detectable via type guard", () => {
    const error = new HarrisTeeterDeniedError();
    expect(isHarrisTeeterDeniedError(error)).toBe(true);
    expect(isHarrisTeeterDeniedError(new Error("nope"))).toBe(false);
    expect(error.message).toMatch(/demo kitchens/i);
  });
});
