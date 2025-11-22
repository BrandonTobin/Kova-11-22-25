
import React, { useState, useRef } from 'react';
import { ArrowLeft, Upload, MapPin, AlertCircle, ShieldCheck, User as UserIcon, Calendar, Briefcase, Flag, Hash, Mail, Lock, ChevronDown, Loader2 } from 'lucide-react';
import { User } from '../types';
import { SECURITY_QUESTIONS } from '../constants';

interface RegisterScreenProps {
  onRegister: (user: User) => void;
  onBack: () => void;
  isLoading?: boolean;
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

const RegisterScreen: React.FC<RegisterScreenProps> = ({ onRegister, onBack, isLoading = false }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<{email?: string, password?: string, general?: string}>({});
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: {email?: string, password?: string, general?: string} = {};
    let isValid = true;

    if (!formData.fullName.trim() || !formData.email.trim() || !formData.password || !formData.dob || !formData.securityAnswer.trim()) {
      newErrors.general = "Please fill in all required fields.";
      isValid = false;
    }

    if (formData.email.trim() && !validateEmail(formData.email)) {
      newErrors.email = "Invalid email address.";
      isValid = false;
    }

    setErrors(newErrors);

    if (!isValid) return;
    
    // We let Supabase/App.tsx handle the ID generation for UUID if needed, 
    // but for the 'User' object passed back, we can set a temp ID or let the parent handler overwrite it.
    // The Kova ID however is specific to our business logic.

    const newUser: User = {
      id: '', // Will be assigned by Supabase DB trigger or App handler
      kovaId: generateKovaId(),
      name: formData.fullName,
      email: formData.email,
      password: formData.password,
      role: formData.title === 'Other' ? formData.customTitle : formData.title,
      industry: 'Tech',
      bio: `Hi, I'm ${formData.fullName}. I'm currently in the ${formData.stage} stage looking to ${formData.mainGoal === 'Other' ? formData.customGoal : formData.mainGoal}.`,
      imageUrl: formData.imagePreview || 'https://picsum.photos/400/400?grayscale',
      tags: [formData.stage],
      badges: [],
      dob: formData.dob,
      age: calculateAge(formData.dob),
      gender: formData.gender,
      stage: formData.stage,
      location: { city: formData.city, state: formData.state },
      mainGoal: formData.mainGoal === 'Other' ? formData.customGoal : formData.mainGoal,
      securityQuestion: formData.securityQuestion,
      securityAnswer: formData.securityAnswer
    };

    onRegister(newUser);
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[5%] left-[15%] w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[15%] right-[10%] w-80 h-80 bg-gold/5 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-md bg-surface/90 backdrop-blur-xl rounded-3xl border border-white/5 shadow-2xl flex flex-col max-h-[90vh] relative z-10 animate-in fade-in zoom-in duration-300">
        
        <div className="p-8 pb-4 text-center shrink-0 relative">
          <button 
            onClick={onBack}
            className="absolute top-8 left-8 p-2 rounded-full hover:bg-white/5 text-text-muted hover:text-white transition-colors"
            title="Back to Login"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/20 text-primary">
             <UserIcon size={32} />
          </div>
          <h1 className="text-2xl font-bold text-text-main tracking-tight">Create Account</h1>
          <p className="text-text-muted text-sm mt-1">Match. Build. Scale.</p>
        </div>

        <div className="flex-1 overflow-y-auto px-8 pb-8 no-scrollbar">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Full Name */}
            <div>
              <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Full Name</label>
              <div className="relative group">
                 <input 
                  required 
                  type="text" 
                  value={formData.fullName} 
                  onChange={e => setFormData({...formData, fullName: e.target.value})} 
                  className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-text-main focus:border-gold/50 focus:ring-1 focus:ring-gold/50 outline-none transition-all placeholder-gray-500/50" 
                  placeholder="Brian O'Conner" 
                />
              </div>
            </div>

            {/* DOB */}
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
            </div>

            {/* Title & Stage Row */}
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

            {/* Gender */}
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

            {/* Location */}
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

            {/* Profile Picture */}
            <div>
               <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Profile Picture</label>
               <div 
                 onClick={() => fileInputRef.current?.click()}
                 className="w-full border border-dashed border-white/20 rounded-xl bg-background/50 hover:bg-white/5 transition-colors cursor-pointer p-4 flex items-center justify-center gap-2 group"
               >
                 {formData.imagePreview ? (
                    <div className="flex items-center gap-3">
                       <img src={formData.imagePreview} alt="Preview" className="w-12 h-12 rounded-full object-cover border border-white/10" />
                       <span className="text-sm text-text-main font-medium">Change Photo</span>
                    </div>
                 ) : (
                    <>
                      <Upload size={20} className="text-text-muted group-hover:text-gold transition-colors" />
                      <span className="text-sm text-text-muted group-hover:text-text-main transition-colors">Upload Photo</span>
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
            </div>

            {/* Main Goal */}
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

            {/* Email */}
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

            {/* Password */}
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
            </div>

            {/* Security Question */}
            <div className="pt-2">
               <div className="flex items-center gap-1.5 mb-1.5 ml-1">
                 <ShieldCheck size={14} className="text-gold" />
                 <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Security Question</label>
               </div>
               <div className="space-y-2">
                 <div className="relative">
                    <select 
                      value={formData.securityQuestion} 
                      onChange={e => setFormData({...formData, securityQuestion: e.target.value})} 
                      className="w-full bg-background border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-sm text-text-main focus:border-gold/50 outline-none appearance-none transition-all"
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
                   className="w-full bg-background border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text-main focus:border-gold/50 outline-none transition-all" 
                   placeholder="Your answer" 
                 />
               </div>
            </div>

            {errors.general && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2">
                 <AlertCircle size={14} /> {errors.general}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-primary to-primary-hover hover:opacity-90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all mt-4 border border-white/5 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 size={20} className="animate-spin"/> : "Complete Registration"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterScreen;
