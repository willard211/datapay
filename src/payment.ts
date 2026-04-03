// ============================================================
// Nexus402 / Nexus402 — x402 支付引擎
// 负责 402 响应构造、支付验证、交易记录与资产统计更新
// ============================================================
import type { X402PaymentRequired, X402Payment, PaymentMethod, AssetConfig, QueryLog } from './types.js';
import { loadConfig } from './config.js';
import { db } from './lib/db.js';
import { createHmac, timingSafeEqual } from 'crypto';
import Stripe from 'stripe';

// ── 常量配置 ─────────────────────────────────────────────────
// NOTE: 平台抽佣比例从环境变量读取，默认 15%
export const PLATFORM_COMMISSION_RATE = parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.15');

// ── HMAC 内部网关 Token ───────────────────────────────────────

/**
 * 为网关内部调用生成一次性 HMAC 支付 Token
 * NOTE: 使用 HMAC-SHA256 对 assetId + amount + timestamp 签名
 *       服务端验证时重新计算并用 timingSafeEqual 比较，防止时序攻击
 */
export function generateGatewayToken(assetId: string, amount: number, timestamp: number): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('[Fatal] JWT_SECRET 未配置，无法签发 Gateway Token');

  const payload = `${assetId}:${amount}:${timestamp}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * 验证网关内部 HMAC Token
 */
function verifyGatewayToken(
  signature: string,
  assetId: string,
  amount: number,
  timestamp: number
): boolean {
  const expected = generateGatewayToken(assetId, amount, timestamp);
  try {
    // NOTE: timingSafeEqual 防止时序攻击，不能用 ===
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

// ── SSRF 防护 ─────────────────────────────────────────────────

/**
 * 检测 URL 是否指向内网地址（SSRF 防护）
 * NOTE: 阻断对 AWS metadata、内网段、localhost 的请求
 */
export function isSsrfRisk(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // 拒绝非 HTTP(S) 协议
    if (!['http:', 'https:'].includes(parsed.protocol)) return true;

    // 拒绝 localhost 和本地回环
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;

    // 拒绝内网 IP 段
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./, // AWS/Azure Instance Metadata Service
      /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // CGNAT
      /^fd/, // IPv6 ULA
    ];
    if (privateRanges.some((r) => r.test(hostname))) return true;

    // 拒绝云服务商 IMDS 域名
    const blockedDomains = [
      'metadata.google.internal',
      'metadata.azure.com',
      '169.254.169.254',
    ];
    if (blockedDomains.includes(hostname)) return true;

    return false;
  } catch {
    return true; // 无法解析的 URL 默认拒绝
  }
}

// ── 402 响应构造 ──────────────────────────────────────────────

/**
 * 构造标准 x402 Payment Required 响应体
 */
export function createPaymentRequired(asset: AssetConfig, walletAddress: string): X402PaymentRequired {
  const paymentMethods: PaymentMethod[] = [
    {
      scheme: 'x402',
      network: 'internal',
      token: asset.currency,
      amount: asset.price.toString(),
      payTo: walletAddress,
      extra: { assetId: asset.id },
    },
  ];

  // 仅在配置了以太坊地址时才广告链上支付
  if (walletAddress.startsWith('0x')) {
    paymentMethods.push({
      scheme: 'x402',
      network: 'base',
      token: 'USDC',
      amount: asset.price.toString(),
      payTo: walletAddress,
    });
  }

  return {
    x402Version: '1.0',
    accepts: paymentMethods,
    description: `访问此数据需要支付 ${asset.price} ${asset.currency}/次`,
    asset: {
      id: asset.id,
      name: asset.name,
      description: asset.description,
    },
  };
}

// ── 支付头解析 ────────────────────────────────────────────────

/**
 * 解析请求中的 X-PAYMENT header
 * 支持 JSON 格式和分号分隔的简洁格式
 * Format: x402;network;token;amount;payer;signature;timestamp[;assetId]
 */
export function parsePaymentHeader(header: string): X402Payment | null {
  try {
    if (header.startsWith('{')) {
      return JSON.parse(header) as X402Payment;
    }

    const parts = header.split(';');
    if (parts.length < 7) return null;

    return {
      scheme: parts[0],
      network: parts[1],
      token: parts[2],
      amount: parts[3],
      payer: parts[4],
      signature: parts[5],
      timestamp: parseInt(parts[6]),
      assetId: parts[7] || undefined,
    };
  } catch {
    return null;
  }
}

// ── 支付验证器 ────────────────────────────────────────────────

export interface PaymentVerifier {
  scheme: string;
  network: string;
  verify(payment: X402Payment, asset: AssetConfig): Promise<{ valid: boolean; reason?: string }>;
}

/**
 * 内部网关验证器（HMAC 签名）
 * NOTE: 替换原来的 MockVerifier，使用真实的 HMAC-SHA256 验证
 *       只有由 /api/v1/agent/ask 网关侧签发的 Token 才能通过
 */
class InternalHmacVerifier implements PaymentVerifier {
  scheme = 'x402';
  network = 'internal';

  async verify(payment: X402Payment, asset: AssetConfig) {
    if (!payment.signature || payment.signature.length !== 64) {
      return { valid: false, reason: '无效的内部 HMAC 签名格式（应为 64 位 hex）' };
    }

    const assetId = payment.assetId || asset.id;
    const amount = parseFloat(payment.amount);

    const isValid = verifyGatewayToken(payment.signature, assetId, amount, payment.timestamp);
    if (!isValid) {
      return { valid: false, reason: 'HMAC 签名验证失败，Token 伪造或已过期' };
    }

    return { valid: true };
  }
}

/**
 * Stripe 支付验证器
 * NOTE: 通过 PaymentIntent ID 查询 Stripe 确认状态
 *       signature 字段传入 PaymentIntent ID（如 pi_xxx）
 */
class StripeVerifier implements PaymentVerifier {
  scheme = 'x402';
  network = 'stripe';
  private stripe: Stripe;

  constructor() {
    // NOTE: 初始化时不强制要求 STRIPE_SECRET_KEY 存在，允许非 Stripe 模式启动
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
  }

  async verify(payment: X402Payment, asset: AssetConfig) {
    if (!process.env.STRIPE_SECRET_KEY) {
      return { valid: false, reason: '服务器未配置 Stripe 支付通道（缺少 STRIPE_SECRET_KEY）' };
    }

    if (!payment.signature || !payment.signature.startsWith('pi_')) {
      return { valid: false, reason: '无效的 Stripe PaymentIntent ID（应以 pi_ 开头）' };
    }

    try {
      const intent = await this.stripe.paymentIntents.retrieve(payment.signature);

      if (intent.status !== 'succeeded') {
        return { valid: false, reason: `Stripe PaymentIntent 状态不是 succeeded: ${intent.status}` };
      }

      // 验证金额是否匹配（Stripe 单位为分）
      const expectedAmountCents = Math.round(asset.price * 100);
      if (intent.amount < expectedAmountCents) {
        return {
          valid: false,
          reason: `Stripe 支付金额不足: 需要 ${expectedAmountCents} 分，实际 ${intent.amount} 分`,
        };
      }

      return { valid: true };
    } catch (err: any) {
      return { valid: false, reason: `Stripe 查询异常: ${err.message}` };
    }
  }
}

/**
 * Solana 验证器（占位，接入真实链上验签需要 @solana/web3.js）
 * FIXME: Phase 3 接入真实 Solana RPC 验签
 */
class SolanaVerifier implements PaymentVerifier {
  scheme = 'x402';
  network = 'solana';

  async verify(payment: X402Payment, _asset: AssetConfig) {
    // Solana 链上签名为 base58 编码，长度约 87-88 字符
    if (!payment.signature || payment.signature.length < 60) {
      return { valid: false, reason: '无效的 Solana 交易签名格式' };
    }
    // TODO: 接入 Solana RPC 验证 transaction 真实性
    console.warn(`[SolanaVerifier] ⚠️ 当前为占位验证，尚未接入链上 RPC`);
    return { valid: false, reason: 'Solana 支付通道尚未开放，敬请期待' };
  }
}

const verifiers: PaymentVerifier[] = [
  new InternalHmacVerifier(),
  new StripeVerifier(),
  new SolanaVerifier(),
];

/**
 * 统一支付验证入口
 */
export async function verifyPayment(
  payment: X402Payment,
  asset: AssetConfig
): Promise<{ valid: boolean; reason?: string }> {
  // 1. 金额检查
  const paidAmount = parseFloat(payment.amount);
  if (isNaN(paidAmount) || paidAmount < asset.price) {
    return {
      valid: false,
      reason: `支付金额不足: 需要 ${asset.price} ${asset.currency}，收到 ${payment.amount}`,
    };
  }

  // 2. 时间戳检查（5 分钟窗口）
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  if (Math.abs(now - payment.timestamp) > fiveMinutes) {
    return { valid: false, reason: '支付时间戳已过期（超过 5 分钟）' };
  }

  // 3. 路由到对应验证器
  const verifier = verifiers.find((v) => v.scheme === payment.scheme && v.network === payment.network);
  if (!verifier) {
    return { valid: false, reason: `不支持的支付方式: ${payment.scheme}/${payment.network}` };
  }

  return await verifier.verify(payment, asset);
}

// ── 交易记录 ──────────────────────────────────────────────────

/**
 * 记录一次成功的数据查询交易
 * NOTE: 同时计算平台抽佣和提供方收益
 */
export async function recordQuery(
  assetId: string,
  payerUserId: string,
  amount: number,
  network: string = 'internal'
): Promise<void> {
  const platformFee = parseFloat((amount * PLATFORM_COMMISSION_RATE).toFixed(6));

  await db.transaction.create({
    data: {
      assetId,
      payerId: payerUserId,
      amount,
      platformFee,
      network,
    },
  });
}

/**
 * 更新资产统计数据，同时更新提供方收益
 * NOTE: providerRevenue = totalRevenue * (1 - commissionRate)
 */
export async function updateAssetStats(assetId: string, amount: number): Promise<void> {
  try {
    const providerEarning = parseFloat((amount * (1 - PLATFORM_COMMISSION_RATE)).toFixed(6));
    await db.asset.update({
      where: { id: assetId },
      data: {
        totalQueries: { increment: 1 },
        totalRevenue: { increment: amount },
        providerRevenue: { increment: providerEarning },
      },
    });
  } catch {
    // 统计失败不影响主流程，但需要记录日志
    console.error(`[Stats] 资产 ${assetId} 统计更新失败`);
  }
}

/**
 * 获取查询日志（用于 Analytics）
 */
export async function getQueryLogs(assetId?: string): Promise<QueryLog[]> {
  const transactions = await db.transaction.findMany({
    where: assetId ? { assetId } : undefined,
    include: { payer: { select: { username: true } } },
    orderBy: { timestamp: 'asc' },
  });

  return transactions.map((tx: any) => ({
    assetId: tx.assetId,
    timestamp: tx.timestamp.toISOString(),
    payer: tx.payer.username,
    amount: tx.amount,
    paymentVerified: true,
  }));
}
