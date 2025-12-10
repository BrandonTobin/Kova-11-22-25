
import React from 'react';
import { motion } from 'framer-motion';
import { User } from '../types';
import { MessageSquare, X, Sparkles, Crown, Gem } from 'lucide-react';
import { DEFAULT_PROFILE_IMAGE } from '../constants';
import { getDisplayName } from '../utils/nameUtils';

interface MatchPopupProps {
  matchedUser: User;
  currentUser: User;
  onClose: () => void;
  onChat: () => void;
}

const MatchPopup: React.FC<MatchPopupProps> = ({ matchedUser, currentUser, onClose, onChat }) => {
  const isPro = matchedUser.subscriptionTier === 'kova_pro';
  const isPlus = matchedUser.subscriptionTier === 'kova_plus';

  const getBorderColor = () => {
    if (isPro) return 'border-gold';
    if (isPlus) return 'border-emerald-500';
    return 'border-gold'; // Default/Free
  };

  const getGlowColor = () => {
    if (isPro) return 'bg-gold/20';
    if (isPlus) return 'bg-emerald-500/20';
    return 'bg-gold/10';
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className={`w-full max-w-lg bg-surface rounded-3xl border shadow-2xl overflow-hidden relative ${isPro ? 'border-gold' : isPlus ? 'border-emerald-500/50' : 'border-white/10'}`}
      >
        {/* Background Effects */}
        <div className={`absolute inset-0 bg-gradient-to-br pointer-events-none ${isPro ? 'from-gold/20 via-transparent' : isPlus ? 'from-emerald-500/20 via-transparent' : 'from-primary/20 via-transparent'}`} />
        <div className={`absolute -top-24 -left-24 w-64 h-64 rounded-full blur-3xl opacity-50 ${isPro ? 'bg-gold/30' : isPlus ? 'bg-emerald-500/30' : 'bg-primary/30'}`} />

        <div className="relative p-8 text-center flex flex-col items-center">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-text-muted hover:text-white transition-colors"
          >
            <X size={24} />
          </button>

          <div className="mb-8">
            <h2 className={`text-4xl font-bold italic transform -rotate-2 font-serif ${isPro ? 'text-gold drop-shadow-[0_0_10px_rgba(214,167,86,0.5)]' : isPlus ? 'text-emerald-400' : 'text-transparent bg-clip-text bg-gradient-to-r from-gold to-white'}`}>
              It's a Match!
            </h2>
            <p className="text-text-muted mt-3 text-lg">You and {getDisplayName(matchedUser.name)} have connected.</p>
            
            {(isPro || isPlus) && (
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mt-3 border ${isPro ? 'bg-gold/10 text-gold border-gold/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}>
                {isPro ? <Crown size={12} fill="currentColor" /> : <Gem size={12} fill="currentColor" />}
                {isPro ? 'Premium Match · Kova Pro' : 'Premium Match · Kova Plus'}
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-6 mb-10">
            {/* Current User */}
            <div className="relative">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-full p-1 bg-surface border border-white/10 shadow-xl overflow-hidden">
                 <img 
                    src={currentUser.imageUrl} 
                    alt="You" 
                    className="w-full h-full rounded-full object-cover" 
                    onError={(e) => { e.currentTarget.src = DEFAULT_PROFILE_IMAGE; }}
                  />
              </div>
            </div>

            {/* Connection Icon */}
            <div className="w-10 h-10 rounded-full bg-surface border border-white/10 flex items-center justify-center shadow-lg z-10 -ml-4 -mr-4">
               <Sparkles size={20} className="text-gold" />
            </div>

            {/* Matched User */}
            <div className="relative">
               <div className={`w-24 h-24 md:w-32 md:h-32 rounded-full p-1 bg-surface border-2 shadow-xl overflow-hidden relative z-0 ${getBorderColor()}`}>
                 <img 
                    src={matchedUser.imageUrl} 
                    alt={matchedUser.name} 
                    className="w-full h-full rounded-full object-cover" 
                    onError={(e) => { e.currentTarget.src = DEFAULT_PROFILE_IMAGE; }}
                  />
                  {/* Glow Ring */}
                  <div className={`absolute inset-0 rounded-full animate-pulse ${getGlowColor()}`} />
               </div>
               {/* Tier Badge */}
               {(isPro || isPlus) && (
                 <div className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center border-2 border-surface shadow-lg z-10 ${isPro ? 'bg-gold text-white' : 'bg-emerald-500 text-white'}`}>
                    {isPro ? <Crown size={14} fill="currentColor" /> : <Gem size={14} fill="currentColor" />}
                 </div>
               )}
            </div>
          </div>

          <div className="flex flex-col w-full gap-3 max-w-xs mx-auto">
            <button 
              onClick={onChat}
              className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-[0_0_20px_rgba(10,61,63,0.4)] hover:bg-primary-hover hover:scale-[1.02] transition-all flex items-center justify-center gap-2 border border-white/10"
            >
              <MessageSquare size={20} />
              Send a Message
            </button>
            <button 
              onClick={onClose}
              className="w-full py-4 bg-transparent hover:bg-white/5 text-text-muted hover:text-white font-semibold rounded-xl transition-colors border border-transparent hover:border-white/10"
            >
              Keep Swiping
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default MatchPopup;
