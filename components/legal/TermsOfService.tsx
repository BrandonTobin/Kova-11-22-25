import React from 'react';
import { ArrowLeft, Download } from 'lucide-react';

interface TermsOfServiceProps {
  onBack: () => void;
}

const TermsOfService: React.FC<TermsOfServiceProps> = ({ onBack }) => {
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
            href="https://dbbtpkgiclzrsigdwdig.supabase.co/storage/v1/object/public/legal/Kova_Terms_of_Service.pdf" 
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-gold hover:text-gold-hover text-sm font-medium"
          >
            <Download size={16} /> Download PDF
          </a>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold mb-8">Terms of Service</h1>
        
        <div className="space-y-8 text-sm md:text-base leading-relaxed text-text-muted">
          <section>
            <h2 className="text-xl font-bold text-text-main mb-2">KOVA LLC – TERMS OF SERVICE</h2>
            <p><strong>Effective Date:</strong> Today</p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Agreement</h3>
            <p>These Terms govern your use of Kova’s platform.</p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Eligibility</h3>
            <p>Users must be 16 years of age or older.</p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Accounts</h3>
            <p>You are responsible for accurate information and account security.</p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Acceptable Use – You agree NOT to:</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Harass or abuse other users</li>
              <li>Misrepresent your identity or business</li>
              <li>Upload harmful, illegal, or inappropriate content</li>
              <li>Reverse engineer the platform</li>
              <li>Use Kova for illegal activity</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Subscriptions & Billing</h3>
            <p>Recurring billing is handled through Stripe. You authorize automatic charges until cancellation.</p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">No Refunds</h3>
            <p>Kova does not offer refunds for subscription payments, except in rare cases of duplicate charges or verified billing errors.</p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Account Termination</h3>
            <p>You may delete your account anytime. Kova may terminate accounts for Terms violations.</p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Liability</h3>
            <p>Kova LLC is not liable for data loss, downtime, user interactions, or business outcomes.</p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Governing Law</h3>
            <p>Florida law governs these Terms.</p>
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

export default TermsOfService;