// ============================================================
// DataPay / Nexus402 — 核心类型定义
// ============================================================

/** 项目配置 */
export interface Wrap402Config {
  projectName: string;
  port: number;
  walletAddress: string;
  currency: string;
  assets: AssetConfig[];
}

/** 单个数据资产的配置 */
export interface AssetConfig {
  id: string;
  name: string;
  description: string;
  source: string;
  sourceType: 'json' | 'csv' | 'api' | 'scraper';
  price: number;
  currency: string;
  tags: string[];
  publishedAt: string;
  totalQueries: number;
  totalRevenue: number;
  providerRevenue?: number;
}

/** x402 Payment Required 响应体 */
export interface X402PaymentRequired {
  x402Version: string;
  accepts: PaymentMethod[];
  description: string;
  asset: {
    id: string;
    name: string;
    description: string;
  };
}

/** 支付方式 */
export interface PaymentMethod {
  scheme: string;
  network: string;
  token: string;
  amount: string;
  payTo: string;
  extra?: Record<string, string>;
}

/** 客户端提交的支付信息（来自 X-PAYMENT header）*/
export interface X402Payment {
  scheme: string;
  network: string;
  token: string;
  amount: string;
  payer: string;      // 用户 ID（已登录用户的数据库 ID）
  signature: string;  // HMAC Token / Stripe PI ID / Solana tx hash
  timestamp: number;
  assetId?: string;   // 可选：内部 HMAC 验证时需要
}

/** 查询日志条目 */
export interface QueryLog {
  assetId: string;
  timestamp: string;
  payer: string;
  amount: number;
  query?: Record<string, string>;
  paymentVerified: boolean;
}

/** 资产运行时状态（内存缓存） */
export interface AssetRuntime {
  config: AssetConfig;
  data: any[];
  schema: Record<string, string>;
}

/** 服务状态 */
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
