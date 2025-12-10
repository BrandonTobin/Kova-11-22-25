
import React, { useState, useMemo, useEffect } from 'react';
import { 
  motion, 
  useMotionValue, 
  useTransform, 
  useAnimation, 
  PanInfo, 
  AnimatePresence 
} from 'framer-motion';
import { User, SubscriptionTier } from '../types';
import { X, Check, Briefcase, Tag, MapPin, Star, Lock, Crown, Gem, Sparkles, Zap } from 'lucide-react';
import { DEFAULT_PROFILE_IMAGE } from '../constants';
import { getDisplayName } from '../utils/nameUtils';

interface SwipeDeckProps {
  users: User[];
  onSwipe: (direction: 'left' | 'right', user: User) => void;
  remainingLikes?: number | null;
  userTier?: SubscriptionTier;
  onUpgrade?: (tier: SubscriptionTier) => void;
}

// Helper to determine sort weight
const getTierWeight = (tier: SubscriptionTier): number => {
  switch (tier) {
    case 'kova_pro': return 3;
    case 'kova_plus': return 2;
    default: return 1;
  }
};

const SwipeDeck: React.FC<SwipeDeckProps> = ({ users, onSwipe, remainingLikes, userTier = 'free', onUpgrade }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const controls = useAnimation();

  // Sort users: Pro > Plus > Free
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const weightA = getTierWeight(a.subscriptionTier);
      const weightB = getTierWeight(b.subscriptionTier);
      return weightB - weightA;
    });
  }, [users]);

  const activeUser = sortedUsers[currentIndex];
  const nextUser = sortedUsers[currentIndex + 1];

  // Motion Values
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  // Subtle rotation (max 5 degrees) based on drag distance
  const rotate = useTransform(x, [-200, 200], [-5, 5]);
  
  // Opacity for overlays
  const likeOpacity = useTransform(x, [20, 150], [0, 1]);
  const nopeOpacity = useTransform(x, [-20, -150], [0, 1]);

  const isLikesExhausted = userTier === 'free' && remainingLikes !== null && remainingLikes <= 0;

  const handleDragEnd = async (_: any, info: PanInfo) => {
    const threshold = 100;
    const velocityThreshold = 500;
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset > threshold || velocity > velocityThreshold) {
      // SWIPE RIGHT (LIKE)
      if (isLikesExhausted) {
        // Snap back and show limit modal
        await controls.start({ x: 0, y: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
        setShowLimitModal(true);
      } else {
        // Animate out right
        await controls.start({ x: 500, opacity: 0, transition: { duration: 0.2 } });
        triggerSwipe('right');
      }
    } else if (offset < -threshold || velocity < -velocityThreshold) {
      // SWIPE LEFT (NOPE)
      // Animate out left
      await controls.start({ x: -500, opacity: 0, transition: { duration: 0.2 } });
      triggerSwipe('left');
    } else {
      // Snap back to center
      controls.start({ x: 0, y: 0, transition: { type: 'spring', stiffness: 500, damping: 30 } });
    }
  };

  const triggerSwipe = (direction: 'left' | 'right') => {
    if (!activeUser) return;
    onSwipe(direction, activeUser);
    
    // Reset position instantly for next card, but index update will trigger re-render
    x.set(0);
    y.set(0);
    setCurrentIndex(prev => prev + 1);
    controls.set({ x: 0, y: 0, opacity: 1 });
  };

  // Button handlers
  const handleButtonSwipe = async (direction: 'left' | 'right') => {
    if (direction === 'right' && isLikesExhausted) {
      setShowLimitModal(true);
      return;
    }

    const targetX = direction === 'right' ? 500 : -500;
    await controls.start({ x: targetX, opacity: 0, transition: { duration: 0.3 } });
    triggerSwipe(direction);
  };

  // --- Styles helper ---
  const getCardStyles = (tier: SubscriptionTier) => {
    if (tier === 'kova_pro') {
      return {
        // Glowing gold border
        container: 'border-2 border-gold shadow-[0_0_25px_rgba(214,167,86,0.5)]',
        // Darker gold ribbon background
        badgeBg: 'bg-[#B8860B]', 
        badgeText: '👑 KOVA PRO USER',
        glow: true
      };
    }
    if (tier === 'kova_plus') {
      return {
        // Glowing emerald border
        container: 'border-2 border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.5)]',
        // Darker emerald ribbon background
        badgeBg: 'bg-emerald-700',
        badgeText: '💎 KOVA PLUS USER',
        glow: true
      };
    }
    // Free user: Standard clean look
    return {
      container: 'border border-white/10 shadow-xl',
      badgeBg: '',
      badgeText: '',
      glow: false
    };
  };

  // Render "Out of Swipes" Modal
  if (showLimitModal) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
        <div className="bg-surface border border-gold/30 rounded-3xl p-8 max-w-sm text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold to-transparent opacity-50"></div>
          
          <div className="w-16 h-16 bg-gradient-to-br from-gold/20 to-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-gold/30">
             <Lock size={32} className="text-gold" />
          </div>
          
          <h2 className="text-2xl font-bold text-text-main mb-3">You're Out of Swipes</h2>
          <p className="text-text-muted text-sm mb-8 leading-relaxed">
            You've hit your daily limit of 30 swipes. Upgrade to Kova Plus for unlimited connections and premium visibility.
          </p>

          <button 
            onClick={() => { setShowLimitModal(false); onUpgrade?.('kova_plus'); }}
            className="w-full py-4 bg-gradient-to-r from-gold to-amber-600 text-white font-bold rounded-xl shadow-lg hover:shadow-gold/20 transition-all flex items-center justify-center gap-2 mb-3"
          >
            <Gem size={18} /> Upgrade to Unlimited
          </button>
          
          <button 
            onClick={() => setShowLimitModal(false)}
            className="w-full py-3 text-text-muted hover:text-white font-medium transition-colors"
          >
            Not Now
          </button>
        </div>
      </div>
    );
  }

  // End of Deck
  if (currentIndex >= sortedUsers.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-in fade-in">
        <div className="w-24 h-24 bg-surface rounded-full flex items-center justify-center mb-6 animate-pulse border border-white/5 shadow-xl">
          <Briefcase className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-3xl font-bold text-text-main mb-3">That's everyone!</h2>
        <p className="text-text-muted max-w-md text-lg leading-relaxed mb-6">
          You've seen all active entrepreneurs in your area. Check back later for more matches.
        </p>
      </div>
    );
  }

  const styles = getCardStyles(activeUser.subscriptionTier);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden p-4 md:p-8 perspective-1000">
      
      {/* Daily Limit Counter (if free) */}
      {userTier === 'free' && (
        <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-black/60 backdrop-blur-md rounded-full px-4 py-1.5 border flex items-center gap-2 shadow-lg transition-colors ${isLikesExhausted ? 'border-red-500/50' : 'border-white/10'}`}>
          <span className="text-xs text-text-muted font-medium">Daily Swipes:</span>
          <span className={`text-xs font-bold ${isLikesExhausted ? 'text-red-400' : 'text-white'}`}>
            {remainingLikes ?? 0} / 30
          </span>
        </div>
      )}

      {/* Background Card (Next User) */}
      {nextUser && (
        <div className="absolute w-full max-w-sm md:max-w-md h-[65vh] md:h-[70vh] bg-surface rounded-3xl border border-white/5 shadow-xl overflow-hidden transform scale-95 translate-y-4 -z-10 opacity-40 filter blur-[1px]">
          <img
            src={nextUser.imageUrl || DEFAULT_PROFILE_IMAGE}
            alt="Next"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Active Card */}
      <motion.div
        key={activeUser.id}
        style={{ x, y, rotate }}
        animate={controls}
        drag // Freely drag in any direction
        onDragEnd={handleDragEnd}
        whileTap={{ cursor: 'grabbing', scale: 1.02 }}
        className={`absolute w-full max-w-sm md:max-w-md h-[65vh] md:h-[70vh] bg-surface rounded-3xl flex flex-col overflow-hidden z-20 cursor-grab ${styles.container}`}
      >
        {/* Premium Banner (Top Ribbon) */}
        {styles.badgeText && (
           <div className={`absolute top-0 left-1/2 -translate-x-1/2 z-40 px-6 py-1.5 rounded-b-lg text-[10px] md:text-xs font-bold uppercase tracking-widest text-white shadow-lg flex items-center justify-center whitespace-nowrap ${styles.badgeBg}`}>
             {styles.badgeText}
           </div>
        )}

        {/* Premium Glow Effect */}
        {styles.glow && (
           <div className="absolute inset-0 z-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none animate-pulse" />
        )}

        {/* Swipe Indicators */}
        <motion.div 
          style={{ opacity: likeOpacity }}
          className="absolute top-12 left-8 z-30 border-4 border-emerald-500 rounded-xl px-4 py-2 transform -rotate-12 bg-black/20 backdrop-blur-sm"
        >
          <span className="text-3xl font-black text-emerald-500 uppercase tracking-widest">Connect</span>
        </motion.div>
        
        <motion.div 
           style={{ opacity: nopeOpacity }}
           className="absolute top-12 right-8 z-30 border-4 border-red-500 rounded-xl px-4 py-2 transform rotate-12 bg-black/20 backdrop-blur-sm"
        >
          <span className="text-3xl font-black text-red-500 uppercase tracking-widest">Skip</span>
        </motion.div>

        {/* Image Section */}
        <div className="relative h-[60%] w-full bg-gray-900 overflow-hidden">
          <img
            src={activeUser.imageUrl || DEFAULT_PROFILE_IMAGE}
            alt={activeUser.name}
            className="w-full h-full object-cover pointer-events-none"
            onError={(e) => { e.currentTarget.src = DEFAULT_PROFILE_IMAGE; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent opacity-90" />
          
          {/* Shimmer for Pro Users */}
          {activeUser.subscriptionTier === 'kova_pro' && (
            <div className="absolute inset-0 z-10 bg-gradient-to-tr from-transparent via-gold/10 to-transparent translate-x-[-100%] animate-[shimmer_3s_infinite]" />
          )}

          {/* Badges Overlay */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 items-end z-20 max-w-[80%]">
             {activeUser.subscriptionTier !== 'free' && (
               <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-lg">
                 {activeUser.subscriptionTier === 'kova_pro' ? <Crown size={14} className="text-gold" /> : <Gem size={14} className="text-emerald-400" />}
               </div>
             )}
          </div>
          
          {/* Stage Tag */}
          <div className="absolute bottom-2 left-4 z-20">
              <span className="bg-primary/90 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg border border-white/10">
                  {activeUser.stage} Stage
              </span>
          </div>
        </div>

        {/* Info Section */}
        <div className="flex-1 p-6 flex flex-col bg-surface relative z-10">
          <div>
            <div className="flex justify-between items-start mb-1">
              <div className="flex items-center gap-2">
                <h2 className={`text-2xl md:text-3xl font-bold tracking-tight ${activeUser.subscriptionTier === 'kova_pro' ? 'text-transparent bg-clip-text bg-gradient-to-r from-gold to-amber-200' : 'text-text-main'}`}>
                  {getDisplayName(activeUser.name)}
                  <span className="text-xl ml-1 font-medium opacity-60">, {activeUser.age}</span>
                </h2>
                {activeUser.subscriptionTier === 'kova_pro' && <Crown size={18} className="text-gold fill-gold/20" />}
                {activeUser.subscriptionTier === 'kova_plus' && <Gem size={18} className="text-emerald-400 fill-emerald-400/20" />}
              </div>
            </div>
            
            <p className="text-secondary font-medium text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
              <Briefcase size={14} /> {activeUser.role} <span className="text-text-muted">•</span> {activeUser.industry}
            </p>
            
            <p className="text-text-muted text-sm leading-relaxed line-clamp-3 opacity-90 mb-4">
              {activeUser.bio}
            </p>
          </div>

          <div className="mt-auto">
            <div className="flex flex-wrap gap-2 mb-4">
              {activeUser.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="px-2 py-1 bg-white/5 border border-white/10 text-text-muted rounded-md text-[10px] font-medium uppercase tracking-wide">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Floating Action Buttons */}
      <div className="absolute bottom-6 md:bottom-10 w-full flex justify-center items-center gap-8 z-20 px-4 pointer-events-none">
          <button 
            className="w-16 h-16 rounded-full bg-surface border border-red-500/30 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-2xl hover:scale-110 hover:border-red-500 pointer-events-auto backdrop-blur-sm"
            onClick={() => handleButtonSwipe('left')}
          >
            <X size={32} />
          </button>

          <button 
            className={`w-16 h-16 rounded-full border flex items-center justify-center transition-all shadow-2xl pointer-events-auto backdrop-blur-sm ${
              isLikesExhausted 
                ? 'bg-surface border-white/10 text-text-muted hover:bg-white/10' 
                : 'bg-surface border-emerald-500/30 text-emerald-500 hover:bg-emerald-500 hover:text-white hover:scale-110 hover:border-emerald-500'
            }`}
            onClick={() => handleButtonSwipe('right')}
          >
            {isLikesExhausted ? <Lock size={28} /> : <Check size={32} />}
          </button>
      </div>
    </div>
  );
};

export default SwipeDeck;
