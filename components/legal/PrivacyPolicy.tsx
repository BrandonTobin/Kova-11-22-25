import React from 'react';
import { ArrowLeft, Download } from 'lucide-react';

interface PrivacyPolicyProps {
  onBack: () => void;
}

const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
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
  href="https://dbbtpkgiclzrsigdwdig.supabase.co/storage/v1/object/public/legal/Kova_Privacy_Policy.pdf"
  target="_blank"
  rel="noopener noreferrer"
  className="flex items-center gap-2 text-gold hover:text-gold-hover text-sm font-medium"
>
  <Download size={16} /> Download PDF
</a>

        </div>

        <h1 className="text-3xl md:text-4xl font-bold mb-8">Privacy Policy</h1>
        
        <div className="space-y-8 text-sm md:text-base leading-relaxed text-text-muted">
          <section>
            <h2 className="text-xl font-bold text-text-main mb-2">KOVA LLC – PRIVACY POLICY</h2>
            <p><strong>Effective Date:</strong> Today</p>
            <p><strong>Website:</strong> https://kovamatch.com</p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Introduction</h3>
            <p>Kova LLC (“Kova”) provides a platform for entrepreneurs to connect. This Privacy Policy explains how we collect and use information.</p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Eligibility</h3>
            <p>Kova is for individuals 16 years of age or older. We do not knowingly collect information from children under 16.</p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Information We Collect</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Information you provide (name, email, profile data, messages)</li>
              <li>Automatically collected information (IP, device data, cookies)</li>
              <li>Payment information via Stripe (we do not store credit card numbers)</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">How We Use Your Information</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Create and manage your account</li>
              <li>Provide platform features</li>
              <li>Improve services and security</li>
              <li>Process payments</li>
              <li>Communicate updates</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Data Sharing</h3>
            <p>We do not sell your data. Limited information may be shared with Stripe, analytics tools, or legal authorities when required.</p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Data Retention</h3>
            <p>We retain data while your account is active.</p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Account Deletion</h3>
            <p>You may request deletion at <a href="mailto:kova.app.team@gmail.com" className="text-primary hover:underline">kova.app.team@gmail.com</a>.</p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Security</h3>
            <p>We use reasonable measures to protect data.</p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Children’s Data</h3>
            <p>Users must be 16+. Accounts of users under 16 will be removed.</p>
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

export default PrivacyPolicy;