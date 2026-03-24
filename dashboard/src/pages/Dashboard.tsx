import React from 'react';
import { DollarSign, BarChart3, Server } from 'lucide-react';
import type { Asset, ServerStatus } from '../types';

interface DashboardProps {
  status: ServerStatus | null;
}

const Dashboard: React.FC<DashboardProps> = ({ status }) => {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 p-6 transition-all hover:border-white/20 hover:bg-slate-900/80">
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
        </div>
        
        <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 p-6 transition-all hover:border-white/20 hover:bg-slate-900/80">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-400">总请求量</h3>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-white tracking-tight">
              {status ? status.totalQueries.toLocaleString() : '0'}
            </span>
            <span className="text-sm text-slate-500 font-medium">次</span>
          </div>
        </div>
        
        <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 p-6 transition-all hover:border-white/20 hover:bg-slate-900/80">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-400">运行资产</h3>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Server className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-white tracking-tight">
              {status ? status.assets.length : '0'}
            </span>
            <span className="text-sm text-slate-500 font-medium">个</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/50 overflow-hidden backdrop-blur-sm">
        <div className="p-6 border-b border-white/5">
          <h2 className="text-lg font-bold text-white">上架资产清单</h2>
        </div>
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
                <tr key={asset.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-200">{asset.name}</td>
                  <td className="px-6 py-4">
                    <span className="text-emerald-400 font-mono">
                      {asset.price} {asset.currency}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums">{asset.totalQueries}</td>
                  <td className="px-6 py-4 text-right text-emerald-400 font-mono">
                    {asset.totalRevenue.toFixed(2)}
                  </td>
                </tr>
              ))}
              {!status?.assets.length && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500 italic">
                    暂无已发布资产，点击右上角开始发布。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
