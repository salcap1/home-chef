import { normalizeIngredientName } from "@/lib/kitchen/normalize";

/** How two food names relate — three layers of kitchen understanding. */
export type FoodMatchMode =
  | "canonical"
  | "specific"
  | "protein_class";

export type FoodIdentity = {
  /** Dedup layer — "same product" across brands/wording (mozzarella, HT mozz). */
  canonicalId: string;
  /** Cooking layer — cut/form matters (pork-chop ≠ pork-tenderloin). */
  specificId: string;
  /** Planning layer — animal/class for caps (both above are proteinClass pork). */
  proteinClass: string | null;
  label: string;
};

type FoodSignature = {
  specificId: string;
  canonicalId: string;
  proteinClass: string | null;
  patterns: RegExp[];
};

const STORE_BRAND_PATTERN =
  /^(harris teeter|ht|kroger|simple truth|private selection|store brand|organic valley|chobani|kikkoman|la brea bakery|perdue|tyson)\s+/i;

/**
 * Ordered most-specific first. First match wins for specificId;
 * canonicalId may be shared across signatures (brand variants).
 */
const FOOD_SIGNATURES: FoodSignature[] = [
  // --- Poultry (cuts before generic) ---
  {
    specificId: "chicken-thighs",
    canonicalId: "chicken-thighs",
    proteinClass: "chicken",
    patterns: [/chicken thigh/i],
  },
  {
    specificId: "chicken-breasts",
    canonicalId: "chicken-breasts",
    proteinClass: "chicken",
    patterns: [/chicken breast/i],
  },
  {
    specificId: "chicken-drumsticks",
    canonicalId: "chicken-drumsticks",
    proteinClass: "chicken",
    patterns: [/chicken drum/i],
  },
  {
    specificId: "ground-turkey",
    canonicalId: "ground-turkey",
    proteinClass: "turkey",
    patterns: [/ground turkey/i],
  },
  {
    specificId: "turkey",
    canonicalId: "turkey",
    proteinClass: "turkey",
    patterns: [/turkey/i],
  },
  {
    specificId: "chicken-broth",
    canonicalId: "chicken-broth",
    proteinClass: null,
    patterns: [/chicken[\s-]+(?:broth|stock|bouillon)/i],
  },
  {
    specificId: "chicken",
    canonicalId: "chicken",
    proteinClass: "chicken",
    patterns: [/chicken(?![\s-]+(?:broth|stock|bouillon|base|seasoning))/i],
  },

  // --- Pork (cuts are NOT interchangeable for cooking) ---
  {
    specificId: "pork-chops",
    canonicalId: "pork-chops",
    proteinClass: "pork",
    patterns: [/pork chop/i, /pork loin chop/i],
  },
  {
    specificId: "pork-tenderloin",
    canonicalId: "pork-tenderloin",
    proteinClass: "pork",
    patterns: [/pork tenderloin/i],
  },
  {
    specificId: "pork-shoulder",
    canonicalId: "pork-shoulder",
    proteinClass: "pork",
    patterns: [/pork shoulder|boston butt/i],
  },
  {
    specificId: "pork-sausage",
    canonicalId: "pork-sausage",
    proteinClass: "pork",
    patterns: [/pork sausage|breakfast sausage/i, /(?<!chicken )sausage/i],
  },
  {
    specificId: "pork-broth",
    canonicalId: "pork-broth",
    proteinClass: null,
    patterns: [/pork[\s-]+(?:broth|stock|bouillon)/i],
  },
  {
    specificId: "pork",
    canonicalId: "pork",
    proteinClass: "pork",
    patterns: [/pork(?![\s-]+(?:broth|stock|bouillon))/i],
  },

  // --- Beef ---
  {
    specificId: "ground-beef",
    canonicalId: "ground-beef",
    proteinClass: "beef",
    patterns: [/ground beef/i],
  },
  {
    specificId: "beef-strips",
    canonicalId: "beef-strips",
    proteinClass: "beef",
    patterns: [
      /beef strip/i,
      /stir.?fry beef/i,
      /beef for stir.?fry/i,
      /sliced beef/i,
      /sirloin tip/i,
      /round sirloin/i,
      /beef.*stir.?fry|stir.?fry.*beef/i,
    ],
  },
  {
    specificId: "steak",
    canonicalId: "steak",
    proteinClass: "beef",
    patterns: [/steak|flank|ribeye|ny strip|skirt steak/i],
  },
  {
    specificId: "beef-broth",
    canonicalId: "beef-broth",
    proteinClass: null,
    patterns: [/beef[\s-]+(?:broth|stock|bouillon)/i],
  },
  {
    specificId: "beef",
    canonicalId: "beef",
    proteinClass: "beef",
    patterns: [/beef(?![\s-]+(?:broth|stock|bouillon))|brisket|chuck roast/i],
  },

  // --- Other proteins ---
  {
    specificId: "salmon",
    canonicalId: "salmon",
    proteinClass: "fish",
    patterns: [/salmon/i],
  },
  {
    specificId: "shrimp",
    canonicalId: "shrimp",
    proteinClass: "seafood",
    patterns: [/shrimp/i],
  },
  {
    specificId: "fish-sauce",
    canonicalId: "fish-sauce",
    proteinClass: null,
    patterns: [/fish[\s-]+sauce/i],
  },
  {
    specificId: "fish",
    canonicalId: "fish",
    proteinClass: "fish",
    patterns: [/fish(?![\s-]+sauce)|cod|tilapia|tuna/i],
  },

  // --- Dairy / identity dupes ---
  {
    specificId: "mozzarella-shredded",
    canonicalId: "mozzarella-shredded",
    proteinClass: null,
    patterns: [/shredded mozz|mozzarella shredded|mozz shredded/i],
  },
  {
    specificId: "cheddar-shredded",
    canonicalId: "cheddar-shredded",
    proteinClass: null,
    patterns: [/shredded cheddar|sharp cheddar shredded|cheddar shredded/i],
  },
  {
    specificId: "eggs",
    canonicalId: "eggs",
    proteinClass: null,
    patterns: [/eggs|egg carton|nest eggs/i],
  },
  {
    specificId: "buttermilk",
    canonicalId: "buttermilk",
    proteinClass: null,
    patterns: [/buttermilk/i],
  },
  {
    specificId: "coconut-milk",
    canonicalId: "coconut-milk",
    proteinClass: null,
    patterns: [/coconut milk/i],
  },
  {
    specificId: "almond-milk",
    canonicalId: "almond-milk",
    proteinClass: null,
    patterns: [/almond milk/i],
  },
  {
    specificId: "milk",
    canonicalId: "milk",
    proteinClass: null,
    patterns: [
      /(?<!(?:coconut|almond|oat|soy|evaporated|condensed)\s)\bmilk\b/i,
    ],
  },

  // --- Produce ---
  {
    specificId: "lemons",
    canonicalId: "lemons",
    proteinClass: null,
    patterns: [/fresh large lemon|lemon(?! juice)/i],
  },

  // --- Pantry / condiments (brand-agnostic canonical) ---
  {
    specificId: "pasta-sauce",
    canonicalId: "pasta-sauce",
    proteinClass: null,
    patterns: [/pasta sauce|tomato basil pasta sauce|marinara/i],
  },
  {
    specificId: "stir-fry-sauce",
    canonicalId: "stir-fry-sauce",
    proteinClass: null,
    patterns: [/stir.?fry sauce/i],
  },
  {
    specificId: "chimichurri",
    canonicalId: "chimichurri",
    proteinClass: null,
    patterns: [/chimichurri/i],
  },
  {
    specificId: "soy-sauce",
    canonicalId: "soy-sauce",
    proteinClass: null,
    patterns: [/soy sauce/i],
  },
  {
    specificId: "ketchup",
    canonicalId: "ketchup",
    proteinClass: null,
    patterns: [/ketchup/i],
  },
  {
    specificId: "sourdough",
    canonicalId: "sourdough",
    proteinClass: null,
    patterns: [/sourdough/i],
  },
  {
    specificId: "green-beans",
    canonicalId: "green-beans",
    proteinClass: null,
    patterns: [/green bean/i],
  },
  {
    specificId: "broccoli-frozen",
    canonicalId: "broccoli",
    proteinClass: null,
    patterns: [/frozen broccoli|broccoli frozen/i],
  },
  {
    specificId: "broccoli",
    canonicalId: "broccoli",
    proteinClass: null,
    patterns: [/\bbroccoli\b/i],
  },
  {
    specificId: "rice-vinegar",
    canonicalId: "rice-vinegar",
    proteinClass: null,
    patterns: [/rice[\s-]+vinegar/i],
  },
  {
    specificId: "rice",
    canonicalId: "rice",
    proteinClass: null,
    patterns: [/\brice\b(?!\s*noodles?)(?![\s-]+vinegar)|basmati|jasmine rice/i],
  },
  {
    specificId: "stir-fry-noodles",
    canonicalId: "stir-fry-noodles",
    proteinClass: null,
    patterns: [
      /stir.?fry noodle/i,
      /yakisoba/i,
      /lo.?mein/i,
      /chow.?mein/i,
      /rice noodles?/i,
      /asian noodles?/i,
    ],
  },
  {
    specificId: "pasta",
    canonicalId: "pasta",
    proteinClass: null,
    patterns: [/pasta|penne|spaghetti|(?<!egg[ -])noodle(?! pack)/i],
  },
  {
    specificId: "garlic-powder",
    canonicalId: "garlic-powder",
    proteinClass: null,
    patterns: [/garlic[\s-]+(?:powder|salt)/i],
  },
  {
    specificId: "garlic",
    canonicalId: "garlic",
    proteinClass: null,
    patterns: [/garlic(?![\s-]+(?:powder|salt|sauce))/i],
  },
  {
    specificId: "green-onion",
    canonicalId: "green-onion",
    proteinClass: null,
    patterns: [/green onion|scallion|spring onion/i],
  },
  {
    specificId: "onion-powder",
    canonicalId: "onion-powder",
    proteinClass: null,
    patterns: [/onion[\s-]+powder/i],
  },
  {
    specificId: "onion",
    canonicalId: "onion",
    proteinClass: null,
    patterns: [/\bonions?\b(?![\s-]+powder)/i],
  },
  {
    specificId: "sweet-potato",
    canonicalId: "sweet-potato",
    proteinClass: null,
    patterns: [/sweet potato/i],
  },
  {
    specificId: "potato",
    canonicalId: "potato",
    proteinClass: null,
    patterns: [/potato/i],
  },
  {
    specificId: "bell-pepper",
    canonicalId: "bell-pepper",
    proteinClass: null,
    patterns: [/bell pepper/i],
  },
  {
    specificId: "cabbage",
    canonicalId: "cabbage",
    proteinClass: null,
    patterns: [/\bcabbage\b/i],
  },
  {
    specificId: "carrot",
    canonicalId: "carrot",
    proteinClass: null,
    patterns: [/carrot/i],
  },
  {
    specificId: "cilantro",
    canonicalId: "cilantro",
    proteinClass: null,
    patterns: [/cilantro/i],
  },
  {
    specificId: "flour-tortilla",
    canonicalId: "flour-tortilla",
    proteinClass: null,
    patterns: [/flour tortilla/i],
  },
  {
    specificId: "chicken-broth",
    canonicalId: "chicken-broth",
    proteinClass: null,
    patterns: [/chicken broth|chicken stock/i],
  },
  {
    specificId: "bbq-sauce",
    canonicalId: "bbq-sauce",
    proteinClass: null,
    patterns: [/bbq sauce|barbecue sauce/i],
  },
  {
    specificId: "olive-oil",
    canonicalId: "olive-oil",
    proteinClass: null,
    patterns: [/olive oil/i],
  },
  {
    specificId: "sesame-oil",
    canonicalId: "sesame-oil",
    proteinClass: null,
    patterns: [/sesame oil/i],
  },
  {
    specificId: "honey-mustard",
    canonicalId: "honey-mustard",
    proteinClass: null,
    patterns: [/honey[\s-]+mustard/i],
  },
  {
    specificId: "honey",
    canonicalId: "honey",
    proteinClass: null,
    patterns: [/\bhoney\b(?![\s-]+mustard)/i],
  },
  {
    specificId: "salsa",
    canonicalId: "salsa",
    proteinClass: null,
    patterns: [/salsa/i],
  },
  {
    specificId: "quinoa",
    canonicalId: "quinoa",
    proteinClass: null,
    patterns: [/quinoa/i],
  },
];

const UNKNOWN: FoodIdentity = {
  canonicalId: "unknown",
  specificId: "unknown",
  proteinClass: null,
  label: "unknown",
};

/** Strip store brands and packaging noise before matching. */
export function stripRetailNoise(name: string): string {
  return name
    .replace(STORE_BRAND_PATTERN, "")
    .replace(/\s*[™®©]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveFoodIdentity(rawName: string): FoodIdentity {
  const stripped = stripRetailNoise(rawName);
  const normalized = normalizeIngredientName(stripped);
  const searchText = `${rawName} ${stripped} ${normalized}`.replace(
    /[-_/]+/g,
    " ",
  );

  for (const signature of FOOD_SIGNATURES) {
    if (!signature.patterns.some((pattern) => pattern.test(searchText))) {
      continue;
    }
    return {
      canonicalId: signature.canonicalId,
      specificId: signature.specificId,
      proteinClass: signature.proteinClass,
      label: signature.specificId.replace(/-/g, " "),
    };
  }

  return {
    ...UNKNOWN,
    canonicalId: normalized || "unknown",
    specificId: normalized || "unknown",
    label: stripped || rawName.trim(),
  };
}

export function foodNamesMatch(
  a: string,
  b: string,
  mode: FoodMatchMode,
): boolean {
  const idA = resolveFoodIdentity(a);
  const idB = resolveFoodIdentity(b);

  switch (mode) {
    case "canonical":
      return (
        idA.canonicalId !== "unknown" &&
        idA.canonicalId === idB.canonicalId
      );
    case "specific":
      return (
        idA.specificId !== "unknown" && idA.specificId === idB.specificId
      );
    case "protein_class":
      return (
        idA.proteinClass !== null &&
        idA.proteinClass === idB.proteinClass
      );
    default:
      return false;
  }
}

/** Proteins detected in a meal title — for weekly planning (granular vs class). */
export function detectProteinsInText(
  text: string,
  granular: boolean,
): string[] {
  const lower = text.toLowerCase();

  if (!granular) {
    const classes = new Set<string>();
    for (const signature of FOOD_SIGNATURES) {
      if (!signature.proteinClass) continue;
      if (!signature.patterns.some((pattern) => pattern.test(lower))) continue;
      classes.add(signature.proteinClass);
    }
    return [...classes];
  }

  // Granular: signatures are most-specific-first. Keep the first hit per animal
  // so "chicken breasts" → chicken-breasts only (not also generic "chicken").
  const byClass = new Map<string, string>();
  for (const signature of FOOD_SIGNATURES) {
    if (!signature.proteinClass) continue;
    if (!signature.patterns.some((pattern) => pattern.test(lower))) continue;
    if (byClass.has(signature.proteinClass)) continue;
    byClass.set(signature.proteinClass, signature.specificId);
  }
  return [...byClass.values()];
}
