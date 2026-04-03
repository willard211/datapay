import { useState, useEffect, useCallback } from 'react';
import { Activity } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

// === Pages ===
import LandingPage from './pages/LandingPage';
import Layout from './components/Layout';
import AuthModal from './components/AuthModal';
import Dashboard from './pages/Dashboard';
import Market from './pages/Market';
import Wallet from './pages/Wallet';
import Lab from './pages/Lab';
import Analytics from './pages/Analytics';

// === Modals ===
import PublishModal from './components/modals/PublishModal';
import TopupModal from './components/modals/TopupModal';
import AssetDetailModal from './components/modals/AssetDetailModal';

// === Types ===
import type { Asset, ServerStatus } from './types';

// NOTE: 从 Vite 环境变量读取后端地址，支持本地/生产多环境部署
// 本地开发：在 dashboard/.env.local 设置 VITE_API_BASE_URL=http://localhost:4021
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4021';

// NOTE: 统一鉴权请求封装，拦截 401 自动清除 token 并触发登出
const createFetchAuth = (onUnauthorized: () => void) => async (url: string, options: any = {}) => {
  const token = localStorage.getItem('datapay_token');
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    onUnauthorized();
  }
  return res;
};

export default function App() {
  // --- Auth State ---
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('datapay_token'));
  // NOTE: showAuthModal 控制登录/注册弹窗，未登录时主页始终可见
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // --- Data State ---
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'market' | 'wallet' | 'lab' | 'analytics'>('dashboard');
  const [account, setAccount] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [myAssets, setMyAssets] = useState<Asset[]>([]);

  // --- Market State ---
  const [marketSearch, setMarketSearch] = useState('');
  const [marketAssets, setMarketAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  // --- Modal State ---
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishForm, setPublishForm] = useState({
    name: '', source: '', sourceType: 'json', price: '0.1', description: '', tags: '',
  });
  const [isPublishing, setIsPublishing] = useState(false);

  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupMethod, setTopupMethod] = useState<'stripe' | 'domestic'>('domestic');
  const [topupAmount, setTopupAmount] = useState('50');
  const [isTopupProcessing, setIsTopupProcessing] = useState(false);

  // --- Lab State ---
  const [labQuery, setLabQuery] = useState('');
  const [labResult, setLabResult] = useState<any>(null);
  const [isLabLoading, setIsLabLoading] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');

  // NOTE: 统一登出逻辑（401 自动触发 or 用户手动）
  const handleLogout = useCallback(() => {
    localStorage.removeItem('datapay_token');
    setToken(null);
    setStatus(null);
    setAccount(null);
    setMyAssets([]);
  }, []);

  // NOTE: fetchAuth 依赖 handleLogout，需在其之后创建
  const fetchAuth = useCallback(
    (url: string, options: any = {}) => createFetchAuth(handleLogout)(url, options),
    [handleLogout]
  );

  // --- Logic Helpers ---
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetchAuth(`${API_BASE}/status`);
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
  }, [fetchAuth]);

  const fetchAccount = useCallback(async () => {
    try {
      const res = await fetchAuth(`${API_BASE}/api/v1/account/balance`);
      if (!res.ok) return;
      const data = await res.json();
      setAccount(data);
      if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
    } catch (err) {
      console.error(err);
    }
  }, [fetchAuth]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetchAuth(`${API_BASE}/api/v1/analytics/stats`);
      if (!res.ok) return;
      const data = await res.json();
      setAnalyticsData(data);
    } catch (err) {
      console.error(err);
    }
  }, [fetchAuth]);

  /**
   * 获取当前用户自己发布的资产（多租户隔离）
   */
  const fetchMyAssets = useCallback(async () => {
    try {
      const res = await fetchAuth(`${API_BASE}/api/v1/my-assets`);
      if (!res.ok) return;
      const data = await res.json();
      setMyAssets(data);
    } catch (err) {
      console.error(err);
    }
  }, [fetchAuth]);

  const searchAssets = useCallback(async (query: string) => {
    try {
      const res = await fetchAuth(`${API_BASE}/api/v1/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setMarketAssets(data);
    } catch (err) {
      console.error(err);
    }
  }, [fetchAuth]);

  // --- Handlers ---
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthError('');
    try {
      const endpoint = authMode === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/register';
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '认证失败');
      localStorage.setItem('datapay_token', data.token);
      setToken(data.token);
      setShowAuthModal(false); // 登录成功后关闭弹窗
      toast.success(authMode === 'login' ? '登录成功！欢迎回来 👋' : '注册成功！已自动登录');
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  /**
   * 发起 Stripe 充值
   * NOTE: 调用后端创建 PaymentIntent，拿到 clientSecret 后跳转 Stripe Hosted Payment Page
   *       实际到账由后端 Stripe Webhook 回调处理，确保支付真实可靠
   */
  const handleTopup = async () => {
    setIsTopupProcessing(true);
    const loadingToast = toast.loading('正在创建支付订单...');
    try {
      const amountNum = parseFloat(topupAmount);
      if (isNaN(amountNum) || amountNum < 1) {
        throw new Error('充值金额最小为 1 CNY');
      }

      if (topupMethod === 'stripe') {
        // 向后端请求 PaymentIntent
        const res = await fetchAuth(`${API_BASE}/api/v1/payment/create-intent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: amountNum }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Stripe 支付初始化失败');
        }
        const { paymentIntentId } = await res.json();
        // 跳转 Stripe 完成支付（使用 Stripe Checkout URL）
        // 实际充值到账由后端 Webhook 处理
        toast.success(
          `Stripe 支付订单已创建 (${paymentIntentId.substring(0, 12)}...)，请在 Stripe 弹窗中完成支付。支付成功后余额将自动更新。`,
          { id: loadingToast, duration: 6000 }
        );
        setShowTopupModal(false);
        // NOTE: 实际项目中此处应跳转 Stripe Payment Element 页面或嵌入 Stripe Elements 表单
        // 完整流程：Stripe.js 渲染 → 用户输入卡信息 → stripe.confirmPayment() → Webhook 到账
      } else {
        // 境内支付（微信/支付宝）— 预留入口，待接入聚合支付 SDK
        toast.error('境内支付通道正在接入中，敬请期待！', { id: loadingToast });
      }
    } catch (err: any) {
      toast.error(err.message, { id: loadingToast });
    } finally {
      setIsTopupProcessing(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPublishing(true);
    const loadingToast = toast.loading('正在发布资产...');
    try {
      const res = await fetchAuth(`${API_BASE}/api/v1/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...publishForm, price: parseFloat(publishForm.price) })
      });
      if (!res.ok) throw new Error('发布失败');
      await Promise.all([fetchStatus(), fetchMyAssets()]);
      setShowPublishModal(false);
      setPublishForm({ name: '', source: '', sourceType: 'json', price: '0.1', description: '', tags: '' });
      toast.success('资产发布成功 🚀', { id: loadingToast });
    } catch (err: any) {
      toast.error(err.message, { id: loadingToast });
    } finally {
      setIsPublishing(false);
    }
  };

  /**
   * 下架资产：DELETE /api/v1/assets/:id
   */
  const handleDeleteAsset = useCallback(async (assetId: string, assetName: string) => {
    if (!window.confirm(`确定要下架资产「${assetName}」吗？此操作不可逆。`)) return;
    const loadingToast = toast.loading(`正在下架「${assetName}」...`);
    try {
      const res = await fetchAuth(`${API_BASE}/api/v1/assets/${assetId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '下架失败');
      await Promise.all([fetchStatus(), fetchMyAssets()]);
      toast.success(data.message || '资产已成功下架', { id: loadingToast });
    } catch (err: any) {
      toast.error(err.message, { id: loadingToast });
    }
  }, [fetchAuth, fetchStatus, fetchMyAssets]);

  const handleAgentAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labQuery) return;
    setIsLabLoading(true);
    setLabResult(null);
    try {
      const res = await fetchAuth(`${API_BASE}/api/v1/agent/ask?q=${encodeURIComponent(labQuery)}`);
      const data = await res.json();
      setLabResult(data);
      await fetchAccount(); 
    } catch (err: any) {
      setLabResult({ error: err.message });
    } finally {
      setIsLabLoading(false);
    }
  };

  const handleRotateKey = async () => {
    if (!window.confirm('确定要轮转 API Key 吗？旧 Key 将立即失效。')) return;
    const loadingToast = toast.loading('正在生成新的 API Key...');
    try {
      const res = await fetchAuth(`${API_BASE}/api/v1/account/keys/rotate`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchAccount();
        toast.success('API Key 已成功轮转！', { id: loadingToast });
      }
    } catch (err) {
      toast.error('轮转失败，请重试', { id: loadingToast });
    }
  };

  const handleUpdateWebhook = async () => {
    const loadingToast = toast.loading('正在保存 Webhook 配置...');
    try {
      const res = await fetchAuth(`${API_BASE}/api/v1/account/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl })
      });
      if ((await res.json()).success) {
        toast.success('Webhook 配置已保存！', { id: loadingToast });
      }
    } catch (e) {
      toast.error('Webhook 更新失败', { id: loadingToast });
    }
  };

  // --- Effects ---
  useEffect(() => {
    if (token) {
      fetchStatus();
      searchAssets('');
      fetchAccount();
      fetchAnalytics();
      fetchMyAssets();
      // NOTE: 从 5s 改为 30s，减少不必要的心跳请求压力
      const timer = setInterval(() => {
        fetchStatus();
        fetchAccount();
        fetchAnalytics();
        fetchMyAssets();
      }, 30000);
      return () => clearInterval(timer);
    }
  }, [token, fetchStatus, fetchAccount, fetchAnalytics, fetchMyAssets, searchAssets]);

  // --- Growth Calc ---
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

  // NOTE: 三层路由：主页（公开） → 登录弹窗（叠加在主页上） → Dashboard（需鉴权）
  if (!token) {
    return (
      <>
        <Toaster position="top-right" toastOptions={{ style: { background: '#0f172a', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)' } }} />
        <LandingPage
          onOpenAuth={(mode) => {
            setAuthMode(mode);
            setAuthError('');
            setAuthForm({ username: '', password: '' });
            setShowAuthModal(true);
          }}
        />
        {showAuthModal && (
          <AuthModal
            mode={authMode} setMode={setAuthMode}
            form={authForm} setForm={setAuthForm}
            onSubmit={handleAuth}
            onClose={() => { setShowAuthModal(false); setAuthError(''); }}
            error={authError} setError={setAuthError}
            isAuthenticating={isAuthenticating}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { background: '#0f172a', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)' } }} />
      <Layout
        activeTab={activeTab} setActiveTab={setActiveTab}
        status={status} loading={loading}
        onRefreshStatus={fetchStatus}
        onOpenPublish={() => setShowPublishModal(true)}
        onLogout={handleLogout}
        username={account?.address}
      >
        {error && (
          <div className="mb-8 p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-4 text-rose-400 animate-in fade-in slide-in-from-top-4">
            <Activity className="w-6 h-6" />
            <p className="font-bold text-sm tracking-wide uppercase">{error}</p>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <Dashboard status={status} myAssets={myAssets} onDeleteAsset={handleDeleteAsset} />
        )}
        {activeTab === 'market' && (
          <Market 
            searchQuery={marketSearch} 
            onSearchChange={(q) => { setMarketSearch(q); searchAssets(q); }} 
            assets={marketAssets} 
            onOpenDetail={(asset) => setSelectedAsset(asset)} 
          />
        )}
        {activeTab === 'wallet' && (
          <Wallet 
            account={account} 
            webhookUrl={webhookUrl} 
            setWebhookUrl={setWebhookUrl} 
            onUpdateWebhook={handleUpdateWebhook} 
            onRotateKey={handleRotateKey} 
            onOpenTopup={() => setShowTopupModal(true)} 
            apiBase={API_BASE}
            fetchAuth={fetchAuth}
          />
        )}
        {activeTab === 'analytics' && <Analytics analyticsData={analyticsData} revenueGrowth={revenueGrowth} status={status} />}
        {activeTab === 'lab' && (
          <Lab 
            labQuery={labQuery} setLabQuery={setLabQuery} 
            onAsk={handleAgentAsk} 
            isLabLoading={isLabLoading} 
            labResult={labResult} 
          />
        )}

        {/* Modals */}
        <PublishModal 
          show={showPublishModal} onClose={() => setShowPublishModal(false)} 
          onPublish={handlePublish} 
          form={publishForm} setForm={setPublishForm} 
          isPublishing={isPublishing} 
        />
        
        <TopupModal 
          show={showTopupModal} onClose={() => setShowTopupModal(false)} 
          onTopup={handleTopup} 
          amount={topupAmount} setAmount={setTopupAmount} 
          method={topupMethod} setMethod={setTopupMethod} 
          isProcessing={isTopupProcessing} 
        />
        
        <AssetDetailModal 
          asset={selectedAsset} onClose={() => setSelectedAsset(null)} 
          apiBase={API_BASE} 
        />
      </Layout>
    </>
  );
}
