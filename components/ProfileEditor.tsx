
import React, { useState, useRef, useEffect } from 'react';
import { User, isProUser } from '../types';
import { Save, Sparkles, X, Copy, CheckCircle, Loader2, Camera, Edit2, Trash2, Crown } from 'lucide-react';
import { enhanceBio } from '../services/geminiService';
import { DEFAULT_PROFILE_IMAGE } from '../constants';

interface ProfileEditorProps {
  user: User;
  onSave: (updatedUser: User) => void;
  onUpgrade: () => void;
}

const ProfileEditor: React.FC<ProfileEditorProps> = ({ user, onSave, onUpgrade }) => {
  const [formData, setFormData] = useState<User>(user);
  const [isEditing, setIsEditing] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const isPro = isProUser(user);

  // Sync local state if prop updates (optional, but good practice)
  useEffect(() => {
    if (!isEditing) {
      setFormData(user);
    }
  }, [user, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFormData(prev => ({ ...prev, imageUrl: DEFAULT_PROFILE_IMAGE }));
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      if (!formData.tags.includes(newTag.trim())) {
        setFormData(prev => ({ ...prev, tags: [...prev.tags, newTag.trim()] }));
      }
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(formData.kovaId);
    setCopied(true);
    
    const toast = document.createElement('div');
    toast.textContent = "Your Kova ID has been copied.";
    toast.className = "fixed top-4 right-4 bg-primary text-white px-4 py-2 rounded-lg shadow-xl z-50 animate-in fade-in slide-in-from-top border border-white/10";
    document.body.appendChild(toast);

    setTimeout(() => {
        setCopied(false);
        if (document.body.contains(toast)) {
            document.body.removeChild(toast);
        }
    }, 2000);
  };

  const handleSave = () => {
    onSave(formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData(user); // Revert changes
    setIsEditing(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-surface rounded-2xl shadow-xl border border-white/5 overflow-y-auto h-full max-h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-text-main">My Profile</h2>
        {!isEditing && (
          <button 
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors border border-primary/20"
          >
            <Edit2 size={16} /> Edit Profile
          </button>
        )}
      </div>

      {/* Upgrade / Pro Status Card */}
      {isPro ? (
        <div className="bg-gradient-to-r from-gold/10 to-background p-5 rounded-xl border border-gold/30 mb-6 flex items-center gap-4 shadow-lg shadow-gold/5">
            <div className="w-12 h-12 bg-gradient-to-br from-gold to-amber-500 rounded-full flex items-center justify-center text-white shadow-md shrink-0">
                <CheckCircle size={24} strokeWidth={3} />
            </div>
            <div>
                <h3 className="font-bold text-gold text-lg flex items-center gap-2">
                    Kova Pro Active
                    <Crown size={16} fill="currentColor" />
                </h3>
                <p className="text-xs text-text-muted mt-0.5">You have full access to all premium features.</p>
            </div>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-surface to-background p-6 rounded-2xl border border-gold/30 mb-6 relative overflow-hidden shadow-lg group">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gold/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-bold text-text-main flex items-center gap-2">
                        Upgrade to Kova Pro <Crown size={20} className="text-gold fill-gold" />
                    </h3>
                    <p className="text-sm text-text-muted mt-1 max-w-md leading-relaxed">
                        Unlock unlimited swipes, advanced heatmaps, and premium AI insights.
                    </p>
                </div>
                <button
                    onClick={onUpgrade}
                    className="px-6 py-3 bg-gradient-to-r from-gold to-amber-600 hover:to-amber-700 text-white font-bold rounded-xl shadow-lg transform hover:scale-105 transition-all whitespace-nowrap"
                >
                    Get Pro
                </button>
            </div>
        </div>
      )}

      {/* Kova ID Section - Always Read Only */}
      <div className="bg-background p-4 rounded-xl border border-gold/30 mb-4 flex items-center justify-between shadow-sm">
         <div>
            <p className="text-xs text-gold uppercase font-bold tracking-wider mb-1">Your Kova ID</p>
            <p className="text-xl font-mono font-bold text-text-main tracking-widest">{formData.kovaId}</p>
         </div>
         <button 
           onClick={copyToClipboard}
           className="flex items-center gap-2 px-4 py-2 bg-surface hover:bg-white/5 border border-white/10 text-text-main rounded-lg transition-colors"
         >
           {copied ? <CheckCircle size={18} className="text-primary" /> : <Copy size={18} />}
           {copied ? "Copied" : "Copy"}
         </button>
      </div>

      <div className="space-y-6">
        {/* Image Preview & Edit */}
        <div className="flex flex-col items-center mb-8">
          <div 
            className={`relative w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-surface shadow-2xl overflow-hidden ${isEditing ? 'group cursor-pointer' : ''}`}
            onClick={() => isEditing && fileInputRef.current?.click()}
          >
            <img 
              src={formData.imageUrl || DEFAULT_PROFILE_IMAGE} 
              alt="Profile" 
              className={`w-full h-full object-cover transition-transform duration-500 ${isEditing ? 'group-hover:scale-105' : ''}`}
              onError={(e) => { e.currentTarget.src = DEFAULT_PROFILE_IMAGE; }}
            />
            
            {/* Hover Overlay */}
            {isEditing && (
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center z-10">
                    <div className="p-2 bg-white/10 rounded-full backdrop-blur-sm mb-2 border border-white/20">
                        <Edit2 size={20} className="text-white" />
                    </div>
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">Change Photo</span>
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

          {isEditing ? (
             <div className="mt-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                 <button 
                   type="button"
                   onClick={() => fileInputRef.current?.click()}
                   className="px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-bold flex items-center gap-2 border border-primary/20"
                 >
                    <Camera size={14} /> Upload
                 </button>
                 <button 
                   type="button"
                   onClick={handleDeleteImage}
                   className="px-4 py-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors text-xs font-bold flex items-center gap-2 border border-red-500/20"
                 >
                    <Trash2 size={14} /> Remove
                 </button>
             </div>
          ) : (
             <p className="text-xs text-text-muted mt-4">Profile Picture</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">Full Name</label>
            {isEditing ? (
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full bg-background border border-white/10 rounded-lg px-4 py-3 text-text-main focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all"
              />
            ) : (
              <div className="w-full bg-background/50 border border-transparent rounded-lg px-4 py-3 text-text-main">
                {formData.name}
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">Title / Role</label>
             {isEditing ? (
              <input
                type="text"
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full bg-background border border-white/10 rounded-lg px-4 py-3 text-text-main focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all"
              />
            ) : (
              <div className="w-full bg-background/50 border border-transparent rounded-lg px-4 py-3 text-text-main">
                {formData.role}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">Industry</label>
             {isEditing ? (
              <input
                type="text"
                name="industry"
                value={formData.industry}
                onChange={handleChange}
                className="w-full bg-background border border-white/10 rounded-lg px-4 py-3 text-text-main focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all"
              />
            ) : (
              <div className="w-full bg-background/50 border border-transparent rounded-lg px-4 py-3 text-text-main">
                {formData.industry}
              </div>
            )}
          </div>

          <div>
             <label className="block text-sm font-medium text-text-muted mb-2">Stage</label>
             {isEditing ? (
               <select 
                 name="stage"
                 value={formData.stage}
                 onChange={handleChange}
                 className="w-full bg-background border border-white/10 rounded-lg px-4 py-3 text-text-main focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all"
               >
                 <option value="Idea">Idea</option>
                 <option value="Early">Early</option>
                 <option value="Growing">Growing</option>
                 <option value="Scaling">Scaling</option>
               </select>
             ) : (
               <div className="w-full bg-background/50 border border-transparent rounded-lg px-4 py-3 text-text-main">
                {formData.stage}
               </div>
             )}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-text-muted">Bio</label>
            {isEditing && (
              <button 
                onClick={handleAiEnhance}
                disabled={isEnhancing}
                className="text-xs text-gold flex items-center gap-1 hover:underline disabled:opacity-50"
              >
                {isEnhancing ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>}
                Enhance with AI
              </button>
            )}
          </div>
          {isEditing ? (
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              rows={4}
              className="w-full bg-background border border-white/10 rounded-lg px-4 py-3 text-text-main focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all"
            />
          ) : (
            <div className="w-full bg-background/50 border border-transparent rounded-lg px-4 py-3 text-text-main min-h-[100px] whitespace-pre-wrap">
              {formData.bio}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-text-muted mb-2">Tags / Interests</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {formData.tags.map(tag => (
              <span key={tag} className="bg-background border border-white/10 px-3 py-1 rounded-full text-sm text-text-main flex items-center gap-1">
                {tag}
                {isEditing && (
                  <button onClick={() => removeTag(tag)} className="text-text-muted hover:text-red-400">
                    <X size={14} />
                  </button>
                )}
              </span>
            ))}
          </div>
          {isEditing && (
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Type tag and press Enter"
              className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm text-text-main focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all mt-2"
            />
          )}
        </div>

        {isEditing && (
          <div className="flex gap-4 pt-4 pb-12">
            <button 
              onClick={handleCancel}
              className="flex-1 py-3 border border-white/10 rounded-xl text-text-muted hover:bg-white/5 transition-colors font-medium"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="flex-1 py-3 bg-primary text-white rounded-xl hover:bg-primary-hover transition-colors font-bold shadow-lg flex items-center justify-center gap-2"
            >
              <Save size={18} /> Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileEditor;
