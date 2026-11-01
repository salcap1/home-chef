import { requireEnv } from "@/lib/env";

const KROGER_API_BASE = "https://api.kroger.com/v1";

export function getKrogerClientCredentials() {
  return {
    clientId: requireEnv("KROGER_CLIENT_ID"),
    clientSecret: requireEnv("KROGER_CLIENT_SECRET"),
  };
}

export function getKrogerRedirectUri(): string {
  const explicit = process.env.KROGER_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const base = getAppBaseUrl();
  return `${base}/api/kroger/callback`;
}

export function getAppBaseUrl(): string {
  const fromEnv =
    process.env.APP_BASE_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (fromEnv) {
    return fromEnv.startsWith("http") ? fromEnv : `https://${fromEnv}`;
  }
  return "http://localhost:3000";
}

/** Store location ID from env, or empty when unset. */
export function getDefaultLocationId(): string {
  return process.env.KROGER_LOCATION_ID?.trim() || "";
}

/** ZIP used to discover a Harris Teeter when location ID is unset. */
export function getDefaultStoreZip(): string {
  return process.env.HARRIS_TEETER_ZIP?.trim() || "";
}

/** Optional name substring to prefer among discovered stores. */
export function getDefaultStoreNameMatch(): string {
  return process.env.HARRIS_TEETER_STORE_NAME?.trim().toLowerCase() || "";
}

export const KROGER_OAUTH_SCOPES = [
  "product.compact",
  "cart.basic:write",
  "profile.compact",
].join(" ");

export { KROGER_API_BASE };
