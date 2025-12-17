import React, { useState } from 'react';
import { ArrowLeft, Download, Send, Loader2, AlertCircle } from 'lucide-react';

interface ContactPageProps {
  onBack: () => void;
}

const ContactPage: React.FC<ContactPageProps> = ({ onBack }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Helper to safely access env vars (Vite compatible)
  const getEnv = (key: string): string => {
    try {
      // @ts-ignore
      return import.meta.env[key] || '';
    } catch (e) {
      return '';
    }
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Basic Validation
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (!validateEmail(formData.email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Endpoint resolution:
      // 1. VITE_CONTACT_ENDPOINT (Full URL)
      // 2. Default fallback: /api/contact (Relative to domain, proxied by Vite or handled by Express)
      const endpoint = getEnv('VITE_CONTACT_ENDPOINT') || '/api/contact';
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // If calling a Supabase Edge Function directly, we usually need the Anon Key.
      // We check if the configured endpoint looks like a Supabase URL or if we just want to be safe.
      const anonKey = getEnv('VITE_SUPABASE_ANON_KEY');
      if (anonKey && (endpoint.includes('supabase.co') || endpoint.includes('functions'))) {
        headers['Authorization'] = `Bearer ${anonKey}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          message: formData.message,
          source: 'kova-web'
        }),
      });

      if (!response.ok) {
        // Attempt to parse error message
        let errorMsg = 'Failed to send message.';
        try {
          const resData = await response.json();
          if (resData.error) errorMsg = resData.error;
          else if (resData.message) errorMsg = resData.message;
        } catch (parseErr) {
          // Fallback to status text
          errorMsg = response.statusText || errorMsg;
        }
        throw new Error(errorMsg);
      }

      // Success
      setSubmitted(true);
      setFormData({ name: '', email: '', message: '' });
    } catch (err: any) {
      console.error('Contact form error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
            href="https://dbbtpkgiclzrsigdwdig.supabase.co/storage/v1/object/public/legal/Kova_Contact_Info.pdf" 
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-gold hover:text-gold-hover text-sm font-medium"
          >
            <Download size={16} /> Download PDF
          </a>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold mb-2">Contact Us</h1>
        <p className="text-xs text-text-muted italic mb-6">Last Updated: December 2025</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-8 text-sm md:text-base leading-relaxed text-text-muted">
            <section>
              <h2 className="text-xl font-bold text-text-main mb-2">KOVA LLC – Contact Information</h2>
              <p>For support, billing inquiries, or general questions, please reach out to us:</p>
            </section>

            <section>
              <h3 className="text-lg font-bold text-text-main mb-2">Email</h3>
              <p><a href="mailto:kova.app.team@gmail.com" className="text-primary hover:underline">kova.app.team@gmail.com</a></p>
            </section>

            <section>
              <h3 className="text-lg font-bold text-text-main mb-2">Mailing Address</h3>
              <p>Kova LLC — Business address coming soon</p>
            </section>

            <section>
              <h3 className="text-lg font-bold text-text-main mb-2">Website</h3>
              <p><a href="https://kovamatch.com" className="text-primary hover:underline">https://kovamatch.com</a></p>
            </section>
          </div>

          <div className="bg-surface border border-white/10 p-6 rounded-2xl h-fit shadow-lg">
            <h3 className="text-xl font-bold text-text-main mb-4">Send a Message</h3>
            
            {submitted ? (
              <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-xl text-center animate-in fade-in zoom-in duration-300">
                <p className="text-green-500 font-bold mb-2">Message Sent!</p>
                <p className="text-text-muted text-sm">Thank you for reaching out. We will get back to you shortly.</p>
                <button 
                  onClick={() => {
                    setSubmitted(false);
                    setError('');
                  }}
                  className="mt-4 text-xs text-text-main underline hover:text-primary"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Name</label>
                  <input 
                    type="text" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-gold/50 transition-colors"
                    placeholder="Your Name"
                    disabled={isSubmitting}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Email</label>
                  <input 
                    type="email" 
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-gold/50 transition-colors"
                    placeholder="you@example.com"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Message</label>
                  <textarea 
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-gold/50 resize-none transition-colors"
                    placeholder="How can we help?"
                    disabled={isSubmitting}
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-red-400 text-xs animate-in fade-in slide-in-from-top-2">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl bg-primary text-white font-bold shadow-lg hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <><Send size={18} /> Send Message</>}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;