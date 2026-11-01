import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import * as schema from "@/lib/db/schema";
import { requireEnv } from "@/lib/env";

export type Database = NeonHttpDatabase<typeof schema>;

let dbInstance: Database | null = null;

export function getDb(): Database {
  if (dbInstance) {
    return dbInstance;
  }

  const sql = neon(requireEnv("DATABASE_URL"));
  dbInstance = drizzle(sql, { schema });
  return dbInstance;
}

export function resetDbForTests(): void {
  dbInstance = null;
}
