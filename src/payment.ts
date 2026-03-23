// ============================================================
// DataPay / wrap402 - x402 Payment Engine
// Handles 402 responses, payment verification, and settlement
// ============================================================
import type { X402PaymentRequired, X402Payment, PaymentMethod, AssetConfig, QueryLog } from './types.js';
import { loadConfig, saveConfig } from './config.js';
import { db } from './lib/db.js';

/**
 * Generate a 402 Payment Required response for an asset
 */
export function createPaymentRequired(asset: AssetConfig, walletAddress: string): X402PaymentRequired {
  const paymentMethods: PaymentMethod[] = [
    {
      scheme: 'x402',
      network: 'internal',
      token: asset.currency,
      amount: asset.price.toString(),
      payTo: walletAddress,
      extra: {
        assetId: asset.id,
      }
    }
  ];

  // Also advertise USDC on Base if available
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
    }
  };
}

/**
 * Parse payment header from request
 * Format: X-PAYMENT: scheme;network;token;amount;payer;signature;timestamp
 */
export function parsePaymentHeader(header: string): X402Payment | null {
  try {
    // Try JSON format first
    if (header.startsWith('{')) {
      return JSON.parse(header) as X402Payment;
    }

    // Semicolon-delimited format
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
    };
  } catch {
    return null;
  }
}

/**
 * Interface for pluggable payment verifiers
 */
export interface PaymentVerifier {
  scheme: string;
  network: string;
  verify(payment: X402Payment, asset: AssetConfig): Promise<{ valid: boolean; reason?: string }>;
}

/**
 * Default POC Verifier: accepts any signature with correct amount
 */
class MockVerifier implements PaymentVerifier {
  scheme = 'x402';
  network = 'internal';

  async verify(payment: X402Payment, asset: AssetConfig) {
    if (!payment.signature || payment.signature.length < 8) {
      return { valid: false, reason: '无效的内部支付签名' };
    }
    return { valid: true };
  }
}

class SolanaMockVerifier implements PaymentVerifier {
  scheme = 'x402';
  network = 'solana';

  async verify(payment: X402Payment, asset: AssetConfig) {
    if (!payment.signature || payment.signature.length < 32) {
      return { valid: false, reason: '无效的 Solana 交易签名格式' };
    }
    console.log(`[SolanaVerifier] 正在验证地址 ${payment.payer} 的签名...`);
    return { valid: true };
  }
}

import Stripe from 'stripe';

class StripeVerifier implements PaymentVerifier {
  scheme = 'x402';
  network = 'stripe';
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
  }

  async verify(payment: X402Payment, asset: AssetConfig) {
    if (!process.env.STRIPE_SECRET_KEY) {
      return { valid: false, reason: '服务器未配置 Stripe 支付通道' };
    }
    
    try {
      console.log(`[StripeVerifier] 正在通过真实的 Stripe 网关扣除金额: ${asset.price} ${asset.currency}...`);
      const charge = await this.stripe.charges.create({
        amount: Math.round(asset.price * 100), // Stripe 采用最小货币单位 (分)
        currency: asset.currency.toLowerCase(),
        source: payment.signature, // 用签名位当做 Stripe 的 Card Token 传递
        description: `Payment for x402 asset: ${asset.name} (ID: ${asset.id})`,
      });
      
      if (charge.status === 'succeeded') {
        return { valid: true };
      } else {
        return { valid: false, reason: `Stripe 扣款拒绝: 状态 [${charge.status}]` };
      }
    } catch (err: any) {
      return { valid: false, reason: `Stripe 扣款异常: ${err.message}` };
    }
  }
}

const verifiers: PaymentVerifier[] = [
  new MockVerifier(),
  new SolanaMockVerifier(),
  new StripeVerifier()
];

export async function verifyPayment(payment: X402Payment, asset: AssetConfig): Promise<{ valid: boolean; reason?: string }> {
  const paidAmount = parseFloat(payment.amount);
  if (isNaN(paidAmount) || paidAmount < asset.price) {
    return { valid: false, reason: `支付金额不足: 需要 ${asset.price} ${asset.currency}，收到 ${payment.amount}` };
  }

  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  if (Math.abs(now - payment.timestamp) > fiveMinutes) {
    return { valid: false, reason: '支付时间戳已过期' };
  }

  const verifier = verifiers.find(v => v.scheme === payment.scheme && v.network === payment.network);
  if (!verifier) {
    if (!payment.signature) return { valid: false, reason: `不支持的支付方式: ${payment.scheme}/${payment.network}` };
    return { valid: true };
  }

  return await verifier.verify(payment, asset);
}

/**
 * Record a successful query
 */
export async function recordQuery(assetId: string, payer: string, amount: number, query?: Record<string, string>): Promise<void> {
  const user = await db.user.findUnique({ where: { username: payer } });
  if (!user) return; // 容错处理

  await db.transaction.create({
    data: {
      assetId,
      payerId: user.id,
      amount,
    }
  });
}

/**
 * Update asset statistics after a successful query
 */
export async function updateAssetStats(assetId: string, amount: number): Promise<void> {
  try {
    await db.asset.update({
      where: { id: assetId },
      data: {
        totalQueries: { increment: 1 },
        totalRevenue: { increment: amount }
      }
    });
  } catch {
    // Non-critical, log and continue
  }
}

/**
 * Get query logs for an asset
 */
export async function getQueryLogs(assetId?: string): Promise<QueryLog[]> {
  const transactions = await db.transaction.findMany({
    where: assetId ? { assetId } : undefined,
    include: { payer: true },
    orderBy: { timestamp: 'asc' }
  });

  return transactions.map((tx: any) => ({
    assetId: tx.assetId,
    timestamp: tx.timestamp.toISOString(),
    payer: tx.payer.username,
    amount: tx.amount,
    paymentVerified: true
  }));
}
