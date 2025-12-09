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

        <h1 className="text-3xl md:text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-xs text-text-muted italic mb-6">Last Updated: December 2025</p>
        
        <div className="space-y-8 text-sm md:text-base leading-relaxed text-text-muted">
          <section>
            <h2 className="text-xl font-bold text-text-main mb-2">KOVA LLC – Terms of Service</h2>
            <p><strong>Effective Date:</strong> December 2025</p>
            <p className="mt-2">
              Welcome to Kova! By accessing or using our website and application (the “Platform”), you agree to be bound by these Terms of Service (“Terms”). If you do not agree, please do not use the Platform.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Eligibility</h3>
            <p>
              You must be at least <strong>16 years old</strong> to use Kova. By creating an account, you represent and warrant that you are 16 years of age or older and meet all eligibility requirements.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Accounts & Security</h3>
            <p>
              You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You agree to provide accurate and current information during registration.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Acceptable Use</h3>
            <p>You agree NOT to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Harass, abuse, or threaten other users.</li>
              <li>Misrepresent your identity, professional status, or business.</li>
              <li>Upload harmful, illegal, or inappropriate content.</li>
              <li>Attempt to scrape, reverse engineer, or disrupt the Platform.</li>
              <li>Use Kova for any illegal activity.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Subscriptions & Billing</h3>
            <p>
              Premium features (Kova Plus, Kova Pro) are billed on a subscription basis. Payments are processed securely via Stripe. Subscriptions automatically renew monthly unless canceled by you before the renewal date.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">No Refunds</h3>
            <p>
              Kova does not offer refunds for subscription payments, including renewals, except in rare cases of duplicate charges or verified billing errors. Please see our Refund Policy for details.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Termination</h3>
            <p>
              You may delete your account at any time via the Profile settings. Kova LLC reserves the right to suspend or terminate accounts that violate these Terms or for any other reason at our sole discretion.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Disclaimers & Limitation of Liability</h3>
            <p>
              The Platform is provided “as is” without warranties of any kind. Kova LLC is not liable for data loss, service downtime, user interactions, or business outcomes resulting from the use of our service. You use the Platform at your own risk.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Governing Law</h3>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the State of Florida, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Contact Us</h3>
            <p>
              If you have any questions regarding these Terms, please contact us:
            </p>
            <p className="mt-2"><strong>Email:</strong> <a href="mailto:kova.app.team@gmail.com" className="text-primary hover:underline">kova.app.team@gmail.com</a></p>
            <p className="mt-2 text-xs italic">Kova LLC — Mailing address: business address coming soon</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;