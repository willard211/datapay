// ============================================================
// DataPay / Nexus402 — Express Server
// 生产就绪版本：安全加固 + 真实支付 + SSRF 防护 + 租户隔离
// ============================================================
import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { loadConfig, saveConfig } from './config.js';
import { loadAssetData } from './asset-loader.js';
import {
  createPaymentRequired,
  parsePaymentHeader,
  verifyPayment,
  recordQuery,
  updateAssetStats,
  getQueryLogs,
  generateGatewayToken,
  isSsrfRisk,
  PLATFORM_COMMISSION_RATE,
} from './payment.js';
import type { AssetConfig, AssetRuntime, ServerStatus } from './types.js';
import { resolve } from 'path';
import { nanoid } from 'nanoid';
import { sendWebhook, WebhookPayload } from './webhooks.js';
import { accountManager, validateEnv, getJwtSecret } from './accounts.js';
import jwt from 'jsonwebtoken';
import { db } from './lib/db.js';

const startTime = Date.now();

// ── Stripe 实例 ───────────────────────────────────────────────
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

// ── Webhook 触发 ──────────────────────────────────────────────
const triggerWebhook = async (userId: string, payload: WebhookPayload) => {
  const account = await accountManager.getAccountById(userId);
  if (account?.webhookUrl) {
    sendWebhook(account.webhookUrl, payload).catch((err) =>
      console.error(`[Webhook Error] ${err.message}`)
    );
  }
};

// ── 鉴权中间件 ────────────────────────────────────────────────

/**
 * JWT / API Key 鉴权中间件
 * NOTE: 验证失败时 next() 不设置 req.account，下游路由按需判断是否强制鉴权
 */
const authenticate = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    // 1. 尝试 JWT 验证
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as any;
      const account = await accountManager.getAccountById(decoded.sub);
      if (account) {
        req.account = account;
        return next();
      }
    } catch {
      // JWT 验证失败，继续尝试 API Key
    }

    // 2. 尝试 API Key 验证
    const account = await accountManager.getAccountByApiKey(token);
    if (account) {
      req.account = account;
      return next();
    }
  }
  // 未鉴权，req.account 为 undefined，下游路由自行决定是否拒绝
  next();
};

/**
 * 强制登录中间件（用于必须鉴权的路由）
 */
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.account) {
    return res.status(401).json({ error: '此接口需要登录，请提供 Authorization: Bearer <token>' });
  }
  next();
};

// ── Server 创建 ───────────────────────────────────────────────

/**
 * 创建并配置 Express 应用
 */
export async function createServer(configDir?: string) {
  // NOTE: 启动前验证所有必要环境变量，早期失败比隐性错误更安全
  validateEnv();

  const app = express();
  app.use(cors());

  // NOTE: Stripe Webhook 需要原始 body，必须在 express.json() 之前注册
  app.use('/api/v1/payment/stripe-webhook', express.raw({ type: 'application/json' }));
  app.use(express.json());

  const config = loadConfig(configDir);
  const runtimes = new Map<string, AssetRuntime>();

  // 从数据库加载所有资产到内存
  const dbAssets = await db.asset.findMany();
  console.log(`📡 [Server] 从数据库加载了 ${dbAssets.length} 个资产`);

  for (const dbAsset of dbAssets) {
    try {
      const assetConfig: AssetConfig = {
        id: dbAsset.id,
        name: dbAsset.name,
        description: dbAsset.description || '',
        source: dbAsset.source,
        sourceType: dbAsset.sourceType as any,
        price: dbAsset.price,
        currency: dbAsset.currency,
        tags: JSON.parse(dbAsset.tags || '[]'),
        totalQueries: dbAsset.totalQueries,
        totalRevenue: dbAsset.totalRevenue,
        providerRevenue: (dbAsset as any).providerRevenue || 0,
        publishedAt: dbAsset.publishedAt.toISOString(),
      };

      if (assetConfig.sourceType === 'api' || assetConfig.sourceType === 'scraper') {
        // NOTE: API/Scraper 类型不预加载数据，每次请求时实时获取
        runtimes.set(assetConfig.id, { config: assetConfig, data: [], schema: {} });
      } else {
        const sourcePath = resolve(configDir || process.cwd(), assetConfig.source);
        const { data, schema } = loadAssetData(sourcePath);
        runtimes.set(assetConfig.id, { config: assetConfig, data, schema });
      }
    } catch (err: any) {
      console.error(`⚠️  加载资产失败 [${dbAsset.name}]: ${err.message}`);
    }
  }

  // ──────────────────────────────────────────────────────────
  // 公开发现端点（无需鉴权）
  // ──────────────────────────────────────────────────────────

  /** AI Agent 资产发现端点 */
  app.get('/.well-known/x402-assets.json', async (_req, res) => {
    const assets = await db.asset.findMany();
    res.json({
      x402Version: '1.0',
      provider: config.projectName,
      assets: assets.map((a: any) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        price: a.price,
        currency: a.currency,
        tags: JSON.parse(a.tags || '[]'),
        endpoint: `/api/v1/data/${a.id}`,
        qualityScore: a.totalQueries > 100 ? 'verified' : 'new',
      })),
      totalAssets: assets.length,
    });
  });

  /** OpenAPI 规范 */
  app.get('/openapi.json', (_req, res) => {
    const paths: any = {};
    for (const [id, runtime] of runtimes) {
      paths[`/api/v1/data/${id}`] = {
        get: {
          summary: runtime.config.name,
          description: `${runtime.config.description}\n\n价格: ${runtime.config.price} ${runtime.config.currency}/次`,
          parameters: Object.keys(runtime.schema).map((field) => ({
            name: field,
            in: 'query',
            required: false,
            schema: { type: runtime.schema[field] || 'string' },
          })),
          responses: {
            '200': { description: '成功返回数据（已支付）' },
            '402': { description: '需要支付' },
          },
          'x-402-price': runtime.config.price,
          'x-402-currency': runtime.config.currency,
        },
      };
    }
    res.json({
      openapi: '3.0.3',
      info: {
        title: `${config.projectName} - Data API`,
        version: '2.0.0',
      },
      servers: [{ url: `http://localhost:${config.port}` }],
      paths,
    });
  });

  /** 服务健康状态 */
  app.get('/status', async (_req, res) => {
    const assets = await db.asset.findMany();
    const status: ServerStatus = {
      running: true,
      port: config.port,
      assets: assets.map((a: any) => ({
        id: a.id,
        name: a.name,
        price: a.price,
        currency: a.currency,
        totalQueries: a.totalQueries,
        totalRevenue: a.totalRevenue,
      })),
      totalQueries: assets.reduce((sum: number, a: any) => sum + a.totalQueries, 0),
      totalRevenue: assets.reduce((sum: number, a: any) => sum + a.totalRevenue, 0),
      uptime: Math.floor((Date.now() - startTime) / 1000),
    };
    res.json(status);
  });

  // ──────────────────────────────────────────────────────────
  // 鉴权接口
  // ──────────────────────────────────────────────────────────

  app.post('/api/v1/auth/register', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
      }
      const result = await accountManager.register(username, password);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/v1/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
      }
      const result = await accountManager.login(username, password);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(401).json({ error: err.message });
    }
  });

  // ──────────────────────────────────────────────────────────
  // 账户管理（需要鉴权）
  // ──────────────────────────────────────────────────────────

  app.get('/api/v1/account/balance', authenticate, requireAuth, async (req: any, res) => {
    // NOTE: 直接返回 req.account，不再使用 username 进行二次查询
    res.json(req.account);
  });

  /** 搜索资产 */
  app.get('/api/v1/search', authenticate, async (req: any, res) => {
    const q = ((req.query.q as string) || '').toLowerCase();
    const isMine = req.query.context === 'mine';
    const providerId = req.account?.id;

    const assets = await db.asset.findMany({
      where: {
        AND: [
          isMine && providerId ? { providerId } : {},
          q
            ? {
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  { description: { contains: q, mode: 'insensitive' } },
                  { tags: { contains: q } },
                ],
              }
            : {},
        ],
      },
    });

    res.json(
      assets.map((a: any) => ({
        ...a,
        tags: JSON.parse(a.tags || '[]'),
      }))
    );
  });

  /** API Key 轮转 */
  app.post('/api/v1/account/keys/rotate', authenticate, requireAuth, async (req: any, res) => {
    const newKey = await accountManager.generateApiKey(req.account.id);
    res.json({ success: true, apiKey: newKey });
  });

  /** 更新 Webhook */
  app.post('/api/v1/account/webhook', authenticate, requireAuth, async (req: any, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: '缺少 url 参数' });
    // 校验 URL 格式
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: '无效的 Webhook URL 格式' });
    }
    await accountManager.updateWebhook(req.account.id, url);
    res.json({ success: true, webhookUrl: url });
  });

  // ──────────────────────────────────────────────────────────
  // Stripe 充值流程（真实支付）
  // ──────────────────────────────────────────────────────────

  /**
   * 创建 Stripe PaymentIntent
   * NOTE: 前端拿到 clientSecret 后，用 Stripe.js 完成支付
   *       用户实际付款通过 /stripe-webhook 回调确认
   */
  app.post('/api/v1/payment/create-intent', authenticate, requireAuth, async (req: any, res) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: 'Stripe 支付通道未配置' });
    }

    const { amount } = req.body;
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < 1) {
      return res.status(400).json({ error: '充值金额最小为 1 CNY' });
    }

    try {
      const intent = await stripe.paymentIntents.create({
        // NOTE: Stripe 金额单位为分（fen），CNY 需 *100
        amount: Math.round(amountNum * 100),
        currency: 'cny',
        metadata: {
          userId: req.account.id,
          username: req.account.address,
          platform: 'datapay',
        },
      });

      // 记录待确认的充值记录（幂等性保障）
      await db.stripeTopup.create({
        data: {
          stripePaymentIntentId: intent.id,
          userId: req.account.id,
          amount: amountNum,
          currency: 'CNY',
          status: 'pending',
        },
      });

      res.json({
        clientSecret: intent.client_secret,
        paymentIntentId: intent.id,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Stripe 创建支付意图失败', details: err.message });
    }
  });

  /**
   * Stripe Webhook 回调（支付成功后自动充值）
   * NOTE: 必须验证 Stripe 签名，防止伪造回调
   */
  app.post('/api/v1/payment/stripe-webhook', async (req, res) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET 未配置');
      return res.status(500).send('Webhook secret not configured');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers['stripe-signature'] as string,
        webhookSecret
      );
    } catch (err: any) {
      console.error(`[Stripe Webhook] 签名验证失败: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      const userId = intent.metadata.userId;
      const amountYuan = intent.amount / 100; // 分 → 元

      try {
        // NOTE: 幂等性检查，防止 Webhook 重复触发
        const existing = await db.stripeTopup.findUnique({
          where: { stripePaymentIntentId: intent.id },
        });

        if (existing && existing.status === 'succeeded') {
          console.log(`[Stripe Webhook] 重复事件，跳过: ${intent.id}`);
          return res.json({ received: true });
        }

        // 执行余额充值
        const newBalance = await accountManager.topup(userId, amountYuan);

        // 更新充值记录状态
        await db.stripeTopup.update({
          where: { stripePaymentIntentId: intent.id },
          data: { status: 'succeeded' },
        });

        console.log(`✅ [Stripe] 用户 ${userId} 充值成功: ${amountYuan} CNY，新余额: ${newBalance}`);

        // 触发 Webhook 通知
        triggerWebhook(userId, {
          event: 'payment.success',
          timestamp: new Date().toISOString(),
          data: { type: 'topup', amount: amountYuan, newBalance, paymentIntentId: intent.id },
        });
      } catch (err: any) {
        console.error(`[Stripe Webhook] 充值处理失败: ${err.message}`);
        return res.status(500).send('Internal Error');
      }
    }

    res.json({ received: true });
  });

  // ──────────────────────────────────────────────────────────
  // 资产管理（需要鉴权）
  // ──────────────────────────────────────────────────────────

  /** 创建/发布新资产 */
  app.post('/api/v1/assets', authenticate, requireAuth, async (req: any, res) => {
    const { name, description, source, sourceType, price, currency, tags } = req.body;
    const providerId = req.account.id;

    if (!name || !source || !sourceType || price === undefined) {
      return res.status(400).json({ error: '缺少必要字段: name, source, sourceType, price' });
    }

    // SSRF 防护：API 类型资产必须验证 source URL
    if ((sourceType === 'api' || sourceType === 'scraper') && isSsrfRisk(source)) {
      return res.status(400).json({
        error: '不允许的资产来源地址：内网地址、localhost 或云服务商元数据地址已被禁止',
      });
    }

    try {
      const assetId = nanoid(10);
      const _sourceType = sourceType as 'json' | 'csv' | 'api' | 'scraper';

      let data: any[] = [];
      let schema: Record<string, string> = {};

      if (_sourceType === 'json' || _sourceType === 'csv') {
        const sourcePath = resolve(configDir || process.cwd(), source);
        const loaded = loadAssetData(sourcePath);
        data = loaded.data;
        schema = loaded.schema;
      }

      const dbAsset = await db.asset.create({
        data: {
          id: assetId,
          name,
          description,
          source,
          sourceType: _sourceType,
          price: parseFloat(price),
          currency: currency || config.currency,
          tags: JSON.stringify(Array.isArray(tags) ? tags : []),
          providerId,
        },
      });

      const assetConfig: AssetConfig = {
        id: dbAsset.id,
        name: dbAsset.name,
        description: dbAsset.description || '',
        source: dbAsset.source,
        sourceType: _sourceType,
        price: dbAsset.price,
        currency: dbAsset.currency,
        tags: Array.isArray(tags) ? tags : [],
        totalQueries: 0,
        totalRevenue: 0,
        publishedAt: dbAsset.publishedAt.toISOString(),
      };

      runtimes.set(assetId, { config: assetConfig, data, schema });
      res.status(201).json({ success: true, asset: assetConfig });
    } catch (err: any) {
      res.status(500).json({ error: '发布资产失败', details: err.message });
    }
  });

  /** 获取当前用户的资产列表 */
  app.get('/api/v1/my-assets', authenticate, requireAuth, async (req: any, res) => {
    const assets = await db.asset.findMany({ where: { providerId: req.account.id } });
    res.json(
      assets.map((a: any) => ({
        ...a,
        tags: JSON.parse(a.tags || '[]'),
      }))
    );
  });

  /** 下架资产（归属校验） */
  app.delete('/api/v1/assets/:id', authenticate, requireAuth, async (req: any, res) => {
    const { id } = req.params;
    const asset = await db.asset.findUnique({ where: { id } });

    if (!asset) return res.status(404).json({ error: '资产不存在' });

    // NOTE: 严格校验归属，防止越权操作
    if (asset.providerId !== req.account.id) {
      return res.status(403).json({ error: '无权操作此资产：您不是该资产的发布者' });
    }

    await db.asset.delete({ where: { id } });
    runtimes.delete(id);
    res.json({ success: true, message: `资产「${asset.name}」已成功下架` });
  });

  // ──────────────────────────────────────────────────────────
  // 交易与收益（需要鉴权）
  // ──────────────────────────────────────────────────────────

  /** 消费方：近期交易记录 */
  app.get('/api/v1/transactions', authenticate, requireAuth, async (req: any, res) => {
    const transactions = await db.transaction.findMany({
      where: { payerId: req.account.id },
      include: { asset: { select: { name: true } } },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    res.json(
      transactions.map((tx: any) => ({
        id: tx.id,
        assetId: tx.assetId,
        assetName: tx.asset?.name || '未知资产',
        amount: tx.amount,
        type: 'spend',
        timestamp: tx.timestamp.toISOString(),
      }))
    );
  });

  /** 提供方：资产收益报告（租户隔离） */
  app.get('/api/v1/earnings', authenticate, requireAuth, async (req: any, res) => {
    const assets = await db.asset.findMany({
      where: { providerId: req.account.id },
      select: {
        id: true,
        name: true,
        price: true,
        totalQueries: true,
        totalRevenue: true,
        providerRevenue: true,
      },
    });

    const totalProviderRevenue = assets.reduce((sum: number, a: any) => sum + (a.providerRevenue || 0), 0);
    const totalQueries = assets.reduce((sum: number, a: any) => sum + a.totalQueries, 0);

    res.json({
      commissionRate: PLATFORM_COMMISSION_RATE,
      totalProviderRevenue: parseFloat(totalProviderRevenue.toFixed(2)),
      totalQueries,
      assets,
    });
  });

  /**
   * Analytics：仅返回当前登录用户的数据统计（租户隔离）
   * NOTE: 修复原版无鉴权、返回全平台数据的安全漏洞
   */
  app.get('/api/v1/analytics/stats', authenticate, requireAuth, async (req: any, res) => {
    try {
      // 获取当前用户资产的所有交易记录
      const myAssets = await db.asset.findMany({
        where: { providerId: req.account.id },
        select: { id: true },
      });
      const myAssetIds = myAssets.map((a: any) => a.id);

      const logs = await getQueryLogs();
      const myLogs = logs.filter((l) => myAssetIds.includes(l.assetId));

      const statsMap = new Map<string, { date: string; queries: number; revenue: number }>();

      // 初始化最近 7 天数据
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        statsMap.set(dateStr, { date: dateStr, queries: 0, revenue: 0 });
      }

      myLogs.forEach((log) => {
        const dateStr = log.timestamp.split('T')[0];
        if (statsMap.has(dateStr)) {
          const s = statsMap.get(dateStr)!;
          s.queries += 1;
          s.revenue += log.amount;
        }
      });

      const result = Array.from(statsMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: '获取分析数据失败', details: err.message });
    }
  });

  // ──────────────────────────────────────────────────────────
  // 智能 Agent 网关
  // ──────────────────────────────────────────────────────────

  /**
   * 自然语言数据查询网关
   * NOTE: 由服务端生成 HMAC Token 签发内部支付凭证，安全调用数据端点
   */
  app.get('/api/v1/agent/ask', authenticate, requireAuth, async (req: any, res) => {
    const q = req.query.q as string;
    if (!q) return res.status(400).json({ error: '缺少查询参数 q' });

    // 1. 搜索匹配资产
    const assets = await db.asset.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { tags: { contains: q } },
        ],
      },
      orderBy: { totalQueries: 'desc' }, // 优先返回热门资产
    });

    if (assets.length === 0) {
      return res.status(404).json({ error: '未找到相关数据资产' });
    }

    const bestAsset = assets[0] as any;

    // 2. 余额扣款
    const success = await accountManager.spend(req.account.id, bestAsset.price);
    if (!success) {
      return res.status(402).json({
        error: '余额不足',
        required: bestAsset.price,
        current: req.account.balance,
        hint: '请前往钱包页面充值',
      });
    }

    // 3. 生成 HMAC 内部支付 Token（替换原来的伪造签名）
    const timestamp = Date.now();
    const hmacToken = generateGatewayToken(bestAsset.id, bestAsset.price, timestamp);
    const paymentHeader = [
      'x402',
      'internal',
      bestAsset.currency,
      bestAsset.price.toString(),
      req.account.id, // NOTE: 使用用户 ID 而非用户名，更安全
      hmacToken,
      timestamp.toString(),
      bestAsset.id, // 传入 assetId 供验签使用
    ].join(';');

    try {
      const runtime = runtimes.get(bestAsset.id);
      if (!runtime) {
        throw new Error(`资产 ${bestAsset.id} 未在内存中找到，请重启服务`);
      }

      // 内部直接调用数据处理逻辑，避免 HTTP 自调用
      const dataResult = await fetchAssetData(runtime, req.account.id, bestAsset.price, paymentHeader, req.query as Record<string, string>);

      const updatedAccount = await accountManager.getAccountById(req.account.id);
      res.json({
        gateway_version: '2.0',
        matched_asset: bestAsset.name,
        cost: bestAsset.price,
        remaining_balance: updatedAccount?.balance ?? 0,
        data: dataResult,
      });

      triggerWebhook(req.account.id, {
        event: 'payment.success',
        timestamp: new Date().toISOString(),
        data: {
          assetId: bestAsset.id,
          assetName: bestAsset.name,
          amount: bestAsset.price,
          source: 'gateway',
        },
      });
    } catch (e: any) {
      // 扣款已成功，但获取数据失败，退款
      await accountManager.topup(req.account.id, bestAsset.price);
      res.status(500).json({ error: '数据获取失败，已退款', details: e.message });
    }
  });

  // ──────────────────────────────────────────────────────────
  // x402 付费数据端点
  // ──────────────────────────────────────────────────────────

  app.get('/api/v1/data/:assetId', async (req, res) => {
    const { assetId } = req.params;
    const runtime = runtimes.get(assetId);

    if (!runtime) {
      return res.status(404).json({ error: `资产不存在: ${assetId}` });
    }

    const paymentHeader = req.headers['x-payment'] as string | undefined;

    if (!paymentHeader) {
      const paymentRequired = createPaymentRequired(runtime.config, config.walletAddress);
      return res.status(402).json(paymentRequired);
    }

    const payment = parsePaymentHeader(paymentHeader);
    if (!payment) {
      return res.status(400).json({ error: '无效的 X-PAYMENT header 格式' });
    }

    // NOTE: 传入 assetId 用于 HMAC 验签
    if (!payment.assetId) payment.assetId = assetId;

    const verification = await verifyPayment(payment, runtime.config);
    if (!verification.valid) {
      return res.status(402).json({
        error: '支付验证失败',
        reason: verification.reason,
        ...createPaymentRequired(runtime.config, config.walletAddress),
      });
    }

    // 支付验证通过，返回数据
    try {
      const data = await fetchAssetData(runtime, payment.payer, parseFloat(payment.amount), paymentHeader, req.query as Record<string, string>);

      // 记录查询日志（异步，不阻塞响应）
      recordQuery(assetId, payment.payer, parseFloat(payment.amount), payment.network).catch(
        (err) => console.error(`[QueryLog] 记录失败: ${err.message}`)
      );
      updateAssetStats(assetId, parseFloat(payment.amount)).catch(
        (err) => console.error(`[Stats] 更新失败: ${err.message}`)
      );

      triggerWebhook(payment.payer, {
        event: 'payment.success',
        timestamp: new Date().toISOString(),
        data: {
          assetId: runtime.config.id,
          assetName: runtime.config.name,
          amount: parseFloat(payment.amount),
          source: runtime.config.sourceType,
        },
      });

      res.setHeader('X-402-Payment-Status', 'verified');
      res.setHeader('X-402-Asset-Id', assetId);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: '数据获取失败', details: err.message });
    }
  });

  return { app, config, runtimes };
}

// ── 内部辅助：获取资产数据 ────────────────────────────────────

/**
 * 根据资产类型获取数据（内部复用，避免 server 自调用）
 */
async function fetchAssetData(
  runtime: AssetRuntime,
  _payerUserId: string,
  _amount: number,
  _paymentHeader: string,
  queryParams: Record<string, string>
): Promise<any> {
  if (runtime.config.sourceType === 'scraper') {
    const url = runtime.config.source;
    if (isSsrfRisk(url)) {
      throw new Error('资产来源 URL 被 SSRF 防护拦截');
    }
    const response = await fetch(url);
    const html = await response.text();
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : 'Unknown';
    const bodyText = html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000);
    return {
      success: true,
      asset: { id: runtime.config.id, name: runtime.config.name },
      data: { title, url, content: bodyText, timestamp: new Date().toISOString() },
    };
  }

  if (runtime.config.sourceType === 'api') {
    const url = runtime.config.source;
    if (isSsrfRisk(url)) {
      throw new Error('资产来源 URL 被 SSRF 防护拦截');
    }
    const params = new URLSearchParams(queryParams).toString();
    const targetUrl = params ? `${url}?${params}` : url;
    const response = await fetch(targetUrl);
    if (!response.ok) throw new Error(`上游 API 响应错误: ${response.status}`);
    const apiData = await response.json();
    return {
      success: true,
      asset: { id: runtime.config.id, name: runtime.config.name },
      data: apiData,
    };
  }

  // JSON / CSV 类型：过滤 + 分页
  let result = [...runtime.data];
  for (const [key, value] of Object.entries(queryParams)) {
    if (key === 'limit' || key === 'offset') continue;
    result = result.filter((item) => {
      const itemValue = item[key];
      if (itemValue === undefined) return true;
      return String(itemValue).toLowerCase().includes(String(value).toLowerCase());
    });
  }

  const limit = parseInt(queryParams.limit) || 20;
  const offset = parseInt(queryParams.offset) || 0;
  const paginatedResult = result.slice(offset, offset + limit);

  return {
    success: true,
    asset: { id: runtime.config.id, name: runtime.config.name },
    pagination: {
      total: result.length,
      limit,
      offset,
      hasMore: offset + limit < result.length,
    },
    schema: runtime.schema,
    data: paginatedResult,
  };
}

// ── 服务启动 ──────────────────────────────────────────────────

export async function startServer(configDir?: string): Promise<void> {
  const { app, config, runtimes } = await createServer(configDir);

  return new Promise((resolve) => {
    app.listen(config.port, () => {
      console.log('');
      console.log('  🚀 DataPay / Nexus402 服务已启动（生产安全版）');
      console.log('  ─────────────────────────────────────────────');
      console.log(`  📡 端口:     http://localhost:${config.port}`);
      console.log(`  📦 资产数量: ${runtimes.size} 个`);
      console.log(`  🔐 安全模式: HMAC 签名验证 ✓  SSRF 防护 ✓`);
      console.log(`  💳 支付:     Stripe PaymentIntent ✓`);
      console.log(`  📊 抽佣:     ${PLATFORM_COMMISSION_RATE * 100}%`);
      console.log('  ─────────────────────────────────────────────');
      console.log('');
      console.log('  按 Ctrl+C 停止服务...');
      resolve();
    });
  });
}
