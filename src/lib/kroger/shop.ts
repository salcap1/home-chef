import {
  addItemsToCart,
  normalizeKrogerProduct,
  searchProducts,
} from "@/lib/kroger/client";
import { getValidKrogerAccessToken } from "@/lib/kroger/connection";
import {
  buildProductSearchVariants,
  computeCartUnits,
  parseGroceryAmount,
  parsePackageSize,
  scoreProductMatch,
} from "@/lib/kroger/match";
import {
  getProductPreference,
  saveProductPreference,
} from "@/lib/kroger/preferences";

export type ShopProductCandidate = {
  upc: string;
  description: string;
  brand: string | null;
  packageSize: string | null;
  priceLabel: string | null;
  onSale: boolean;
  regularPrice: number | null;
  promoPrice: number | null;
  imageUrl: string | null;
  suggestedQuantity: number;
  relevance: number;
};

/** Search Harris Teeter catalog for a grocery line; soft-sort only — never auto-picks. */
export async function searchHarrisTeeterCandidates(input: {
  householdId: string;
  itemName: string;
  quantityText?: string | null;
  locationId: string;
  limit?: number;
}): Promise<ShopProductCandidate[]> {
  const preference = await getProductPreference(
    input.householdId,
    input.itemName,
  );
  const requestedAmount = parseGroceryAmount(input.quantityText ?? null);
  const searchTerms = buildProductSearchVariants(input.itemName);
  const seenUpcs = new Set<string>();
  const candidates: ShopProductCandidate[] = [];
  const perTermLimit = input.limit ?? 10;

  for (const term of searchTerms) {
    if (candidates.length >= perTermLimit * 2) break;

    const products = await searchProducts({
      term,
      locationId: input.locationId,
      limit: perTermLimit,
    });

    for (const product of products) {
      const normalized = normalizeKrogerProduct(product);
      if (seenUpcs.has(normalized.upc)) continue;
      seenUpcs.add(normalized.upc);

      const relevance = scoreProductMatch({
        searchTerm: term,
        description: normalized.description,
        brand: product.brand,
        upc: normalized.upc,
        onSale: normalized.onSale,
        regularPrice: normalized.regularPrice,
        promoPrice: normalized.promoPrice,
        preferredBrand: preference?.preferredBrand,
        preferredUpc: preference?.preferredUpc,
        brandLocked: preference?.brandLocked,
        timesPurchased: preference?.timesChosen,
      });

      candidates.push({
        upc: normalized.upc,
        description: normalized.description,
        brand: product.brand ?? null,
        packageSize: normalized.packageSize,
        priceLabel: normalized.priceLabel,
        onSale: normalized.onSale,
        regularPrice: normalized.regularPrice,
        promoPrice: normalized.promoPrice,
        imageUrl: normalized.imageUrl,
        suggestedQuantity: computeCartUnits(
          requestedAmount,
          parsePackageSize(normalized.packageSize),
        ),
        relevance,
      });
    }
  }

  return candidates.sort((a, b) => {
    if (b.relevance !== a.relevance) return b.relevance - a.relevance;
    const priceA = a.promoPrice ?? a.regularPrice ?? Infinity;
    const priceB = b.promoPrice ?? b.regularPrice ?? Infinity;
    return priceA - priceB;
  });
}

export async function addHarrisTeeterProductToCart(input: {
  householdId: string;
  groceryName: string;
  quantityText: string | null;
  upc: string;
  packageSize?: string | null;
  description?: string | null;
  brand?: string | null;
  quantity?: number;
}): Promise<{
  quantity: number;
  description: string;
  upc: string;
  locationName: string;
}> {
  const auth = await getValidKrogerAccessToken(input.householdId);
  if (!auth) {
    throw new Error(
      "Harris Teeter account not linked. Link from the Groceries page.",
    );
  }

  const quantity =
    input.quantity ??
    computeCartUnits(
      parseGroceryAmount(input.quantityText),
      parsePackageSize(input.packageSize),
    );

  await addItemsToCart({
    accessToken: auth.accessToken,
    items: [{ upc: input.upc, quantity }],
    modality: "PICKUP",
  });

  const description =
    input.description?.trim() ||
    input.brand?.trim() ||
    `UPC ${input.upc}`;

  await saveProductPreference({
    householdId: input.householdId,
    groceryName: input.groceryName,
    preferredUpc: input.upc,
    preferredBrand: input.brand,
    productDescription: description,
    source: "user_pick",
  });

  return {
    quantity,
    description,
    upc: input.upc,
    locationName: auth.locationName ?? "Harris Teeter",
  };
}
