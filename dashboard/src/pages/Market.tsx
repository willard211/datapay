import React from 'react';
import { Search, Database } from 'lucide-react';
import type { Asset } from '../types';

interface MarketProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  assets: Asset[];
  onOpenDetail: (asset: Asset) => void;
}

const Market: React.FC<MarketProps> = ({
  searchQuery,
  onSearchChange,
  assets,
  onOpenDetail
}) => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col items-center text-center max-w-2xl mx-auto py-12">
        <h1 className="text-4xl font-extrabold text-white mb-4 tracking-tight">发现 AI 原生数据资产</h1>
        <p className="text-slate-400 mb-8 leading-relaxed">
          在这里，所有资产都遵循 x402 协议，支持机器对机器的自动发现与即时支付。
        </p>
        <div className="relative w-full max-w-lg">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            type="text" 
            value={searchQuery} 
            onChange={(e) => onSearchChange(e.target.value)} 
            placeholder="按名称、描述或标签搜索..." 
            className="w-full h-14 pl-12 pr-4 rounded-2xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-2xl" 
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {assets.map((asset) => (
          <div key={asset.id} className="group flex flex-col p-6 rounded-2xl border border-white/10 bg-slate-900/40 hover:bg-slate-900/60 hover:border-white/20 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
                <Database className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20">
                {asset.sourceType}
              </span>
            </div>
            
            <h3 className="text-lg font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">
              {asset.name}
            </h3>
            
            <p className="text-sm text-slate-400 line-clamp-2 mb-4 flex-grow leading-relaxed">
              {asset.description}
            </p>
            
            <div className="flex flex-wrap gap-2 mb-6">
              {asset.tags?.map((tag) => (
                <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-white/5">
                  #{tag}
                </span>
              ))}
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <span className="text-lg font-bold text-emerald-400 font-mono">
                {asset.price} {asset.currency}
              </span>
              <button 
                onClick={() => onOpenDetail(asset)}
                className="h-9 px-4 rounded-lg bg-indigo-500/10 text-indigo-400 text-sm font-bold hover:bg-indigo-500 hover:text-white transition-all shadow-sm"
              >
                查看文档
              </button>
            </div>
          </div>
        ))}
        {assets.length === 0 && (
          <div className="col-span-full py-20 text-center text-slate-500 italic">
            没有找到匹配的资产。
          </div>
        )}
      </div>
    </div>
  );
};

export default Market;
