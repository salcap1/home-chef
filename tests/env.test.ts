import { afterEach, describe, expect, it } from "vitest";

import { getEnv, requireEnv } from "@/lib/env";

const KEYS = [
  "DATABASE_URL",
  "AI_GATEWAY_API_KEY",
  "AI_MODEL",
  "AI_PLANNING_MODEL",
  "AI_MONTHLY_BUDGET_USD",
  "AI_GLOBAL_MONTHLY_BUDGET_USD",
  "AI_CHAT_HOURLY_LIMIT",
  "AI_CHAT_DAILY_LIMIT",
  "AI_SELF_SIGNUP_CHAT_LIMIT",
  "HOUSEHOLD_NAME",
  "HOUSEHOLD_TIMEZONE",
  "WEB_PANEL_SESSION_KEY",
  "WEB_PANEL_SECRET",
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

describe("getEnv", () => {
  it("applies defaults for optional knobs", () => {
    for (const key of KEYS) setEnv(key, undefined);
    const env = getEnv();
    expect(env.AI_MODEL).toBe("openai/gpt-5-mini");
    expect(env.AI_PLANNING_MODEL).toBe("openai/gpt-5-mini");
    expect(env.AI_MONTHLY_BUDGET_USD).toBe(5);
    expect(env.AI_CHAT_HOURLY_LIMIT).toBe(10);
    expect(env.AI_CHAT_DAILY_LIMIT).toBe(40);
    expect(env.AI_SELF_SIGNUP_CHAT_LIMIT).toBe(3);
    expect(env.HOUSEHOLD_NAME).toBe("Home");
    expect(env.HOUSEHOLD_TIMEZONE).toBe("America/New_York");
    expect(env.AI_GLOBAL_MONTHLY_BUDGET_USD).toBeUndefined();
  });

  it("parses numeric overrides", () => {
    setEnv("AI_MONTHLY_BUDGET_USD", "12.5");
    setEnv("AI_GLOBAL_MONTHLY_BUDGET_USD", "100");
    setEnv("AI_CHAT_HOURLY_LIMIT", "3");
    const env = getEnv();
    expect(env.AI_MONTHLY_BUDGET_USD).toBe(12.5);
    expect(env.AI_GLOBAL_MONTHLY_BUDGET_USD).toBe(100);
    expect(env.AI_CHAT_HOURLY_LIMIT).toBe(3);
  });
});

describe("requireEnv", () => {
  it("returns present values", () => {
    setEnv("HOUSEHOLD_NAME", "Demo");
    expect(requireEnv("HOUSEHOLD_NAME")).toBe("Demo");
  });

  it("throws when missing", () => {
    setEnv("WEB_PANEL_SESSION_KEY", undefined);
    expect(() => requireEnv("WEB_PANEL_SESSION_KEY")).toThrow(
      /Missing required environment variable: WEB_PANEL_SESSION_KEY/,
    );
  });
});
