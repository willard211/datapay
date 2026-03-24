// ============================================================
// DataPay / wrap402 - Express Server
// Serves x402-payable data endpoints
// ============================================================
import express from 'express';
import cors from 'cors';
import { loadConfig, saveConfig } from './config.js';
import { loadAssetData } from './asset-loader.js';
import { createPaymentRequired, parsePaymentHeader, verifyPayment, recordQuery, updateAssetStats, getQueryLogs } from './payment.js';
import type { AssetConfig, AssetRuntime, ServerStatus } from './types.js';
import { resolve } from 'path';
import { nanoid } from 'nanoid';
import { sendWebhook, WebhookPayload } from './webhooks.js';
import { accountManager, JWT_SECRET } from './accounts.js';
import jwt from 'jsonwebtoken';
import { db } from './lib/db.js';

const startTime = Date.now();

/**
 * Helper to trigger webhook for an account
 */
const triggerWebhook = async (address: string, payload: WebhookPayload) => {
  const account = await accountManager.getAccount(address);
  if (account.webhookUrl) {
    sendWebhook(account.webhookUrl, payload).catch(err => console.error(`[Webhook Error] ${err.message}`));
  }
};

/**
 * Create and configure the Express server
 */
export async function createServer(configDir?: string) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const config = loadConfig(configDir);
  const runtimes = new Map<string, AssetRuntime>();

  // Use Prisma to load assets instead of config.assets
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
        publishedAt: dbAsset.publishedAt.toISOString()
      };

      if (assetConfig.sourceType === 'api' || assetConfig.sourceType === 'scraper') {
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

  // ──────────────────────────────────────────────
  // Discovery Endpoints (free, for AI Agent discovery)
  // ──────────────────────────────────────────────

  /** Well-known asset discovery endpoint */
  app.get('/.well-known/x402-assets.json', async (_req, res) => {
    const assets = await db.asset.findMany();
    const result = assets.map((a: any) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      price: a.price,
      currency: a.currency,
      tags: JSON.parse(a.tags || '[]'),
      endpoint: `/api/v1/data/${a.id}`,
      qualityScore: 'unverified',
    }));
    res.json({
      x402Version: '1.0',
      provider: config.projectName,
      assets: result,
      totalAssets: assets.length,
    });
  });

  /** OpenAPI spec for all assets */
  app.get('/openapi.json', (_req, res) => {
    const paths: any = {};
    for (const [id, runtime] of runtimes) {
      paths[`/api/v1/data/${id}`] = {
        get: {
          summary: runtime.config.description,
          description: `价格: ${runtime.config.price} ${runtime.config.currency}/次`,
          parameters: Object.keys(runtime.schema).map(field => ({
            name: field,
            in: 'query',
            required: false,
            schema: { type: runtime.schema[field] || 'string' },
            description: `按 ${field} 筛选`,
          })),
          responses: {
            '200': {
              description: '成功返回数据（已支付）',
              content: { 'application/json': {} },
            },
            '402': {
              description: '需要支付',
              content: { 'application/json': {} },
            },
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
        description: 'x402-payable data endpoints powered by DataPay / wrap402',
        version: '1.0.0',
      },
      servers: [{ url: `http://localhost:${config.port}` }],
      paths,
    });
  });

  /** Server status */
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

  /**
   * GET /api/v1/search
   * Search assets using database query
   */
  app.get('/api/v1/search', async (req, res) => {
    const q = (req.query.q as string || '').toLowerCase();
    
    // 多租户隔离：如果提供了 token 且带了 context=mine，只搜自己的
    const isMine = req.query.context === 'mine';
    const providerId = (req as any).account?.id;

    const assets = await db.asset.findMany({
      where: {
        AND: [
          isMine && providerId ? { providerId } : {},
          q ? {
            OR: [
              { name: { contains: q } },
              { description: { contains: q } },
              { tags: { contains: q } }
            ]
          } : {}
        ]
      }
    });

    res.json(assets.map((a: any) => ({
      ...a,
      tags: JSON.parse(a.tags || '[]')
    })));
  });

  // --- Middleware ---
  const authenticate = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // 1. Try JWT
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const account = await accountManager.getAccount(decoded.username);
        req.account = account;
        return next();
      } catch (e) {
        // Not a valid JWT, fallback to api key check
      }

      // 2. Try API Key
      const account = await accountManager.getAccountByApiKey(token);
      if (account) {
        req.account = account;
        return next();
      }
    }
    // Fallback for legacy requests or dashboard local testing
    next();
  };

  // --- Auth APIs ---
  app.post('/api/v1/auth/register', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
      
      const result = await accountManager.register(username, password);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/v1/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });

      const result = await accountManager.login(username, password);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(401).json({ error: err.message });
    }
  });

  // --- Account & Gateway APIs ---

  app.get('/api/v1/account/balance', authenticate, async (req: any, res) => {
    const address = req.account?.address || req.query.address as string || 'demo-user';
    res.json(await accountManager.getAccount(address));
  });

  app.post('/api/v1/account/topup', authenticate, async (req: any, res) => {
    const address = req.account?.address || req.body.address || 'demo-user';
    const { amount } = req.body;
    const newBalance = await accountManager.topup(address, parseFloat(amount) || 10);
    res.json({ success: true, balance: newBalance });
  });

  /**
   * The Smart Gateway: Ask with Natural Language
   */
  app.get('/api/v1/agent/ask', authenticate, async (req: any, res) => {
    const q = req.query.q as string;
    const address = req.account?.address || req.query.address as string || 'demo-user';

    if (!q) return res.status(400).json({ error: 'Missing query' });

    // 1. Search for best asset
    const searchRes = await fetch(`http://localhost:${config.port}/api/v1/search?q=${encodeURIComponent(q)}`);
    const assets = await searchRes.json() as AssetConfig[];

    if (assets.length === 0) {
      return res.status(404).json({ error: '未找到相关数据资产。请尝试不同的关键字。' });
    }

    const bestAsset = assets[0];

    // 2. Billing: Check balance and spend
    const success = await accountManager.spend(address, bestAsset.price);
    if (!success) {
      const currentAccount = await accountManager.getAccount(address);
      return res.status(402).json({ 
        error: '余额不足', 
        required: bestAsset.price, 
        current: currentAccount.balance 
      });
    }

    // 3. Fetch Data (Internal Call)
    console.log(`🤖 [Gateway] 为 ${address} 自动购买资产: ${bestAsset.name} (${bestAsset.price} ${bestAsset.currency})`);
    try {
      // Simulate the x402 payment flow internally
      const dataRes = await fetch(`http://localhost:${config.port}/api/v1/data/${bestAsset.id}`, {
        headers: {
          'X-PAYMENT': `x402;internal;${bestAsset.currency};${bestAsset.price};${address};auto-gateway-sig-${Date.now()};${Date.now()}`
        }
      });
      
      const payload = await dataRes.json();
      const currentAccount = await accountManager.getAccount(address);
      res.json({
        gateway_version: '1.0',
        matched_asset: bestAsset.name,
        cost: bestAsset.price,
        remaining_balance: currentAccount.balance,
        data: payload
      });

      // Async Webhook trigger
      triggerWebhook(address, {
        event: 'payment.success',
        timestamp: new Date().toISOString(),
        data: {
          assetId: bestAsset.id,
          assetName: bestAsset.name,
          amount: bestAsset.price,
          payer: address,
          source: 'gateway'
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: 'Gateway Fetch Error', details: e.message });
    }
  });

  app.post('/api/v1/account/keys/rotate', authenticate, async (req: any, res) => {
    const address = req.account?.address || req.body.address;
    const newKey = await accountManager.generateApiKey(address);
    res.json({ success: true, apiKey: newKey });
  });

  app.post('/api/v1/account/webhook', authenticate, async (req: any, res) => {
    const address = req.account?.address || req.body.address;
    const { url } = req.body;
    if (!address || !url) return res.status(400).json({ error: 'Missing address or url' });
    
    await accountManager.updateWebhook(address, url);
    res.json({ success: true, webhookUrl: url });
  });

  /** POST /api/v1/assets - Publish new asset (DB integrated) */
  app.post('/api/v1/assets', authenticate, async (req, res) => {
    const { name, description, source, sourceType, price, currency, tags } = req.body;
    const providerId = (req as any).account.id;

    if (!name || !source || !sourceType || price === undefined) {
      res.status(400).json({ error: '缺少必要字段: name, source, sourceType, price' });
      return;
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

      // Save to database
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
          providerId
        }
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
        publishedAt: dbAsset.publishedAt.toISOString()
      };

      // Hot reload to memory
      runtimes.set(assetId, { config: assetConfig, data, schema });

      res.status(201).json({ success: true, asset: assetConfig });
    } catch (err: any) {
      res.status(500).json({ error: '配置或加载资产失败', details: err.message });
    }
  });

  /** 
   * GET /api/v1/analytics/stats
   * Get query and revenue stats for the last 7 days
   */
  app.get('/api/v1/analytics/stats', async (_req, res) => {
    try {
      const logs = await getQueryLogs();
      const statsMap = new Map<string, { date: string, queries: number, revenue: number }>();
      
      // Initialize last 7 days with zeros
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        statsMap.set(dateStr, { date: dateStr, queries: 0, revenue: 0 });
      }

      // Aggregate logs from the .jsonl file
      logs.forEach(log => {
        const dateStr = log.timestamp.split('T')[0];
        if (statsMap.has(dateStr)) {
          const s = statsMap.get(dateStr)!;
          s.queries += 1;
          s.revenue += log.amount;
        }
      });

      // Sort by date ascending for charts
      const result = Array.from(statsMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: '获取分析数据失败', details: err.message });
    }
  });

  // ──────────────────────────────────────────────
  // Data Endpoints (x402 payable)
  // ──────────────────────────────────────────────

  /** Main data access endpoint - returns 402 or data */
  app.get('/api/v1/data/:assetId', async (req, res) => {
    const { assetId } = req.params;
    const runtime = runtimes.get(assetId);

    if (!runtime) {
      res.status(404).json({ error: `资产不存在: ${assetId}` });
      return;
    }

    // Check for payment header
    const paymentHeader = req.headers['x-payment'] as string | undefined;

    if (!paymentHeader) {
      // No payment → Return 402
      const paymentRequired = createPaymentRequired(runtime.config, config.walletAddress);
      res.status(402).json(paymentRequired);
      return;
    }

    // Parse and verify payment
    const payment = parsePaymentHeader(paymentHeader);
    if (!payment) {
      res.status(400).json({ error: '无效的支付头格式' });
      return;
    }

    const verification = await verifyPayment(payment, runtime.config);
    if (!verification.valid) {
      res.status(402).json({
        error: '支付验证失败',
        reason: verification.reason,
        ...createPaymentRequired(runtime.config, config.walletAddress),
      });
      return;
    }

    // Payment verified → Return data
    if (runtime.config.sourceType === 'scraper') {
      try {
        console.log(`🕷️ [Scraper] 正在抓取: ${runtime.config.source}`);
        const response = await fetch(runtime.config.source);
        const html = await response.text();
        
        // Simple POC: Extract body text and title
        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1] : 'Unknown Title';
        const bodyText = html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000);

        // NOTE: 与 api/json 分支保持一致，记录查询日志和资产统计
        await recordQuery(assetId, payment.payer, parseFloat(payment.amount), req.query as Record<string, string>);
        await updateAssetStats(assetId, parseFloat(payment.amount));

        triggerWebhook(payment.payer, {
          event: 'payment.success',
          timestamp: new Date().toISOString(),
          data: {
            assetId: runtime.config.id,
            assetName: runtime.config.name,
            amount: parseFloat(payment.amount),
            payer: payment.payer,
            source: 'scraper'
          }
        });

        res.setHeader('X-402-Payment-Status', 'verified');
        res.json({
          success: true,
          asset: { id: runtime.config.id, name: runtime.config.name },
          data: {
            title,
            url: runtime.config.source,
            content: bodyText,
            timestamp: new Date().toISOString()
          }
        });
        return;
      } catch (err: any) {
        res.status(500).json({ error: '抓取失败', details: err.message });
        return;
      }
    }

    if (runtime.config.sourceType === 'api') {
      try {
        const queryParams = new URLSearchParams(req.query as Record<string, string>).toString();
        const targetUrl = queryParams ? `${runtime.config.source}?${queryParams}` : runtime.config.source;
        
        const response = await fetch(targetUrl);
        if (!response.ok) {
           throw new Error(`上游 API 响应错误: ${response.status}`);
        }
        const apiData = await response.json();
        
        await recordQuery(assetId, payment.payer, parseFloat(payment.amount), req.query as Record<string, string>);
        await updateAssetStats(assetId, parseFloat(payment.amount));

        triggerWebhook(payment.payer, {
          event: 'payment.success',
          timestamp: new Date().toISOString(),
          data: {
            assetId: runtime.config.id,
            assetName: runtime.config.name,
            amount: parseFloat(payment.amount),
            payer: payment.payer,
            source: 'api'
          }
        });

        res.setHeader('X-402-Payment-Status', 'verified');
        res.setHeader('X-402-Asset-Id', assetId);

        res.json({
          success: true,
          asset: { id: runtime.config.id, name: runtime.config.name },
          data: apiData,
        });
        return;
      } catch (err: any) {
        res.status(500).json({ error: '代理请求失败', details: err.message });
        return;
      }
    }

    let result = [...runtime.data];

    // Apply query filters
    const queryParams = req.query;
    for (const [key, value] of Object.entries(queryParams)) {
      if (key === 'limit' || key === 'offset') continue;
      result = result.filter(item => {
        const itemValue = item[key];
        if (itemValue === undefined) return true;
        return String(itemValue).toLowerCase().includes(String(value).toLowerCase());
      });
    }

    // Apply pagination
    const limit = parseInt(queryParams.limit as string) || 20;
    const offset = parseInt(queryParams.offset as string) || 0;
    const paginatedResult = result.slice(offset, offset + limit);

    // Record query and update stats
    recordQuery(assetId, payment.payer, parseFloat(payment.amount), queryParams as Record<string, string>);
    updateAssetStats(assetId, parseFloat(payment.amount));

    // Add response headers
    res.setHeader('X-402-Payment-Status', 'verified');
    res.setHeader('X-402-Asset-Id', assetId);
    res.setHeader('X-402-Records-Total', result.length.toString());

    res.json({
      success: true,
      asset: {
        id: runtime.config.id,
        name: runtime.config.name,
      },
      pagination: {
        total: result.length,
        limit,
        offset,
        hasMore: offset + limit < result.length,
      },
      schema: runtime.schema,
      data: paginatedResult,
    });
  });

  return { app, config, runtimes };
}

/**
 * Start the server
 */
export async function startServer(configDir?: string): Promise<void> {
  const result = await createServer(configDir);
  const { app, config, runtimes } = result;

  return new Promise((resolve) => {
    app.listen(config.port, () => {
      console.log('');
      console.log('  🚀 DataPay 服务已启动');
      console.log('  ─────────────────────────────────────');
      console.log(`  📡 端口:     http://localhost:${config.port}`);
      console.log(`  📦 资产数量:  ${runtimes.size} 个`);
      console.log('');
      console.log('  📋 可用端点:');
      console.log(`     GET /.well-known/x402-assets.json  (资产发现)`);
      console.log(`     GET /openapi.json                  (OpenAPI 规范)`);
      console.log(`     GET /status                        (服务状态)`);
      console.log('');

      for (const [id, runtime] of runtimes) {
        const dataInfo = runtime.config.sourceType === 'api' ? '动态 API' : `${runtime.data.length} 条`;
        console.log(`  💰 ${runtime.config.name}`);
        console.log(`     GET /api/v1/data/${id}`);
        console.log(`     价格: ${runtime.config.price} ${runtime.config.currency}/次 | 数据量: ${dataInfo}`);
        console.log('');
      }

      console.log('  ─────────────────────────────────────');
      console.log('  🤖 AI Agent 可通过以下方式发现并调用:');
      console.log(`     1. 访问 /.well-known/x402-assets.json 发现数据`);
      console.log(`     2. 请求数据端点 → 收到 402 + 支付指令`);
      console.log(`     3. 附带 X-PAYMENT 头重新请求 → 获取数据`);
      console.log('  ─────────────────────────────────────');
      console.log('');
      console.log('  按 Ctrl+C 停止服务...');
      resolve();
    });
  });
}
