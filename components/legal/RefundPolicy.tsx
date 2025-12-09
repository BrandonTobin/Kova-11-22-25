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

        <h1 className="text-3xl md:text-4xl font-bold mb-2">Refund Policy</h1>
        <p className="text-xs text-text-muted italic mb-6">Last Updated: December 2025</p>
        
        <div className="space-y-8 text-sm md:text-base leading-relaxed text-text-muted">
          <section>
            <h2 className="text-xl font-bold text-text-main mb-2">KOVA LLC – Refund & Cancellation Policy</h2>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">No Refunds</h3>
            <p>
              Kova LLC adheres to a strict no-refund policy. We do NOT offer refunds for:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Monthly subscription fees once processed.</li>
              <li>Subscription renewals (it is your responsibility to cancel before the renewal date).</li>
              <li>Early cancellations of a billing cycle.</li>
              <li>Accidental purchases or "change of mind."</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Exceptions</h3>
            <p>We may consider refunds only in the following specific circumstances:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Duplicate Charges:</strong> If you were billed multiple times for the same period due to a technical error.</li>
              <li><strong>Verified Technical Errors:</strong> If a billing error occurred on our end that resulted in an incorrect charge.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Cancellations</h3>
            <p>
              You may cancel your subscription at any time via your account settings. Cancellation will prevent future charges, but you will retain access to premium features until the end of your current billing period. No prorated refunds are issued for partial months.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">How to Request Help</h3>
            <p>
              If you believe a billing error has occurred, please contact our support team immediately.
            </p>
            <p className="mt-2"><strong>Email:</strong> <a href="mailto:kova.app.team@gmail.com" className="text-primary hover:underline">kova.app.team@gmail.com</a></p>
            <p className="mt-2 text-xs italic">Kova LLC — Mailing address: business address coming soon</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default RefundPolicy;