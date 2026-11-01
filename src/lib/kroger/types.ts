export type KrogerLocation = {
  locationId: string;
  name: string;
  chain: string;
  address?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
};

export type KrogerProduct = {
  productId: string;
  upc: string;
  description: string;
  brand?: string;
  images?: Array<{
    perspective?: string;
    sizes?: Array<{
      size?: string;
      url?: string;
    }>;
  }>;
  items?: Array<{
    price?: {
      regular?: number;
      promo?: number;
    };
    size?: string;
    soldBy?: string;
  }>;
};

export type KrogerTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};
