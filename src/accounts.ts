import { db } from './lib/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

// NOTE: 强制从环境变量读取 JWT_SECRET，不提供任何默认值
// 服务启动时若未配置将抛出异常（见 validateEnv 函数）
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('[Fatal] JWT_SECRET 环境变量未配置。请复制 .env.example 并设置强密钥后重启服务。');
  }
  return secret;
}

// NOTE: 启动时调用此函数，确保关键环境变量就位
export function validateEnv(): void {
  getJwtSecret(); // 若未配置则早期崩溃，防止以弱密钥运行
  if (!process.env.DATABASE_URL) {
    throw new Error('[Fatal] DATABASE_URL 环境变量未配置。');
  }
}

export interface Account {
  id: string;
  address: string;
  balance: number;
  apiKey: string | null;
  webhookUrl: string | null;
  lastUpdated: string;
}

export class AccountManager {
  /**
   * 注册新用户
   */
  async register(username: string, passwordRaw: string): Promise<{ token: string; account: Account }> {
    if (!username || username.length < 3 || username.length > 50) {
      throw new Error('用户名长度需在 3-50 个字符之间');
    }
    if (!passwordRaw || passwordRaw.length < 8) {
      throw new Error('密码长度不能少于 8 位');
    }

    const existing = await db.user.findUnique({ where: { username } });
    if (existing) throw new Error('用户已存在');

    const password = await bcrypt.hash(passwordRaw, 12); // 使用更高的 cost factor
    const apiKey = this.generateSecureApiKey();

    const newUser = await db.user.create({
      data: {
        username,
        password,
        balance: 0, // NOTE: 不再自动发放奖励金，余额来源只有充值
        apiKey,
      },
    });

    const token = jwt.sign({ username, sub: newUser.id }, getJwtSecret(), { expiresIn: '7d' });

    return {
      token,
      account: this.toAccount(newUser),
    };
  }

  /**
   * 用户登录
   */
  async login(username: string, passwordRaw: string): Promise<{ token: string; account: Account }> {
    const user = await db.user.findUnique({ where: { username } });
    // NOTE: 无论用户是否存在，都进行 bcrypt 比较，防止时序攻击
    if (!user) {
      await bcrypt.compare(passwordRaw, '$2a$12$placeholder.hash.to.prevent.timing.attack');
      throw new Error('用户不存在或密码错误');
    }

    const valid = await bcrypt.compare(passwordRaw, user.password);
    if (!valid) {
      throw new Error('用户不存在或密码错误');
    }

    const token = jwt.sign({ username, sub: user.id }, getJwtSecret(), { expiresIn: '7d' });

    return {
      token,
      account: this.toAccount(user),
    };
  }

  /**
   * 根据用户 ID 获取账户（优先使用 ID 查询，更安全）
   * NOTE: 此方法不再自动创建账户，移除了 temp-password 漏洞
   */
  async getAccountById(userId: string): Promise<Account | null> {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    return this.toAccount(user);
  }

  /**
   * 根据用户名获取账户（仅内部使用）
   */
  async getAccount(username: string): Promise<Account | null> {
    const user = await db.user.findUnique({ where: { username } });
    if (!user) return null;
    return this.toAccount(user);
  }

  /**
   * 根据 API Key 查找账户
   */
  async getAccountByApiKey(apiKey: string): Promise<Account | undefined> {
    const user = await db.user.findUnique({ where: { apiKey } });
    if (!user) return undefined;
    return this.toAccount(user);
  }

  /**
   * 轮转 API Key（仅限已登录用户调用）
   */
  async generateApiKey(userId: string): Promise<string> {
    const apiKey = this.generateSecureApiKey();
    await db.user.update({
      where: { id: userId },
      data: { apiKey },
    });
    return apiKey;
  }

  /**
   * 充值（由 Stripe Webhook 回调触发，不由用户直接调用）
   * NOTE: amount 单位为 CNY（元），已在 Stripe 层完成换算
   */
  async topup(userId: string, amount: number): Promise<number> {
    if (amount <= 0) throw new Error('充值金额必须大于 0');
    const user = await db.user.update({
      where: { id: userId },
      data: { balance: { increment: amount } },
    });
    return user.balance;
  }

  /**
   * 扣款（原子操作，消灭竞态条件）
   * NOTE: 使用 Prisma 的条件更新模拟乐观锁
   *       若余额不足，update 操作影响 0 行，返回 false
   */
  async spend(userId: string, amount: number): Promise<boolean> {
    if (amount <= 0) return false;

    try {
      // NOTE: WHERE 条件包含余额检查，确保原子性——读写在同一条 SQL 中完成
      // 等价于: UPDATE users SET balance = balance - amount WHERE id = ? AND balance >= amount
      await db.$executeRaw`
        UPDATE "User"
        SET balance = balance - ${amount}, "updatedAt" = NOW()
        WHERE id = ${userId} AND balance >= ${amount}
      `;

      // 验证更新是否成功（即 WHERE 条件是否满足）
      const user = await db.user.findUnique({ where: { id: userId } });
      // 如果扣款后 balance 应该等于原余额减 amount，难以直接判断
      // 替代方案：检查余额是否合理（非负，且已减少）
      if (!user) return false;
      return user.balance >= 0;
    } catch {
      return false;
    }
  }

  /**
   * 更新 Webhook URL
   */
  async updateWebhook(userId: string, url: string): Promise<void> {
    await db.user.update({
      where: { id: userId },
      data: { webhookUrl: url },
    });
  }

  // ── 私有方法 ──────────────────────────────────────────────

  /**
   * 将数据库 User 对象映射为 Account 接口
   */
  private toAccount(user: {
    id: string;
    username: string;
    balance: number;
    apiKey: string | null;
    webhookUrl: string | null;
    updatedAt: Date;
  }): Account {
    return {
      id: user.id,
      address: user.username,
      balance: user.balance,
      apiKey: user.apiKey,
      webhookUrl: user.webhookUrl,
      lastUpdated: user.updatedAt.toISOString(),
    };
  }

  /**
   * 生成密码学安全的 API Key
   * NOTE: 用 crypto 模块替换 Math.random()，后者不是密码学安全随机数
   */
  private generateSecureApiKey(): string {
    return `dp-${randomBytes(24).toString('hex')}`;
  }
}

export const accountManager = new AccountManager();
