// ============================================================
// DataPay / wrap402 - x402 Payment Engine
// Handles 402 responses, payment verification, and settlement
// ============================================================
import type { X402PaymentRequired, X402Payment, PaymentMethod, AssetConfig, QueryLog } from './types.js';
import { loadConfig, saveConfig } from './config.js';
import { appendFileSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const QUERY_LOG_FILE = '.wrap402-queries.jsonl';

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
 * Verify payment for an asset
 * In POC mode: accept any well-formed payment with correct amount
 * In production: verify on-chain signature / check balance
 */
export function verifyPayment(payment: X402Payment, asset: AssetConfig): { valid: boolean; reason?: string } {
  // Check amount
  const paidAmount = parseFloat(payment.amount);
  if (isNaN(paidAmount) || paidAmount < asset.price) {
    return { valid: false, reason: `支付金额不足: 需要 ${asset.price} ${asset.currency}，收到 ${payment.amount}` };
  }

  // Check timestamp (within 5 minutes)
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  if (Math.abs(now - payment.timestamp) > fiveMinutes) {
    return { valid: false, reason: '支付时间戳已过期（超过5分钟）' };
  }

  // Check signature is present
  if (!payment.signature || payment.signature.length < 8) {
    return { valid: false, reason: '无效的支付签名' };
  }

  // POC: accept payment
  return { valid: true };
}

/**
 * Record a successful query
 */
export function recordQuery(assetId: string, payer: string, amount: number, query?: Record<string, string>): void {
  const log: QueryLog = {
    assetId,
    timestamp: new Date().toISOString(),
    payer,
    amount,
    query,
    paymentVerified: true,
  };

  const logPath = resolve(process.cwd(), QUERY_LOG_FILE);
  appendFileSync(logPath, JSON.stringify(log) + '\n', 'utf-8');
}

/**
 * Update asset statistics after a successful query
 */
export function updateAssetStats(assetId: string, amount: number): void {
  try {
    const config = loadConfig();
    const asset = config.assets.find(a => a.id === assetId);
    if (asset) {
      asset.totalQueries += 1;
      asset.totalRevenue += amount;
      saveConfig(config);
    }
  } catch {
    // Non-critical, log and continue
  }
}

/**
 * Get query logs for an asset
 */
export function getQueryLogs(assetId?: string): QueryLog[] {
  const logPath = resolve(process.cwd(), QUERY_LOG_FILE);
  if (!existsSync(logPath)) return [];

  const lines = readFileSync(logPath, 'utf-8').trim().split('\n').filter(Boolean);
  const logs = lines.map(line => JSON.parse(line) as QueryLog);

  if (assetId) {
    return logs.filter(log => log.assetId === assetId);
  }
  return logs;
}
