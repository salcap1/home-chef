import { randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { krogerConnections, krogerOauthStates } from "@/lib/db/schema";
import {
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  refreshUserAccessToken,
  searchLocations,
} from "@/lib/kroger/client";
import {
  getDefaultLocationId,
  getDefaultStoreNameMatch,
  getDefaultStoreZip,
  getAppBaseUrl,
} from "@/lib/kroger/config";

const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;

export async function resolveHarrisTeeterLocation(): Promise<{
  locationId: string;
  name: string;
}> {
  const configuredId = getDefaultLocationId();
  const configuredName = process.env.KROGER_LOCATION_NAME?.trim();

  if (configuredId) {
    return {
      locationId: configuredId,
      name: configuredName || "Harris Teeter",
    };
  }

  const zip = getDefaultStoreZip();
  if (!zip) {
    throw new Error(
      "Set KROGER_LOCATION_ID (or HARRIS_TEETER_ZIP to discover a store).",
    );
  }

  const stores = await searchLocations({ zipCode: zip });
  const harrisTeeter = stores.filter((store) => store.chain === "HART");
  const matchTerm = getDefaultStoreNameMatch();
  const preferred =
    (matchTerm
      ? harrisTeeter.find((store) =>
          store.name.toLowerCase().includes(matchTerm),
        )
      : undefined) ?? harrisTeeter[0];

  if (preferred) {
    return { locationId: preferred.locationId, name: preferred.name };
  }

  throw new Error(
    `No Harris Teeter store found near ZIP ${zip}. Set KROGER_LOCATION_ID.`,
  );
}

export async function createKrogerOAuthState(
  householdId: string,
): Promise<string> {
  const db = getDb();
  const stateToken = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS);

  await db.insert(krogerOauthStates).values({
    stateToken,
    householdId,
    expiresAt,
  });

  return stateToken;
}

export function buildKrogerLinkUrl(stateToken: string): string {
  return `${getAppBaseUrl()}/api/kroger/auth?state=${stateToken}`;
}

export function buildKrogerAuthorizeRedirect(stateToken: string): string {
  return buildAuthorizationUrl(stateToken);
}

export async function validateKrogerOAuthState(stateToken: string): Promise<{
  householdId: string;
} | null> {
  const db = getDb();
  const now = new Date();

  const rows = await db
    .select()
    .from(krogerOauthStates)
    .where(
      and(
        eq(krogerOauthStates.stateToken, stateToken),
        gt(krogerOauthStates.expiresAt, now),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return { householdId: row.householdId };
}

export async function consumeKrogerOAuthState(stateToken: string): Promise<{
  householdId: string;
} | null> {
  const state = await validateKrogerOAuthState(stateToken);
  if (!state) return null;

  const db = getDb();
  await db
    .delete(krogerOauthStates)
    .where(eq(krogerOauthStates.stateToken, stateToken));

  return state;
}

export async function saveKrogerConnection(input: {
  householdId: string;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  locationId: string;
  locationName: string;
}): Promise<void> {
  const db = getDb();
  const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);

  await db
    .insert(krogerConnections)
    .values({
      householdId: input.householdId,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      expiresAt,
      locationId: input.locationId,
      locationName: input.locationName,
    })
    .onConflictDoUpdate({
      target: krogerConnections.householdId,
      set: {
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        expiresAt,
        locationId: input.locationId,
        locationName: input.locationName,
        updatedAt: new Date(),
      },
    });
}

export async function getKrogerConnection(householdId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(krogerConnections)
    .where(eq(krogerConnections.householdId, householdId))
    .limit(1);
  return rows[0] ?? null;
}

/** Always scoped to this kitchen’s kroger_connections row — never a global token. */
export async function getValidKrogerAccessToken(
  householdId: string,
): Promise<{ accessToken: string; locationId: string; locationName: string | null } | null> {
  const connection = await getKrogerConnection(householdId);
  if (!connection) return null;

  const refreshBufferMs = 60_000;
  if (connection.expiresAt.getTime() > Date.now() + refreshBufferMs) {
    return {
      accessToken: connection.accessToken,
      locationId: connection.locationId,
      locationName: connection.locationName,
    };
  }

  const refreshed = await refreshUserAccessToken(connection.refreshToken);
  const refreshToken =
    refreshed.refresh_token ?? connection.refreshToken;

  await saveKrogerConnection({
    householdId,
    accessToken: refreshed.access_token,
    refreshToken,
    expiresInSeconds: refreshed.expires_in,
    locationId: connection.locationId,
    locationName: connection.locationName ?? "Harris Teeter",
  });

  return {
    accessToken: refreshed.access_token,
    locationId: connection.locationId,
    locationName: connection.locationName,
  };
}

export async function completeKrogerOAuth(input: {
  code: string;
  stateToken: string;
}): Promise<{ householdId: string; locationName: string }> {
  const state = await consumeKrogerOAuthState(input.stateToken);
  if (!state) {
    throw new Error("OAuth link expired or invalid. Run /link-harris-teeter again.");
  }

  const token = await exchangeAuthorizationCode(input.code);
  if (!token.refresh_token) {
    throw new Error("Kroger did not return a refresh token.");
  }

  const location = await resolveHarrisTeeterLocation();

  await saveKrogerConnection({
    householdId: state.householdId,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresInSeconds: token.expires_in,
    locationId: location.locationId,
    locationName: location.name,
  });

  return { householdId: state.householdId, locationName: location.name };
}
