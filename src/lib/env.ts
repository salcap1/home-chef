import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  AI_GATEWAY_API_KEY: z.string().min(1).optional(),
  AI_MODEL: z.string().min(1).default("openai/gpt-5-mini"),
  AI_PLANNING_MODEL: z.string().min(1).default("openai/gpt-5-mini"),
  /** Default per-household monthly AI budget when households.monthly_budget_usd is null. */
  AI_MONTHLY_BUDGET_USD: z.coerce.number().positive().default(5),
  /** Optional hard cap across all households this calendar month. */
  AI_GLOBAL_MONTHLY_BUDGET_USD: z.coerce.number().positive().optional(),
  AI_CHAT_HOURLY_LIMIT: z.coerce.number().int().positive().default(10),
  AI_CHAT_DAILY_LIMIT: z.coerce.number().int().positive().default(40),
  HOUSEHOLD_NAME: z.string().min(1).default("Home"),
  HOUSEHOLD_TIMEZONE: z.string().min(1).default("America/New_York"),
  KROGER_CLIENT_ID: z.string().min(1).optional(),
  KROGER_CLIENT_SECRET: z.string().min(1).optional(),
  KROGER_REDIRECT_URI: z.string().url().optional(),
  KROGER_LOCATION_ID: z.string().min(1).optional(),
  KROGER_LOCATION_NAME: z.string().min(1).optional(),
  HARRIS_TEETER_ZIP: z.string().min(1).optional(),
  HARRIS_TEETER_STORE_NAME: z.string().min(1).optional(),
  APP_BASE_URL: z.string().min(1).optional(),
  /**
   * Optional one-time bootstrap passcode. On first successful login matching this
   * value, the oldest household without a passcode_lookup is claimed.
   * Prefer scripts/create-household.ts for new kitchens; remove after migrate.
   */
  WEB_PANEL_SECRET: z.string().min(1).optional(),
  WEB_PANEL_SESSION_KEY: z.string().min(32).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(): AppEnv {
  return envSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
    AI_MODEL: process.env.AI_MODEL,
    AI_PLANNING_MODEL: process.env.AI_PLANNING_MODEL,
    AI_MONTHLY_BUDGET_USD: process.env.AI_MONTHLY_BUDGET_USD,
    AI_GLOBAL_MONTHLY_BUDGET_USD: process.env.AI_GLOBAL_MONTHLY_BUDGET_USD,
    AI_CHAT_HOURLY_LIMIT: process.env.AI_CHAT_HOURLY_LIMIT,
    AI_CHAT_DAILY_LIMIT: process.env.AI_CHAT_DAILY_LIMIT,
    HOUSEHOLD_NAME: process.env.HOUSEHOLD_NAME,
    HOUSEHOLD_TIMEZONE: process.env.HOUSEHOLD_TIMEZONE,
    KROGER_CLIENT_ID: process.env.KROGER_CLIENT_ID,
    KROGER_CLIENT_SECRET: process.env.KROGER_CLIENT_SECRET,
    KROGER_REDIRECT_URI: process.env.KROGER_REDIRECT_URI,
    KROGER_LOCATION_ID: process.env.KROGER_LOCATION_ID,
    KROGER_LOCATION_NAME: process.env.KROGER_LOCATION_NAME,
    HARRIS_TEETER_ZIP: process.env.HARRIS_TEETER_ZIP,
    HARRIS_TEETER_STORE_NAME: process.env.HARRIS_TEETER_STORE_NAME,
    APP_BASE_URL: process.env.APP_BASE_URL,
    WEB_PANEL_SECRET: process.env.WEB_PANEL_SECRET,
    WEB_PANEL_SESSION_KEY: process.env.WEB_PANEL_SESSION_KEY,
    NODE_ENV: process.env.NODE_ENV,
  });
}

export function requireEnv<K extends keyof AppEnv>(
  key: K,
): NonNullable<AppEnv[K]> {
  const value = getEnv()[key];
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value as NonNullable<AppEnv[K]>;
}
