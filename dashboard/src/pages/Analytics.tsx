import React from 'react';
import { TrendingUp, DollarSign, BarChart3 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { ServerStatus } from '../types';

interface AnalyticsProps {
  analyticsData: any[];
  revenueGrowth: number | null;
  status: ServerStatus | null;
}

const Analytics: React.FC<AnalyticsProps> = ({
  analyticsData,
  revenueGrowth,
  status
}) => {
  return (
    <div className="max-w-6xl mx-auto space-y-10 py-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-black text-white mb-2 tracking-tight">商业洞察报告</h1>
          <p className="text-slate-400 text-lg">实时追踪 DataPay 资产的全球营收与调用趋势</p>
        </div>
        <div className="flex items-center gap-4 bg-indigo-500/10 border border-indigo-500/20 px-6 py-3 rounded-2xl shadow-lg shadow-indigo-500/5">
          <TrendingUp className="w-6 h-6 text-indigo-400" />
          <span className="text-base font-bold text-indigo-100 italic">
            近 7 天营收增长：
            <span className={revenueGrowth !== null && revenueGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {revenueGrowth !== null ? `${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth.toFixed(1)}%` : '计算中...'}
            </span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Revenue Chart */}
        <div className="p-8 rounded-[32px] border border-white/10 bg-slate-900/50 backdrop-blur-xl group hover:border-indigo-500/30 transition-all duration-300 shadow-xl">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
                <DollarSign className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">营收趋势 (CNY)</h2>
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">7-Day Snapshot</span>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analyticsData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)' }}
                  itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                  cursor={{ stroke: '#10b981', strokeWidth: 1 }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Queries Chart */}
        <div className="p-8 rounded-[32px] border border-white/10 bg-slate-900/50 backdrop-blur-xl group hover:border-indigo-500/30 transition-all duration-300 shadow-xl">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">调用量 (Requests)</h2>
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Live Traffic</span>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analyticsData}>
                <defs>
                  <linearGradient id="colorQueries" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)' }}
                  itemStyle={{ color: '#6366f1', fontWeight: 'bold' }}
                  cursor={{ stroke: '#6366f1', strokeWidth: 1 }}
                />
                <Area type="monotone" dataKey="queries" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorQueries)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="p-10 rounded-[40px] border border-white/10 bg-slate-900/50 backdrop-blur-xl shadow-2xl">
         <h2 className="text-2xl font-bold text-white mb-8 tracking-tight">最受欢迎资产排行</h2>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           {status?.assets.sort((a:any, b:any) => b.totalRevenue - a.totalRevenue).slice(0, 3).map((asset:any) => (
             <div key={asset.id} className="p-6 rounded-2xl bg-slate-950/50 border border-white/5 flex items-center justify-between hover:border-indigo-500/30 transition-all group">
               <div>
                 <div className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors">{asset.name}</div>
                 <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">{asset.sourceType}</div>
               </div>
               <div className="text-right">
                 <div className="text-2xl font-black text-emerald-400 tabular-nums">¥{asset.totalRevenue.toFixed(2)}</div>
                 <div className="text-[10px] text-slate-500 font-bold mt-1">{asset.totalQueries.toLocaleString()} 次成功交易</div>
               </div>
             </div>
           ))}
           {!status?.assets.length && (
             <div className="col-span-full py-10 text-center text-slate-500 italic">暂无资产排行数据。</div>
           )}
         </div>
      </div>
    </div>
  );
};

export default Analytics;
