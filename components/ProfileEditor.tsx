import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, Match, SubscriptionTier } from '../types';
import { 
  Save, Sparkles, X, Copy, CheckCircle, Loader2, Camera, Edit2, 
  Crown, MapPin, Link as LinkIcon, Briefcase, 
  Target, MessageCircle, Clock, Globe, Share2, Plus, Hash, Users, Check, Lock
} from 'lucide-react';
import { enhanceBio } from '../services/geminiService';
import { DEFAULT_PROFILE_IMAGE, SUBSCRIPTION_PLANS } from '../constants';
import { getDisplayName } from '../utils/nameUtils';

interface ProfileEditorProps {
  user: User;
  onSave: (updatedUser: User, imageFile?: File) => void;
  onUpgrade: (tier: SubscriptionTier) => void;
  matches?: Match[];
}

// Helper component for tag inputs
const TagInput = ({ 
  tags, 
  onAdd, 
  onRemove, 
  placeholder, 
  isEditing, 
  icon: Icon 
}: { 
  tags: string[], 
  onAdd: (tag: string) => void, 
  onRemove: (tag: string) => void, 
  placeholder: string, 
  isEditing: boolean,
  icon?: React.ElementType
}) => {
  const [input, setInput] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      onAdd(input.trim());
      setInput('');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((tag, idx) => (
          <span key={idx} className="bg-background border border-white/10 px-3 py-1 rounded-full text-sm text-text-main flex items-center gap-1">
            {Icon && <Icon size={12} className="text-secondary" />}
            {tag}
            {isEditing && (
              <button onClick={() => onRemove(tag)} className="text-text-muted hover:text-red-400 ml-1">
                <X size={14} />
              </button>
            )}
          </span>
        ))}
        {tags.length === 0 && !isEditing && <span className="text-text-muted text-sm italic">None listed</span>}
      </div>
      {isEditing && (
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm text-text-main focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all"
          />
          <button 
            onClick={() => { if(input.trim()) { onAdd(input.trim()); setInput(''); } }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-primary hover:text-primary-hover p-1"
          >
            <Plus size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

const ProfileEditor: React.FC<ProfileEditorProps> = ({ user, onSave, onUpgrade, matches = [] }) => {
  // Initialize form data with defaults for new fields to avoid undefined errors
  const [formData, setFormData] = useState<User>({
    ...user,
    location: user.location || { city: '', state: '' },
    skills: user.skills || [],
    lookingFor: user.lookingFor || [],
    availability: user.availability || [],
    goalsList: user.goalsList || [],
    links: user.links || { linkedin: '', website: '', twitter: '', portfolio: '' }
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  
  // Track the raw file for upload
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Connections modal state
  const [showConnectionsModal, setShowConnectionsModal] = useState(false);

  // Derive connections from matches
  const connections = useMemo(() => {
    const map = new Map<string, Match['user']>();
    (matches || []).forEach((m) => {
      if (m.user?.id) {
        map.set(m.user.id, m.user);
      }
    });
    return Array.from(map.values());
  }, [matches]);

  // Re-sync if user prop changes externally
  useEffect(() => {
    setFormData({
      ...user,
      location: user.location || { city: '', state: '' },
      skills: user.skills || [],
      lookingFor: user.lookingFor || [],
      availability: user.availability || [],
      goalsList: user.goalsList || [],
      links: user.links || { linkedin: '', website: '', twitter: '', portfolio: '' }
    });
    setImageFile(null);
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Handle nested objects
    if (name.startsWith('links.')) {
      const linkKey = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        links: { ...prev.links, [linkKey]: value }
      }));
    } else if (name === 'city' || name === 'state') {
      setFormData(prev => ({
        ...prev,
        location: { ...prev.location, [name]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        // Show local preview immediately
        setFormData(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAiEnhance = async () => {
    setIsEnhancing(true);
    try {
      const enhanced = await enhanceBio(formData.bio);
      setFormData(prev => ({ ...prev, bio: enhanced }));
    } catch (error) {
      console.error("Failed to enhance bio");
    } finally {
      setIsEnhancing(false);
    }
  };

  const copyIdToClipboard = () => {
    navigator.clipboard.writeText(formData.kovaId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const copyProfileLink = () => {
    navigator.clipboard.writeText(`https://kova.app/p/${formData.kovaId}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSave = () => {
    onSave(formData, imageFile || undefined);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      ...user,
      location: user.location || { city: '', state: '' },
      skills: user.skills || [],
      lookingFor: user.lookingFor || [],
      availability: user.availability || [],
      goalsList: user.goalsList || [],
      links: user.links || { linkedin: '', website: '', twitter: '', portfolio: '' }
    }); 
    setImageFile(null);
    setIsEditing(false);
  };

  const addToArray = (field: keyof User, item: string) => {
    setFormData(prev => {
      const current = (prev[field] as string[]) || [];
      if (!current.includes(item)) {
        return { ...prev, [field]: [...current, item] };
      }
      return prev;
    });
  };

  const removeFromArray = (field: keyof User, item: string) => {
    setFormData(prev => {
      const current = (prev[field] as string[]) || [];
      return { ...prev, [field]: current.filter(i => i !== item) };
    });
  };

  return (
    <div className="max-w-6xl mx-auto pb-12 px-4 md:px-6">
      
      {/* 1. TOP HEADER: Identity & Actions */}
      <div className="bg-surface border border-white/10 rounded-2xl p-6 mb-8 flex flex-col md:flex-row items-center md:items-start gap-6 relative shadow-lg">
          {/* Avatar Section */}
          <div className="relative group shrink-0">
             <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-background shadow-2xl overflow-hidden relative bg-black">
                <img 
                  src={formData.imageUrl || DEFAULT_PROFILE_IMAGE} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.src = DEFAULT_PROFILE_IMAGE; }}
                />
                {isEditing && (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Camera size={24} className="text-white mb-1" />
                    <span className="text-[10px] uppercase font-bold text-white tracking-widest">Change</span>
                  </div>
                )}
             </div>
             <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleImageChange}
             />
          </div>

          {/* Info Section */}
          <div className="flex-1 text-center md:text-left pt-2 w-full md:w-auto">
             {isEditing ? (
                <div className="space-y-3 max-w-md mx-auto md:mx-0">
                   <div>
                      <label className="block text-xs font-medium text-text-muted mb-1 text-left">Full Name</label>
                      <input 
                        type="text" 
                        name="name" 
                        value={formData.name} 
                        onChange={handleChange} 
                        className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-text-main focus:outline-none focus:border-gold/50" 
                        placeholder="Full Name"
                      />
                   </div>
                   <div>
                      <label className="block text-xs font-medium text-text-muted mb-1 text-left">Role / Title</label>
                      <input 
                        type="text" 
                        name="role" 
                        value={formData.role} 
                        onChange={handleChange} 
                        className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-text-main focus:outline-none focus:border-gold/50" 
                        placeholder="Title / Role"
                      />
                   </div>
                </div>
             ) : (
                <>
                   <h1 className="text-3xl font-bold text-text-main mb-1">{formData.name || "User"}</h1>
                   <p className="text-lg text-text-muted mb-4">{formData.role || "Founder"}</p>
                </>
             )}
             
             <div className="flex flex-wrap gap-3 justify-center md:justify-start mt-4">
                 <button
                  type="button"
                  onClick={() => connections.length > 0 && setShowConnectionsModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-background border border-white/10 rounded-xl text-sm font-medium text-text-muted hover:text-primary transition-colors disabled:opacity-50"
                  disabled={connections.length === 0}
                >
                  <Users size={16} className="text-primary" />
                  <span>
                    {connections.length} connection{connections.length !== 1 ? 's' : ''}
                  </span>
                </button>
             </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-2 md:mt-0 md:self-start">
             {!isEditing ? (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl transition-colors border border-primary/20 font-medium"
                >
                  <Edit2 size={16} /> Edit Profile
                </button>
              ) : (
                <>
                  <button 
                    onClick={handleCancel}
                    className="px-5 py-2.5 border border-white/10 rounded-xl text-text-muted hover:bg-white/5 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSave}
                    className="px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-hover transition-colors font-bold shadow-lg flex items-center gap-2"
                  >
                    <Save size={18} /> Save Changes
                  </button>
                </>
              )}
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Metadata & Subscription */}
        <div className="space-y-6 lg:col-span-1">
          {/* Account Tier */}
          <div className="bg-surface border border-white/10 rounded-2xl p-5 shadow-sm relative overflow-hidden">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">Account Tier</h3>
            
            <div className="flex items-center gap-3 mb-4">
               {user.subscriptionTier === 'kova_pro' ? (
                 <div className="w-12 h-12 bg-gradient-to-br from-gold to-amber-600 rounded-full flex items-center justify-center text-white shadow-lg shrink-0">
                   <Crown size={24} fill="currentColor" />
                 </div>
               ) : user.subscriptionTier === 'kova_plus' ? (
                  <div className="w-12 h-12 bg-surface border border-white/20 rounded-full flex items-center justify-center text-white shadow-lg shrink-0">
                   <Crown size={24} className="text-white" fill="white" />
                 </div>
               ) : (
                 <div className="w-12 h-12 bg-surface border border-white/10 rounded-full flex items-center justify-center text-text-muted shrink-0">
                   <UserIcon size={24} />
                 </div>
               )}
               <div>
                  <p className="font-bold text-text-main text-lg">
                    {SUBSCRIPTION_PLANS[user.subscriptionTier]?.name || 'Unknown'}
                  </p>
                  <p className="text-xs text-text-muted">
                    {user.subscriptionTier === 'free' ? 'Standard Access' : 'Active Subscription'}
                  </p>
               </div>
            </div>
            
            <div className="pt-4 border-t border-white/5">
              <button 
                onClick={copyProfileLink}
                className="w-full flex items-center justify-between text-sm text-text-muted hover:text-white group transition-colors"
              >
                <span className="flex items-center gap-2"><Share2 size={14} /> Copy Profile Link</span>
                {copiedLink ? <CheckCircle size={14} className="text-green-500"/> : <Copy size={14} className="opacity-0 group-hover:opacity-100 transition-opacity"/>}
              </button>
            </div>
          </div>

          {/* Subscription Selector */}
          <div className="bg-surface border border-white/10 rounded-2xl p-6">
             <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-6 pb-2 border-b border-white/5">Subscription</h3>
             
             <div className="grid grid-cols-1 gap-4">
                {Object.values(SUBSCRIPTION_PLANS).map((plan) => {
                  const isCurrent = user.subscriptionTier === plan.id;
                  const isPro = plan.id === 'kova_pro';
                  const isPlus = plan.id === 'kova_plus';
                  const isFree = plan.id === 'free';
                  
                  return (
                    <div 
                      key={plan.id}
                      className={`relative flex flex-col p-4 rounded-xl border transition-all ${
                        isCurrent 
                          ? 'bg-white/5 border-gold shadow-[0_0_15px_rgba(214,167,86,0.15)]' 
                          : 'bg-background border-white/5 hover:border-white/10'
                      }`}
                    >
                      {/* Locked Overlay for Pro */}
                      {isPro && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-xl">
                           <div className="px-4 py-2 rounded-full bg-black/80 flex items-center gap-2 border border-white/10 shadow-xl">
                              <Lock size={12} className="text-zinc-400" />
                              <span className="text-xs font-semibold tracking-wide text-white">
                                Kova Pro | Coming Soon
                              </span>
                           </div>
                        </div>
                      )}

                      {/* Content Wrapper - Pointer events disabled for Pro */}
                      <div className={isPro ? "pointer-events-none" : ""}>
                        {isCurrent && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-surface text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm z-10">
                            Current
                          </div>
                        )}
                        
                        <div className="text-center mb-4 mt-2">
                           <h4 className={`font-bold text-lg ${isPro ? 'text-gold' : 'text-text-main'}`}>
                             {plan.name}
                           </h4>
                           <p className="text-sm font-medium text-text-muted">{plan.price}</p>
                        </div>

                        <ul className="space-y-2 mb-6 flex-1">
                          {plan.features.slice(0, 3).map((feat, i) => (
                            <li key={i} className="text-xs text-text-muted flex items-start gap-2">
                              <Check size={12} className={`shrink-0 mt-0.5 ${isPro ? 'text-gold' : 'text-text-muted'}`} />
                              <span className="leading-tight">{feat}</span>
                            </li>
                          ))}
                        </ul>
                        
                        {!isCurrent && !isFree && (
                          <button 
                            disabled={isPro}
                            onClick={() => onUpgrade(plan.id)}
                            className={`w-full py-2 rounded-lg text-xs font-bold transition-colors ${
                              isPro 
                                ? 'bg-gradient-to-r from-gold to-amber-600 text-white opacity-50 cursor-not-allowed' 
                                : 'bg-surface border border-white/10 hover:bg-white/5 text-text-main'
                            }`}
                          >
                            Choose {plan.name.replace('Kova ', '')}
                          </button>
                        )}
                        
                        {isCurrent && (
                          <div className="w-full py-2 text-center text-xs font-bold text-gold/50 cursor-default">
                            Active
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
             </div>
          </div>

          {/* Kova ID Card */}
          <div className="bg-surface border border-white/10 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-background rounded-md text-gold border border-gold/20">
                  <Hash size={14} />
                </div>
                <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Kova ID</span>
              </div>
              <button 
                onClick={copyIdToClipboard}
                className="text-text-muted hover:text-white transition-colors"
                title="Copy ID"
              >
                {copiedId ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
              </button>
            </div>
            <div className="bg-background rounded-lg border border-white/5 p-3 text-center">
              <p className="text-xl font-mono font-bold text-text-main tracking-widest">{formData.kovaId}</p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Profile Content */}
        <div className="lg:col-span-2 space-y-6">

          {/* Professional Info */}
          <div className="bg-surface border border-white/10 rounded-2xl p-6">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-6 pb-2 border-b border-white/5">Professional Info</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Industry */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1.5 flex items-center gap-1.5"><Globe size={14} /> Industry</label>
                {isEditing ? (
                  <input type="text" name="industry" value={formData.industry} onChange={handleChange} className="w-full bg-background border border-white/10 rounded-lg px-3 py-2.5 text-text-main focus:outline-none focus:border-gold/50 transition-all" />
                ) : (
                  <p className="text-text-main">{formData.industry}</p>
                )}
              </div>

              {/* Stage */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1.5">Stage</label>
                {isEditing ? (
                  <select name="stage" value={formData.stage} onChange={handleChange} className="w-full bg-background border border-white/10 rounded-lg px-3 py-2.5 text-text-main focus:outline-none focus:border-gold/50 transition-all">
                    {['Idea', 'Early', 'Growing', 'Scaling'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <span className="inline-block px-3 py-1 bg-primary/10 text-primary rounded-lg text-sm font-bold border border-primary/20">{formData.stage}</span>
                )}
              </div>

              {/* Experience Level */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1.5">Experience Level</label>
                {isEditing ? (
                  <select name="experienceLevel" value={formData.experienceLevel || ''} onChange={handleChange} className="w-full bg-background border border-white/10 rounded-lg px-3 py-2.5 text-text-main focus:outline-none focus:border-gold/50 transition-all">
                    <option value="">Select...</option>
                    {['Beginner', 'Junior', 'Mid-Level', 'Senior', 'Expert', 'Executive'].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                ) : (
                  <p className="text-text-main">{formData.experienceLevel || 'Not specified'}</p>
                )}
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1.5 flex items-center gap-1.5"><MapPin size={14} /> Location</label>
                {isEditing ? (
                  <div className="flex gap-2">
                    <input type="text" name="city" placeholder="City" value={formData.location.city} onChange={handleChange} className="w-full bg-background border border-white/10 rounded-lg px-3 py-2.5 text-text-main focus:outline-none focus:border-gold/50 transition-all" />
                    <input type="text" name="state" placeholder="State" value={formData.location.state} onChange={handleChange} className="w-20 bg-background border border-white/10 rounded-lg px-3 py-2.5 text-text-main focus:outline-none focus:border-gold/50 transition-all" />
                  </div>
                ) : (
                  <p className="text-text-main">
                    {formData.location.city && formData.location.state 
                      ? `${formData.location.city}, ${formData.location.state}` 
                      : 'Not specified'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* About You */}
          <div className="bg-surface border border-white/10 rounded-2xl p-6">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-6 pb-2 border-b border-white/5">About You</h3>
            
            <div className="space-y-6">
              {/* Bio */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-text-muted">Bio</label>
                  {isEditing && (
                    <button onClick={handleAiEnhance} disabled={isEnhancing} className="text-xs text-gold flex items-center gap-1 hover:underline disabled:opacity-50">
                      {isEnhancing ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>} Enhance
                    </button>
                  )}
                </div>
                {isEditing ? (
                  <textarea name="bio" value={formData.bio} onChange={handleChange} rows={4} className="w-full bg-background border border-white/10 rounded-lg px-4 py-3 text-text-main focus:outline-none focus:border-gold/50 transition-all leading-relaxed" />
                ) : (
                  <p className="text-text-main leading-relaxed whitespace-pre-wrap">{formData.bio || "No bio yet."}</p>
                )}
              </div>

              {/* Goals */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2 flex items-center gap-1.5"><Target size={14} /> Goals</label>
                {isEditing ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map(idx => (
                      <input 
                        key={idx}
                        type="text" 
                        placeholder={`Goal ${idx + 1}`}
                        value={formData.goalsList?.[idx] || ''} 
                        onChange={(e) => {
                          const newGoals = [...(formData.goalsList || [])];
                          newGoals[idx] = e.target.value;
                          setFormData(prev => ({ ...prev, goalsList: newGoals }));
                        }} 
                        className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-text-main focus:outline-none focus:border-gold/50 transition-all" 
                      />
                    ))}
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {(formData.goalsList && formData.goalsList.filter(Boolean).length > 0) ? (
                      formData.goalsList.filter(Boolean).map((goal, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-text-main">
                          <span className="text-gold mt-1.5">•</span> {goal}
                        </li>
                      ))
                    ) : (
                      <li className="text-text-muted text-sm italic">No goals set yet.</li>
                    )}
                  </ul>
                )}
              </div>

              {/* Communication Style */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2 flex items-center gap-1.5"><MessageCircle size={14} /> Preferred Communication</label>
                {isEditing ? (
                  <select 
                    name="communicationStyle" 
                    value={formData.communicationStyle || ''} 
                    onChange={handleChange} 
                    className="w-full bg-background border border-white/10 rounded-lg px-3 py-2.5 text-text-main focus:outline-none focus:border-gold/50 transition-all"
                  >
                    <option value="">Select...</option>
                    <option value="Async only">Async only (Text/Email)</option>
                    <option value="Video calls preferred">Video calls preferred</option>
                    <option value="Flexible">Flexible</option>
                    <option value="Strictly scheduled">Strictly scheduled</option>
                  </select>
                ) : (
                  <span className="inline-block px-3 py-1 bg-surface border border-white/10 rounded-full text-sm text-text-main">{formData.communicationStyle || 'Not specified'}</span>
                )}
              </div>
            </div>
          </div>

          {/* Interests & Connect */}
          <div className="bg-surface border border-white/10 rounded-2xl p-6">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-6 pb-2 border-b border-white/5">Interests & Connect</h3>
            
            <div className="space-y-6">
              {/* Skills */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">Skills / Strengths</label>
                <TagInput 
                  tags={formData.skills || []} 
                  onAdd={(t) => addToArray('skills', t)} 
                  onRemove={(t) => removeFromArray('skills', t)} 
                  placeholder="Add a skill (e.g. Sales, React)" 
                  isEditing={isEditing}
                />
              </div>

              {/* Interests */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">Interests</label>
                <TagInput 
                  tags={formData.tags || []} 
                  onAdd={(t) => addToArray('tags', t)} 
                  onRemove={(t) => removeFromArray('tags', t)} 
                  placeholder="Add interest" 
                  isEditing={isEditing}
                />
              </div>

              {/* Looking For */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">Looking For</label>
                <TagInput 
                  tags={formData.lookingFor || []} 
                  onAdd={(t) => addToArray('lookingFor', t)} 
                  onRemove={(t) => removeFromArray('lookingFor', t)} 
                  placeholder="e.g. Co-founder, Mentor" 
                  isEditing={isEditing}
                  icon={Target}
                />
              </div>

              {/* Availability */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2 flex items-center gap-1.5"><Clock size={14} /> Availability</label>
                <TagInput 
                  tags={formData.availability || []} 
                  onAdd={(t) => addToArray('availability', t)} 
                  onRemove={(t) => removeFromArray('availability', t)} 
                  placeholder="e.g. Weekends, Evenings" 
                  isEditing={isEditing}
                />
              </div>

              {/* Links */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-3 flex items-center gap-1.5"><LinkIcon size={14} /> Links</label>
                {isEditing ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" placeholder="LinkedIn URL" name="links.linkedin" value={formData.links?.linkedin || ''} onChange={handleChange} className="bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-text-main focus:outline-none focus:border-gold/50" />
                    <input type="text" placeholder="Twitter / X URL" name="links.twitter" value={formData.links?.twitter || ''} onChange={handleChange} className="bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-text-main focus:outline-none focus:border-gold/50" />
                    <input type="text" placeholder="Website URL" name="links.website" value={formData.links?.website || ''} onChange={handleChange} className="bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-text-main focus:outline-none focus:border-gold/50" />
                    <input type="text" placeholder="Portfolio URL" name="links.portfolio" value={formData.links?.portfolio || ''} onChange={handleChange} className="bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-text-main focus:outline-none focus:border-gold/50" />
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {formData.links?.linkedin && <a href={formData.links.linkedin} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-background border border-white/10 rounded-lg text-sm text-text-main hover:text-primary hover:border-primary/50 transition-colors">LinkedIn</a>}
                    {formData.links?.twitter && <a href={formData.links.twitter} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-background border border-white/10 rounded-lg text-sm text-text-main hover:text-primary hover:border-primary/50 transition-colors">Twitter / X</a>}
                    {formData.links?.website && <a href={formData.links.website} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-background border border-white/10 rounded-lg text-sm text-text-main hover:text-primary hover:border-primary/50 transition-colors">Website</a>}
                    {formData.links?.portfolio && <a href={formData.links.portfolio} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-background border border-white/10 rounded-lg text-sm text-text-main hover:text-primary hover:border-primary/50 transition-colors">Portfolio</a>}
                    {(!formData.links || Object.values(formData.links).every(v => !v)) && <span className="text-text-muted text-sm italic">No links added.</span>}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Connections modal */}
      {showConnectionsModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowConnectionsModal(false)}
        >
          <div
            className="bg-surface w-full max-w-md rounded-2xl border border-white/10 shadow-2xl p-6 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-text-main">
                  Connections
                </h2>
                <p className="text-xs text-text-muted">
                  {connections.length} connection{connections.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConnectionsModal(false)}
                className="text-text-muted hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-2">
              {connections.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 p-3 bg-background/50 rounded-xl border border-white/5"
                >
                  <img
                    src={u.imageUrl}
                    className="w-10 h-10 rounded-full object-cover border border-white/10"
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_PROFILE_IMAGE;
                    }}
                  />
                  <div>
                    <p className="font-bold text-sm text-text-main">
                      {getDisplayName(u.name)}
                    </p>
                    <p className="text-xs text-text-muted">
                      {u.role} • {u.industry}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// IMPORTANT: Define UserIcon locally as 'User' is already imported as a type
const UserIcon = ({ size, className }: { size?: number, className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size || 24} 
    height={size || 24} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export default ProfileEditor;