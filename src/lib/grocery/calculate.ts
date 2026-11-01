import { resolveFoodIdentity } from "@/lib/kitchen/food-knowledge";
import { normalizeIngredientName } from "@/lib/kitchen/normalize";
import { parseStoredInstructionSteps } from "@/lib/recipes/instruction-steps";

export type GroceryNeed = {
  name: string;
  normalizedName: string;
  quantityText: string | null;
  /** Meal labels that contributed this line, e.g. "Meal 1". */
  meals?: string[];
};

export function unionMealLabels(
  a?: string[],
  b?: string[],
): string[] | undefined {
  const labels = [...new Set([...(a ?? []), ...(b ?? [])])];
  return labels.length > 0 ? labels : undefined;
}

type ParsedQuantity = {
  value: number;
  unit: string;
};

const PREP_WORD =
  "(?:finely |roughly |thinly |freshly )?(?:minced|chopped|diced|sliced|cubed|crushed|grated|peeled|seeded|trimmed|rinsed|drained|softened|melted|divided|to taste|room temperature|optional)";

const MEASURE_UNITS = new Set([
  "lb",
  "oz",
  "cup",
  "tbsp",
  "tsp",
  "clove",
  "g",
  "ml",
  "can",
  "jar",
  "bottle",
  "package",
  "bunch",
  "head",
  "each",
]);

/** Strip knife-work / shopping noise so "garlic, minced" matches "garlic". */
export function stripCulinaryPrep(name: string): string {
  let cleaned = name.trim();
  cleaned = cleaned.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  cleaned = cleaned.replace(/\boptional\b/gi, " ");
  cleaned = cleaned.replace(/\bstore-bought or homemade\b/gi, " ");
  cleaned = cleaned.replace(/\bor homemade\b/gi, " ");
  cleaned = cleaned.replace(/\s+or swap\s+.+$/i, "");
  cleaned = cleaned.replace(
    /\b(for serving|for garnish|to serve|to garnish|divided|total)\b/gi,
    " ",
  );
  cleaned = cleaned.replace(/\b(drained and rinsed|drained|rinsed)\b/gi, " ");
  cleaned = cleaned.replace(/\bcanned\b/gi, " ");
  cleaned = cleaned.replace(/^(medium|large|small|ripe)\s+/i, "");
  cleaned = cleaned.replace(/,?\s*(medium|large|small|ripe)\s*$/i, "");
  // "garlic, minced" / "garlic — minced" / trailing prep after comma
  cleaned = cleaned.replace(new RegExp(`,\\s*${PREP_WORD}\\b.*$`, "i"), "").trim();
  // Normalized form without comma: "garlic minced"
  cleaned = cleaned.replace(new RegExp(`\\s+${PREP_WORD}$`, "i"), "").trim();
  // Leading: "minced garlic"
  cleaned = cleaned
    .replace(new RegExp(`^${PREP_WORD}\\s+`, "i"), "")
    .trim();
  return cleaned.replace(/[,\s]+$/g, "").replace(/\s+/g, " ").trim() || name.trim();
}

/** True when this is not a shopping item (water, leftovers from another meal). */
export function isNonShoppableGroceryName(name: string): boolean {
  const n = name.trim();
  if (!n) return true;
  if (/from meal\s*\d/i.test(n)) return true;
  if (/\bleftovers?\b/i.test(n) && /\bfrom\b/i.test(n)) return true;
  if (/^cooked .+\bfrom\b/i.test(n)) return true;

  const stripped = stripCulinaryPrep(n).toLowerCase();
  if (!stripped) return true;
  if (/^(water|ice|tap water)$/i.test(stripped)) return true;
  if (/^water for\b/i.test(stripped)) return true;
  if (/\b(cooking water|pasta water|boiling water|pasta cooking water)\b/i.test(stripped)) {
    return true;
  }
  if (/^extra water\b/i.test(stripped)) return true;
  return false;
}

/** Keep a shoppable amount: "2 lb (about 900 g) carrots, peeled…" → "2 lb". */
export function simplifyQuantityText(
  quantityText: string | null | undefined,
): string | null {
  if (!quantityText?.trim()) return null;
  const q = quantityText
    .trim()
    .replace(/½/g, "1/2")
    .replace(/⅓/g, "1/3")
    .replace(/¼/g, "1/4")
    .replace(/¾/g, "3/4")
    .replace(/^about\s+/i, "")
    .replace(
      /\b(divided|optional|total|chopped|minced|diced|packed|drained and rinsed|drained|rinsed)\b.*$/i,
      "",
    )
    .trim();

  const canned = q.match(
    /^(\d+(?:\s+\d+\/\d+|\s*\/\s*\d+)?)\s*\([^)]*\)\s*(cans?)\b/i,
  );
  if (canned) {
    const n = canned[1]!;
    return `${n} ${Number(n) === 1 ? "can" : "cans"}`;
  }

  const parsed = parseQuantityForMerge(q);
  if (parsed && MEASURE_UNITS.has(parsed.unit)) {
    return formatMergedQuantity(parsed);
  }

  const beforeExtra = q.split(/\s*\(|,/)[0]?.trim() ?? q;
  const parsedHead = parseQuantityForMerge(beforeExtra);
  if (parsedHead && MEASURE_UNITS.has(parsedHead.unit)) {
    return formatMergedQuantity(parsedHead);
  }
  if (parsedHead && parsedHead.unit !== "each") {
    const value =
      Math.abs(parsedHead.value - Math.round(parsedHead.value)) < 1e-9
        ? String(Math.round(parsedHead.value))
        : String(Math.round(parsedHead.value * 100) / 100);
    return value;
  }

  return beforeExtra || null;
}

/** Turn a recipe ingredient into a grocery need, or null if it should not be bought. */
export function shoppingNeedFromParts(
  name: string,
  quantityText: string | null | undefined,
): GroceryNeed | null {
  let cleaned = name.trim();
  if (!cleaned) return null;
  if (/^water or\b/i.test(cleaned)) {
    cleaned = cleaned.replace(/^water or\s+/i, "");
  }
  if (isNonShoppableGroceryName(cleaned)) {
    return null;
  }
  let displayName = stripCulinaryPrep(cleaned) || cleaned;
  const alternatives = displayName
    .split(/\s+or\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
  if (alternatives.length > 1) {
    displayName =
      alternatives.find((part) => !isNonShoppableGroceryName(part)) ??
      alternatives[0]!;
    displayName = stripCulinaryPrep(displayName) || displayName;
  }
  if (
    !displayName ||
    looksLikeInstructionLine(displayName) ||
    looksLikeMealTitleLine(displayName) ||
    isNonShoppableGroceryName(displayName)
  ) {
    return null;
  }
  return {
    name: displayName,
    normalizedName: groceryMatchKey(displayName),
    quantityText: simplifyQuantityText(quantityText ?? null),
  };
}

/**
 * Stable key for consolidating grocery needs across recipes.
 * Uses food-knowledge when known; otherwise prep-stripped normalized name.
 */
export function groceryMatchKey(name: string): string {
  const stripped = stripCulinaryPrep(name);
  const identity = resolveFoodIdentity(stripped);
  // Known foods → canonical id; unknown → normalizeIngredientName fallback inside resolve.
  if (identity.canonicalId && identity.canonicalId !== "unknown") {
    return identity.canonicalId;
  }
  return normalizeIngredientName(stripped) || normalizeIngredientName(name);
}

/** Prefer a short shopping name when consolidating variants. */
export function preferGroceryDisplayName(a: string, b: string): string {
  const aClean = stripCulinaryPrep(a);
  const bClean = stripCulinaryPrep(b);
  if (aClean.length !== bClean.length) {
    return aClean.length < bClean.length ? aClean : bClean;
  }
  return aClean.length <= a.length ? aClean : a;
}

function parseFractionToken(token: string): number | null {
  const mixed = token.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const num = Number(mixed[2]);
    const den = Number(mixed[3]);
    if (den === 0) return null;
    return whole + num / den;
  }
  const frac = token.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const num = Number(frac[1]);
    const den = Number(frac[2]);
    if (den === 0) return null;
    return num / den;
  }
  const plain = Number(token);
  return Number.isFinite(plain) ? plain : null;
}

function normalizeUnit(raw: string): string {
  const u = raw.toLowerCase().replace(/\.$/, "").trim();
  const map: Record<string, string> = {
    lb: "lb",
    lbs: "lb",
    pound: "lb",
    pounds: "lb",
    oz: "oz",
    ounce: "oz",
    ounces: "oz",
    cup: "cup",
    cups: "cup",
    c: "cup",
    tbsp: "tbsp",
    tbsps: "tbsp",
    tablespoon: "tbsp",
    tablespoons: "tbsp",
    tsp: "tsp",
    tsps: "tsp",
    teaspoon: "tsp",
    teaspoons: "tsp",
    clove: "clove",
    cloves: "clove",
    g: "g",
    gram: "g",
    grams: "g",
    ml: "ml",
    milliliter: "ml",
    milliliters: "ml",
    can: "can",
    cans: "can",
    jar: "jar",
    jars: "jar",
    bottle: "bottle",
    bottles: "bottle",
    package: "package",
    packages: "package",
    pack: "package",
    packs: "package",
    bunch: "bunch",
    bunches: "bunch",
    head: "head",
    heads: "head",
    each: "each",
    ea: "each",
    ct: "each",
    count: "each",
  };
  return map[u] ?? u;
}

/** Parse a single quantity string for merge (null if not safely additive). */
export function parseQuantityForMerge(
  quantityText: string | null | undefined,
): ParsedQuantity | null {
  if (!quantityText?.trim()) return null;
  const trimmed = quantityText
    .trim()
    .toLowerCase()
    .replace(/½/g, "1/2")
    .replace(/⅓/g, "1/3")
    .replace(/¼/g, "1/4")
    .replace(/¾/g, "3/4");

  // "2 lb", "1 1/4 lb", "2.5 cups", "3 cloves"
  const withUnit = trimmed.match(
    /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*([a-zA-Z]+)\b/,
  );
  if (withUnit) {
    const value = parseFractionToken(withUnit[1]!);
    if (value == null) return null;
    return { value, unit: normalizeUnit(withUnit[2]!) };
  }

  // Bare count: "12", "6"
  const bare = trimmed.match(/^(\d+(?:\.\d+)?)$/);
  if (bare) {
    return { value: Number(bare[1]), unit: "each" };
  }

  return null;
}

function toBaseUnit(qty: ParsedQuantity): ParsedQuantity | null {
  if (qty.unit === "lb") return { value: qty.value * 16, unit: "oz" };
  if (qty.unit === "cup") return { value: qty.value * 16, unit: "tbsp" };
  if (qty.unit === "tbsp") return { value: qty.value * 3, unit: "tsp" };
  return qty;
}

function fromBaseUnit(qty: ParsedQuantity, preferredUnit: string): ParsedQuantity {
  if (preferredUnit === "lb" && qty.unit === "oz") {
    return { value: qty.value / 16, unit: "lb" };
  }
  if (preferredUnit === "cup" && qty.unit === "tbsp") {
    return { value: qty.value / 16, unit: "cup" };
  }
  if (preferredUnit === "tbsp" && qty.unit === "tsp") {
    return { value: qty.value / 3, unit: "tbsp" };
  }
  // Prefer larger unit when summing oz → lb if whole-ish
  if (qty.unit === "oz" && qty.value >= 16 && qty.value % 16 === 0) {
    return { value: qty.value / 16, unit: "lb" };
  }
  if (qty.unit === "oz" && qty.value >= 16) {
    const lb = qty.value / 16;
    if (Math.abs(lb - Math.round(lb * 4) / 4) < 1e-9) {
      return { value: Math.round(lb * 4) / 4, unit: "lb" };
    }
  }
  return qty;
}

function formatQuantityValue(value: number): string {
  const whole = Math.floor(value + 1e-9);
  const fraction = value - whole;
  const fractions: Array<[number, string]> = [
    [0.25, "1/4"],
    [1 / 3, "1/3"],
    [0.5, "1/2"],
    [2 / 3, "2/3"],
    [0.75, "3/4"],
  ];
  if (fraction < 0.02) return String(whole);
  for (const [amount, label] of fractions) {
    if (Math.abs(fraction - amount) < 0.02) {
      return whole > 0 ? `${whole} ${label}` : label;
    }
  }
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

function formatMergedQuantity(qty: ParsedQuantity): string {
  const value = formatQuantityValue(qty.value);
  if (qty.unit === "each") return value;
  const pluralUnits: Record<string, string> = {
    clove: "cloves",
    cup: "cups",
    can: "cans",
    jar: "jars",
    bottle: "bottles",
    package: "packages",
    bunch: "bunches",
    head: "heads",
  };
  const unit =
    qty.value > 1.001 ? (pluralUnits[qty.unit] ?? qty.unit) : qty.unit;
  return `${value} ${unit}`;
}

/** Add quantities when units are compatible; otherwise join with " + ". */
export function mergeQuantityTexts(
  a: string | null | undefined,
  b: string | null | undefined,
): string | null {
  const left = a?.trim() || null;
  const right = b?.trim() || null;
  if (!left) return right;
  if (!right) return left;
  if (normalizeIngredientName(left) === normalizeIngredientName(right)) {
    // Identical non-numeric notes ("to taste") → keep one. Identical amounts still add.
    if (!parseQuantityForMerge(left)) return left;
  }

  const pa = parseQuantityForMerge(left);
  const pb = parseQuantityForMerge(right);
  if (!pa || !pb) {
    return `${left} + ${right}`;
  }

  // "3 tsp" plus a unit-less "1" is the same seasoning, not an extra item.
  if (pa.unit === "each" && pa.value === 1 && pb.unit !== "each") return right;
  if (pb.unit === "each" && pb.value === 1 && pa.unit !== "each") return left;

  const baseA = toBaseUnit(pa);
  const baseB = toBaseUnit(pb);
  if (!baseA || !baseB || baseA.unit !== baseB.unit) {
    return `${left} + ${right}`;
  }

  const summed = fromBaseUnit(
    { value: baseA.value + baseB.value, unit: baseA.unit },
    pa.unit === pb.unit ? pa.unit : pa.unit === "lb" || pb.unit === "lb" ? "lb" : pa.unit,
  );
  return formatMergedQuantity(summed);
}

export function consolidateGroceryNeeds(needs: GroceryNeed[]): GroceryNeed[] {
  const map = new Map<string, GroceryNeed>();
  for (const need of needs) {
    const key = need.normalizedName || groceryMatchKey(need.name);
    const existing = map.get(key);
      if (!existing) {
      map.set(key, {
        name: stripCulinaryPrep(need.name) || need.name,
        normalizedName: key,
        quantityText: need.quantityText,
        meals: need.meals,
      });
      continue;
    }
    map.set(key, {
      name: preferGroceryDisplayName(existing.name, need.name),
      normalizedName: key,
      quantityText: mergeQuantityTexts(existing.quantityText, need.quantityText),
      meals: unionMealLabels(existing.meals, need.meals),
    });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Cooking-step language — not a grocery line. */
export function looksLikeInstructionLine(text: string): boolean {
  const line = text.trim();
  if (!line) return true;

  // Numbered steps: "1. Toss the chicken…"
  if (/^\d+[.)]\s+\S/.test(line)) return true;

  // Section headers / labels
  if (
    /^(for the |to serve\b|optional:|directions\b|instructions\b|method\b|make ahead\b|note:)/i.test(
      line,
    )
  ) {
    return true;
  }

  // Imperative cooking verbs (with or without "the")
  if (
    /^(preheat|heat|cook|bake|roast|saute|sauté|simmer|boil|bring|toss|mix|stir|whisk|drain|combine|place|transfer|remove|set aside|pat|meanwhile|repeat|rest|cover|uncover|flip|turn|spread|pour|scrape|fold|knead|grill|broil|fry|sear|brown|reduce|taste|adjust|garnish|plate|serve|season|while|until|then|using|thread|skewer)\b/i.test(
      line,
    )
  ) {
    return true;
  }

  // "Add the …" / "Let the …" / "In a large bowl…"
  if (
    /^(add|let|in a |on a |into a |over (?:medium|high|low)|slice the|chop the|dice the|mince the|cut the|wash the|rinse the|dry the|pound the)\b/i.test(
      line,
    )
  ) {
    return true;
  }

  // Long action sentence without a quantity dash — skip ingredient-style comma notes
  if (
    !/\s[—–]\s/.test(line) &&
    !/,/.test(line) &&
    line.length > 48 &&
    /\b(until|into|minutes?|degrees?|oven|skillet|meanwhile)\b/i.test(line)
  ) {
    return true;
  }

  return false;
}

/**
 * Meal titles look like "Honey-garlic pork with mashed potatoes & green beans".
 * Those must never become grocery lines. Lines with a quantity dash are ingredients.
 */
export function looksLikeMealTitleLine(text: string): boolean {
  const line = text.trim();
  if (/\s[—–]\s/.test(line)) return false;
  if (line.length < 40) return false;
  // Typical batch titles: "… with X & Y" or long "… with A, B & C"
  if (/\bwith\b.+\s&\s/i.test(line)) return true;
  return /\bwith\b/i.test(line) && (line.match(/,/g)?.length ?? 0) >= 1;
}

/**
 * Parse a recipe ingredients block into grocery needs.
 * Newline-separated only — never split on commas (that turns
 * "garlic, minced — 2 cloves" into junk like "minced").
 */
export function parseIngredientsTextToNeeds(
  ingredientsText: string,
): GroceryNeed[] {
  return ingredientsText
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•·]+\s*/, "").trim())
    .filter(Boolean)
    .map((line) => {
      // "1. chicken thighs — 2 lb" is an ingredient. "1. Preheat…" is a step.
      const cleaned = line.replace(/^\d+[.)]\s+/, "").trim();
      if (!cleaned) return null;
      if (looksLikeInstructionLine(cleaned) || looksLikeMealTitleLine(cleaned)) {
        return null;
      }
      return parseIngredientNeedLine(cleaned);
    })
    .filter((need): need is GroceryNeed => need != null);
}

function parseIngredientNeedLine(line: string): GroceryNeed | null {
  if (looksLikeInstructionLine(line) || looksLikeMealTitleLine(line)) {
    return null;
  }

  const emDash = line.match(/^(.+?)\s+[—–]\s+(.+)$/);
  if (emDash) {
    return shoppingNeedFromParts(emDash[1]!.trim(), emDash[2]!.trim());
  }

  const hyphen = line.match(/^(.+?)\s+-\s+(.+)$/);
  if (hyphen && hyphen[2]!.trim().length < 40) {
    return shoppingNeedFromParts(hyphen[1]!.trim(), hyphen[2]!.trim());
  }

  // "2 lb chicken thighs" / "1 cup rice"
  const qtyFirst = line.match(
    /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*(lb|lbs|pounds?|oz|ounces?|cups?|tbsp|tablespoons?|tsp|teaspoons?|cloves?|cans?|jars?|packages?|bunches?|heads?)\b\s+(.+)$/i,
  );
  if (qtyFirst) {
    const name = qtyFirst[3]!.trim();
    if (!name || looksLikeInstructionLine(name) || looksLikeMealTitleLine(name)) {
      return null;
    }
    return shoppingNeedFromParts(name, `${qtyFirst[1]} ${qtyFirst[2]}`);
  }

  // "12 flour tortillas" — a count, not "25 minutes"
  const countFirst = line.match(/^(\d+)\s+([A-Za-z].+)$/);
  if (
    countFirst &&
    !/^(minutes?|hours?|seconds?|degrees?)\b/i.test(countFirst[2]!)
  ) {
    const name = countFirst[2]!.trim();
    if (!looksLikeInstructionLine(name) && !looksLikeMealTitleLine(name)) {
      return shoppingNeedFromParts(name, countFirst[1]!);
    }
  }

  // Bare name without quantity — allow only short, non-title lines.
  if (looksLikeMealTitleLine(line) || line.length > 60) return null;
  return shoppingNeedFromParts(line, null);
}

/** Indented or bulleted lines under a step, e.g. "   · black beans — 2 cans". */
function parseInstructionBulletNeeds(instructionsText: string): GroceryNeed[] {
  const needs: GroceryNeed[] = [];
  for (const line of instructionsText.split(/\r?\n/)) {
    if (!/^\s*[-•*·]/.test(line) && !/^\s{2,}\S/.test(line)) continue;
    const cleaned = line.replace(/^[-•*·\s]+/, "").trim();
    if (!cleaned || looksLikeInstructionLine(cleaned)) continue;
    const need = parseIngredientNeedLine(cleaned);
    if (need) needs.push(need);
  }
  return needs;
}

/**
 * Grocery needs from a stored recipe: ingredients list plus any step-only items.
 * Skips water, leftovers-from-another-meal, and instruction-like lines.
 */
export function groceryNeedsFromRecipe(recipe: {
  name?: string | null;
  ingredientsText?: string | null;
  instructionsText?: string | null;
  instructionSteps?: unknown;
}): GroceryNeed[] {
  const fromList = recipe.ingredientsText?.trim()
    ? parseIngredientsTextToNeeds(recipe.ingredientsText)
    : [];
  const covered = new Set(fromList.map((need) => need.normalizedName));
  const extras: GroceryNeed[] = [];

  const remember = (need: GroceryNeed | null) => {
    if (!need || covered.has(need.normalizedName)) return;
    covered.add(need.normalizedName);
    extras.push(need);
  };

  const steps = parseStoredInstructionSteps(recipe.instructionSteps ?? null);
  const structured =
    steps?.flatMap((step) => step.ingredients ?? []) ?? [];
  if (structured.length > 0) {
    for (const ingredient of structured) {
      remember(
        shoppingNeedFromParts(ingredient.name, ingredient.quantityText),
      );
    }
  } else if (recipe.instructionsText?.trim()) {
    for (const need of parseInstructionBulletNeeds(recipe.instructionsText)) {
      remember(need);
    }
  }

  return consolidateGroceryNeeds([...fromList, ...extras]);
}

export function mondayOfWeek(date = new Date(), timeZone = "America/New_York"): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const weekday = get("weekday");
  const local = new Date(Date.UTC(year, month - 1, day));
  const weekdayIndex: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const current = weekdayIndex[weekday ?? "Mon"] ?? 1;
  const diff = current === 0 ? -6 : 1 - current;
  local.setUTCDate(local.getUTCDate() + diff);
  return local.toISOString().slice(0, 10);
}

export function dateInTimeZone(date = new Date(), timeZone = "America/New_York"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
