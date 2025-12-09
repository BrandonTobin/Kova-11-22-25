import React, { useState } from 'react';
import { ArrowLeft, Download, Send, Loader2 } from 'lucide-react';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    console.log("Contact Form Submission:", formData);
    
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
      setFormData({ name: '', email: '', message: '' });
    }, 1500);
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
              <h2 className="text-xl font-bold text-text-main mb-2">KOVA LLC – CONTACT INFORMATION</h2>
              <p>For support or inquiries:</p>
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

          <div className="bg-surface border border-white/10 p-6 rounded-2xl h-fit">
            <h3 className="text-xl font-bold text-text-main mb-4">Send a Message</h3>
            
            {submitted ? (
              <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-xl text-center">
                <p className="text-green-500 font-bold mb-2">Message Sent!</p>
                <p className="text-text-muted text-sm">Thank you for reaching out. We will get back to you shortly.</p>
                <button 
                  onClick={() => setSubmitted(false)}
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
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-gold/50"
                    placeholder="Your Name"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Email</label>
                  <input 
                    type="email" 
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-gold/50"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Message</label>
                  <textarea 
                    required
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-gold/50 resize-none"
                    placeholder="How can we help?"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl bg-primary text-white font-bold shadow-lg hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
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