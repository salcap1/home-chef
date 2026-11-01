import { describe, expect, it } from "vitest";

import { computePasscodeLookup } from "@/lib/panel/passcode";
import {
  createPanelSessionToken,
  verifyPanelSessionToken,
} from "@/lib/panel/session";

describe("computePasscodeLookup", () => {
  it("is deterministic for the same passcode and pepper", () => {
    const a = computePasscodeLookup("kitchen-secret", "pepper-at-least-32-chars-long!!");
    const b = computePasscodeLookup("kitchen-secret", "pepper-at-least-32-chars-long!!");
    expect(a).toBe(b);
  });

  it("changes when passcode or pepper changes", () => {
    const base = computePasscodeLookup("kitchen-secret", "pepper-at-least-32-chars-long!!");
    expect(computePasscodeLookup("other", "pepper-at-least-32-chars-long!!")).not.toBe(base);
    expect(
      computePasscodeLookup("kitchen-secret", "different-pepper-32-chars-min!!"),
    ).not.toBe(base);
  });

  it("trims whitespace before hashing", () => {
    const a = computePasscodeLookup("  abc  ", "pepper-at-least-32-chars-long!!");
    const b = computePasscodeLookup("abc", "pepper-at-least-32-chars-long!!");
    expect(a).toBe(b);
  });
});

describe("panel session tokens", () => {
  const sessionKey = "x".repeat(32);
  const householdId = "11111111-2222-3333-4444-555555555555";

  it("round-trips household id", async () => {
    const token = await createPanelSessionToken(householdId, sessionKey);
    const session = await verifyPanelSessionToken(token, sessionKey);
    expect(session).toEqual({
      householdId,
      expiresAt: expect.any(Number),
    });
  });

  it("rejects tampered tokens", async () => {
    const token = await createPanelSessionToken(householdId, sessionKey);
    const tampered = token.replace(householdId, "99999999-2222-3333-4444-555555555555");
    expect(await verifyPanelSessionToken(tampered, sessionKey)).toBeNull();
  });

  it("rejects wrong session key", async () => {
    const token = await createPanelSessionToken(householdId, sessionKey);
    expect(await verifyPanelSessionToken(token, "y".repeat(32))).toBeNull();
  });

  it("rejects missing token", async () => {
    expect(await verifyPanelSessionToken(undefined, sessionKey)).toBeNull();
  });
});
