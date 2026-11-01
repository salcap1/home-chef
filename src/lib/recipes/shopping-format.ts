import {
  isNonShoppableGroceryName,
  shoppingNeedFromParts,
  simplifyQuantityText,
  stripCulinaryPrep,
} from "@/lib/grocery/calculate";

export type NamedQuantity = {
  name: string;
  quantityText: string;
};

/**
 * Normalize a generated ingredient so recipe storage matches grocery parsing.
 * Water / leftover-from-meal items stay in cook steps but are omitted from the shopping list.
 */
export function tidyRecipeIngredient(item: NamedQuantity): NamedQuantity {
  const need = shoppingNeedFromParts(item.name, item.quantityText);
  if (need) {
    return {
      name: need.name,
      quantityText: need.quantityText ?? item.quantityText.trim(),
    };
  }
  return {
    name: stripCulinaryPrep(item.name) || item.name.trim(),
    quantityText: simplifyQuantityText(item.quantityText) ?? item.quantityText.trim(),
  };
}

export function toIngredientsText(items: NamedQuantity[]): string {
  return items
    .filter((item) => item.name.trim() && !isNonShoppableGroceryName(item.name))
    .map((item) => {
      const tidied = tidyRecipeIngredient(item);
      return tidied.quantityText
        ? `${tidied.name} — ${tidied.quantityText}`
        : tidied.name;
    })
    .join("\n");
}
