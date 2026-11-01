import { createHmac } from "crypto";

/** Deterministic login key for a passcode (no username). */
export function computePasscodeLookup(passcode: string, pepper: string): string {
  return createHmac("sha256", pepper)
    .update(passcode.trim(), "utf8")
    .digest("base64url");
}
