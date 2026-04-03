import axios, { AxiosInstance } from 'axios';
import { DiscoveryResponse, PaymentHeader, PaymentRequirement } from './types.js';

export interface Nexus402ClientConfig {
  baseUrl: string;
  payerId?: string;
  apiKey?: string;
  autoPay?: boolean;
}

export class Nexus402Client {
  private client: AxiosInstance;
  private config: Nexus402ClientConfig;

  constructor(config: Nexus402ClientConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      validateStatus: () => true, // Handle 402 manually
    });
  }

  /**
   * 发现可用的数据资产
   */
  async discover(): Promise<DiscoveryResponse> {
    const res = await this.client.get('/.well-known/x402-assets.json');
    if (res.status !== 200) {
      throw new Error(`Discovery failed: ${res.status}`);
    }
    return res.data;
  }

  /**
   * 发起带 402 自动处理的请求
   */
  async request<T>(endpoint: string, options: any = {}): Promise<T> {
    let response = await this.client.request({
      url: endpoint,
      ...options,
    });

    // 如果收到 402 且开启了自动支付
    if (response.status === 402 && this.config.autoPay) {
      const requirement: PaymentRequirement = response.data;
      const paymentHeader = await this.simulatedPayment(requirement);
      
      // 携带支付凭证重试
      const p = paymentHeader;
      const headerString = `${p.scheme};${p.network};${p.token};${p.amount};${p.payer};${p.signature};${p.timestamp}`;
      
      response = await this.client.request({
        url: endpoint,
        ...options,
        headers: {
          ...options.headers,
          'X-PAYMENT': headerString,
        },
      });
    }

    if (response.status !== 200) {
      throw new Error(`Request failed with status ${response.status}: ${JSON.stringify(response.data)}`);
    }

    return response.data;
  }

  /**
   * 使用自然语言查询数据（通过智能网关）
   */
  async ask<T>(query: string, address?: string): Promise<T> {
    const res = await this.client.get('/api/v1/agent/ask', {
      params: { q: query, address: address || this.config.payerId },
      headers: this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}
    });
    
    if (res.status !== 200) {
      throw new Error(`Agent Ask failed: ${JSON.stringify(res.data)}`);
    }
    return res.data;
  }

  /**
   * 获取账号余额
   */
  async getBalance(address?: string): Promise<{ address: string; balance: number; lastUpdated: string }> {
    const res = await this.client.get('/api/v1/account/balance', {
      params: { address: address || this.config.payerId },
      headers: this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}
    });

    if (res.status !== 200) {
      throw new Error(`Get Balance failed: ${JSON.stringify(res.data)}`);
    }
    return res.data;
  }

  /**
   * 模拟支付过程 (POC 阶段)
   */
  private async simulatedPayment(requirement: PaymentRequirement): Promise<PaymentHeader> {
    const method = requirement.accepts[0];
    return {
      scheme: method.scheme,
      network: method.network,
      token: method.token,
      amount: method.amount,
      payer: this.config.payerId || 'simulated-agent',
      signature: `sim-sig-${Math.random().toString(36).substring(7)}`,
      timestamp: Date.now(),
    };
  }
}
