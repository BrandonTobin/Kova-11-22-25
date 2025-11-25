import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, isProUser, Match } from '../types';
import { 
  Save, Sparkles, X, Copy, CheckCircle, Loader2, Camera, Edit2, 
  Crown, MapPin, Link as LinkIcon, Briefcase, 
  Target, MessageCircle, Clock, Globe, Share2, Plus, Hash, Users
} from 'lucide-react';
import { enhanceBio } from '../services/geminiService';
import { DEFAULT_PROFILE_IMAGE } from '../constants';
import { getDisplayName } from '../utils/nameUtils';

interface ProfileEditorProps {
  user: User;
  onSave: (updatedUser: User, imageFile?: File) => void;
  onUpgrade: () => void;
  // NEW: optional matches prop so existing callers don't break
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

  // NEW: state for connections modal
  const [showConnectionsModal, setShowConnectionsModal] = useState(false);

  // NEW: derive connections from matches (unique by user.id)
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
    // Pass the raw file to parent for uploading
    onSave(formData, imageFile || undefined);
    setIsEditing(false);
    // Note: We don't clear imageFile here immediately because if upload fails 
    // we might want to keep state, but for now we rely on App.tsx to handle success.
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

  // Helper for array manipulation
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
    <div className="max-w-4xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-main">My Profile</h1>
          <p className="text-text-muted">Manage your personal brand and preferences.</p>
        </div>
        <div className="flex gap-3">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Account & Status */}
        <div className="space-y-6">
          {/* Plan Card */}
          <div className="bg-surface border border-white/10 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Crown size={64} className="text-gold" />
            </div>
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">Account</h3>
            
            {isProUser(user) ? (
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-gold to-amber-600 rounded-full flex items-center justify-center text-white shadow-lg shrink-0">
                  <Crown size={24} fill="currentColor" />
                </div>
                <div>
                  <p className="font-bold text-text-main text-lg">Kova Pro</p>
                  <p className="text-xs text-gold">Active Membership</p>
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-text-main text-lg">Free Plan</span>
                  <span className="text-xs bg-white/5 px-2 py-1 rounded text-text-muted">Basic</span>
                </div>
                <button 
                  onClick={onUpgrade}
                  className="w-full py-2.5 bg-gradient-to-r from-gold to-amber-600 text-white text-sm font-bold rounded-lg shadow-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Crown size={14} fill="currentColor" />
                  Upgrade to Pro
                </button>
              </div>
            )}
            
            {/* Profile Link Action */}
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

        {/* CENTER & RIGHT: Main Profile Info */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Section: Profile Header (Image) */}
          <div className="bg-surface border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center">
            <div className="relative group mb-4">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-background shadow-2xl overflow-hidden relative">
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
            <p className="text-sm text-text-muted">Profile Picture</p>

            {/* NEW: Connections button under avatar */}
            <button
              type="button"
              onClick={() => connections.length > 0 && setShowConnectionsModal(true)}
              className="mt-3 inline-flex items-center gap-2 text-sm text-text-muted hover:text-primary transition-colors disabled:opacity-50"
              disabled={connections.length === 0}
            >
              <Users size={16} className="text-primary" />
              <span className="font-medium text-text-main">
                {connections.length} connection{connections.length !== 1 ? 's' : ''}
              </span>
            </button>
          </div>

          {/* Section: Professional Info */}
          <div className="bg-surface border border-white/10 rounded-2xl p-6">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-6 pb-2 border-b border-white/5">Professional Info</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1.5">Full Name</label>
                {isEditing ? (
                  <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full bg-background border border-white/10 rounded-lg px-3 py-2.5 text-text-main focus:outline-none focus:border-gold/50 transition-all" />
                ) : (
                  <p className="text-text-main font-medium">{formData.name}</p>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1.5 flex items-center gap-1.5"><Briefcase size={14} /> Title / Role</label>
                {isEditing ? (
                  <input type="text" name="role" value={formData.role} onChange={handleChange} className="w-full bg-background border border-white/10 rounded-lg px-3 py-2.5 text-text-main focus:outline-none focus:border-gold/50 transition-all" />
                ) : (
                  <p className="text-text-main">{formData.role}</p>
                )}
              </div>

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

          {/* Section: About You */}
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

          {/* Section: Interests & Connect */}
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

      {/* NEW: Connections modal */}
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
                className="p-2 rounded-full hover:bg-background text-text-muted hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {connections.length === 0 ? (
              <p className="text-sm text-text-muted">You don’t have any connections yet.</p>
            ) : (
              <div className="space-y-2">
                {connections.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-background/70 border border-white/5"
                  >
                    {c.imageUrl ? (
                      <img
                        src={c.imageUrl}
                        alt={getDisplayName(c.name || c.email)}
                        className="w-9 h-9 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">
                        {getDisplayName(c.name || c.email).charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-main">
                        {getDisplayName(c.name || c.email)}
                      </p>
                      {/* Only name shown – no “connect” buttons or anything */}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileEditor;