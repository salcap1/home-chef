import { afterEach, describe, expect, it } from "vitest";

import {
  getAppBaseUrl,
  getDefaultLocationId,
  getDefaultStoreNameMatch,
  getDefaultStoreZip,
  getKrogerClientCredentials,
  getKrogerRedirectUri,
  KROGER_OAUTH_SCOPES,
} from "@/lib/kroger/config";

const KEYS = [
  "APP_BASE_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL",
  "KROGER_REDIRECT_URI",
  "KROGER_LOCATION_ID",
  "KROGER_CLIENT_ID",
  "KROGER_CLIENT_SECRET",
  "HARRIS_TEETER_ZIP",
  "HARRIS_TEETER_STORE_NAME",
] as const;

const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
    delete saved[key];
  }
});

function setEnv(key: (typeof KEYS)[number], value: string | undefined) {
  if (!(key in saved)) saved[key] = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

describe("kroger config", () => {
  it("defaults app base URL to localhost", () => {
    for (const key of [
      "APP_BASE_URL",
      "VERCEL_PROJECT_PRODUCTION_URL",
      "VERCEL_URL",
    ] as const) {
      setEnv(key, undefined);
    }
    expect(getAppBaseUrl()).toBe("http://localhost:3000");
  });

  it("prefers APP_BASE_URL and adds https when missing", () => {
    setEnv("APP_BASE_URL", "example.com");
    expect(getAppBaseUrl()).toBe("https://example.com");
  });

  it("builds redirect URI from base when unset", () => {
    setEnv("KROGER_REDIRECT_URI", undefined);
    setEnv("APP_BASE_URL", "https://app.example");
    expect(getKrogerRedirectUri()).toBe(
      "https://app.example/api/kroger/callback",
    );
  });

  it("uses explicit redirect URI when set", () => {
    setEnv("KROGER_REDIRECT_URI", " https://app.example/cb ");
    expect(getKrogerRedirectUri()).toBe("https://app.example/cb");
  });

  it("reads optional store discovery env with empty defaults", () => {
    setEnv("KROGER_LOCATION_ID", undefined);
    setEnv("HARRIS_TEETER_ZIP", undefined);
    setEnv("HARRIS_TEETER_STORE_NAME", undefined);
    expect(getDefaultLocationId()).toBe("");
    expect(getDefaultStoreZip()).toBe("");
    expect(getDefaultStoreNameMatch()).toBe("");

    setEnv("KROGER_LOCATION_ID", " 12345 ");
    setEnv("HARRIS_TEETER_ZIP", " 10001 ");
    setEnv("HARRIS_TEETER_STORE_NAME", " Downtown ");
    expect(getDefaultLocationId()).toBe("12345");
    expect(getDefaultStoreZip()).toBe("10001");
    expect(getDefaultStoreNameMatch()).toBe("downtown");
  });

  it("exposes OAuth scopes", () => {
    expect(KROGER_OAUTH_SCOPES).toContain("product.compact");
    expect(KROGER_OAUTH_SCOPES).toContain("cart.basic:write");
  });

  it("reads Kroger client credentials from env", () => {
    setEnv("KROGER_CLIENT_ID", "client-id");
    setEnv("KROGER_CLIENT_SECRET", "client-secret");
    expect(getKrogerClientCredentials()).toEqual({
      clientId: "client-id",
      clientSecret: "client-secret",
    });
  });
});
