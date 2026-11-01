import { groceryMatchKey } from "@/lib/grocery/calculate";
import { normalizeIngredientName } from "@/lib/kitchen/normalize";

/** Strip catalog-style variant suffixes accidentally added to grocery lines. */
export function cleanGroceryItemName(name: string): string {
  let cleaned = name.trim();
  const variantSegment =
    /\s*[—–-]\s*(?:organic|store brand|generic|artisanal(?:\/organic)?|premium(?:\/organic)?|sale(?:\/[^—–-]+)?|discount(?:\/[^—–-]+)?|large pack|family pack|value pack|party pack|air-?chilled|grass-?fed)\s*(?=[—–-]|$)/gi;

  for (let i = 0; i < 4; i++) {
    const next = cleaned.replace(variantSegment, "").trim();
    if (next === cleaned) break;
    cleaned = next;
  }

  return cleaned
    .replace(/\s*[—–]\s*/g, " — ")
    .replace(/\s+/g, " ")
    .replace(/( — )+/g, " — ")
    .trim();
}

export function baseNormalizedGroceryName(name: string): string {
  const cleaned = cleanGroceryItemName(name)
    .replace(/\s+[—–]\s+.+$/, "")
    .trim();
  return groceryMatchKey(cleaned || name);
}

/** Find a grocery line by the name the household said or the row label. */
export function findGroceryItemByName<
  T extends { name: string; normalizedName: string },
>(items: T[], name: string): T | undefined {
  const query = name.trim();
  if (!query) return undefined;
  const spaced = normalizeIngredientName(query);
  const canonical = baseNormalizedGroceryName(query);
  return items.find(
    (item) =>
      item.normalizedName === canonical ||
      item.normalizedName === spaced ||
      normalizeIngredientName(item.name) === spaced ||
      baseNormalizedGroceryName(item.name) === canonical,
  );
}

/** True when a line looks like a catalog alternative, not a real shopping need. */
export function isGroceryVariantLine(name: string): boolean {
  return /[—–-]\s*(organic|store brand|sale\/|artisanal|premium\/|discount\/|large pack|family pack|party pack|air-?chilled|grass-?fed)/i.test(
    name,
  );
}
