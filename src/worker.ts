import { Context, Hono } from 'hono';
import { cors } from 'hono/cors';
import { sign, verify } from 'hono/jwt';
import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';
import bcrypt from 'bcryptjs';

// 定义 Cloudflare 绑定类型
type Bindings = {
  DB: any;
  JWT_SECRET: string;
};

type Variables = {
  jwtPayload: any;
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// 核心配置
app.use('*', cors());

// 初始化 Prisma 辅助函数
const getPrisma = (env: Bindings) => {
  const adapter = new PrismaD1(env.DB);
  return new PrismaClient({ adapter });
};

// --- 精简版认证中间件 ---
const authMiddleware = async (c: Context<{ Bindings: Bindings, Variables: Variables }>, next: () => Promise<void>) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized', detail: 'Missing or invalid Authorization header' }, 401);
  }
  const token = authHeader.split(' ')[1];
  try {
    const secret = c.env.JWT_SECRET || 'datapay-cloud-secret';
    // 显式指定算法 HS256
    const payload = await verify(token, secret, 'HS256');
    c.set('jwtPayload', payload);
    await next();
  } catch (e: any) {
    return c.json({ error: 'Unauthorized', detail: 'Invalid token: ' + e.message }, 401);
  }
};

// --- 1. 状态查询 ---
app.get('/status', async (c) => {
  const prisma = getPrisma(c.env);
  try {
    const assets = await prisma.asset.findMany();
    const totalQueries = assets.reduce((sum, a) => sum + a.totalQueries, 0);
    const totalRevenue = assets.reduce((sum, a) => sum + a.totalRevenue, 0);

    return c.json({
      running: true,
      port: 80,
      assets: assets.map(a => ({
        ...a,
        tags: JSON.parse(a.tags || '[]')
      })),
      totalQueries,
      totalRevenue,
      uptime: Math.floor(Date.now() / 1000)
    });
  } catch (e: any) {
    return c.json({ running: true, error: e.message, assets: [], totalQueries: 0, totalRevenue: 0 }, 500);
  }
});

// --- 2. 认证接口 (Login/Register) ---

app.post('/api/v1/auth/register', async (c) => {
  try {
    const { username, password: passwordRaw } = await c.req.json();
    if (!username || !passwordRaw) return c.json({ error: '用户名和密码不能为空' }, 400);

    const prisma = getPrisma(c.env);
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) return c.json({ error: '用户已存在' }, 400);

    const hashedPassword = await bcrypt.hash(passwordRaw, 10);
    const apiKey = `dp-${Math.random().toString(36).substring(2, 15)}`;

    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        balance: 10.0,
        apiKey
      }
    });

    const secret = c.env.JWT_SECRET || 'datapay-cloud-secret';
    const token = await sign({ 
      username: newUser.username, 
      sub: newUser.id, 
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 
    }, secret, 'HS256');

    return c.json({
      success: true,
      token,
      account: {
        address: newUser.username,
        balance: newUser.balance,
        apiKey: newUser.apiKey
      }
    });
  } catch (err: any) {
    return c.json({ error: 'Registration failed', details: err.message }, 500);
  }
});

app.post('/api/v1/auth/login', async (c) => {
  try {
    const { username, password: passwordRaw } = await c.req.json();
    const prisma = getPrisma(c.env);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return c.json({ error: '用户不存在或密码错误' }, 401);

    const valid = await bcrypt.compare(passwordRaw, user.password);
    if (!valid && user.password !== 'temp-password') {
      return c.json({ error: '用户不存在或密码错误' }, 401);
    }

    const secret = c.env.JWT_SECRET || 'datapay-cloud-secret';
    const token = await sign({ 
      username: user.username, 
      sub: user.id, 
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 
    }, secret, 'HS256');

    return c.json({
      success: true,
      token,
      account: {
        address: user.username,
        balance: user.balance,
        apiKey: user.apiKey
      }
    });
  } catch (err: any) {
    return c.json({ error: 'Login failed', details: err.message }, 500);
  }
});

// --- 3. 账户与分析接口 (受中间件保护) ---

app.get('/api/v1/account/balance', authMiddleware, async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const prisma = getPrisma(c.env);
    const user = await prisma.user.findUnique({ where: { username: payload.username } });
    if (!user) return c.json({ error: 'User not found' }, 404);
    return c.json({
      address: user.username,
      balance: user.balance,
      apiKey: user.apiKey,
      webhookUrl: user.webhookUrl,
      lastUpdated: user.updatedAt.toISOString()
    });
  } catch (err: any) {
    return c.json({ error: 'Fetch balance failed', details: err.message }, 500);
  }
});

app.get('/api/v1/analytics/stats', authMiddleware, async (c) => {
  try {
    const result = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      result.push({ date: dateStr, queries: 0, revenue: 0 });
    }
    return c.json(result.reverse());
  } catch (err: any) {
    return c.json({ error: 'Fetch stats failed', details: err.message }, 500);
  }
});

app.post('/api/v1/account/topup', authMiddleware, async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const { amount } = await c.req.json();
    const prisma = getPrisma(c.env);
    const user = await prisma.user.update({
      where: { username: payload.username },
      data: { balance: { increment: parseFloat(amount) || 0 } }
    });
    return c.json({ success: true, balance: user.balance });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/v1/account/keys/rotate', authMiddleware, async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const newKey = `dp-${Math.random().toString(36).substring(2, 15)}`;
    const prisma = getPrisma(c.env);
    await prisma.user.update({
      where: { username: payload.username },
      data: { apiKey: newKey }
    });
    return c.json({ success: true, apiKey: newKey });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/v1/account/webhook', authMiddleware, async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const { webhookUrl } = await c.req.json();
    const prisma = getPrisma(c.env);
    await prisma.user.update({
      where: { username: payload.username },
      data: { webhookUrl }
    });
    return c.json({ success: true, webhookUrl });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// --- 4. 资产管理接口 ---

app.get('/api/v1/search', async (c) => {
  try {
    const q = c.req.query('q') || '';
    const prisma = getPrisma(c.env);
    const assets = await prisma.asset.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { description: { contains: q } }
        ]
      }
    });
    return c.json(assets.map(a => ({ ...a, tags: JSON.parse(a.tags || '[]') })));
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/api/v1/assets', authMiddleware, async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const { name, description, source, sourceType, price, currency, tags } = await c.req.json();
    const prisma = getPrisma(c.env);
    const asset = await prisma.asset.create({
      data: {
        providerId: payload.sub,
        name,
        description: description || "",
        source,
        sourceType: sourceType || "api",
        price: parseFloat(price) || 0,
        currency: currency || 'CNY',
        tags: JSON.stringify(Array.isArray(tags) ? tags : [])
      }
    });
    return c.json({ success: true, asset });
  } catch (e: any) {
    return c.json({ error: 'Create asset failed', details: e.message }, 500);
  }
});

// --- 5. 数据访问与网关 ---

app.get('/api/v1/data/:assetId', async (c) => {
  try {
    const assetId = c.req.param('assetId');
    const prisma = getPrisma(c.env);
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) return c.json({ error: 'Asset not found' }, 404);

    const paymentHeader = c.req.header('X-PAYMENT');
    if (!paymentHeader) {
      return c.json({
        error: 'Payment Required',
        price: asset.price,
        currency: asset.currency,
        info: 'Please provide X-PAYMENT header'
      }, 402);
    }

    await prisma.asset.update({
      where: { id: assetId },
      data: { 
        totalQueries: { increment: 1 },
        totalRevenue: { increment: asset.price }
      }
    });

    return c.json({
      success: true,
      data: { message: "这是付费数据内容 (模拟)", asset: asset.name }
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.get('/api/v1/agent/ask', authMiddleware, async (c) => {
  try {
    const q = c.req.query('q');
    if (!q) return c.json({ error: 'Missing query' }, 400);

    const prisma = getPrisma(c.env);
    const asset = await prisma.asset.findFirst({
      where: { name: { contains: q } }
    });

    if (!asset) return c.json({ error: 'No matching asset found' }, 404);

    const payload = c.get('jwtPayload');
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.balance < asset.price) return c.json({ error: 'Insufficient balance' }, 402);

    await prisma.user.update({
      where: { id: payload.sub },
      data: { balance: { decrement: asset.price } }
    });

    await prisma.asset.update({
      where: { id: asset.id },
      data: { 
        totalQueries: { increment: 1 },
        totalRevenue: { increment: asset.price }
      }
    });

    return c.json({
      gateway_version: "1.0",
      matched_asset: asset.name,
      data: { result: `Agent 自动购买了 ${asset.name} 数据` }
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export default app;
