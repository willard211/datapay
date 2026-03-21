// ============================================================
// DataPay / wrap402 - Express Server
// Serves x402-payable data endpoints
// ============================================================
import express from 'express';
import cors from 'cors';
import { loadConfig, saveConfig } from './config.js';
import { loadAssetData } from './asset-loader.js';
import { createPaymentRequired, parsePaymentHeader, verifyPayment, recordQuery, updateAssetStats } from './payment.js';
import type { AssetConfig, AssetRuntime, ServerStatus } from './types.js';
import { resolve } from 'path';
import { nanoid } from 'nanoid';

const startTime = Date.now();

/**
 * Create and configure the Express server
 */
export function createServer(configDir?: string) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const config = loadConfig(configDir);
  const runtimes = new Map<string, AssetRuntime>();

  // Load all assets into memory
  for (const assetConfig of config.assets) {
    try {
      if (assetConfig.sourceType === 'api') {
        runtimes.set(assetConfig.id, { config: assetConfig, data: [], schema: {} });
      } else {
        const sourcePath = resolve(configDir || process.cwd(), assetConfig.source);
        const { data, schema } = loadAssetData(sourcePath);
        runtimes.set(assetConfig.id, { config: assetConfig, data, schema });
      }
    } catch (err: any) {
      console.error(`⚠️  加载资产失败 [${assetConfig.name}]: ${err.message}`);
    }
  }

  // ──────────────────────────────────────────────
  // Discovery Endpoints (free, for AI Agent discovery)
  // ──────────────────────────────────────────────

  /** Well-known asset discovery endpoint */
  app.get('/.well-known/x402-assets.json', (_req, res) => {
    const assets = config.assets.map(a => ({
      id: a.id,
      name: a.name,
      description: a.description,
      price: a.price,
      currency: a.currency,
      tags: a.tags,
      endpoint: `/api/v1/data/${a.id}`,
      qualityScore: 'unverified',
    }));
    res.json({
      x402Version: '1.0',
      provider: config.projectName,
      assets,
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
  app.get('/status', (_req, res) => {
    const status: ServerStatus = {
      running: true,
      port: config.port,
      assets: config.assets.map(a => ({
        id: a.id,
        name: a.name,
        price: a.price,
        currency: a.currency,
        totalQueries: a.totalQueries,
        totalRevenue: a.totalRevenue,
      })),
      totalQueries: config.assets.reduce((sum, a) => sum + a.totalQueries, 0),
      totalRevenue: config.assets.reduce((sum, a) => sum + a.totalRevenue, 0),
      uptime: Math.floor((Date.now() - startTime) / 1000),
    };
    res.json(status);
  });

  /** Publish a new asset dynamically from the dashboard */
  app.post('/api/v1/assets', (req, res) => {
    const { name, description, source, price, currency, tags } = req.body;
    
    if (!name || !source || price === undefined) {
      res.status(400).json({ error: '缺少必填字段 (name, source, price)' });
      return;
    }

    const isApi = source.startsWith('http://') || source.startsWith('https://');
    let dataLength = '未知 (API代理)';
    let schema: Record<string, string> = {};
    let data: any[] = [];
    let _sourceType: 'api' | 'json' | 'csv' = 'api';

    try {
      if (!isApi) {
        const sourcePath = resolve(configDir || process.cwd(), source);
        const parsed = loadAssetData(sourcePath);
        dataLength = `${parsed.data.length} 条记录`;
        schema = parsed.schema;
        data = parsed.data;
        _sourceType = source.endsWith('.csv') ? 'csv' : 'json';
      }

      const assetId = nanoid(10);
      const asset: AssetConfig = {
        id: assetId,
        name: name,
        description: description || (isApi ? `${name} - 动态 API 接口` : `${name} - 包含 ${dataLength}`),
        source: source,
        sourceType: _sourceType,
        price: parseFloat(price),
        currency: currency || config.currency,
        tags: tags ? tags.map((t: string) => t.trim()) : [],
        publishedAt: new Date().toISOString(),
        totalQueries: 0,
        totalRevenue: 0,
      };

      // Ensure no duplicate name issues or handle gracefully
      config.assets.push(asset);
      saveConfig(config, configDir);

      // Hot reload to memory
      runtimes.set(assetId, { config: asset, data, schema });

      res.status(201).json({ success: true, asset });
    } catch (err: any) {
      res.status(500).json({ error: '配置或加载资产失败', details: err.message });
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

    const verification = verifyPayment(payment, runtime.config);
    if (!verification.valid) {
      res.status(402).json({
        error: '支付验证失败',
        reason: verification.reason,
        ...createPaymentRequired(runtime.config, config.walletAddress),
      });
      return;
    }

    // Payment verified → Return data
    if (runtime.config.sourceType === 'api') {
      try {
        const queryParams = new URLSearchParams(req.query as Record<string, string>).toString();
        const targetUrl = queryParams ? `${runtime.config.source}?${queryParams}` : runtime.config.source;
        
        const response = await fetch(targetUrl);
        if (!response.ok) {
           throw new Error(`上游 API 响应错误: ${response.status}`);
        }
        const apiData = await response.json();
        
        recordQuery(assetId, payment.payer, parseFloat(payment.amount), req.query as Record<string, string>);
        updateAssetStats(assetId, parseFloat(payment.amount));

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
export function startServer(configDir?: string): Promise<void> {
  return new Promise((resolve) => {
    const { app, config, runtimes } = createServer(configDir);

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
