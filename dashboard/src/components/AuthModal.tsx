import React from 'react';
import { Database, User, Lock, RefreshCw, X } from 'lucide-react';

interface AuthModalProps {
  mode: 'login' | 'register';
  setMode: (m: 'login' | 'register') => void;
  form: any;
  setForm: (f: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  error: string;
  setError: (e: string) => void;
  isAuthenticating: boolean;
}

const AuthModal: React.FC<AuthModalProps> = ({
  mode,
  setMode,
  form,
  setForm,
  onSubmit,
  onClose,
  error,
  setError,
  isAuthenticating,
}) => {
  return (
    // NOTE: 点击遮罩层也可关闭弹窗，提升用户体验
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="max-w-md w-full rounded-3xl bg-slate-900 border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <div className="p-10 text-center space-y-8">
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="mx-auto h-20 w-20 rounded-[24px] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30">
            <Database className="w-10 h-10 text-white" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-white tracking-tight">DataPay 控制台</h2>
            <p className="text-slate-400 text-sm font-medium">
              {mode === 'login' ? '管理您的所有商业 x402 资产' : '开启您的 AI 原生数据商业化之旅'}
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5 pt-4 text-left">
            {error && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold text-center animate-in shake duration-300">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">用户名 / 账号</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="text"
                  required
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  className="w-full h-13 bg-slate-950/50 border border-white/10 rounded-2xl pl-12 pr-4 text-white placeholder-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
                  placeholder="例如：demo-user"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">访问密码</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full h-13 bg-slate-950/50 border border-white/10 rounded-2xl pl-12 pr-4 text-white placeholder-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full h-14 bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-black text-lg rounded-2xl shadow-xl shadow-indigo-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
            >
              {isAuthenticating ? <RefreshCw className="w-6 h-6 animate-spin" /> : null}
              {mode === 'login' ? '即刻登录' : '创建开发者环境'}
            </button>
          </form>
        </div>
        
        <div className="bg-slate-900/50 p-6 border-t border-white/5 text-center">
          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            className="text-sm text-slate-400 hover:text-white transition-colors underline decoration-slate-700 underline-offset-8 font-medium"
          >
            {mode === 'login' ? '首次使用？点击注册新环境' : '已有账号？返回登录'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
