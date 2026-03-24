import React from 'react';
import { RefreshCw, Activity } from 'lucide-react';

interface LabProps {
  labQuery: string;
  setLabQuery: (q: string) => void;
  onAsk: (e: React.FormEvent) => void;
  isLabLoading: boolean;
  labResult: any;
}

const Lab: React.FC<LabProps> = ({
  labQuery,
  setLabQuery,
  onAsk,
  isLabLoading,
  labResult
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-12 py-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-4xl font-black text-white mb-4 tracking-tight">Smart Agent 实验室</h1>
        <p className="text-slate-400 leading-relaxed text-lg">
          输入人话，DataPay 自动搜寻最高匹配资产并代其付费取数。
          <span className="block text-xs mt-2 text-indigo-400/60 font-mono">X402 PROTOCOL REAL-TIME EXECUTION</span>
        </p>
      </div>

      <form onSubmit={onAsk} className="relative flex gap-3 group">
        <div className="relative flex-1">
          <input 
            type="text" 
            value={labQuery} 
            onChange={(e) => setLabQuery(e.target.value)} 
            placeholder="试试：帮我查一下硅谷的鼠标价格..." 
            className="w-full h-18 pl-8 pr-4 rounded-2xl bg-slate-900 border border-white/10 text-white text-xl focus:outline-none focus:border-indigo-500 transition-all shadow-2xl placeholder-slate-600 focus:ring-4 focus:ring-indigo-500/10" 
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <kbd className="hidden md:inline-flex h-6 items-center gap-1 rounded border border-white/10 bg-slate-800 px-1.5 font-mono text-[10px] font-medium text-slate-500 italic">Enter to Run</kbd>
          </div>
        </div>
        <button 
          type="submit" 
          disabled={isLabLoading} 
          className="h-18 px-10 rounded-2xl bg-white text-slate-950 font-black text-lg hover:bg-slate-200 disabled:opacity-50 transition-all flex items-center gap-3 shadow-xl active:scale-95"
        >
          {isLabLoading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Activity className="w-6 h-6" />}
          执行 Agent 调用
        </button>
      </form>

      {labResult && (
        <div className="rounded-3xl border border-white/10 bg-slate-900/60 overflow-hidden shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-300">
          <div className="p-5 border-b border-white/10 bg-slate-950/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Gateway Trace Output</span>
            </div>
            {labResult.matched_asset && (
              <div className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                已自动匹配并购买: {labResult.matched_asset}
              </div>
            )}
          </div>
          <div className="relative">
            <pre className="p-8 text-sm font-mono text-indigo-300 overflow-auto max-h-[500px] bg-slate-950/20 custom-scrollbar whitespace-pre-wrap">
              {JSON.stringify(labResult, null, 2)}
            </pre>
            <div className="absolute bottom-4 right-4 text-[10px] font-mono text-slate-600">
               JSON RESPONSE OBJECT
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Lab;
