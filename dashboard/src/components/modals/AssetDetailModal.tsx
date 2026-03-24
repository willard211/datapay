import React from 'react';
import { Database } from 'lucide-react';
import type { Asset } from '../../types';

interface AssetDetailModalProps {
  asset: Asset | null;
  onClose: () => void;
  apiBase: string;
}

const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  asset,
  onClose,
  apiBase
}) => {
  if (!asset) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-6 relative" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-1">{asset.name}</h2>
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/20">{asset.sourceType}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-2xl leading-none transition-colors">×</button>
        </div>
        
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">{asset.description}</p>
        
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/5">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">API 端点</div>
            <code className="text-sm text-emerald-400 font-mono break-all">GET {apiBase}/api/v1/data/{asset.id}</code>
          </div>
          
          <div className="p-4 rounded-xl bg-white/5 border border-white/5">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">单次调用费用</div>
            <span className="text-lg font-bold text-emerald-400">{asset.price} {asset.currency}</span>
          </div>
          
          {asset.tags && asset.tags.length > 0 && (
            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">标签</div>
              <div className="flex flex-wrap gap-2">
                {asset.tags.map((tag: string) => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">#{tag}</span>
                ))}
              </div>
            </div>
          )}
          
          <div className="p-4 rounded-xl bg-white/5 border border-white/5">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Agent 调用示例 (cURL)</div>
            <pre className="text-xs font-mono text-indigo-300 overflow-auto whitespace-pre-wrap bg-slate-950 p-3 rounded-lg border border-white/5">
{`curl -H "X-PAYMENT: x402;internal;${asset.currency};${asset.price};your-agent-id;your-sig;$(date +%s%3N)" \\
  ${apiBase}/api/v1/data/${asset.id}`}
            </pre>
          </div>
        </div>
        
        <button onClick={onClose} className="mt-6 w-full h-12 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-all">关闭说明</button>
      </div>
    </div>
  );
};

export default AssetDetailModal;
