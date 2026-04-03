import React, { useState } from 'react';
import { Plus, Globe, DollarSign, RefreshCw, ArrowLeft } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import {
  PaymentElement,
  Elements,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import toast from 'react-hot-toast';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

interface TopupModalProps {
  show: boolean;
  onClose: () => void;
  onTopup: () => void;
  amount: string;
  setAmount: (amt: string) => void;
  method: 'stripe' | 'domestic';
  setMethod: (m: 'stripe' | 'domestic') => void;
  isProcessing: boolean;
  clientSecret?: string;
  onPaymentSuccess?: () => void;
  clearClientSecret?: () => void;
}

const CheckoutForm = ({ onSuccess, amount }: { onSuccess: () => void, amount: string }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    });

    setIsProcessing(false);

    if (error) {
      toast.error(error.message || '支付失败');
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      toast.success('支付成功！余额即将刷新');
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <button 
        disabled={isProcessing || !stripe || !elements}
        className="w-full h-14 rounded-2xl bg-indigo-500 text-white font-black text-lg hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50"
      >
        {isProcessing ? (
          <><RefreshCw className="w-5 h-5 animate-spin" /> 支付处理中...</>
        ) : (
          `确认支付 ¥${amount}`
        )}
      </button>
    </form>
  );
};

const TopupModal: React.FC<TopupModalProps> = ({
  show,
  onClose,
  onTopup,
  amount,
  setAmount,
  method,
  setMethod,
  isProcessing,
  clientSecret,
  onPaymentSuccess,
  clearClientSecret
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md">
      <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-8 space-y-8">
          <div className="flex items-center justify-between">
            {clientSecret ? (
              <button onClick={clearClientSecret} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm font-bold transition-colors">
                <ArrowLeft className="w-5 h-5" />
                返回金额
              </button>
            ) : (
              <h2 className="text-2xl font-bold text-white tracking-tight">账户充值</h2>
            )}
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
              <Plus className="w-6 h-6 rotate-45" />
            </button>
          </div>

          {clientSecret ? (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-slate-400">订单总额</span>
                <span className="text-xl font-bold text-white">¥ {amount}</span>
              </div>
              <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night', variables: { colorPrimary: '#6366f1', colorBackground: '#0f172a', colorText: '#f8fafc', colorDanger: '#f43f5e', fontFamily: 'Inter, system-ui, sans-serif' } } }}>
                <CheckoutForm onSuccess={() => onPaymentSuccess && onPaymentSuccess()} amount={amount} />
              </Elements>
            </div>
          ) : (
            <>
              {/* Amount Selection */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">选择充值金额 (CNY)</label>
                <div className="grid grid-cols-3 gap-3">
                  {['50', '100', '200', '500', '1000', '2000'].map(amt => (
                    <button
                      key={amt}
                      onClick={() => setAmount(amt)}
                      className={`h-12 rounded-xl border font-bold transition-all ${amount === amt ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-950 border-white/5 text-slate-400 hover:border-white/10'}`}
                    >
                      ¥{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">支付方式 (Hybrid Strategy)</label>
                <div className="space-y-2">
                  <button 
                    onClick={() => setMethod('domestic')}
                    className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all ${method === 'domestic' ? 'bg-indigo-500/10 border-indigo-500/50' : 'bg-slate-950 border-white/5 opacity-60'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400"><Globe className="w-5 h-5" /></div>
                      <div className="text-left">
                        <div className="text-sm font-bold text-white">境内聚合支付</div>
                        <div className="text-[10px] text-slate-500">支持 微信/支付宝/银行卡 (合规渠道)</div>
                      </div>
                    </div>
                    {method === 'domestic' && <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>}
                  </button>

                  <button 
                    onClick={() => setMethod('stripe')}
                    className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all ${method === 'stripe' ? 'bg-indigo-500/10 border-indigo-500/50' : 'bg-slate-950 border-white/5 opacity-60'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400"><DollarSign className="w-5 h-5" /></div>
                      <div className="text-left">
                        <div className="text-sm font-bold text-white">Stripe Checkout</div>
                        <div className="text-[10px] text-slate-500">International Credit Cards</div>
                      </div>
                    </div>
                    {method === 'stripe' && <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>}
                  </button>
                </div>
              </div>

              <button 
                onClick={onTopup}
                disabled={isProcessing}
                className="w-full h-14 rounded-2xl bg-white text-slate-950 font-black text-lg hover:bg-slate-200 transition-all flex items-center justify-center gap-3 shadow-xl"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-6 h-6 animate-spin" />
                    安全环境初始化中...
                  </>
                ) : (
                  <>下一步</>
                )}
              </button>
              
              <p className="text-[10px] text-slate-500 text-center px-4 leading-relaxed">
                点击下一步即代表您同意《Nexus402 服务条款》。资金将即时入账至您的开发者余额。
              </p>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default TopupModal;
