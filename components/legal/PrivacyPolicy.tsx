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

        <h1 className="text-3xl md:text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-xs text-text-muted italic mb-6">Last Updated: December 2025</p>
        
        <div className="space-y-8 text-sm md:text-base leading-relaxed text-text-muted">
          <section>
            <h2 className="text-xl font-bold text-text-main mb-2">KOVA LLC – Privacy Policy</h2>
            <p><strong>Last updated:</strong> December 2025</p>
            <p className="mt-2">
              Kova LLC (“Kova,” “we,” “us,” or “our”) provides a platform for entrepreneurs to connect, collaborate, and grow. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website (https://kovamatch.com) or use our mobile/web application (the “Platform”).
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Eligibility</h3>
            <p>
              The Platform is intended solely for users who are <strong>16 years of age or older</strong>. We do not knowingly collect, use, or disclose personal information from children under 16. If we become aware that we have collected personal data from a child under 16, we will delete that information immediately.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Information We Collect</h3>
            <p className="mb-2">We collect information that helps us provide a safe and effective matchmaking service.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account Information:</strong> Name, email address, encrypted password, date of birth, and profile details (role, industry, bio).</li>
              <li><strong>Usage Data:</strong> Device information, IP address, browser type, and log data related to your interactions with the Platform.</li>
              <li><strong>Communications:</strong> Messages sent between users and support inquiries submitted to us.</li>
              <li><strong>Payment Information:</strong> Processed securely via Stripe. Kova does not store your credit card numbers or banking credentials.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">How We Use Your Information</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>To create, manage, and secure your account.</li>
              <li>To match you with other entrepreneurs and display your professional profile.</li>
              <li>To provide features like video rooms, messaging, and goal tracking.</li>
              <li>To improve our Platform, analytics, and security measures.</li>
              <li>To send service-related emails (e.g., account verification, security alerts, billing updates).</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Legal Bases for Processing</h3>
            <p>We process your data based on:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Contract:</strong> To fulfill our Terms of Service and provide the Kova platform.</li>
              <li><strong>Legitimate Interests:</strong> To improve our services and prevent fraud or abuse.</li>
              <li><strong>Consent:</strong> Where applicable (e.g., for specific marketing communications).</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Sharing of Information</h3>
            <p>We do not sell your personal data. We may share information with:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Service Providers:</strong> Third-party vendors like Stripe (payments), Supabase (database), and email providers who help us operate the Platform.</li>
              <li><strong>Legal Authorities:</strong> If required by law, subpoena, or to protect the safety of our users.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Data Retention</h3>
            <p>
              We retain your personal information as long as your account is active or as needed to provide you with our services. We may retain certain logs or records for longer periods if required by law or for legitimate business security purposes.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Your Rights</h3>
            <p>Depending on your location, you may have rights to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Access or correct your personal data.</li>
              <li>Request deletion of your data (Right to be Forgotten).</li>
              <li>Opt-out of non-essential marketing communications.</li>
            </ul>
            <p className="mt-2">To exercise these rights, contact us at <a href="mailto:kova.app.team@gmail.com" className="text-primary hover:underline">kova.app.team@gmail.com</a>.</p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Children’s Data</h3>
            <p>
              Kova is strictly for users <strong>16 years of age or older</strong>. If we discover an account belonging to a user under 16, it will be terminated and associated data deleted.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Security</h3>
            <p>
              We implement reasonable technical and organizational measures to protect your data. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">International Transfers</h3>
            <p>
              Your information may be transferred to and maintained on computers located outside of your state, province, country, or other governmental jurisdiction where the data protection laws may differ. By using Kova, you consent to such transfer.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Changes to this Policy</h3>
            <p>
              We may update this Privacy Policy from time to time. The effective date will be updated at the top of this page. Continued use of the Platform signifies your acceptance of changes.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-text-main mb-2">Contact Us</h3>
            <p>If you have questions about this Privacy Policy, please contact us:</p>
            <p className="mt-2"><strong>Email:</strong> <a href="mailto:kova.app.team@gmail.com" className="text-primary hover:underline">kova.app.team@gmail.com</a></p>
            <p><strong>Website:</strong> <a href="https://kovamatch.com" className="text-primary hover:underline">https://kovamatch.com</a></p>
            <p className="mt-2 text-xs italic">Kova LLC — Mailing address: business address coming soon</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;