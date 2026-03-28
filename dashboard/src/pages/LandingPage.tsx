import React, { useState } from 'react';
import {
  Database,
  Zap,
  Shield,
  Globe,
  Bot,
  TrendingUp,
  ArrowRight,
  Code2,
  ChevronRight,
  Star,
} from 'lucide-react';

interface LandingPageProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
}

// 核心特性数据
const FEATURES = [
  {
    icon: Bot,
    color: 'from-indigo-500 to-purple-600',
    glow: 'indigo',
    title: 'AI 原生发现',
    desc: '内置 /.well-known/x402-assets.json，AI Agent 自动发现资产并付款，无需任何额外集成。',
  },
  {
    icon: Zap,
    color: 'from-amber-400 to-orange-500',
    glow: 'amber',
    title: '零代码秒上线',
    desc: '上传一个 JSON/CSV 文件，30 秒内即可将数据包装成收费 API，开始赚钱。',
  },
  {
    icon: Shield,
    color: 'from-emerald-400 to-teal-500',
    glow: 'emerald',
    title: 'HTTP 402 协议',
    desc: '基于 Web 原生的支付标准，天然防盗用、防滥用，无需额外鉴权开发。',
  },
  {
    icon: Globe,
    color: 'from-sky-400 to-blue-600',
    glow: 'sky',
    title: '混合全球结算',
    desc: '支持境内聚合支付与 Stripe 全球结算，一键配置，轻松触达海外 AI 开发者市场。',
  },
  {
    icon: TrendingUp,
    color: 'from-rose-400 to-pink-600',
    glow: 'rose',
    title: '实时商业洞察',
    desc: '动态营收曲线、调用量趋势、资产排行榜，一切尽在赛博风格仪表盘中一览无余。',
  },
  {
    icon: Code2,
    color: 'from-violet-400 to-purple-600',
    glow: 'violet',
    title: 'TypeScript SDK',
    desc: '极简 DataPayClient，三行代码完成资产发现→自动付款→数据获取的完整闭环。',
  },
];

const STEPS = [
  { step: '01', title: '注册开发者账号', desc: '30 秒完成注册，免费赠送 10 CNY 账户余额' },
  { step: '02', title: '上架数据资产', desc: '上传本地 JSON/CSV 或填入第三方 API URL' },
  { step: '03', title: '设定收费价格', desc: '自由定价，每次查询按需计费' },
  { step: '04', title: '开始躺收', desc: 'AI Agent 自动发现并付费，收入实时到账' },
];

const LandingPage: React.FC<LandingPageProps> = ({ onOpenAuth }) => {
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      
      {/* ── 顶部导航 ── */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-slate-950/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Database className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 tracking-tight">
              DataPay
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenAuth('login')}
              className="px-5 py-2 text-sm font-bold text-slate-300 hover:text-white transition-colors"
            >
              登录
            </button>
            <button
              onClick={() => onOpenAuth('register')}
              className="px-5 py-2 rounded-xl bg-white text-slate-950 font-black text-sm hover:bg-indigo-50 hover:shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all active:scale-95"
            >
              免费注册
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero 区域 ── */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        {/* 背景光晕装饰 */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-500/10 blur-[120px] rounded-full" />
          <div className="absolute top-40 left-1/4 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full" />
          <div className="absolute top-40 right-1/4 w-64 h-64 bg-blue-500/10 blur-[80px] rounded-full" />
        </div>

        <div className="relative container mx-auto max-w-5xl text-center">
          {/* 徽标 */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold tracking-widest uppercase mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
            <Star className="w-3 h-3 fill-current" />
            基于 x402 协议 · AI Agent 原生支付网关
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            将数据变成
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
              AI 自动付费的资产
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
            DataPay 让任何开发者都能在 <strong className="text-white">30 秒</strong> 内，把本地 Excel、JSON 数据或第三方 API，
            包装成 AI Agent 能自动发现并按次计费调用的数据服务。
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            <button
              onClick={() => onOpenAuth('register')}
              className="group h-14 px-8 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black text-lg hover:shadow-2xl hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all flex items-center gap-3 active:scale-[0.98]"
            >
              免费开始赚钱
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => onOpenAuth('login')}
              className="h-14 px-8 rounded-2xl border border-white/10 text-slate-300 font-bold hover:border-white/20 hover:bg-white/5 transition-all"
            >
              已有账号，直接登录
            </button>
          </div>

          {/* 统计数据小卡片 */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-center animate-in fade-in duration-700 delay-500">
            {[
              { value: '30s', label: '上线一个数据资产' },
              { value: 'x402', label: 'Web 原生支付协议' },
              { value: '∞', label: '可同时发布资产数量' },
            ].map((stat) => (
              <div key={stat.label} className="space-y-1">
                <div className="text-4xl font-black text-white">{stat.value}</div>
                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 代码演示 Banner ── */}
      <section className="py-6 px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-8 overflow-x-auto shadow-2xl">
            <div className="flex items-center gap-2 mb-5">
              <span className="h-3 w-3 rounded-full bg-rose-500" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
              <span className="ml-3 text-xs text-slate-600 font-mono">agent-client.ts</span>
            </div>
            <pre className="font-mono text-sm leading-relaxed text-slate-300 whitespace-pre">
{`import { DataPayClient } from 'datapay-sdk';

const client = new DataPayClient({ apiKey: 'dp-your-key' });

// 1. 自动发现所有可用资产
const assets = await client.discover();

// 2. 自动付费并获取数据（无需手动处理 402）
const result = await client.request(assets[0].id, {
  params: { company: '张三科技' }
});

console.log(result.data); // 征信报告、风险评分、全都有 ✨`}
            </pre>
          </div>
        </div>
      </section>

      {/* ── 核心特性网格 ── */}
      <section className="py-24 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-white tracking-tight mb-4">为什么选择 DataPay？</h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              专为 AI 时代设计的数据货币化基础设施，让数据产生持续的被动收入。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={i}
                  onMouseEnter={() => setHoveredFeature(i)}
                  onMouseLeave={() => setHoveredFeature(null)}
                  className="relative group p-7 rounded-3xl border border-white/5 bg-slate-900/40 hover:border-white/10 hover:bg-slate-900/70 transition-all duration-300 cursor-default overflow-hidden"
                >
                  {/* 悬浮光晕 */}
                  <div className={`absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br ${feature.color} blur-[60px] opacity-0 group-hover:opacity-20 transition-opacity duration-500 rounded-full`} />
                  
                  <div className={`inline-flex p-3 rounded-2xl bg-gradient-to-br ${feature.color} mb-5 shadow-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-black text-white mb-2">{feature.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 上手步骤 ── */}
      <section className="py-24 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-950/20 to-transparent pointer-events-none" />
        <div className="relative container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-white tracking-tight mb-4">四步开启躺赚模式</h2>
            <p className="text-slate-400 text-lg">从开通账户到第一笔 AI 付款，全程不超过 5 分钟。</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((item, i) => (
              <div key={i} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[calc(100%-0px)] w-full h-px bg-gradient-to-r from-indigo-500/30 to-transparent z-10">
                    <ChevronRight className="absolute -right-3 -top-2 w-4 h-4 text-indigo-500/50" />
                  </div>
                )}
                <div className="p-6 rounded-3xl border border-white/5 bg-slate-900/40 hover:border-indigo-500/20 transition-all group">
                  <div className="text-4xl font-black text-indigo-500/30 group-hover:text-indigo-500/60 transition-colors mb-4 font-mono">
                    {item.step}
                  </div>
                  <h3 className="text-base font-black text-white mb-2">{item.title}</h3>
                  <p className="text-slate-400 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA 底部区域 ── */}
      <section className="py-24 px-6">
        <div className="container mx-auto max-w-3xl text-center">
          <div className="relative p-12 rounded-[40px] border border-indigo-500/20 bg-indigo-950/40 backdrop-blur-xl overflow-hidden shadow-2xl shadow-indigo-500/10">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-600/5 pointer-events-none" />
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-500/20 blur-[80px] rounded-full pointer-events-none" />
            <div className="relative">
              <h2 className="text-4xl font-black text-white tracking-tight mb-4">
                你的数据，现在就能变钱
              </h2>
              <p className="text-slate-400 mb-8 text-lg">
                注册即赠 <strong className="text-indigo-400">¥10</strong> 免费额度，零门槛体验完整功能。
              </p>
              <button
                onClick={() => onOpenAuth('register')}
                className="group h-16 px-12 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black text-xl hover:shadow-2xl hover:shadow-indigo-500/40 hover:-translate-y-1 transition-all flex items-center gap-4 mx-auto active:scale-[0.98]"
              >
                立即免费注册
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── 页脚 ── */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-600 font-bold uppercase tracking-[0.15em]">
          <div>© 2026 DATAPAY NETWORK · X402 PROTOCOL GATEWAY</div>
          <div className="flex gap-6">
            <span className="hover:text-indigo-400 transition-colors cursor-pointer">Documentation</span>
            <span className="hover:text-indigo-400 transition-colors cursor-pointer">GitHub</span>
            <span className="hover:text-indigo-400 transition-colors cursor-pointer">Status</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
