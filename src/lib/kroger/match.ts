export type GroceryAmount = {
  unit: "each" | "lb" | "oz" | "fl_oz" | null;
  value: number;
};

/** Parse requested amount from grocery list quantity text. */
export function parseGroceryAmount(quantityText: string | null): GroceryAmount {
  if (!quantityText?.trim()) {
    return { unit: "each", value: 1 };
  }

  const trimmed = quantityText.trim().toLowerCase();

  const rangeCount = trimmed.match(
    /(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(medium|large|small|ct|count|each|ea)?\b/,
  );
  if (rangeCount) {
    const low = Number(rangeCount[1]);
    const high = Number(rangeCount[2]);
    return {
      unit: "each",
      value: Math.max(1, Math.round((low + high) / 2)),
    };
  }

  const packMatch = trimmed.match(
    /(\d+(?:\.\d+)?)\s*(x|pack|package|packages|pk|ct|count|each|ea)\b/,
  );
  if (packMatch) {
    return { unit: "each", value: Number(packMatch[1]) };
  }

  const lbMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(lb|lbs|pound|pounds)\b/);
  if (lbMatch) {
    return { unit: "lb", value: Number(lbMatch[1]) };
  }

  const ozMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(oz|ounce|ounces)\b/);
  if (ozMatch) {
    return { unit: "oz", value: Number(ozMatch[1]) };
  }

  const flOzMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(fl\s*oz|fluid ounce|fluid ounces)\b/);
  if (flOzMatch) {
    return { unit: "fl_oz", value: Number(flOzMatch[1]) };
  }

  const leadingCount = trimmed.match(/^(\d+)\b/);
  if (leadingCount) {
    return { unit: "each", value: Number(leadingCount[1]) };
  }

  if (/\b(jar|bottle|bag|loaf|bunch|head|package|pack)\b/.test(trimmed)) {
    return { unit: "each", value: 1 };
  }

  return { unit: null, value: 1 };
}

/** Parse package size from Kroger catalog (e.g. "3 lb", "16 oz", "1 ea"). */
export function parsePackageSize(size: string | null | undefined): GroceryAmount {
  if (!size?.trim()) {
    return { unit: "each", value: 1 };
  }

  const trimmed = size.trim().toLowerCase();

  const lbMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(lb|lbs|pound|pounds)\b/);
  if (lbMatch) {
    return { unit: "lb", value: Number(lbMatch[1]) };
  }

  const ozMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(oz|ounce|ounces)\b/);
  if (ozMatch) {
    return { unit: "oz", value: Number(ozMatch[1]) };
  }

  const flOzMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(fl\s*oz|fluid ounce|fluid ounces)\b/);
  if (flOzMatch) {
    return { unit: "fl_oz", value: Number(flOzMatch[1]) };
  }

  const countMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(ct|count|ea|each|pk|pack)\b/);
  if (countMatch) {
    return { unit: "each", value: Number(countMatch[1]) };
  }

  if (/\b(ea|each)\b/.test(trimmed)) {
    return { unit: "each", value: 1 };
  }

  return { unit: null, value: 1 };
}

function toPounds(amount: GroceryAmount): number | null {
  if (amount.unit === "lb") return amount.value;
  if (amount.unit === "oz") return amount.value / 16;
  return null;
}

/** Compute Kroger cart units from requested amount vs catalog package size. */
export function computeCartUnits(
  requested: GroceryAmount,
  packageAmount: GroceryAmount,
): number {
  if (requested.unit === "each" && packageAmount.unit === "each") {
    return Math.max(1, Math.min(20, Math.ceil(requested.value / packageAmount.value)));
  }

  const reqLb = toPounds(requested);
  const pkgLb = toPounds(packageAmount);
  if (reqLb !== null && pkgLb !== null && pkgLb > 0) {
    return Math.max(1, Math.min(20, Math.ceil(reqLb / pkgLb)));
  }

  if (requested.unit === "each") {
    return Math.max(1, Math.min(20, Math.round(requested.value)));
  }

  return 1;
}

const LEADING_BRANDS =
  /^(perdue|tyson|harris teeter|ht|kroger|simple truth|private selection|nature'?s promise|organic valley|boar'?s head|land o lakes|philadelphia|barilla|hunt'?s|del monte|progresso|kraft|heinz|hellmann'?s|best foods|quaker|cheerios|dannon|chobani|fage)\b/i;

const SEARCH_NOISE =
  /\b(jarred|fresh|frozen|boneless|skinless|extra virgin|approx|approximately|medium|large|small|bag|bottle|jar|pack|package|ct|count|tenderloin|pantry|produce|dairy|meat|condiments)\b/gi;

/** Strip brand prefixes and category noise before Kroger search. */
export function normalizeGroceryItemForCart(name: string): string {
  let cleaned = buildProductSearchTerm(name);
  cleaned = cleaned.replace(LEADING_BRANDS, "").trim();
  cleaned = cleaned.replace(SEARCH_NOISE, " ").replace(/\s+/g, " ").trim();
  return cleaned || buildProductSearchTerm(name);
}

/** Build a product search term from a grocery line item. */
export function buildProductSearchTerm(name: string): string {
  return name
    .replace(/\([^)]*\)/g, " ")
    .replace(/—.*$/, " ")
    .replace(/\s*[—–-]\s*[\d.]+\s*(?:lb|lbs|oz|ounce|ounces|g|kg|ml|l)\b.*$/i, " ")
    .replace(/\s*~\s*[\d.]+\s*(?:lb|lbs|oz|g|kg)\b.*$/i, " ")
    .replace(/\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\s*(?:lb|lbs|oz|ounce|ounces|g|kg|ml|l)\b/gi, " ")
    .replace(/\b\d+\s*(?:medium|large|small)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

/** Fallback search terms when the primary query returns no / weak matches. */
export function buildProductSearchVariants(name: string): string[] {
  const normalized = normalizeGroceryItemForCart(name);
  const primary = buildProductSearchTerm(normalized);
  const variants = new Set<string>();
  if (normalized) variants.add(normalized);
  if (primary) variants.add(primary);

  const simplified = primary
    .replace(SEARCH_NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (simplified) variants.add(simplified);

  const tokens = primary.split(/\s+/).filter((token) => token.length > 2);
  if (tokens.length > 3) {
    variants.add(tokens.slice(-3).join(" "));
  }
  if (tokens.length > 2) {
    variants.add(tokens.slice(-2).join(" "));
  }

  const lower = primary.toLowerCase();
  const shortcuts: Array<[RegExp, string]> = [
    [/ground beef/, "ground beef"],
    [/pork tenderloin/, "pork tenderloin"],
    [/sweet potato/, "sweet potato"],
    [/pasta sauce/, "pasta sauce"],
    [/olive oil/, "olive oil"],
    [/minced garlic|garlic/, "minced garlic"],
    [/shredded mozzarella|mozzarella/, "shredded mozzarella"],
    [/shredded cheddar|cheddar cheese/, "shredded cheddar"],
    [/chicken breast/, "boneless chicken breast"],
    [/chicken thigh/, "chicken thighs"],
    [/salsa/, "salsa"],
    [/lemon/, "lemons"],
  ];
  for (const [pattern, term] of shortcuts) {
    if (pattern.test(lower)) variants.add(term);
  }

  return [...variants].filter(Boolean);
}

export type ProductScoreInput = {
  searchTerm: string;
  description: string;
  brand?: string | null;
  upc?: string | null;
  onSale?: boolean;
  regularPrice?: number | null;
  promoPrice?: number | null;
  preferredBrand?: string | null;
  preferredUpc?: string | null;
  brandLocked?: boolean;
  timesPurchased?: number;
};

export function scoreProductMatch(input: ProductScoreInput): number;
export function scoreProductMatch(
  searchTerm: string,
  productDescription: string,
  brand?: string | null,
  preferredBrand?: string | null,
): number;
export function scoreProductMatch(
  searchTermOrInput: string | ProductScoreInput,
  productDescription?: string,
  brand?: string | null,
  preferredBrand?: string | null,
): number {
  const input: ProductScoreInput =
    typeof searchTermOrInput === "string"
      ? {
          searchTerm: searchTermOrInput,
          description: productDescription ?? "",
          brand,
          preferredBrand,
        }
      : searchTermOrInput;

  const termTokens = input.searchTerm
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 2);
  const description = input.description.toLowerCase();
  const brandLower = input.brand?.toLowerCase() ?? "";

  if (termTokens.length === 0) return 0;

  let score = 0;
  for (const token of termTokens) {
    if (description.includes(token)) score += 1;
  }

  if (description.includes(input.searchTerm.toLowerCase())) {
    score += termTokens.length;
  }

  let normalized = score / termTokens.length;

  if (input.preferredUpc && input.upc && input.preferredUpc === input.upc) {
    normalized += input.brandLocked ? 1.2 : 0.85;
  }

  if (input.preferredBrand) {
    const preferred = input.preferredBrand.toLowerCase();
    if (
      brandLower.includes(preferred) ||
      description.includes(preferred) ||
      (brandLower && preferred.includes(brandLower))
    ) {
      normalized += input.brandLocked ? 0.7 : 0.45;
      if ((input.timesPurchased ?? 0) >= 2) normalized += 0.15;
    }
  }

  if (
    !input.preferredBrand &&
    !input.preferredUpc &&
    (brandLower.includes("harris teeter") || brandLower === "ht")
  ) {
    normalized += 0.05;
  }

  return normalized;
}
