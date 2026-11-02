import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "./coverage",
      // Deterministic / unit-testable surface (AGENTS.md §37).
      // DB, HTTP, Next server actions, and DOM helpers stay out of the badge.
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/db/**",
        "src/lib/ai/agent.ts",
        "src/lib/ai/recipes.ts",
        "src/lib/ai/meal-batch.ts",
        "src/lib/ai/budget.ts",
        "src/lib/ai/tools/**",
        "src/lib/conversation/**",
        "src/lib/household/accounts.ts",
        "src/lib/household/context.ts",
        "src/lib/kitchen/snapshot.ts",
        "src/lib/kroger/client.ts",
        "src/lib/kroger/connection.ts",
        "src/lib/kroger/preferences.ts",
        "src/lib/kroger/shop.ts",
        "src/lib/meals/service.ts",
        "src/lib/panel/actions.ts",
        "src/lib/panel/auth.ts",
        "src/lib/panel/focus-field.ts",
        "src/lib/panel/queries.ts",
        "src/lib/planning/grocery-categories.ts",
        "src/lib/planning/service.ts",
        "src/lib/preferences/service.ts",
        "**/*.d.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "./src"),
    },
  },
});
