import {
  getKrogerClientCredentials,
  KROGER_API_BASE,
  KROGER_OAUTH_SCOPES,
  getKrogerRedirectUri,
} from "@/lib/kroger/config";
import type {
  KrogerLocation,
  KrogerProduct,
  KrogerTokenResponse,
} from "@/lib/kroger/types";

function basicAuthHeader(): string {
  const { clientId, clientSecret } = getKrogerClientCredentials();
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function parseJson<T>(response: Response): Promise<T | null> {
  // Kroger cart/add returns 204 No Content on success — empty body is OK.
  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  let payload: T & {
    errors?: Array<{ code?: string; reason?: string }> | { reason?: string };
    error?: string;
    error_description?: string;
  };

  try {
    payload = text ? (JSON.parse(text) as typeof payload) : ({} as typeof payload);
  } catch {
    throw new Error(
      `Kroger API ${response.status}: invalid JSON (${text.slice(0, 120)})`,
    );
  }

  if (!response.ok) {
    const errors = payload.errors;
    const reason =
      (Array.isArray(errors) ? errors[0]?.reason : errors?.reason) ??
      payload.error_description ??
      payload.error ??
      response.statusText;
    throw new Error(`Kroger API ${response.status}: ${reason}`);
  }

  return payload;
}

export async function getClientCredentialsToken(): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "product.compact",
  });

  const response = await fetch(`${KROGER_API_BASE}/connect/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body,
  });

  const token = await parseJson<KrogerTokenResponse>(response);
  if (!token?.access_token) {
    throw new Error("Kroger API: missing access token");
  }
  return token.access_token;
}

export function buildAuthorizationUrl(state: string): string {
  const { clientId } = getKrogerClientCredentials();
  const params = new URLSearchParams({
    scope: KROGER_OAUTH_SCOPES,
    response_type: "code",
    client_id: clientId,
    redirect_uri: getKrogerRedirectUri(),
    state,
  });
  return `${KROGER_API_BASE}/connect/oauth2/authorize?${params.toString()}`;
}

export async function exchangeAuthorizationCode(
  code: string,
): Promise<KrogerTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getKrogerRedirectUri(),
  });

  const response = await fetch(`${KROGER_API_BASE}/connect/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body,
  });

  const token = await parseJson<KrogerTokenResponse>(response);
  if (!token?.access_token) {
    throw new Error("Kroger API: missing access token from authorization code");
  }
  return token;
}

export async function refreshUserAccessToken(
  refreshToken: string,
): Promise<KrogerTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(`${KROGER_API_BASE}/connect/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body,
  });

  const token = await parseJson<KrogerTokenResponse>(response);
  if (!token?.access_token) {
    throw new Error("Kroger API: missing access token from refresh");
  }
  return token;
}

export async function searchLocations(input: {
  zipCode: string;
  radiusInMiles?: number;
  limit?: number;
}): Promise<KrogerLocation[]> {
  const token = await getClientCredentialsToken();
  const params = new URLSearchParams({
    "filter.zipCode.near": input.zipCode,
    "filter.radiusInMiles": String(input.radiusInMiles ?? 25),
    "filter.limit": String(input.limit ?? 50),
  });

  const response = await fetch(`${KROGER_API_BASE}/locations?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const payload = await parseJson<{ data: KrogerLocation[] }>(response);
  return payload?.data ?? [];
}

export async function searchProducts(input: {
  term: string;
  locationId: string;
  limit?: number;
}): Promise<KrogerProduct[]> {
  const token = await getClientCredentialsToken();
  const params = new URLSearchParams({
    "filter.term": input.term,
    "filter.locationId": input.locationId,
    "filter.limit": String(input.limit ?? 5),
  });

  const response = await fetch(`${KROGER_API_BASE}/products?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const payload = await parseJson<{ data: KrogerProduct[] }>(response);
  return payload?.data ?? [];
}

export async function addItemsToCart(input: {
  accessToken: string;
  items: Array<{ upc: string; quantity: number }>;
  modality?: "PICKUP" | "DELIVERY";
}): Promise<void> {
  const modality = input.modality ?? "PICKUP";
  const response = await fetch(`${KROGER_API_BASE}/cart/add`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: input.items.map((item) => ({
        upc: item.upc,
        quantity: item.quantity,
        modality,
      })),
    }),
  });

  await parseJson<{ data?: unknown }>(response);
}

export function pickProductImageUrl(product: KrogerProduct): string | null {
  const images = product.images ?? [];
  if (images.length === 0) return null;

  const preferred =
    images.find((image) => image.perspective === "front") ?? images[0];
  const sizes = preferred?.sizes ?? [];
  if (sizes.length === 0) return null;

  const preferredSizes = ["medium", "small", "thumbnail", "large", "xlarge"];
  for (const size of preferredSizes) {
    const match = sizes.find((entry) => entry.size === size && entry.url);
    if (match?.url) return match.url;
  }

  return sizes.find((entry) => entry.url)?.url ?? null;
}

export function normalizeKrogerProduct(product: KrogerProduct): {
  upc: string;
  description: string;
  priceLabel: string | null;
  onSale: boolean;
  regularPrice: number | null;
  promoPrice: number | null;
  brand: string | null;
  packageSize: string | null;
  imageUrl: string | null;
} {
  const upc = product.upc || product.productId;
  const item = product.items?.[0];
  const regular = item?.price?.regular ?? null;
  const promo = item?.price?.promo ?? null;
  const onSale = promo !== null && regular !== null && promo < regular;
  const price = promo ?? regular;
  const packageSize = item?.size ?? null;
  const size = packageSize ? ` (${packageSize})` : "";
  const saleTag = onSale ? " · SALE" : "";
  const priceLabel =
    price !== undefined && price !== null
      ? `$${price.toFixed(2)}${size}${saleTag}`
      : size
        ? `${size}${saleTag}`
        : saleTag || null;

  return {
    upc,
    description: product.description,
    priceLabel,
    onSale,
    regularPrice: regular,
    promoPrice: promo,
    brand: product.brand ?? null,
    packageSize,
    imageUrl: pickProductImageUrl(product),
  };
}
