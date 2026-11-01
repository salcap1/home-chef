export const PANEL_SESSION_COOKIE = "panel_session";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export type PanelSessionPayload = {
  householdId: string;
  expiresAt: number;
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function hmacSha256(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return toBase64Url(new Uint8Array(signature));
}

function signingPayload(householdId: string, expiresAt: number): string {
  return `${householdId}.${expiresAt}`;
}

export async function createPanelSessionToken(
  householdId: string,
  sessionKey: string,
): Promise<string> {
  const expiresAt = Date.now() + SESSION_MS;
  const payload = signingPayload(householdId, expiresAt);
  const signature = await hmacSha256(payload, sessionKey);
  return `${payload}.${signature}`;
}

export async function verifyPanelSessionToken(
  token: string | undefined,
  sessionKey: string,
): Promise<PanelSessionPayload | null> {
  if (!token) return null;
  const firstDot = token.indexOf(".");
  const secondDot = token.indexOf(".", firstDot + 1);
  if (firstDot <= 0 || secondDot <= firstDot) return null;

  const householdId = token.slice(0, firstDot);
  const expiresRaw = token.slice(firstDot + 1, secondDot);
  const signature = token.slice(secondDot + 1);
  if (!householdId || !expiresRaw || !signature) return null;

  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  const expected = await hmacSha256(
    signingPayload(householdId, expiresAt),
    sessionKey,
  );
  if (!safeEqual(signature, expected)) return null;

  return { householdId, expiresAt };
}

export function panelSessionCookieOptions(token: string) {
  return {
    name: PANEL_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MS / 1000,
  };
}
