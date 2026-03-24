// ============================================================
// DataPay / wrap402 - Core Type Definitions
// ============================================================

/** Configuration for the wrap402 project */
export interface Wrap402Config {
  /** Project name */
  projectName: string;
  /** Server port */
  port: number;
  /** Wallet address for receiving payments */
  walletAddress: string;
  /** Default currency */
  currency: string;
  /** Registered assets */
  assets: AssetConfig[];
}

/** Configuration for a single published asset */
export interface AssetConfig {
  /** Unique asset ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description for AI Agent discovery */
  description: string;
  /** Source file path or URL */
  source: string;
  /** Source type */
  sourceType: 'json' | 'csv' | 'api' | 'scraper';
  /** Price per query */
  price: number;
  /** Currency (e.g., "CNY", "USDC") */
  currency: string;
  /** Asset category tags */
  tags: string[];
  /** Published timestamp */
  publishedAt: string;
  /** Total queries served */
  totalQueries: number;
  /** Total revenue earned */
  totalRevenue: number;
}

/** x402 Payment Required response payload */
export interface X402PaymentRequired {
  /** x402 protocol version */
  x402Version: string;
  /** Accepted payment methods */
  accepts: PaymentMethod[];
  /** Human-readable description */
  description: string;
  /** Asset metadata */
  asset: {
    id: string;
    name: string;
    description: string;
  };
}

/** Payment method specification */
export interface PaymentMethod {
  /** Payment scheme identifier */
  scheme: string;
  /** Network (e.g., "base", "ethereum", "internal") */
  network: string;
  /** Token (e.g., "USDC", "CNY-credits") */
  token: string;
  /** Price amount */
  amount: string;
  /** Recipient address or account */
  payTo: string;
  /** Additional metadata */
  extra?: Record<string, string>;
}

/** Payment header from client */
export interface X402Payment {
  /** Payment scheme used */
  scheme: string;
  /** Network */
  network: string;
  /** Token */
  token: string;
  /** Amount paid */
  amount: string;
  /** Payer identifier */
  payer: string;
  /** Payment signature or transaction hash */
  signature: string;
  /** Timestamp */
  timestamp: number;
}

/** Query log entry */
export interface QueryLog {
  /** Asset queried */
  assetId: string;
  /** Timestamp */
  timestamp: string;
  /** Payer ID */
  payer: string;
  /** Amount paid */
  amount: number;
  /** Query parameters */
  query?: Record<string, string>;
  /** Whether payment was verified */
  paymentVerified: boolean;
}

/** Asset runtime state */
export interface AssetRuntime {
  config: AssetConfig;
  data: any[];
  schema: Record<string, string>;
}

/** Server status info */
export interface ServerStatus {
  running: boolean;
  port: number;
  assets: {
    id: string;
    name: string;
    price: number;
    currency: string;
    totalQueries: number;
    totalRevenue: number;
  }[];
  totalQueries: number;
  totalRevenue: number;
  uptime: number;
}
