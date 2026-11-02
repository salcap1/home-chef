import { describe, expect, it } from "vitest";

import {
  MIN_PASSCODE_LENGTH,
  validateNewPasscode,
} from "@/lib/panel/passcode";

describe("validateNewPasscode", () => {
  it("rejects short passcodes", () => {
    expect(validateNewPasscode("short", "short")).toBe("too_short");
    expect(validateNewPasscode("a".repeat(MIN_PASSCODE_LENGTH - 1), "a".repeat(MIN_PASSCODE_LENGTH - 1))).toBe(
      "too_short",
    );
  });

  it("rejects mismatched confirm", () => {
    expect(validateNewPasscode("longenough", "different1")).toBe("mismatch");
  });

  it("accepts matching passcodes of sufficient length", () => {
    expect(validateNewPasscode("longenough", "longenough")).toBeNull();
    expect(
      validateNewPasscode("  longenough  ", "longenough"),
    ).toBeNull();
  });
});
