import { isDemoKitchen } from "@/lib/household/accounts";

export class HarrisTeeterDeniedError extends Error {
  constructor(message = "Harris Teeter Shop is not available on demo kitchens.") {
    super(message);
    this.name = "HarrisTeeterDeniedError";
  }
}

export function isHarrisTeeterDeniedError(
  error: unknown,
): error is HarrisTeeterDeniedError {
  return error instanceof HarrisTeeterDeniedError;
}

/**
 * Demo / self-signup kitchens (ai_chat_lifetime_limit set) cannot Link HT or Shop.
 * Script-created kitchens keep full Shop access via their own kroger_connections row.
 */
export async function assertHarrisTeeterAllowed(
  householdId: string,
): Promise<void> {
  if (await isDemoKitchen(householdId)) {
    throw new HarrisTeeterDeniedError();
  }
}

export async function canUseHarrisTeeterShop(
  householdId: string,
): Promise<boolean> {
  return !(await isDemoKitchen(householdId));
}
