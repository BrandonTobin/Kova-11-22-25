import React from 'react';
import { CheckCircle, ArrowRight } from 'lucide-react';

interface PaymentSuccessProps {
  onContinue: () => void;
}

const PaymentSuccess: React.FC<PaymentSuccessProps> = ({ onContinue }) => {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-background p-6 text-center animate-in fade-in zoom-in duration-500">
      <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mb-6 border border-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
        <CheckCircle size={48} className="text-green-500" />
      </div>
      
      <h1 className="text-3xl font-bold text-text-main mb-4">Payment Successful!</h1>
      <p className="text-text-muted max-w-md mb-8 leading-relaxed">
        Thank you for upgrading. Your account has been updated with premium features. You can now access unlimited swipes and advanced insights.
      </p>

      <button
        onClick={onContinue}
        className="px-8 py-4 bg-primary text-white rounded-xl font-bold shadow-lg hover:bg-primary-hover transition-all flex items-center gap-2 transform hover:scale-105"
      >
        Go to Dashboard <ArrowRight size={20} />
      </button>
    </div>
  );
};

export default PaymentSuccess;