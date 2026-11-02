import { timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getEnv, requireEnv } from "@/lib/env";
import {
  claimLegacyHouseholdPasscode,
  createHouseholdWithPasscode,
  findHouseholdIdByPasscodeLookup,
} from "@/lib/household/accounts";
import {
  computePasscodeLookup,
  validateNewPasscode,
} from "@/lib/panel/passcode";
import {
  createPanelSessionToken,
  PANEL_SESSION_COOKIE,
  panelSessionCookieOptions,
  verifyPanelSessionToken,
  type PanelSessionPayload,
} from "@/lib/panel/session";

export { MIN_PASSCODE_LENGTH } from "@/lib/panel/passcode";

function safeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

async function issuePanelSession(householdId: string): Promise<void> {
  const sessionKey = requireEnv("WEB_PANEL_SESSION_KEY");
  const token = await createPanelSessionToken(householdId, sessionKey);
  const cookieStore = await cookies();
  cookieStore.set(panelSessionCookieOptions(token));
}

export async function getPanelSession(): Promise<PanelSessionPayload | null> {
  const sessionKey = requireEnv("WEB_PANEL_SESSION_KEY");
  const cookieStore = await cookies();
  const token = cookieStore.get(PANEL_SESSION_COOKIE)?.value;
  return verifyPanelSessionToken(token, sessionKey);
}

export async function isPanelAuthenticated(): Promise<boolean> {
  return (await getPanelSession()) != null;
}

export async function requirePanelSession(): Promise<PanelSessionPayload> {
  const session = await getPanelSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function loginWithPasscode(passcode: string): Promise<boolean> {
  const trimmed = passcode.trim();
  if (!trimmed) return false;

  const sessionKey = requireEnv("WEB_PANEL_SESSION_KEY");
  const lookup = computePasscodeLookup(trimmed, sessionKey);

  let householdId = await findHouseholdIdByPasscodeLookup(lookup);

  // One-time bootstrap: env passcode claims the oldest household without a login key.
  if (!householdId) {
    const legacy = getEnv().WEB_PANEL_SECRET;
    if (legacy && safeEqualString(trimmed, legacy)) {
      householdId = await claimLegacyHouseholdPasscode(lookup);
    }
  }

  if (!householdId) return false;

  await issuePanelSession(householdId);
  return true;
}

export type CreateAccountResult =
  | { ok: true }
  | { ok: false; error: "too_short" | "mismatch" | "in_use" | "failed" };

/** Public self-signup: one passcode = one demo kitchen (chat + Shop caps). */
export async function createAccountWithPasscode(
  passcode: string,
  confirm: string,
): Promise<CreateAccountResult> {
  const validationError = validateNewPasscode(passcode, confirm);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const trimmed = passcode.trim();
  const sessionKey = requireEnv("WEB_PANEL_SESSION_KEY");
  const env = getEnv();

  try {
    const created = await createHouseholdWithPasscode({
      name: env.HOUSEHOLD_NAME,
      passcode: trimmed,
      sessionPepper: sessionKey,
      aiChatLifetimeLimit: env.AI_SELF_SIGNUP_CHAT_LIMIT,
    });
    await issuePanelSession(created.id);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("already in use")) {
      return { ok: false, error: "in_use" };
    }
    return { ok: false, error: "failed" };
  }
}

export async function logoutPanelSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PANEL_SESSION_COOKIE);
}
