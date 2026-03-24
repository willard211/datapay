import React from 'react';
import { Database, Plus, RefreshCw, User, LogOut } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  status: any;
  loading: boolean;
  onRefreshStatus: () => void;
  onOpenPublish: () => void;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  status,
  loading,
  onRefreshStatus,
  onOpenPublish,
  onLogout
}) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30">
      <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Database className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 tracking-tight">
              DataPay
            </span>
            <div className="ml-12 flex items-center gap-1 bg-slate-900/80 p-1.5 rounded-2xl border border-white/5 shadow-inner">
              {[
                { id: 'dashboard', label: '控制中心' },
                { id: 'market', label: '资源市场' },
                { id: 'wallet', label: '账户余额' },
                { id: 'lab', label: 'Agent 实验室' },
                { id: 'analytics', label: '数据分析' }
              ].map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-5 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === tab.id ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/40 translate-z-10' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3 bg-slate-900/50 px-4 py-2 rounded-full border border-white/5">
              <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${status ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
              </span>
              <span className="text-xs font-bold text-slate-300 tracking-wide uppercase">
                {status ? `Engine Online : ${status.port}` : 'Engine Offline'}
              </span>
              <button 
                onClick={onRefreshStatus} 
                className={`p-1 rounded-lg hover:bg-slate-800 transition-colors text-slate-500 hover:text-white ${loading ? 'animate-spin' : ''}`}
                title="刷新状态"
              >
                <RefreshCw className="w-3.2 h-3.2" />
              </button>
            </div>
            
            <button 
              onClick={onOpenPublish} 
              className="h-11 px-6 rounded-xl bg-white text-slate-950 font-black text-sm hover:bg-indigo-50 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all flex items-center gap-2 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              发布资产
            </button>
            
            <div className="h-8 w-px bg-white/10"></div>
            
            <div className="flex items-center gap-3 group">
              <div className="h-10 w-10 rounded-full bg-slate-800 border border-white/5 flex items-center justify-center text-indigo-400 group-hover:border-indigo-500 transition-colors cursor-pointer">
                <User className="w-5 h-5" />
              </div>
              <button 
                onClick={onLogout} 
                className="p-2.5 rounded-xl hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-all active:scale-90" 
                title="安全退出"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-10 min-h-[calc(100-80px)]">
        {children}
      </main>
      
      <footer className="w-full border-t border-white/5 py-8 mt-12 bg-slate-950/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 flex justify-between items-center text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em]">
          <div>© 2026 DATAPAY NETWORK • X402 PROTOCOL GATEWAY</div>
          <div className="flex gap-6">
            <span className="hover:text-indigo-400 transition-colors cursor-help">Documentation</span>
            <span className="hover:text-indigo-400 transition-colors cursor-help">Security Audit</span>
            <span className="hover:text-indigo-400 transition-colors cursor-help">API Status</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
