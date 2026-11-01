/**
 * Create a kitchen account (passcode = login) or attach a passcode to an existing household.
 *
 *   npx tsx --env-file=.env.local scripts/create-household.ts --passcode='secret'
 *   npx tsx --env-file=.env.local scripts/create-household.ts --passcode='secret' --name='Demo'
 *   npx tsx --env-file=.env.local scripts/create-household.ts --passcode='secret' --budget=2
 *   npx tsx --env-file=.env.local scripts/create-household.ts --passcode='secret' --household-id=<uuid>
 */
import { getEnv, requireEnv } from "@/lib/env";
import {
  createHouseholdWithPasscode,
  setHouseholdPasscode,
} from "@/lib/household/accounts";

function argValue(flag: string): string | undefined {
  const prefixed = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (prefixed) return prefixed.slice(flag.length + 1);

  const index = process.argv.indexOf(flag);
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  return undefined;
}

async function main() {
  const passcode = argValue("--passcode");
  if (!passcode?.trim()) {
    console.error(
      "Usage: scripts/create-household.ts --passcode=… [--name=Home] [--budget=5] [--household-id=uuid]",
    );
    process.exit(1);
  }

  const sessionPepper = requireEnv("WEB_PANEL_SESSION_KEY");
  const name = argValue("--name")?.trim() || getEnv().HOUSEHOLD_NAME || "Home";
  const budgetRaw = argValue("--budget");
  const monthlyBudgetUsd =
    budgetRaw != null && budgetRaw !== ""
      ? Number(budgetRaw)
      : undefined;
  if (
    monthlyBudgetUsd !== undefined &&
    (!Number.isFinite(monthlyBudgetUsd) || monthlyBudgetUsd <= 0)
  ) {
    console.error("--budget must be a positive number");
    process.exit(1);
  }

  const householdId = argValue("--household-id")?.trim();
  if (householdId) {
    await setHouseholdPasscode({
      householdId,
      passcode,
      sessionPepper,
    });
    console.log(`Updated passcode for household ${householdId}`);
    return;
  }

  const created = await createHouseholdWithPasscode({
    name,
    passcode,
    sessionPepper,
    monthlyBudgetUsd: monthlyBudgetUsd ?? null,
  });

  console.log(`Created household ${created.id} (${name})`);
  if (monthlyBudgetUsd != null) {
    console.log(`Monthly AI budget: $${monthlyBudgetUsd}`);
  } else {
    console.log(
      `Monthly AI budget: default $${getEnv().AI_MONTHLY_BUDGET_USD} (from env)`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
