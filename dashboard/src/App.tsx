import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Database, 
  DollarSign, 
  Activity, 
  Plus, 
  Link as LinkIcon,
  Server,
  RefreshCw,
  Search,
  Globe,
  Key,
  Copy,
  TrendingUp
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

// === Types ===
interface Asset {
  id: string;
  name: string;
  price: number;
  currency: string;
  totalQueries: number;
  totalRevenue: number;
  sourceType: string;
  description: string;
  tags: string[];
}

interface ServerStatus {
  running: boolean;
  port: number;
  assets: Asset[];
  totalQueries: number;
  totalRevenue: number;
  uptime: number;
}

// === API Fetcher ===
const API_BASE = 'http://localhost:4020';

export default function App() {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form State
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishForm, setPublishForm] = useState({
    name: '',
    source: '',
    sourceType: 'json',
    price: '0.1',
    description: '',
    tags: '',
  });
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'market' | 'wallet' | 'lab' | 'analytics'>('dashboard');
  const [marketSearch, setMarketSearch] = useState('');
  const [marketAssets, setMarketAssets] = useState<Asset[]>([]);
  const [account, setAccount] = useState<any>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [labQuery, setLabQuery] = useState('');
  const [labResult, setLabResult] = useState<any>(null);
  const [isLabLoading, setIsLabLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  /**
   * 根据 analyticsData 动态计算近 7 天营收增长率
   * 对比后半段 vs 前半段的日均营收
   */
  const revenueGrowth = (() => {
    if (analyticsData.length < 2) return null;
    const mid = Math.floor(analyticsData.length / 2);
    const firstHalf = analyticsData.slice(0, mid);
    const secondHalf = analyticsData.slice(mid);
    const avgFirst = firstHalf.reduce((s: number, d: any) => s + d.revenue, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s: number, d: any) => s + d.revenue, 0) / secondHalf.length;
    if (avgFirst === 0) return avgSecond > 0 ? 100 : 0;
    return ((avgSecond - avgFirst) / avgFirst) * 100;
  })();

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/status`);
      if (!res.ok) throw new Error('API server not running');
      const data = await res.json();
      setStatus(data);
      setError('');
    } catch (err: any) {
      setError('无法连接到 DataPay 核心引擎。请确保已运行 wrap402 serve');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const searchAssets = async (query: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setMarketAssets(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAccount = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/account/balance?address=demo-user`);
      const data = await res.json();
      setAccount(data);
      if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/analytics/stats`);
      const data = await res.json();
      setAnalyticsData(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTopup = async () => {
    try {
      await fetch(`${API_BASE}/api/v1/account/topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: 'demo-user', amount: 50 })
      });
      await fetchAccount();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRotateKey = async () => {
    if (!window.confirm('确定要轮转 API Key 吗？旧的 Key 将立即失效。')) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/account/keys/rotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: 'demo-user' })
      });
      const data = await res.json();
      if (data.success) {
        await fetchAccount();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateWebhook = async () => {
    if (!account) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/account/webhook`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${account.apiKey}`
        },
        body: JSON.stringify({ address: 'demo-user', url: webhookUrl })
      });
      const data = await res.json();
      if (data.success) alert('Webhook 配置成功！');
    } catch (e) {
      alert('Webhook 更新失败');
    }
  };

  const handleAgentAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labQuery) return;
    setIsLabLoading(true);
    setLabResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/agent/ask?q=${encodeURIComponent(labQuery)}&address=demo-user`);
      const data = await res.json();
      setLabResult(data);
      await fetchAccount(); // Refresh balance
    } catch (err: any) {
      setLabResult({ error: err.message });
    } finally {
      setIsLabLoading(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPublishing(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...publishForm,
          price: parseFloat(publishForm.price)
        })
      });
      if (!res.ok) throw new Error('发布失败');
      
      await fetchStatus();
      setShowPublishModal(false);
      setPublishForm({ name: '', source: '', sourceType: 'json', price: '0.1', description: '', tags: '' });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    searchAssets('');
    fetchAccount();
    fetchAnalytics();
    const timer = setInterval(() => {
      fetchStatus();
      fetchAccount();
      fetchAnalytics();
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30">
      
      <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Database className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              DataPay
            </span>
            <div className="ml-10 flex items-center gap-1 bg-slate-900/50 p-1 rounded-xl border border-white/5">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-200'}`}
              >
                控制中心
              </button>
              <button 
                onClick={() => setActiveTab('market')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'market' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-200'}`}
              >
                资源市场
              </button>
              <button 
                onClick={() => setActiveTab('wallet')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'wallet' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-200'}`}
              >
                账户余额
              </button>
              <button 
                onClick={() => setActiveTab('lab')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'lab' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Agent 实验室
              </button>
              <button 
                onClick={() => setActiveTab('analytics')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'analytics' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-200'}`}
              >
                数据分析
              </button>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${status ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
              </span>
              <span className="text-sm font-medium text-slate-300">
                {status ? `引擎运行中 (Port: ${status.port})` : '引擎已离线'}
              </span>
            </div>
            <button onClick={fetchStatus} className="p-2 rounded-md hover:bg-slate-800 transition-colors text-slate-400 hover:text-white">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => setShowPublishModal(true)} className="h-9 px-4 rounded-md bg-white text-slate-950 font-medium hover:bg-slate-200 transition-colors flex items-center gap-2">
              <Plus className="w-4 h-4" />
              发布新资产
            </button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        {error && (
          <div className="mb-8 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-400">
            <Activity className="w-5 h-5" />
            <p>{error}</p>
          </div>
        )}

        {activeTab === 'dashboard' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 p-6 transition-all hover:border-white/20 hover:bg-slate-900/80">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-slate-400">累计总营收</h3>
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400"><DollarSign className="w-5 h-5" /></div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-white tracking-tight">{status ? status.totalRevenue.toFixed(2) : '0.00'}</span>
                  <span className="text-sm text-slate-500 font-medium">CNY</span>
                </div>
              </div>
              <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 p-6 transition-all hover:border-white/20 hover:bg-slate-900/80">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-slate-400">总请求量</h3>
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400"><BarChart3 className="w-5 h-5" /></div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-white tracking-tight">{status ? status.totalQueries.toLocaleString() : '0'}</span>
                  <span className="text-sm text-slate-500 font-medium">次</span>
                </div>
              </div>
              <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 p-6 transition-all hover:border-white/20 hover:bg-slate-900/80">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-slate-400">运行资产</h3>
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400"><Server className="w-5 h-5" /></div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-white tracking-tight">{status ? status.assets.length : '0'}</span>
                  <span className="text-sm text-slate-500 font-medium">个</span>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 overflow-hidden backdrop-blur-sm">
              <div className="p-6 border-b border-white/5"><h2 className="text-lg font-bold text-white">上架资产清单</h2></div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950/50 text-slate-400">
                    <tr>
                      <th className="px-6 py-4 font-medium">资产名称</th>
                      <th className="px-6 py-4 font-medium">单价</th>
                      <th className="px-6 py-4 text-right">调用量</th>
                      <th className="px-6 py-4 text-right">收入</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {status?.assets.map((asset) => (
                      <tr key={asset.id} className="hover:bg-white/[0.02]">
                        <td className="px-6 py-4 font-medium text-slate-200">{asset.name}</td>
                        <td className="px-6 py-4"><span className="text-emerald-400">{asset.price} {asset.currency}</span></td>
                        <td className="px-6 py-4 text-right">{asset.totalQueries}</td>
                        <td className="px-6 py-4 text-right text-emerald-400">{asset.totalRevenue.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : activeTab === 'market' ? (
          <div className="space-y-8">
            <div className="flex flex-col items-center text-center max-w-2xl mx-auto py-12">
              <h1 className="text-4xl font-extrabold text-white mb-4">发现 AI 原生数据资产</h1>
              <p className="text-slate-400 mb-8">在这里，所有资产都遵循 x402 协议，支持机器对机器的自动发现与即时支付。</p>
              <div className="relative w-full max-w-lg">
                <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="text" value={marketSearch} onChange={(e) => { setMarketSearch(e.target.value); searchAssets(e.target.value); }} placeholder="语义化搜索..." className="w-full h-14 pl-12 pr-4 rounded-2xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-indigo-500 transition-all shadow-xl" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {marketAssets.map((asset: any) => (
                <div key={asset.id} className="group flex flex-col p-6 rounded-2xl border border-white/10 bg-slate-900/40 hover:bg-slate-900/60 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400"><Database className="w-6 h-6" /></div>
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider bg-indigo-500/5 px-2 py-1 rounded border border-indigo-500/20">{asset.sourceType}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-indigo-400">{asset.name}</h3>
                  <p className="text-sm text-slate-400 line-clamp-2 mb-4 flex-grow">{asset.description}</p>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {asset.tags?.map((tag: string) => (
                      <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">#{tag}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <span className="text-lg font-bold text-emerald-400">{asset.price} {asset.currency}</span>
                    <button 
                      onClick={() => setSelectedAsset(asset)}
                      className="h-9 px-4 rounded-lg bg-indigo-500/10 text-indigo-400 text-sm font-medium hover:bg-indigo-500 hover:text-white transition-all"
                    >查看文档</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'wallet' ? (
          <div className="max-w-2xl mx-auto space-y-8 py-12">
            <div className="text-center"><h1 className="text-4xl font-extrabold text-white mb-4">我的开发者账户</h1></div>
            <div className="p-8 rounded-3xl border border-white/10 bg-slate-900/50 backdrop-blur-xl relative">
              <div className="text-sm text-slate-400 mb-2">当前可用余额</div>
              <div className="flex items-baseline gap-2 mb-8">
                <span className="text-6xl font-black text-white tracking-tighter">{account ? account.balance.toFixed(2) : '0.00'}</span>
                <span className="text-xl text-slate-500 font-bold uppercase">CNY</span>
              </div>
              <div className="space-y-4 mb-8">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest flex items-center gap-2">
                       <Key className="w-3 h-3 text-indigo-400" /> API Access Key
                    </div>
                    <button 
                      onClick={handleRotateKey}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" /> 轮转密钥
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-mono text-slate-300 truncate">
                      {account?.apiKey || '••••••••••••••••'}
                    </div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(account?.apiKey || '');
                        alert('已复制到剪贴板');
                      }}
                      className="p-1 px-2 rounded bg-indigo-500/10 text-indigo-400 text-[10px] hover:bg-indigo-500/20 transition-all font-bold"
                    >
                      复制
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="text-[10px] text-slate-500 uppercase mb-1 tracking-widest">开发者 ID (Address)</div>
                  <div className="text-sm font-mono text-slate-300 truncate">{account?.address || 'demo-user'}</div>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="text-[10px] text-slate-500 uppercase mb-1 tracking-widest flex items-center gap-2">
                    <Activity className="w-3 h-3 text-emerald-400" /> Webhook 回调地址
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://your-api.com/webhooks/datapay"
                      className="flex-1 bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                    <button 
                      onClick={handleUpdateWebhook}
                      className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-[10px] font-bold hover:bg-indigo-600 transition-all"
                    >
                      保存
                    </button>
                  </div>
                </div>
              </div>
              <button onClick={handleTopup} className="w-full h-14 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-lg hover:shadow-2xl transition-all flex items-center justify-center gap-3">
                <Plus className="w-6 h-6" /> 即刻充值 50.00 CNY
              </button>
            </div>
          </div>
        ) : activeTab === 'analytics' ? (
          <div className="max-w-6xl mx-auto space-y-8 py-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row items-end justify-between gap-4 mb-8">
              <div>
                <h1 className="text-4xl font-black text-white mb-2 tracking-tight">商业洞察报告</h1>
                <p className="text-slate-400">实时追踪 DataPay 资产的全球营收与调用趋势</p>
              </div>
              <div className="flex items-center gap-3 bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 rounded-xl">
                <TrendingUp className="w-5 h-5 text-indigo-400" />
                <span className="text-sm font-bold text-indigo-100 italic">
                  过去 7 天平均营收：{revenueGrowth !== null ? `${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth.toFixed(1)}%` : '暂无数据'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Revenue Chart */}
              <div className="p-8 rounded-3xl border border-white/10 bg-slate-900/50 backdrop-blur-xl group hover:border-indigo-500/30 transition-all">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400"><DollarSign className="w-5 h-5" /></div>
                    <h2 className="text-xl font-bold text-white">营收趋势 (CNY)</h2>
                  </div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">7 Day History</span>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analyticsData}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                        itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Queries Chart */}
              <div className="p-8 rounded-3xl border border-white/10 bg-slate-900/50 backdrop-blur-xl group hover:border-indigo-500/30 transition-all">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400"><BarChart3 className="w-5 h-5" /></div>
                    <h2 className="text-xl font-bold text-white">调用频次 (Requests)</h2>
                  </div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">7 Day Activity</span>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analyticsData}>
                      <defs>
                        <linearGradient id="colorQueries" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                        itemStyle={{ color: '#6366f1', fontWeight: 'bold' }}
                      />
                      <Area type="monotone" dataKey="queries" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorQueries)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="p-8 rounded-3xl border border-white/10 bg-slate-900/50 backdrop-blur-xl">
               <h2 className="text-xl font-bold text-white mb-6">头部资产营收贡献率</h2>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {status?.assets.slice(0, 3).map((asset) => (
                   <div key={asset.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                     <div>
                       <div className="text-sm font-bold text-white">{asset.name}</div>
                       <div className="text-[10px] text-slate-500 uppercase">{asset.sourceType}</div>
                     </div>
                     <div className="text-right">
                       <div className="text-lg font-black text-emerald-400">¥{asset.totalRevenue.toFixed(2)}</div>
                       <div className="text-[10px] text-slate-500">{asset.totalQueries} 次查询</div>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-8 py-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h1 className="text-4xl font-extrabold text-white mb-4">Smart Agent 实验室</h1>
              <p className="text-slate-400">输入人话，DataPay 自动搜寻最高匹配资产并代其付费取数。</p>
            </div>
            <form onSubmit={handleAgentAsk} className="relative flex gap-2">
              <input type="text" value={labQuery} onChange={(e) => setLabQuery(e.target.value)} placeholder="试试：帮我查一下硅谷的鼠标价格..." className="flex-1 h-16 pl-6 pr-4 rounded-xl bg-slate-900 border border-white/10 text-white text-lg focus:outline-none focus:border-indigo-500 transition-all shadow-2xl" />
              <button type="submit" disabled={isLabLoading} className="h-16 px-8 rounded-xl bg-white text-slate-950 font-bold hover:bg-slate-200 disabled:opacity-50 transition-all flex items-center gap-3">
                {isLabLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Activity className="w-5 h-5" />}
                执行 Agent 调用
              </button>
            </form>
            {labResult && (
              <div className="rounded-2xl border border-white/10 bg-slate-900/80 overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-white/10 bg-slate-950/50 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 tracking-widest">GATEWAY TRACE</span>
                  {labResult.matched_asset && <span className="text-xs text-indigo-400">已自动购买: {labResult.matched_asset}</span>}
                </div>
                <pre className="p-6 text-sm font-mono text-indigo-300 overflow-auto max-h-[500px]">
                  {JSON.stringify(labResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Publish Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-6 relative">
            <h2 className="text-xl font-bold text-white mb-4">封装发布新资产</h2>
            <form onSubmit={handlePublish} className="space-y-4">
              <div className="flex gap-2 p-1 bg-slate-950 rounded-xl border border-white/5">
                <button type="button" onClick={() => setPublishForm({...publishForm, sourceType: 'json'})} className={`flex-1 py-1 rounded-lg text-xs ${publishForm.sourceType === 'json' ? 'bg-indigo-500 text-white' : 'text-slate-500'}`}>文件</button>
                <button type="button" onClick={() => setPublishForm({...publishForm, sourceType: 'api'})} className={`flex-1 py-1 rounded-lg text-xs ${publishForm.sourceType === 'api' ? 'bg-indigo-500 text-white' : 'text-slate-500'}`}>API</button>
                <button type="button" onClick={() => setPublishForm({...publishForm, sourceType: 'scraper'})} className={`flex-1 py-1 rounded-lg text-xs ${publishForm.sourceType === 'scraper' ? 'bg-indigo-500 text-white' : 'text-slate-500'}`}>抓取</button>
              </div>
              <input required type="text" value={publishForm.name} onChange={e => setPublishForm({...publishForm, name: e.target.value})} className="w-full h-10 px-3 rounded-lg bg-slate-950 border border-white/10 text-white" placeholder="资产名称" />
              <input required type="text" value={publishForm.source} onChange={e => setPublishForm({...publishForm, source: e.target.value})} className="w-full h-10 px-3 rounded-lg bg-slate-950 border border-white/10 text-white" placeholder={publishForm.sourceType === 'scraper' ? '目标网页 URL' : '数据来源 (文件路径或 URL)'} />
              <input required type="number" step="0.01" value={publishForm.price} onChange={e => setPublishForm({...publishForm, price: e.target.value})} className="w-full h-10 px-3 rounded-lg bg-slate-950 border border-white/10 text-white" placeholder="单价" />
              <textarea rows={2} value={publishForm.description} onChange={e => setPublishForm({...publishForm, description: e.target.value})} className="w-full p-3 rounded-lg bg-slate-950 border border-white/10 text-white" placeholder="描述"></textarea>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowPublishModal(false)} className="flex-1 h-10 rounded-lg bg-slate-800">取消</button>
                <button type="submit" disabled={isPublishing} className="flex-1 h-10 rounded-lg bg-indigo-500">{isPublishing ? '提交中...' : '提交'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Asset Detail Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm" onClick={() => setSelectedAsset(null)}>
          <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-6 relative" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">{selectedAsset.name}</h2>
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/20">{selectedAsset.sourceType}</span>
              </div>
              <button onClick={() => setSelectedAsset(null)} className="text-slate-500 hover:text-white text-2xl leading-none">×</button>
            </div>
            <p className="text-sm text-slate-400 mb-6">{selectedAsset.description}</p>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">API 端点</div>
                <code className="text-sm text-emerald-400 font-mono">GET {API_BASE}/api/v1/data/{selectedAsset.id}</code>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">单次调用费用</div>
                <span className="text-lg font-bold text-emerald-400">{selectedAsset.price} {selectedAsset.currency}</span>
              </div>
              {selectedAsset.tags && selectedAsset.tags.length > 0 && (
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">标签</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedAsset.tags.map((tag: string) => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">#{tag}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Agent 调用示例</div>
                <pre className="text-xs font-mono text-indigo-300 overflow-auto whitespace-pre-wrap">{`curl -H "X-PAYMENT: x402;internal;${selectedAsset.currency};${selectedAsset.price};your-agent-id;your-sig;$(date +%s%3N)" \
  ${API_BASE}/api/v1/data/${selectedAsset.id}`}</pre>
              </div>
            </div>
            <button onClick={() => setSelectedAsset(null)} className="mt-6 w-full h-10 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors">关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}
