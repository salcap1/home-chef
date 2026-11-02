import { createHmac } from "crypto";

export const MIN_PASSCODE_LENGTH = 8;

export type PasscodeValidationError = "too_short" | "mismatch";

/** Pure checks for Create account (before DB). */
export function validateNewPasscode(
  passcode: string,
  confirm: string,
): PasscodeValidationError | null {
  const trimmed = passcode.trim();
  const confirmed = confirm.trim();
  if (trimmed.length < MIN_PASSCODE_LENGTH) return "too_short";
  if (trimmed !== confirmed) return "mismatch";
  return null;
}

/** Deterministic login key for a passcode (no username). */
export function computePasscodeLookup(passcode: string, pepper: string): string {
  return createHmac("sha256", pepper)
    .update(passcode.trim(), "utf8")
    .digest("base64url");
}
