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
  Globe
} from 'lucide-react';

// === Types ===
interface Asset {
  id: string;
  name: string;
  price: number;
  currency: string;
  totalQueries: number;
  totalRevenue: number;
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
    price: '0.1',
    description: '',
  });
  const [isPublishing, setIsPublishing] = useState(false);

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
      setPublishForm({ name: '', source: '', price: '0.1', description: '' });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Auto refresh every 5s
    const timer = setInterval(fetchStatus, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30">
      
      {/* Navbar */}
      <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Database className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              DataPay
            </span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-medium border border-indigo-500/20 ml-2">
              Pro
            </span>
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
            <button 
              onClick={fetchStatus}
              className="p-2 rounded-md hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={() => setShowPublishModal(true)}
              className="h-9 px-4 rounded-md bg-white text-slate-950 font-medium hover:bg-slate-200 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              发布新资产
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        
        {error && (
          <div className="mb-8 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-400">
            <Activity className="w-5 h-5" />
            <p>{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card 1 */}
          <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 p-6 transition-all hover:border-white/20 hover:bg-slate-900/80">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-400">累计总营收</h3>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-white tracking-tight">
                {status ? status.totalRevenue.toFixed(2) : '0.00'}
              </span>
              <span className="text-sm text-slate-500 font-medium">CNY</span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400">
              <Activity className="w-3 h-3" />
              <span>实时结算</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 p-6 transition-all hover:border-white/20 hover:bg-slate-900/80">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-400">总 API 调用次数</h3>
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                <BarChart3 className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-white tracking-tight">
                {status ? status.totalQueries.toLocaleString() : '0'}
              </span>
              <span className="text-sm text-slate-500 font-medium">次请求</span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-purple-400">
              <Activity className="w-3 h-3" />
              <span>通过 x402 协议验证</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 p-6 transition-all hover:border-white/20 hover:bg-slate-900/80">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-400">已发布资产数</h3>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <Server className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-white tracking-tight">
                {status ? status.assets.length : '0'}
              </span>
              <span className="text-sm text-slate-500 font-medium">个数据集/API</span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-blue-400">
              <Globe className="w-3 h-3" />
              <span>全局可发现</span>
            </div>
          </div>
        </div>

        {/* Assets Table */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 overflow-hidden backdrop-blur-sm">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">上架数字资产</h2>
              <p className="text-sm text-slate-400 mt-1">你的所有可通过 x402 Micropayment 协议被 AI 调用的资产</p>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                placeholder="搜索资产..." 
                className="w-64 h-10 pl-10 pr-4 rounded-lg bg-slate-950 border border-white/10 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-white placeholder:text-slate-600"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/50 text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">资产名称</th>
                  <th className="px-6 py-4 font-medium">端点地址</th>
                  <th className="px-6 py-4 font-medium">单次售价</th>
                  <th className="px-6 py-4 font-medium text-right">调用量</th>
                  <th className="px-6 py-4 font-medium text-right">累计收入</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {!status || status.assets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      还没有发布任何资产。运行 CLI 工具包裹你的第一个 API！
                    </td>
                  </tr>
                ) : (
                  status.assets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                            <Database className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-medium text-slate-200">{asset.name}</div>
                            <div className="text-xs text-slate-500 mt-0.5 font-mono">{asset.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-400">
                          <code className="text-xs bg-slate-950 px-2 py-1 rounded border border-white/5 text-slate-300">
                            /api/v1/data/{asset.id}
                          </code>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
                          {asset.price} {asset.currency}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-slate-300 font-medium">
                        {asset.totalQueries.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right text-emerald-400 font-medium">
                        {asset.totalRevenue.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 text-slate-500 hover:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100">
                          <LinkIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Publish Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-6 relative">
            <h2 className="text-xl font-bold text-white mb-4">封装发布新资产</h2>
            <form onSubmit={handlePublish} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">资产名称</label>
                <input required type="text" value={publishForm.name} onChange={e => setPublishForm({...publishForm, name: e.target.value})} className="w-full h-10 px-3 rounded-lg bg-slate-950 border border-white/10 text-white focus:border-indigo-500 focus:outline-none" placeholder="例如：实时美元汇率" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">上游 API 源地址 (动态逆向代理)</label>
                <input required type="url" value={publishForm.source} onChange={e => setPublishForm({...publishForm, source: e.target.value})} className="w-full h-10 px-3 rounded-lg bg-slate-950 border border-white/10 text-white focus:border-indigo-500 focus:outline-none" placeholder="https://api.example.com/data" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">单次调用售价 (CNY/次)</label>
                <input required type="number" step="0.01" min="0" value={publishForm.price} onChange={e => setPublishForm({...publishForm, price: e.target.value})} className="w-full h-10 px-3 rounded-lg bg-slate-950 border border-white/10 text-white focus:border-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">介绍/描述 (供 Agent 端发现)</label>
                <textarea rows={2} value={publishForm.description} onChange={e => setPublishForm({...publishForm, description: e.target.value})} className="w-full p-3 rounded-lg bg-slate-950 border border-white/10 text-white focus:border-indigo-500 focus:outline-none" placeholder="可选填。清晰描述这个接口返回哪些数据..."></textarea>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowPublishModal(false)} className="flex-1 h-10 rounded-lg bg-slate-800 text-slate-300 font-medium hover:bg-slate-700">取消</button>
                <button type="submit" disabled={isPublishing} className="flex-1 h-10 rounded-lg bg-indigo-500 text-white font-medium hover:bg-indigo-600 disabled:opacity-50">
                  {isPublishing ? '提交中...' : '确认发布'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
