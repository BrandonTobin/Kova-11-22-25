import React from 'react';
import { ArrowLeft, Download } from 'lucide-react';

interface RefundPolicyProps {
  onBack: () => void;
}

const RefundPolicy: React.FC<RefundPolicyProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-background text-text-main p-6 md:p-12 overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-text-muted hover:text-white transition-colors"
          >
            <ArrowLeft size={20} /> Back
          </button>
          
          <a 
            href="https://dbbtpkgiclzrsigdwdig.supabase.co/storage/v1/object/public/legal/Kova_Refund_Policy.pdf" 
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-gold hover:text-gold-hover text-sm font-medium"
          >
            <Download size={16} /> Download PDF
          </a>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold mb-8">Refund Policy</h1>
        
        <div className="space-y-8 text-sm md:text-base leading-relaxed text-text-muted">
          <section>
            <h2 className="text-xl font-bold text-text-main mb-2">KOVA LLC – REFUND & CANCELLATION POLICY</h2>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Refunds</h3>
            <p>Kova LLC does NOT offer refunds for:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Monthly subscription fees</li>
              <li>Renewals</li>
              <li>Early cancellations</li>
              <li>Accidental purchases</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Refund Exceptions</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Duplicate charges</li>
              <li>Verified technical billing errors</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Cancellations</h3>
            <p>Users may cancel anytime; cancellations prevent future charges but do not refund past payments.</p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Contact</h3>
            <p>Email: <a href="mailto:kova.app.team@gmail.com" className="text-primary hover:underline">kova.app.team@gmail.com</a></p>
            <p className="mt-2 text-xs italic">Kova LLC — Mailing address: business address coming soon</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default RefundPolicy;