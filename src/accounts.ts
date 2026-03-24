import { db } from './lib/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'datapay-dev-secret-super-safe';

export interface Account {
  address: string;
  balance: number;
  apiKey: string | null;
  webhookUrl: string | null;
  lastUpdated: string;
}

export class AccountManager {
  async register(username: string, passwordRaw: string): Promise<{ token: string, account: Account }> {
    const existing = await db.user.findUnique({ where: { username } });
    if (existing) throw new Error('用户已存在');

    const password = await bcrypt.hash(passwordRaw, 10);
    const apiKey = `dp-${Math.random().toString(36).substring(2, 15)}`;
    
    const newUser = await db.user.create({
      data: {
        username,
        password,
        balance: 10.0, // Initial bonus
        apiKey
      }
    });

    const token = jwt.sign({ username, sub: newUser.id }, JWT_SECRET, { expiresIn: '7d' });
    
    return {
      token,
      account: {
        address: newUser.username,
        balance: newUser.balance,
        apiKey: newUser.apiKey,
        webhookUrl: newUser.webhookUrl,
        lastUpdated: newUser.updatedAt.toISOString(),
      }
    };
  }

  async login(username: string, passwordRaw: string): Promise<{ token: string, account: Account }> {
    const user = await db.user.findUnique({ where: { username } });
    if (!user) throw new Error('用户不存在或密码错误');

    const valid = await bcrypt.compare(passwordRaw, user.password);
    if (!valid && user.password !== 'temp-password') {
       throw new Error('用户不存在或密码错误');
    }

    const token = jwt.sign({ username, sub: user.id }, JWT_SECRET, { expiresIn: '7d' });
    
    return {
      token,
      account: {
        address: user.username,
        balance: user.balance,
        apiKey: user.apiKey,
        webhookUrl: user.webhookUrl,
        lastUpdated: user.updatedAt.toISOString(),
      }
    };
  }

  async getAccount(address: string): Promise<Account> {
    const user = await db.user.findUnique({ where: { username: address } });
    if (!user) {
      // Auto-create with welcome bonus for POC backward compatibility
      const apiKey = `dp-${Math.random().toString(36).substring(2, 15)}`;
      const newUser = await db.user.create({
        data: {
          username: address,
          password: 'temp-password', // Will be changed when user officially registers
          balance: 10.0,
          apiKey: apiKey
        }
      });
      return {
        address: newUser.username,
        balance: newUser.balance,
        apiKey: newUser.apiKey,
        webhookUrl: newUser.webhookUrl,
        lastUpdated: newUser.updatedAt.toISOString(),
      };
    }

    return {
      address: user.username,
      balance: user.balance,
      apiKey: user.apiKey,
      webhookUrl: user.webhookUrl,
      lastUpdated: user.updatedAt.toISOString(),
    };
  }

  async getAccountByApiKey(apiKey: string): Promise<Account | undefined> {
    const user = await db.user.findUnique({ where: { apiKey } });
    if (!user) return undefined;
    
    return {
      address: user.username,
      balance: user.balance,
      apiKey: user.apiKey,
      webhookUrl: user.webhookUrl,
      lastUpdated: user.updatedAt.toISOString(),
    };
  }

  async generateApiKey(address: string): Promise<string> {
    const apiKey = `dp-${Math.random().toString(36).substring(2, 15)}`;
    await db.user.upsert({
      where: { username: address },
      create: {
        username: address,
        password: 'temp-password',
        balance: 10.0,
        apiKey
      },
      update: {
        apiKey
      }
    });
    return apiKey;
  }

  async topup(address: string, amount: number): Promise<number> {
    const user = await db.user.upsert({
      where: { username: address },
      create: {
        username: address,
        password: 'temp-password',
        balance: 10.0 + amount,
      },
      update: {
        balance: { increment: amount }
      }
    });
    return user.balance;
  }

  async spend(address: string, amount: number): Promise<boolean> {
    const user = await db.user.findUnique({ where: { username: address } });
    if (!user || user.balance < amount) return false;

    await db.user.update({
      where: { username: address },
      data: { balance: { decrement: amount } }
    });
    return true;
  }

  async updateWebhook(address: string, url: string): Promise<void> {
    await db.user.upsert({
      where: { username: address },
      create: {
        username: address,
        password: 'temp-password',
        webhookUrl: url
      },
      update: {
        webhookUrl: url
      }
    });
  }
}

export const accountManager = new AccountManager();
