import React, { useState, useEffect } from 'react';
import { Plus, Key, RefreshCw, Activity, Copy, ArrowDownLeft } from 'lucide-react';

interface Transaction {
  id: string;
  assetId: string;
  assetName: string;
  amount: number;
  type: 'spend';
  timestamp: string;
}

interface WalletProps {
  account: {
    address: string;
    balance: number;
    apiKey: string;
    webhookUrl: string;
  } | null;
  webhookUrl: string;
  setWebhookUrl: (url: string) => void;
  onUpdateWebhook: () => void;
  onRotateKey: () => void;
  onOpenTopup: () => void;
  apiBase: string;
  fetchAuth: (url: string, options?: any) => Promise<Response>;
}

const Wallet: React.FC<WalletProps> = ({
  account,
  webhookUrl,
  setWebhookUrl,
  onUpdateWebhook,
  onRotateKey,
  onOpenTopup,
  apiBase,
  fetchAuth,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  useEffect(() => {
    const loadTransactions = async () => {
      setTxLoading(true);
      try {
        const res = await fetchAuth(`${apiBase}/api/v1/transactions`);
        if (res.ok) {
          const data = await res.json();
          setTransactions(data);
        }
      } catch (e) {
        console.error('交易历史加载失败', e);
      } finally {
        setTxLoading(false);
      }
    };
    loadTransactions();
  }, [apiBase, fetchAuth]);

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold text-white mb-4 tracking-tight">我的开发者账户</h1>
        <p className="text-slate-400">管理您的支付凭证、资金余额与回调配置</p>
      </div>

      <div className="p-8 rounded-3xl border border-white/10 bg-slate-900/50 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        {/* Background glow Decor */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full"></div>
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full"></div>

        <div className="relative">
          <div className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">当前可用余额</div>
          <div className="flex items-baseline gap-2 mb-10">
            <span className="text-7xl font-black text-white tracking-tighter tabular-nums text-glow">
              {account ? account.balance.toFixed(2) : '0.00'}
            </span>
            <span className="text-xl text-slate-500 font-bold uppercase tracking-wide">CNY</span>
          </div>

          <div className="space-y-4 mb-10">
            {/* API Key Section */}
            <div className="p-5 rounded-2xl bg-slate-950/50 border border-white/5 group hover:border-white/10 transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold flex items-center gap-2">
                  <Key className="w-3 h-3 text-indigo-400" /> API Access Key
                </div>
                <button 
                  onClick={onRotateKey}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors font-bold"
                >
                  <RefreshCw className="w-3 h-3" /> 轮转密钥
                </button>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm font-mono text-slate-300 truncate tracking-tight">
                  {account?.apiKey || '••••••••••••••••••••••••••••••••'}
                </div>
                <button 
                  onClick={() => {
                    if (account?.apiKey) {
                      navigator.clipboard.writeText(account.apiKey);
                    }
                  }}
                  className="flex items-center gap-1 p-2 px-3 rounded-lg bg-indigo-500/10 text-indigo-400 text-[10px] font-bold hover:bg-indigo-500/20 transition-all border border-indigo-500/20"
                >
                  <Copy className="w-3 h-3" /> 复制
                </button>
              </div>
            </div>

            {/* Developer ID Section */}
            <div className="p-5 rounded-2xl bg-slate-950/50 border border-white/5 group hover:border-white/10 transition-all">
              <div className="text-[10px] text-slate-500 uppercase mb-2 tracking-widest font-bold">开发者 ID (Address)</div>
              <div className="text-sm font-mono text-slate-300 truncate tracking-tight">
                {account?.address || 'demo-user'}
              </div>
            </div>

            {/* Webhook Section */}
            <div className="p-5 rounded-2xl bg-slate-950/50 border border-white/5 group hover:border-white/10 transition-all">
              <div className="text-[10px] text-slate-500 uppercase mb-3 tracking-widest font-bold flex items-center gap-2">
                <Activity className="w-3 h-3 text-emerald-400" /> Webhook 支付推送回调
              </div>
              <div className="flex gap-3">
                <input 
                  type="text" 
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://your-api.com/webhooks/nexus402"
                  className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                />
                <button 
                  onClick={onUpdateWebhook}
                  className="px-5 py-2 rounded-xl bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-600 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                >
                  保存配置
                </button>
              </div>
            </div>
          </div>

          <button 
            onClick={onOpenTopup} 
            className="w-full h-16 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black text-xl hover:shadow-2xl hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            <Plus className="w-7 h-7" /> 账户充值
          </button>
        </div>
      </div>

      {/* NOTE: 近期交易历史区块，调用 /api/v1/transactions 接口 */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/50 backdrop-blur-xl overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">近期交易记录</h2>
          <span className="text-xs text-slate-500 font-mono">最近 20 条</span>
        </div>
        {txLoading ? (
          <div className="py-12 text-center text-slate-500 text-sm">加载中...</div>
        ) : transactions.length === 0 ? (
          <div className="py-12 text-center text-slate-500 italic text-sm">暂无交易记录</div>
        ) : (
          <div className="divide-y divide-white/5">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
                    <ArrowDownLeft className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-200">{tx.assetName}</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      {new Date(tx.timestamp).toLocaleString('zh-CN', { hour12: false })}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-rose-400 tabular-nums">- ¥{tx.amount.toFixed(4)}</div>
                  <div className="text-[10px] text-slate-600 uppercase font-bold">消费</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Wallet;
