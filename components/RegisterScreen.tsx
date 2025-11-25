import React, { useState, useRef } from 'react';
import { ArrowLeft, Upload, MapPin, AlertCircle, ShieldCheck, Calendar, Flag, Mail, Lock, ChevronDown, Loader2, ArrowRight, Check } from 'lucide-react';
import { User } from '../types';
import { SECURITY_QUESTIONS } from '../constants';

interface RegisterScreenProps {
  onRegister: (user: User, imageFile?: File) => void;
  onBack: () => void;
  isLoading?: boolean;
  error?: string;
  onClearError?: () => void;
}

const TITLES = ['Founder', 'Co-Founder', 'Investor', 'CEO', 'CTO', 'COO', 'CMO', 'Freelancer', 'Solo Founder', 'Entrepreneur', 'Student', 'Other'];
const STAGES = ['Idea', 'Early', 'Growing', 'Scaling'];
const GOALS = ['Find Cofounder', 'Accountability Partner', 'Collab Partner', 'Brainstorm Partner', 'Mentor', 'Mentee', 'Other'];

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
  "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"
];

const RegisterScreen: React.FC<RegisterScreenProps> = ({ onRegister, onBack, isLoading = false, error, onClearError }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 0-based index for steps: 0, 1, 2
  const [step, setStep] = useState(0); 
  const TOTAL_STEPS = 3;

  const [errors, setErrors] = useState<{email?: string, password?: string, confirmPassword?: string, general?: string}>({});
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    dob: '',
    title: 'Founder', 
    customTitle: '',
    stage: 'Idea',
    gender: 'Male' as 'Male' | 'Female',
    city: '',
    state: '',
    mainGoal: 'Find a Technical Co-founder', 
    customGoal: '',
    image: null as File | null,
    imagePreview: '',
    securityQuestion: SECURITY_QUESTIONS[0],
    securityAnswer: ''
  });

  const generateKovaId = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `KVA-${result}`;
  };

  const calculateAge = (dob: string) => {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const difference = Date.now() - birthDate.getTime();
    const ageDate = new Date(difference);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormData({
        ...formData,
        image: file,
        imagePreview: URL.createObjectURL(file)
      });
    }
  };

  const validateStep = (currentStep: number) => {
    const newErrors: {email?: string, password?: string, confirmPassword?: string, general?: string} = {};
    let isValid = true;

    if (currentStep === 0) { // Step 0: Account & Security
      if (!formData.fullName.trim() || !formData.email.trim() || !formData.password || !formData.confirmPassword || !formData.securityAnswer.trim()) {
        newErrors.general = "Please fill in all fields.";
        isValid = false;
      }
      if (formData.email.trim() && !validateEmail(formData.email)) {
        newErrors.email = "Invalid email address.";
        isValid = false;
      }
      if (formData.password.length < 6) {
        newErrors.password = "Password must be at least 6 characters.";
        isValid = false;
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match.";
        isValid = false;
      }
    } else if (currentStep === 1) { // Step 1: Founder & Venture
      if (!formData.dob) {
        newErrors.general = "Please enter your date of birth.";
        isValid = false;
      } else if (calculateAge(formData.dob) < 16) {
        newErrors.general = "You must be at least 16 years old.";
        isValid = false;
      }
      if (!formData.city.trim() || !formData.state) {
        newErrors.general = "Please provide your location.";
        isValid = false;
      }
    }
    // Step 2 is just image upload (optional), so no strict validation needed.

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Default Avatar if no image uploaded
    const safeImageUrl = `https://ui-avatars.com/api/?background=0D8ABC&color=fff&name=${encodeURIComponent(formData.fullName)}`;

    const newUser: User = {
      id: '', // Assigned by DB/App
      kovaId: generateKovaId(),
      name: formData.fullName,
      email: formData.email,
      password: formData.password,
      role: formData.title === 'Other' ? formData.customTitle : formData.title,
      industry: 'Tech',
      bio: `Hi, I'm ${formData.fullName}. I'm currently in the ${formData.stage} stage looking to ${formData.mainGoal === 'Other' ? formData.customGoal : formData.mainGoal}.`,
      imageUrl: safeImageUrl,
      tags: [formData.stage],
      badges: [],
      dob: formData.dob,
      age: calculateAge(formData.dob),
      gender: formData.gender,
      stage: formData.stage,
      location: { city: formData.city, state: formData.state },
      mainGoal: formData.mainGoal === 'Other' ? formData.customGoal : formData.mainGoal,
      securityQuestion: formData.securityQuestion,
      securityAnswer: formData.securityAnswer,
      subscriptionTier: 'free',
      proExpiresAt: null
    };

    onRegister(newUser, formData.image || undefined);
  };

  const handleNext = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (validateStep(step)) {
      if (step < TOTAL_STEPS - 1) {
        setStep(prev => prev + 1);
        if (onClearError) onClearError();
      } else {
        handleSubmit(e);
      }
    }
  };

  const handleBack = () => {
    if (step === 0) {
      onBack();
    } else {
      setStep(prev => prev - 1);
      setErrors({});
      if (onClearError) onClearError();
    }
  };

  // Render Steps
  const renderStepContent = () => {
    switch (step) {
      case 0: // Account & Security
        return (
          <div className="space-y-5 animate-in fade-in slide-in-from-right duration-300">
             <div>
              <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Full Name</label>
              <div className="relative group">
                 <input 
                  autoFocus
                  required 
                  type="text" 
                  value={formData.fullName} 
                  onChange={e => setFormData({...formData, fullName: e.target.value})} 
                  className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-text-main focus:border-gold/50 focus:ring-1 focus:ring-gold/50 outline-none transition-all placeholder-gray-500/50" 
                  placeholder="Brian O'Conner" 
                />
              </div>
            </div>

            <div>
               <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Email</label>
               <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                    <Mail size={18} />
                  </div>
                  <input 
                    required 
                    type="email" 
                    value={formData.email} 
                    onChange={e => {
                      setFormData({...formData, email: e.target.value});
                      if (errors.email) setErrors({...errors, email: undefined});
                    }}
                    className={`w-full bg-background border ${errors.email ? 'border-red-500' : 'border-white/10'} rounded-xl pl-10 pr-4 py-3 text-text-main focus:border-gold/50 outline-none transition-all placeholder-gray-500/50`} 
                    placeholder="you@startup.com" 
                  />
               </div>
               {errors.email && <p className="text-red-400 text-xs mt-1 ml-1">{errors.email}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                 <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Password</label>
                 <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                      <Lock size={18} />
                   </div>
                   <input 
                     required 
                     type="password" 
                     value={formData.password} 
                     onChange={e => setFormData({...formData, password: e.target.value})} 
                     className="w-full bg-background border border-white/10 rounded-xl pl-10 pr-4 py-3 text-text-main focus:border-gold/50 outline-none transition-all placeholder-gray-500/50" 
                     placeholder="••••••••" 
                   />
                 </div>
                 {errors.password && <p className="text-red-400 text-xs mt-1 ml-1">{errors.password}</p>}
              </div>
              
              <div>
                 <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Confirm Password</label>
                 <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                      <Lock size={18} />
                   </div>
                   <input 
                     required 
                     type="password" 
                     value={formData.confirmPassword} 
                     onChange={e => setFormData({...formData, confirmPassword: e.target.value})} 
                     className={`w-full bg-background border ${errors.confirmPassword ? 'border-red-500' : 'border-white/10'} rounded-xl pl-10 pr-4 py-3 text-text-main focus:border-gold/50 outline-none transition-all placeholder-gray-500/50`}
                     placeholder="••••••••" 
                   />
                 </div>
                 {errors.confirmPassword && <p className="text-red-400 text-xs mt-1 ml-1">{errors.confirmPassword}</p>}
              </div>
            </div>

            <div className="pt-2">
               <div className="flex items-center gap-1.5 mb-1.5 ml-1">
                 <ShieldCheck size={14} className="text-gold" />
                 <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Security Question</label>
               </div>
               <div className="space-y-3">
                 <div className="relative">
                    <select 
                      value={formData.securityQuestion} 
                      onChange={e => setFormData({...formData, securityQuestion: e.target.value})} 
                      className="w-full bg-background border border-white/10 rounded-xl pl-4 pr-10 py-3 text-sm text-text-main focus:border-gold/50 outline-none appearance-none transition-all"
                    >
                        {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-text-muted">
                      <ChevronDown size={16} />
                    </div>
                 </div>
                 <input 
                   required 
                   type="text" 
                   value={formData.securityAnswer} 
                   onChange={e => setFormData({...formData, securityAnswer: e.target.value})} 
                   className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-sm text-text-main focus:border-gold/50 outline-none transition-all" 
                   placeholder="Your answer" 
                 />
               </div>
            </div>
          </div>
        );
      case 1: // Founder & Venture
        return (
          <div className="space-y-5 animate-in fade-in slide-in-from-right duration-300">
            <div>
               <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Date of Birth</label>
               <div className="relative group">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                    <Calendar size={18} />
                 </div>
                 <input 
                   required 
                   type="date" 
                   value={formData.dob} 
                   onChange={e => setFormData({...formData, dob: e.target.value})} 
                   className="w-full bg-background border border-white/10 rounded-xl pl-10 pr-4 py-3 text-text-main focus:border-gold/50 outline-none transition-all" 
                 />
               </div>
               <p className="text-[10px] text-text-muted ml-1 mt-1">Must be 16+ to join.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Title</label>
                  <div className="relative">
                    <select 
                      value={formData.title} 
                      onChange={e => setFormData({...formData, title: e.target.value})} 
                      className="w-full bg-background border border-white/10 rounded-xl pl-3 pr-10 py-3 text-text-main focus:border-gold/50 outline-none appearance-none transition-all"
                    >
                      {TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-text-muted">
                      <ChevronDown size={16} />
                    </div>
                  </div>
               </div>
               <div>
                  <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Stage</label>
                  <div className="relative">
                    <select 
                      value={formData.stage} 
                      onChange={e => setFormData({...formData, stage: e.target.value})} 
                      className="w-full bg-background border border-white/10 rounded-xl pl-3 pr-10 py-3 text-text-main focus:border-gold/50 outline-none appearance-none transition-all"
                    >
                      {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-text-muted">
                      <ChevronDown size={16} />
                    </div>
                  </div>
               </div>
            </div>

            <div>
               <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Gender</label>
               <div className="relative">
                 <select 
                   value={formData.gender} 
                   onChange={e => setFormData({...formData, gender: e.target.value as 'Male' | 'Female'})} 
                   className="w-full bg-background border border-white/10 rounded-xl pl-4 pr-10 py-3 text-text-main focus:border-gold/50 outline-none appearance-none transition-all"
                 >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                 </select>
                 <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-text-muted">
                    <ChevronDown size={16} />
                 </div>
               </div>
            </div>

            <div>
               <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Location</label>
               <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                      <MapPin size={18} />
                    </div>
                    <input 
                      required 
                      type="text" 
                      value={formData.city} 
                      onChange={e => setFormData({...formData, city: e.target.value})} 
                      className="w-full bg-background border border-white/10 rounded-xl pl-10 pr-4 py-3 text-text-main focus:border-gold/50 outline-none transition-all" 
                      placeholder="City" 
                    />
                  </div>
                  <div className="relative w-1/3">
                    <select 
                      required 
                      value={formData.state} 
                      onChange={e => setFormData({...formData, state: e.target.value})} 
                      className="w-full bg-background border border-white/10 rounded-xl pl-2 pr-8 py-3 text-text-main focus:border-gold/50 outline-none appearance-none transition-all text-sm"
                    >
                      <option value="">State</option>
                      {US_STATES.map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-text-muted">
                      <ChevronDown size={16} />
                    </div>
                  </div>
               </div>
            </div>

            <div>
               <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Main Goal</label>
               <div className="relative">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                    <Flag size={18} />
                 </div>
                 <select 
                   value={formData.mainGoal} 
                   onChange={e => setFormData({...formData, mainGoal: e.target.value})} 
                   className="w-full bg-background border border-white/10 rounded-xl pl-10 pr-10 py-3 text-text-main focus:border-gold/50 outline-none appearance-none transition-all"
                 >
                   {GOALS.map(g => <option key={g} value={g}>{g}</option>)}
                 </select>
                 <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-text-muted">
                    <ChevronDown size={16} />
                 </div>
               </div>
            </div>
            
            {formData.mainGoal === 'Other' && (
               <div>
                  <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Specific Goal</label>
                  <input 
                      type="text" 
                      value={formData.customGoal} 
                      onChange={e => setFormData({...formData, customGoal: e.target.value})} 
                      className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-text-main focus:border-gold/50 outline-none transition-all" 
                      placeholder="e.g. Find Beta Users" 
                  />
               </div>
            )}
          </div>
        );
      case 2: // Profile Picture (Upload)
        return (
          <div className="space-y-5 animate-in fade-in slide-in-from-right duration-300">
             <div>
               <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Profile Picture</label>
               <div 
                 onClick={() => fileInputRef.current?.click()}
                 className="w-full border border-dashed border-white/20 rounded-xl bg-background/50 hover:bg-white/5 transition-colors cursor-pointer p-8 flex flex-col items-center justify-center gap-4 group relative overflow-hidden min-h-[250px]"
               >
                 {formData.imagePreview ? (
                    <>
                       <div className="w-32 h-32 rounded-full border-4 border-gold shadow-lg overflow-hidden relative z-10">
                          <img 
                            src={formData.imagePreview} 
                            alt="Preview" 
                            className="w-full h-full object-cover"
                          />
                       </div>
                       <span className="text-sm text-text-main font-medium z-10 flex items-center gap-2">
                         <Check size={16} className="text-green-500" /> Photo Selected
                       </span>
                    </>
                 ) : (
                    <>
                      <div className="w-20 h-20 bg-background rounded-full flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform shadow-lg">
                        <Upload size={32} className="text-text-muted group-hover:text-gold transition-colors" />
                      </div>
                      <span className="text-sm text-text-muted group-hover:text-text-main transition-colors text-center">
                         Tap to upload a photo<br/>
                         <span className="text-xs opacity-60">or skip to use a default avatar</span>
                      </span>
                    </>
                 )}
                 <input 
                   type="file" 
                   ref={fileInputRef} 
                   className="hidden" 
                   accept="image/*" 
                   onChange={handleImageChange} 
                 />
               </div>
               <p className="text-center text-xs text-text-muted mt-4">You can change this later in your profile.</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch(step) {
      case 0: return "Account & Security";
      case 1: return "Founder & Venture";
      case 2: return "Profile Picture";
      default: return "";
    }
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[5%] left-[15%] w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[15%] right-[10%] w-80 h-80 bg-gold/5 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-md bg-surface/90 backdrop-blur-xl rounded-3xl border border-white/5 shadow-2xl flex flex-col h-[650px] relative z-10 animate-in fade-in zoom-in duration-300">
        
        {/* Header Section */}
        <div className="p-8 pb-4 text-center shrink-0 relative">
          <button 
            onClick={handleBack}
            className="absolute top-8 left-8 p-2 rounded-full hover:bg-white/5 text-text-muted hover:text-white transition-colors"
            title="Back"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="flex flex-col items-center">
            <h1 className="text-xl font-bold text-text-main tracking-tight mb-1">Create Account</h1>
            <p className="text-xs text-text-muted uppercase tracking-widest font-bold mb-4">Step {step + 1} of {TOTAL_STEPS}</p>
            
            {/* Progress Bar */}
            <div className="w-full max-w-[200px] h-1.5 bg-white/5 rounded-full overflow-hidden flex mb-2">
              <div className={`h-full bg-gold transition-all duration-500 ease-out`} style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}></div>
            </div>
            <p className="text-lg font-medium text-white">{getStepTitle()}</p>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto px-8 pb-4 no-scrollbar">
          {/* Prevent implicit submit on Enter by handling onSubmit manually */}
          <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="h-full flex flex-col">
            <div className="flex-1">
              {renderStepContent()}
            </div>

            {/* Error Display */}
            {(errors.general || error) && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
                 <AlertCircle size={16} className="shrink-0" /> 
                 <span>{errors.general || error}</span>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="pt-6 pb-4 mt-auto">
              {step < TOTAL_STEPS - 1 ? (
                <button 
                  type="button" 
                  onClick={handleNext}
                  className="w-full bg-surface border border-white/10 hover:bg-white/5 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  Continue <ArrowRight size={18} />
                </button>
              ) : (
                <button 
                  type="button" 
                  onClick={handleSubmit} // Explicitly call handleSubmit on last step
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-primary to-primary-hover hover:opacity-90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all border border-white/5 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 size={20} className="animate-spin"/> : "Complete Registration"}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterScreen;