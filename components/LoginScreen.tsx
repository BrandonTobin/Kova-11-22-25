
import React, { useState } from 'react';
import { ArrowRight, UserPlus, Mail, Lock, KeyRound, ArrowLeft, CheckCircle, ShieldCheck, Loader2 } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (email: string, pass: string) => void;
  onRegisterClick: () => void;
  error?: string;
  isLoading?: boolean;
  onGetSecurityQuestion?: (email: string) => Promise<string | null>;
  onVerifyAndReset?: (email: string, answer: string, newPass: string) => Promise<{ success: boolean; message: string }>;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onRegisterClick, error, isLoading = false, onGetSecurityQuestion, onVerifyAndReset }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Forgot Password State
  const [view, setView] = useState<'login' | 'forgot-email' | 'security-challenge' | 'reset-success'>('login');
  const [resetEmail, setResetEmail] = useState('');
  const [resetQuestion, setResetQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password && !isLoading) {
      onLogin(email, password);
    }
  };

  const handleLookupEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setIsResetting(true);
    if (!resetEmail.trim()) {
      setResetError('Please enter your email address.');
      setIsResetting(false);
      return;
    }

    if (onGetSecurityQuestion) {
      const question = await onGetSecurityQuestion(resetEmail);
      if (question) {
        setResetQuestion(question);
        setView('security-challenge');
      } else {
        setResetError('No account found with this email.');
      }
    } else {
      setResetError('Reset functionality unavailable.');
    }
    setIsResetting(false);
  };

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setIsResetting(true);

    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters.');
      setIsResetting(false);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setResetError('Passwords do not match.');
      setIsResetting(false);
      return;
    }
    if (!securityAnswer.trim()) {
       setResetError('Please answer the security question.');
       setIsResetting(false);
       return;
    }

    if (onVerifyAndReset) {
      const result = await onVerifyAndReset(resetEmail, securityAnswer, newPassword);
      if (result.success) {
        setView('reset-success');
      } else {
        setResetError(result.message);
      }
    }
    setIsResetting(false);
  };

  const renderLoginForm = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-10">
        {/* Brand Mark */}
        <div className="flex justify-center mb-6">
            <div className="relative w-16 h-16 rounded-full border-2 border-gold/30 flex items-center justify-center shadow-[0_0_15px_rgba(214,167,86,0.15)] bg-surface">
              <div className="absolute inset-0 rounded-full border border-gold/10 scale-110"></div>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-0.5">
                <path d="M2 2H7V10L17 2H22L12 12L22 22H17L7 14V22H2V2Z" fill="url(#k_gradient)" />
                <defs>
                  <linearGradient id="k_gradient" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#D6A756"/>
                    <stop offset="1" stopColor="#B8860B"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
        </div>
        
        <h1 className="text-3xl font-bold text-text-main mb-2 tracking-tight">Welcome Back</h1>
        <p className="text-text-muted font-light text-sm">
          Sign in to continue your journey.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Email Address</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted group-focus-within:text-gold transition-colors">
              <Mail size={18} />
            </div>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background border border-white/10 rounded-xl pl-10 pr-4 py-3 text-text-main focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all placeholder-gray-500/50" 
              placeholder="founder@kova.app" 
            />
          </div>
        </div>
        
        <div>
          <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Password</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted group-focus-within:text-gold transition-colors">
              <Lock size={18} />
            </div>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background border border-white/10 rounded-xl pl-10 pr-4 py-3 text-text-main focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all placeholder-gray-500/50" 
              placeholder="••••••••" 
            />
          </div>
          <div className="text-right mt-2">
            <button 
              type="button"
              onClick={() => setView('forgot-email')}
              className="text-xs text-secondary hover:text-gold transition-colors"
            >
              Forgot Password?
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center animate-in fade-in slide-in-from-top-2">
            {error}
          </div>
        )}

        <button 
          type="submit"
          disabled={isLoading}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-primary-hover hover:opacity-90 text-white font-bold text-lg transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 group border border-white/5 mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isLoading ? <Loader2 className="animate-spin" size={20} /> : (
             <>Sign In <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" /></>
          )}
        </button>
      </form>

      <div className="mt-8 text-center relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
          <div className="relative bg-surface px-4 text-text-muted text-xs uppercase tracking-wider">New here?</div>
      </div>

      <button 
        onClick={onRegisterClick}
        disabled={isLoading}
        className="w-full mt-6 py-3 rounded-xl bg-transparent border border-white/10 text-text-main hover:bg-white/5 transition-colors flex items-center justify-center gap-2 font-medium"
      >
        <UserPlus size={18} /> Create an Account
      </button>
    </div>
  );

  const renderForgotEmail = () => (
    <div className="animate-in fade-in slide-in-from-right duration-300">
      <button onClick={() => setView('login')} className="text-text-muted hover:text-white mb-6 flex items-center gap-2 text-sm">
        <ArrowLeft size={16} /> Back to Login
      </button>
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/20 text-primary">
          <KeyRound size={32} />
        </div>
        <h2 className="text-2xl font-bold text-text-main">Reset Password</h2>
        <p className="text-text-muted text-sm mt-2">Enter your email to find your account.</p>
      </div>

      <form onSubmit={handleLookupEmail} className="space-y-6">
        <div>
          <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Email Address</label>
          <div className="relative group">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted group-focus-within:text-gold transition-colors">
                <Mail size={18} />
             </div>
             <input 
               type="email" 
               required
               value={resetEmail}
               onChange={(e) => setResetEmail(e.target.value)}
               className="w-full bg-background border border-white/10 rounded-xl pl-10 pr-4 py-3 text-text-main focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all"
               placeholder="name@example.com"
             />
          </div>
        </div>

        {resetError && <p className="text-red-400 text-sm text-center">{resetError}</p>}

        <button 
          type="submit" 
          disabled={isResetting}
          className="w-full py-4 rounded-xl bg-primary text-white font-bold shadow-lg hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isResetting ? <Loader2 className="animate-spin" size={20} /> : "Next Step"}
        </button>
      </form>
    </div>
  );

  const renderSecurityChallenge = () => (
    <div className="animate-in fade-in slide-in-from-right duration-300">
      <button onClick={() => setView('forgot-email')} className="text-text-muted hover:text-white mb-6 flex items-center gap-2 text-sm">
        <ArrowLeft size={16} /> Change Email
      </button>
      
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-gold/20 text-gold">
          <ShieldCheck size={32} />
        </div>
        <h2 className="text-xl font-bold text-text-main">Security Challenge</h2>
        <p className="text-text-muted text-sm mt-1">Answer your security question to reset.</p>
      </div>

      <form onSubmit={handleVerifyAndReset} className="space-y-4">
        <div className="bg-surface border border-white/10 p-4 rounded-xl mb-4 text-center">
            <p className="text-xs text-gold font-bold uppercase tracking-wider mb-1">Question</p>
            <p className="text-text-main font-medium">{resetQuestion}</p>
        </div>

        <div>
           <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Your Answer</label>
           <input 
             type="text" 
             required
             value={securityAnswer}
             onChange={(e) => setSecurityAnswer(e.target.value)}
             className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all"
             placeholder="Type your answer"
           />
        </div>

        <div className="border-t border-white/10 my-4 pt-4"></div>
        
        <div>
           <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">New Password</label>
           <input 
             type="password" 
             required
             value={newPassword}
             onChange={(e) => setNewPassword(e.target.value)}
             className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all"
             placeholder="New password"
           />
        </div>

        <div>
           <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Confirm Password</label>
           <input 
             type="password" 
             required
             value={confirmNewPassword}
             onChange={(e) => setConfirmNewPassword(e.target.value)}
             className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all"
             placeholder="Confirm password"
           />
        </div>

        {resetError && <p className="text-red-400 text-sm text-center">{resetError}</p>}

        <button 
          type="submit" 
          disabled={isResetting}
          className="w-full py-4 rounded-xl bg-primary text-white font-bold shadow-lg hover:bg-primary-hover transition-colors mt-2 disabled:opacity-50 flex justify-center items-center"
        >
          {isResetting ? <Loader2 className="animate-spin" size={20} /> : "Reset Password"}
        </button>
      </form>
    </div>
  );

  const renderSuccess = () => (
    <div className="animate-in fade-in zoom-in duration-300 text-center py-8">
       <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20 text-green-500">
          <CheckCircle size={40} />
       </div>
       <h2 className="text-2xl font-bold text-text-main mb-2">Password Reset!</h2>
       <p className="text-text-muted text-sm mb-8">Your password has been successfully updated. You can now log in with your new credentials.</p>
       
       <button 
         onClick={() => {
            setView('login');
            setResetEmail('');
            setResetQuestion('');
            setSecurityAnswer('');
            setNewPassword('');
            setConfirmNewPassword('');
         }}
         className="w-full py-4 rounded-xl bg-primary text-white font-bold shadow-lg hover:bg-primary-hover transition-colors"
       >
         Back to Login
       </button>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-300">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[5%] left-[15%] w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[15%] right-[10%] w-80 h-80 bg-gold/5 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-md w-full bg-surface/90 backdrop-blur-xl p-8 rounded-3xl border border-white/5 shadow-2xl relative z-10">
        {view === 'login' && renderLoginForm()}
        {view === 'forgot-email' && renderForgotEmail()}
        {view === 'security-challenge' && renderSecurityChallenge()}
        {view === 'reset-success' && renderSuccess()}
      </div>
    </div>
  );
};

export default LoginScreen;
