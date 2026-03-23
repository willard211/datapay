import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

interface Account {
  address: string;
  balance: number;
  apiKey: string;
  webhookUrl?: string;
  lastUpdated: string;
}

const ACCOUNTS_FILE = '.wrap402-accounts.json';

export class AccountManager {
  private accounts: Map<string, Account> = new Map();
  private filePath: string;

  constructor(cwd: string = process.cwd()) {
    this.filePath = resolve(cwd, ACCOUNTS_FILE);
    this.load();
  }

  private load() {
    if (existsSync(this.filePath)) {
      try {
        const data = JSON.parse(readFileSync(this.filePath, 'utf-8'));
        Object.keys(data).forEach(addr => {
          this.accounts.set(addr, data[addr]);
        });
      } catch (e) {
        console.error('Failed to load accounts:', e);
      }
    }
  }

  private save() {
    const data: Record<string, Account> = {};
    this.accounts.forEach((acc, addr) => {
      data[addr] = acc;
    });
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  getAccount(address: string): Account {
    if (!this.accounts.has(address)) {
      const newAcc = {
        address,
        balance: 10.0, // Default welcome bonus for POC
        apiKey: `dp-${Math.random().toString(36).substring(2, 15)}`,
        lastUpdated: new Date().toISOString()
      };
      this.accounts.set(address, newAcc);
      this.save();
    }
    return this.accounts.get(address)!;
  }

  getAccountByApiKey(apiKey: string): Account | undefined {
    for (const acc of this.accounts.values()) {
      if (acc.apiKey === apiKey) return acc;
    }
    return undefined;
  }

  generateApiKey(address: string): string {
    const acc = this.getAccount(address);
    acc.apiKey = `dp-${Math.random().toString(36).substring(2, 15)}`;
    this.save();
    return acc.apiKey;
  }

  topup(address: string, amount: number): number {
    const acc = this.getAccount(address);
    acc.balance += amount;
    acc.lastUpdated = new Date().toISOString();
    this.save();
    return acc.balance;
  }

  spend(address: string, amount: number): boolean {
    const acc = this.getAccount(address);
    if (acc.balance < amount) return false;
    
    acc.balance -= amount;
    acc.lastUpdated = new Date().toISOString();
    this.save();
    return true;
  }

  updateWebhook(address: string, url: string): void {
    const acc = this.getAccount(address);
    acc.webhookUrl = url;
    acc.lastUpdated = new Date().toISOString();
    this.save();
  }
}

export const accountManager = new AccountManager();
