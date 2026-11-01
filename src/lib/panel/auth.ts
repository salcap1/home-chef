import { timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getEnv, requireEnv } from "@/lib/env";
import {
  claimLegacyHouseholdPasscode,
  findHouseholdIdByPasscodeLookup,
} from "@/lib/household/accounts";
import { computePasscodeLookup } from "@/lib/panel/passcode";
import {
  createPanelSessionToken,
  PANEL_SESSION_COOKIE,
  panelSessionCookieOptions,
  verifyPanelSessionToken,
  type PanelSessionPayload,
} from "@/lib/panel/session";

function safeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
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

  const token = await createPanelSessionToken(householdId, sessionKey);
  const cookieStore = await cookies();
  cookieStore.set(panelSessionCookieOptions(token));
  return true;
}

export async function logoutPanelSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PANEL_SESSION_COOKIE);
}
