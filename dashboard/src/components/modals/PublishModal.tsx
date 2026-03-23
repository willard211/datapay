import React from 'react';

interface PublishModalProps {
  show: boolean;
  onClose: () => void;
  onPublish: (e: React.FormEvent) => void;
  form: {
    name: string;
    source: string;
    sourceType: string;
    price: string;
    description: string;
    tags: string;
  };
  setForm: (form: any) => void;
  isPublishing: boolean;
}

const PublishModal: React.FC<PublishModalProps> = ({
  show,
  onClose,
  onPublish,
  form,
  setForm,
  isPublishing
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-6 relative">
        <h2 className="text-xl font-bold text-white mb-4">封装发布新资产</h2>
        <form onSubmit={onPublish} className="space-y-4">
          <div className="flex gap-2 p-1 bg-slate-950 rounded-xl border border-white/5">
            <button type="button" onClick={() => setForm({...form, sourceType: 'json'})} className={`flex-1 py-1 rounded-lg text-xs ${form.sourceType === 'json' ? 'bg-indigo-500 text-white' : 'text-slate-500'}`}>文件</button>
            <button type="button" onClick={() => setForm({...form, sourceType: 'api'})} className={`flex-1 py-1 rounded-lg text-xs ${form.sourceType === 'api' ? 'bg-indigo-500 text-white' : 'text-slate-500'}`}>API</button>
            <button type="button" onClick={() => setForm({...form, sourceType: 'scraper'})} className={`flex-1 py-1 rounded-lg text-xs ${form.sourceType === 'scraper' ? 'bg-indigo-500 text-white' : 'text-slate-500'}`}>抓取</button>
          </div>
          <input required type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full h-10 px-3 rounded-lg bg-slate-950 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500" placeholder="资产名称" />
          <input required type="text" value={form.source} onChange={e => setForm({...form, source: e.target.value})} className="w-full h-10 px-3 rounded-lg bg-slate-950 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500" placeholder={form.sourceType === 'scraper' ? '目标网页 URL' : '数据来源 (文件路径或 URL)'} />
          <input required type="number" step="0.01" value={form.price} onChange={e => setForm({...form, price: e.target.value})} className="w-full h-10 px-3 rounded-lg bg-slate-950 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500" placeholder="单价" />
          <textarea rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full p-3 rounded-lg bg-slate-950 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500" placeholder="描述"></textarea>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 h-10 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors">取消</button>
            <button type="submit" disabled={isPublishing} className="flex-1 h-10 rounded-lg bg-indigo-500 text-white font-bold hover:bg-indigo-600 transition-colors">{isPublishing ? '提交中...' : '提交'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PublishModal;
