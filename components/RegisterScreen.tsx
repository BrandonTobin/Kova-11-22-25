
import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Upload, MapPin, AlertCircle, ShieldCheck, Calendar, Flag, Mail, Lock, ChevronDown, Loader2, ArrowRight, Check, Crop, FileText } from 'lucide-react';
import { User, ViewState, getAvatarStyle } from '../types';
import { SECURITY_QUESTIONS } from '../constants';
import PhotoPositionEditor from './PhotoPositionEditor';

interface RegisterScreenProps {
  onRegister: (user: User, imageFile?: File) => void;
  onBack: () => void;
  isLoading?: boolean;
  error?: string;
  onClearError?: () => void;
  onNavigateLegal?: (view: ViewState) => void;
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

const RegisterScreen: React.FC<RegisterScreenProps> = ({ onRegister, onBack, isLoading = false, error, onClearError, onNavigateLegal }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Refs for Autofocus
  const fullNameRef = useRef<HTMLInputElement>(null);
  const dobRef = useRef<HTMLInputElement>(null);
  
  // 0-based index for steps: 0, 1, 2
  // We use a constant for max steps to prevent overflow
  const TOTAL_STEPS = 3;
  const [step, setStep] = useState(0); 

  const [errors, setErrors] = useState<{email?: string, password?: string, confirmPassword?: string, general?: string}>({});
  
  // Location Validation State
  const [isValidatingLocation, setIsValidatingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [isLocationVerified, setIsLocationVerified] = useState(false);

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
    bio: '', // Added Bio field
    image: null as File | null,
    imagePreview: '',
    // Avatar Positioning
    avatarZoom: 1,
    avatarOffsetX: 0,
    avatarOffsetY: 0,
    
    securityQuestion: SECURITY_QUESTIONS[0],
    securityAnswer: '',
    acceptTerms: false,
    acceptPrivacy: false,
    isSixteen: false,
  });

  const [showPhotoEditor, setShowPhotoEditor] = useState(false);

  // --- Persistence Logic ---
  useEffect(() => {
    // Restore from sessionStorage on mount
    const savedForm = sessionStorage.getItem('kova_register_form');
    const savedStep = sessionStorage.getItem('kova_register_step');

    if (savedForm) {
      try {
        const parsed = JSON.parse(savedForm);
        setFormData(prev => ({ ...prev, ...parsed, image: null })); // Cannot restore File object
      } catch (e) {
        console.error("Failed to restore registration form", e);
      }
    }
    if (savedStep) {
      // CLAMP STEP to ensure it never exceeds bounds
      const parsedStep = parseInt(savedStep);
      const safeStep = Math.min(Math.max(parsedStep, 0), TOTAL_STEPS - 1);
      setStep(safeStep);
    }
  }, []);

  useEffect(() => {
    // Save to sessionStorage on change
    const { image, ...rest } = formData; // Exclude File object
    sessionStorage.setItem('kova_register_form', JSON.stringify(rest));
    sessionStorage.setItem('kova_register_step', step.toString());
  }, [formData, step]);

  // --- Autofocus Logic ---
  useEffect(() => {
    // Small timeout to ensure DOM render
    const timer = setTimeout(() => {
      if (step === 0 && fullNameRef.current) {
        fullNameRef.current.focus();
      } else if (step === 1 && dobRef.current) {
        dobRef.current.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [step]);

  // --- Formatting Helper ---
  const capitalizeName = (name: string) => {
    return name.toLowerCase().replace(/(?:^|\s|-|')\S/g, (c) => c.toUpperCase());
  };

  const handleNameBlur = () => {
    setFormData(prev => ({
      ...prev,
      fullName: capitalizeName(prev.fullName)
    }));
  };

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
      const previewUrl = URL.createObjectURL(file);
      setFormData({
        ...formData,
        image: file,
        imagePreview: previewUrl,
        // Reset zoom/offset on new image
        avatarZoom: 1,
        avatarOffsetX: 0,
        avatarOffsetY: 0
      });
      // Automatically open editor when new image is selected
      setShowPhotoEditor(true);
    }
  };

  // --- Location Validation (Nominatim) ---
  const validateLocation = async (city: string, state: string): Promise<boolean> => {
    if (!city.trim()) {
      setIsLocationVerified(false);
      return false;
    }

    setIsValidatingLocation(true);
    setLocationError('');
    setIsLocationVerified(false);

    try {
      let url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&city=${encodeURIComponent(city.trim())}&country=USA`;
      if (state) {
        url += `&state=${encodeURIComponent(state)}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error('Location check failed');
      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        setIsLocationVerified(true);
        setIsValidatingLocation(false);
        return true;
      } else {
        setLocationError("We couldn't find that city. Please check spelling.");
        setIsValidatingLocation(false);
        return false;
      }
    } catch (err) {
      console.error("Geocoding error", err);
      setLocationError("Could not verify location. Please try again.");
      setIsValidatingLocation(false);
      return false;
    }
  };

  const handleCityBlur = () => {
    if (formData.city) {
      validateLocation(formData.city, formData.state);
    }
  };

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newState = e.target.value;
    setFormData(prev => ({ ...prev, state: newState }));
    if (formData.city) {
      validateLocation(formData.city, newState);
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
        newErrors.general = "You must be at least 16 years old to use Kova.";
        isValid = false;
      }
      if (!formData.city.trim()) {
        newErrors.general = "Please enter your city.";
        isValid = false;
      } else if (!formData.state) {
        newErrors.general = "Please select your state.";
        isValid = false;
      }
      // Bio is optional but recommended, no strict validation needed unless desired
    } else if (currentStep === 2) { // Step 2: Final & Consent
      if (!formData.acceptTerms || !formData.acceptPrivacy || !formData.isSixteen) {
        newErrors.general = "You must accept the Terms, Privacy Policy, and confirm your age.";
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Auto-capitalize one last time just in case
    const finalName = capitalizeName(formData.fullName);

    // Default Avatar if no image uploaded
    const safeImageUrl = `https://ui-avatars.com/api/?background=0D8ABC&color=fff&name=${encodeURIComponent(finalName)}`;

    // Use provided bio or fallback to generated one
    const finalBio = formData.bio.trim() 
      ? formData.bio.trim() 
      : `Hi, I'm ${finalName}. I'm currently in the ${formData.stage} stage looking to ${formData.mainGoal === 'Other' ? formData.customGoal : formData.mainGoal}.`;

    const newUser: User = {
      id: '', // Assigned by DB/App
      kovaId: generateKovaId(),
      name: finalName,
      email: formData.email,
      password: formData.password,
      role: formData.title === 'Other' ? formData.customTitle : formData.title,
      industry: 'Tech',
      bio: finalBio,
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
      proExpiresAt: null,
      // Avatar Settings
      avatarZoom: formData.avatarZoom,
      avatarOffsetX: formData.avatarOffsetX,
      avatarOffsetY: formData.avatarOffsetY
    };

    onRegister(newUser, formData.image || undefined);
  };

  const handleNext = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Auto-capitalize name when moving from Step 0
    if (step === 0) {
      setFormData(prev => ({ ...prev, fullName: capitalizeName(prev.fullName) }));
    }

    // Sync Validation First
    if (!validateStep(step)) return;

    // Step 1: Async Location Check
    if (step === 1) {
      const isValidLoc = await validateLocation(formData.city, formData.state);
      if (!isValidLoc) return; 
    }

    // Proceed if not on last step
    if (step < TOTAL_STEPS - 1) {
      // Safely increment step, preventing overflow
      setStep(prev => Math.min(prev + 1, TOTAL_STEPS - 1));
      if (onClearError) onClearError();
    } else {
      // Last step: Submit
      handleSubmit(e);
    }
  };

  const handleBack = () => {
    if (step === 0) {
      // Clear persistence on explicit back to login
      sessionStorage.removeItem('kova_register_form');
      sessionStorage.removeItem('kova_register_step');
      onBack();
    } else {
      // Safely decrement step
      setStep(prev => Math.max(prev - 1, 0));
      setErrors({});
      if (onClearError) onClearError();
    }
  };

  // Render Steps
  const renderStepContent = () => {
    switch (step) {
      case 0: // Account & Security
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right duration-300">
            <div>
              <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Full Name</label>
              <input 
                ref={fullNameRef}
                type="text" 
                value={formData.fullName} 
                onChange={e => setFormData({...formData, fullName: e.target.value})} 
                onBlur={handleNameBlur}
                className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-text-main focus:border-gold/50 outline-none" 
                placeholder="e.g. John Doe" 
              />
            </div>
            
            <div>
              <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-background border border-white/10 rounded-xl pl-10 pr-4 py-3 text-text-main focus:border-gold/50 outline-none" placeholder="founder@example.com" />
              </div>
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                  <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-background border border-white/10 rounded-xl pl-10 pr-4 py-3 text-text-main focus:border-gold/50 outline-none" placeholder="Min 6 chars" />
                </div>
                {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Confirm</label>
                <input type="password" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-text-main focus:border-gold/50 outline-none" placeholder="Repeat password" />
                {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>}
              </div>
            </div>

            <div className="bg-surface border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                 <ShieldCheck className="text-gold" size={18} />
                 <span className="text-sm font-bold text-text-main">Account Recovery</span>
              </div>
              <div className="space-y-3">
                 <div>
                    <label className="block text-xs text-text-muted mb-1">Security Question</label>
                    <div className="relative">
                      <select value={formData.securityQuestion} onChange={e => setFormData({...formData, securityQuestion: e.target.value})} className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-text-main appearance-none focus:border-gold/50 outline-none">
                        {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={14} />
                    </div>
                 </div>
                 <div>
                    <label className="block text-xs text-text-muted mb-1">Answer</label>
                    <input type="text" value={formData.securityAnswer} onChange={e => setFormData({...formData, securityAnswer: e.target.value})} className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-text-main focus:border-gold/50 outline-none" placeholder="Your answer" />
                 </div>
              </div>
            </div>
          </div>
        );
      case 1: // Founder Profile
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right duration-300">
             <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Date of Birth</label>
                  <div className="relative">
                     <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                     <input ref={dobRef} type="date" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} className="w-full bg-background border border-white/10 rounded-xl pl-10 pr-4 py-3 text-text-main focus:border-gold/50 outline-none" />
                  </div>
               </div>
               <div>
                  <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Gender</label>
                  <div className="relative">
                    <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value as any})} className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-text-main appearance-none focus:border-gold/50 outline-none">
                       <option value="Male">Male</option>
                       <option value="Female">Female</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={18} />
                  </div>
               </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Title</label>
                   <div className="relative">
                      <select value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-text-main appearance-none focus:border-gold/50 outline-none text-sm">
                        {TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={18} />
                   </div>
                   {formData.title === 'Other' && (
                     <input type="text" value={formData.customTitle} onChange={e => setFormData({...formData, customTitle: e.target.value})} className="w-full bg-background border border-white/10 rounded-xl px-4 py-2 mt-2 text-text-main focus:border-gold/50 outline-none text-sm" placeholder="Enter Title" />
                   )}
                </div>
                <div>
                   <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Stage</label>
                   <div className="relative">
                      <select value={formData.stage} onChange={e => setFormData({...formData, stage: e.target.value})} className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-text-main appearance-none focus:border-gold/50 outline-none text-sm">
                        {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <Flag className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={18} />
                   </div>
                </div>
             </div>

             <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Location</label>
                <div className="grid grid-cols-2 gap-2">
                   <div className="relative">
                      <input 
                        type="text" 
                        value={formData.city} 
                        onChange={(e) => {
                          setFormData({ ...formData, city: e.target.value });
                          setIsLocationVerified(false);
                          setLocationError('');
                        }}
                        onBlur={handleCityBlur}
                        className={`w-full bg-background border rounded-xl px-4 py-3 text-text-main focus:border-gold/50 outline-none ${locationError ? 'border-red-500/50' : isLocationVerified ? 'border-green-500/50' : 'border-white/10'}`} 
                        placeholder="City" 
                        autoComplete="off"
                      />
                   </div>

                   <div className="relative">
                      <select value={formData.state} onChange={handleStateChange} className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-text-main appearance-none focus:border-gold/50 outline-none text-sm">
                         <option value="">Select State</option>
                         {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={18} />
                   </div>
                </div>
                
                <div className="min-h-[20px] mt-1 ml-1">
                  {isValidatingLocation ? (
                    <div className="flex items-center gap-1.5 text-xs text-text-muted animate-pulse">
                      <Loader2 size={12} className="animate-spin" /> Validating location...
                    </div>
                  ) : locationError ? (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                      <AlertCircle size={12} /> {locationError}
                    </p>
                  ) : isLocationVerified ? (
                    <p className="text-xs text-green-500 flex items-center gap-1">
                      <Check size={12} /> Location verified
                    </p>
                  ) : null}
                </div>
             </div>

             <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1">Main Goal</label>
                <div className="relative">
                    <select value={formData.mainGoal} onChange={e => setFormData({...formData, mainGoal: e.target.value})} className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-text-main appearance-none focus:border-gold/50 outline-none text-sm">
                       {GOALS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={18} />
                </div>
                {formData.mainGoal === 'Other' && (
                     <input type="text" value={formData.customGoal} onChange={e => setFormData({...formData, customGoal: e.target.value})} className="w-full bg-background border border-white/10 rounded-xl px-4 py-2 mt-2 text-text-main focus:border-gold/50 outline-none text-sm" placeholder="What is your goal?" />
                )}
             </div>

             {/* BIO FIELD ADDITION */}
             <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-gold mb-1.5 ml-1 flex items-center gap-1">
                  Bio
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-4 text-text-muted" size={18} />
                  <textarea 
                    value={formData.bio}
                    onChange={e => setFormData({...formData, bio: e.target.value})}
                    className="w-full bg-background border border-white/10 rounded-xl pl-10 pr-4 py-3 text-text-main focus:border-gold/50 outline-none resize-none h-24 text-sm leading-relaxed"
                    placeholder="What you’re working on, interests, founder/investor, etc."
                  />
                </div>
             </div>
          </div>
        );
      case 2: // Profile Image & Consent
        return (
          <div className="flex flex-col items-center justify-start space-y-6 animate-in fade-in zoom-in duration-300 py-4">
             <div className="relative group cursor-pointer">
                <div 
                  className="w-40 h-40 rounded-full border-4 border-dashed border-white/20 flex items-center justify-center bg-background hover:bg-white/5 transition-colors overflow-hidden"
                  onClick={() => fileInputRef.current?.click()}
                >
                   {formData.imagePreview ? (
                     <img 
                       src={formData.imagePreview} 
                       alt="Preview" 
                       className="w-full h-full object-cover" 
                       style={getAvatarStyle({
                         avatarZoom: formData.avatarZoom,
                         avatarOffsetX: formData.avatarOffsetX,
                         avatarOffsetY: formData.avatarOffsetY
                       })}
                     />
                   ) : (
                     <div className="text-center text-text-muted">
                        <Upload size={32} className="mx-auto mb-2 opacity-50" />
                        <span className="text-xs uppercase tracking-wide">Upload Photo</span>
                     </div>
                   )}
                </div>
                
                {formData.imagePreview && (
                  <button 
                    onClick={() => setShowPhotoEditor(true)}
                    className="absolute -bottom-2 -right-2 bg-surface text-text-main border border-white/20 p-2 rounded-full shadow-lg hover:bg-white/10 transition-colors"
                    title="Adjust Photo"
                  >
                    <Crop size={16} />
                  </button>
                )}

                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleImageChange}
                />
             </div>
             
             {/* Agreements */}
             <div className="w-full bg-surface border border-white/10 rounded-xl p-4 space-y-3">
               <label className="flex items-start gap-3 cursor-pointer">
                 <input 
                   autoFocus 
                   type="checkbox" 
                   checked={formData.acceptTerms}
                   onChange={(e) => setFormData({...formData, acceptTerms: e.target.checked})}
                   className="mt-1 accent-gold w-4 h-4"
                 />
                 <span className="text-xs text-text-muted">
                   I agree to the <button type="button" onClick={() => onNavigateLegal?.(ViewState.TERMS)} className="text-primary hover:underline">Terms of Service</button>
                 </span>
               </label>
               
               <label className="flex items-start gap-3 cursor-pointer">
                 <input 
                   type="checkbox" 
                   checked={formData.acceptPrivacy}
                   onChange={(e) => setFormData({...formData, acceptPrivacy: e.target.checked})}
                   className="mt-1 accent-gold w-4 h-4"
                 />
                 <span className="text-xs text-text-muted">
                   I agree to the <button type="button" onClick={() => onNavigateLegal?.(ViewState.PRIVACY)} className="text-primary hover:underline">Privacy Policy</button>
                 </span>
               </label>

               <label className="flex items-start gap-3 cursor-pointer">
                 <input 
                   type="checkbox" 
                   checked={formData.isSixteen}
                   onChange={(e) => setFormData({...formData, isSixteen: e.target.checked})}
                   className="mt-1 accent-gold w-4 h-4"
                 />
                 <span className="text-xs text-text-muted">
                   I confirm I am 16 years of age or older.
                 </span>
               </label>
             </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-6 relative">
       {/* Background */}
       <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[5%] right-[15%] w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] left-[10%] w-80 h-80 bg-gold/5 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-md w-full bg-surface/90 backdrop-blur-xl rounded-3xl border border-white/5 shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
         {/* Header */}
         <div className="p-6 border-b border-white/5 bg-black/20 shrink-0">
            <div className="flex items-center justify-between mb-4">
               <button onClick={handleBack} className="text-text-muted hover:text-white transition-colors">
                  <ArrowLeft size={20} />
               </button>
               <span className="text-xs font-bold text-gold uppercase tracking-widest">
                  Step {step + 1} of {TOTAL_STEPS}
               </span>
               <div className="w-5"></div> {/* Spacer */}
            </div>
            <h2 className="text-2xl font-bold text-text-main text-center">
               {step === 0 && "Create Account"}
               {step === 1 && "Founder Profile"}
               {step === 2 && "Finalize & Consent"}
            </h2>
         </div>

         {/* Content */}
         <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 text-red-400 text-sm">
                 <AlertCircle size={16} className="mt-0.5 shrink-0" />
                 <span>{error}</span>
              </div>
            )}
            
            {errors.general && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
                 {errors.general}
              </div>
            )}

            <form onSubmit={handleNext}>
              {renderStepContent()}
              
              {/* Fake submit button to handle Enter key */}
              <button type="submit" className="hidden" />
            </form>
         </div>

         {/* Footer */}
         <div className="p-6 border-t border-white/5 bg-surface shrink-0">
            <button 
              onClick={handleNext}
              disabled={isLoading || isValidatingLocation}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-bold shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group"
            >
               {isLoading || isValidatingLocation ? <Loader2 className="animate-spin" size={20} /> : (
                 step === TOTAL_STEPS - 1 ? (
                   <>Complete Registration <Check size={20} /></>
                 ) : (
                   <>Next Step <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" /></>
                 )
               )}
            </button>
         </div>
      </div>

      {showPhotoEditor && formData.imagePreview && (
        <PhotoPositionEditor 
          imageSrc={formData.imagePreview}
          initialZoom={formData.avatarZoom}
          initialOffsetX={formData.avatarOffsetX}
          initialOffsetY={formData.avatarOffsetY}
          onCancel={() => setShowPhotoEditor(false)}
          onSave={(settings) => {
            setFormData({
              ...formData,
              avatarZoom: settings.zoom,
              avatarOffsetX: settings.offsetX,
              avatarOffsetY: settings.offsetY
            });
            setShowPhotoEditor(false);
          }}
        />
      )}
    </div>
  );
};

export default RegisterScreen;
