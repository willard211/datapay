export interface Asset {
  id: string;
  name: string;
  price: number;
  currency: string;
  description: string;
  endpoint: string;
}

export interface DiscoveryResponse {
  totalAssets: number;
  assets: Asset[];
}

export interface PaymentRequirement {
  x402Version: string;
  description: string;
  accepts: {
    scheme: string;
    network: string;
    token: string;
    amount: string;
    payTo: string;
  }[];
}

export interface PaymentHeader {
  scheme: string;
  network: string;
  token: string;
  amount: string;
  payer: string;
  signature: string;
  timestamp: number;
}
