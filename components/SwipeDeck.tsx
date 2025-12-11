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
import { 
  X, 
  Check, 
  Briefcase, 
  Crown, 
  Gem, 
  RotateCcw, 
  ThumbsUp,
  Lock
} from 'lucide-react';
import { DEFAULT_PROFILE_IMAGE } from '../constants';
import { getDisplayName } from '../utils/nameUtils';

interface SwipeDeckProps {
  users: User[];
  onSwipe: (direction: 'left' | 'right' | 'superlike', user: User) => void;
  remainingLikes?: number | null;
  userTier?: SubscriptionTier;
  onUpgrade?: (tier: SubscriptionTier) => void;
  onOutOfSwipes?: () => void;
  currentUserId?: string; // Needed for local storage keys
}

// Helper to get daily Super Like quota
const getSuperLikeQuota = (tier: SubscriptionTier = 'free') => {
  if (tier === 'kova_pro' || tier === 'kova_plus') return 5;
  return 1;
};

const SwipeDeck: React.FC<SwipeDeckProps> = ({ 
  users, 
  onSwipe, 
  remainingLikes, 
  userTier = 'free', 
  onUpgrade, 
  onOutOfSwipes,
  currentUserId 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const controls = useAnimation();

  // --- Local State for New Features ---
  // History stack for Undo (store previous index and user)
  const [history, setHistory] = useState<{ index: number; user: User; direction: string } | null>(null);
  
  // Track refunded swipes locally to update the UI counter without touching backend
  const [refundedSwipes, setRefundedSwipes] = useState(0);

  // Super Like State
  const [superLikesUsed, setSuperLikesUsed] = useState(0);
  const [showSuperLikeToast, setShowSuperLikeToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Daily Quota Logic for Superlikes
  const superLikeQuota = getSuperLikeQuota(userTier);
  const superLikesLeft = Math.max(0, superLikeQuota - superLikesUsed);

  // Initialize/Reset Superlikes from LocalStorage
  useEffect(() => {
    if (!currentUserId) return;
    
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const key = `kova_superlikes_${currentUserId}_${today}`;
    
    const stored = localStorage.getItem(key);
    if (stored) {
      setSuperLikesUsed(parseInt(stored, 10));
    } else {
      setSuperLikesUsed(0);
    }
  }, [currentUserId]);

  const incrementSuperLikeUsage = () => {
    if (!currentUserId) return;
    const today = new Date().toISOString().split('T')[0];
    const key = `kova_superlikes_${currentUserId}_${today}`;
    const newVal = superLikesUsed + 1;
    setSuperLikesUsed(newVal);
    localStorage.setItem(key, newVal.toString());
  };

  // Use the order provided by the parent (weighted shuffle)
  // We make a shallow copy to be safe, but we do NOT re-sort.
  const sortedUsers = useMemo(() => [...users], [users]);

  const activeUser = sortedUsers[currentIndex];
  const nextUser = sortedUsers[currentIndex + 1];

  // Motion Values - shared across renders but reset manually
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  // Subtle rotation (max 5 degrees) based on X drag distance
  const rotate = useTransform(x, [-200, 200], [-5, 5]);
  
  // Opacity for overlays
  const likeOpacity = useTransform(x, [20, 150], [0, 1]);
  const nopeOpacity = useTransform(x, [-20, -150], [0, 1]);

  // Calculated displayed likes (props + local refunds)
  const displayRemainingLikes = remainingLikes !== null && remainingLikes !== undefined 
    ? Math.min(30, remainingLikes + refundedSwipes) 
    : null;

  // Only free users can be exhausted of normal swipes
  const isLikesExhausted = userTier === 'free' && displayRemainingLikes !== null && displayRemainingLikes <= 0;

  // Handle the end of a drag gesture
  const handleDragEnd = async (_: any, info: PanInfo) => {
    const threshold = 100;
    const velocityThreshold = 500;
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    // Swipe detection logic
    const isSwipeRight = offset > threshold || (velocity > velocityThreshold && offset > -50);
    const isSwipeLeft = offset < -threshold || (velocity < -velocityThreshold && offset < 50);

    if (isSwipeRight) {
      // SWIPE RIGHT (LIKE)
      if (isLikesExhausted) {
        // Limit reached: Snap back to center & trigger external modal
        await controls.start({ x: 0, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
        onOutOfSwipes?.();
      } else {
        // Success: Animate out to the right
        await controls.start({ x: 500, opacity: 0, transition: { duration: 0.2 } });
        triggerSwipe('right');
      }
    } else if (isSwipeLeft) {
      // SWIPE LEFT (NOPE)
      // Success: Animate out to the left
      await controls.start({ x: -500, opacity: 0, transition: { duration: 0.2 } });
      triggerSwipe('left');
    } else {
      // No Swipe: Snap back to center (Reset X and Y)
      controls.start({ x: 0, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
    }
  };

  const triggerSwipe = (direction: 'left' | 'right' | 'superlike') => {
    if (!activeUser) return;
    
    // Save to history before moving on
    setHistory({ index: currentIndex, user: activeUser, direction });

    // Call parent handler
    onSwipe(direction, activeUser);
    
    // IMPORTANT: Reset motion values immediately before mounting the new card.
    x.set(0);
    y.set(0);
    controls.set({ x: 0, y: 0, rotate: 0, opacity: 1 });

    setCurrentIndex(prev => prev + 1);
  };

  // --- Button Handlers ---

  const handleUndo = async () => {
    // TIER CHECK: Free users cannot rewind
    if (userTier === 'free') {
      onUpgrade?.('kova_plus');
      return;
    }

    if (!history) return;

    // Restore index
    const prevIndex = history.index;
    setCurrentIndex(prevIndex);
    
    // Clear history (1 level deep)
    setHistory(null);

    // If it was a right swipe (that consumed a daily like), refund it visually
    // Although Plus/Pro users have unlimited likes, we still refund it to keep state consistent if counters are used.
    if (history.direction === 'right' || history.direction === 'superlike') {
      setRefundedSwipes(prev => prev + 1);
    }

    // Reset card position visually
    x.set(0);
    y.set(0);
    await controls.start({ x: 0, y: 0, opacity: 1, rotate: 0, transition: { duration: 0.3 } });
  };

  const handleButtonSwipe = async (direction: 'left' | 'right') => {
    if (direction === 'right' && isLikesExhausted) {
      onOutOfSwipes?.();
      return;
    }

    const targetX = direction === 'right' ? 500 : -500;
    await controls.start({ x: targetX, opacity: 0, transition: { duration: 0.3 } });
    triggerSwipe(direction);
  };

  const handleSuperLike = async () => {
    if (superLikesLeft <= 0) {
      if (userTier === 'free') {
        // Free user ran out -> Upsell
        setToastMessage("Free limit reached. Upgrade for more.");
        setShowSuperLikeToast(true);
        setTimeout(() => setShowSuperLikeToast(false), 3000);
        onUpgrade?.('kova_plus');
      } else {
        // Paid user ran out -> Just notify
        setToastMessage("You've used all 5 Superlikes today!");
        setShowSuperLikeToast(true);
        setTimeout(() => setShowSuperLikeToast(false), 3000);
      }
      return;
    }

    // Also check if normal swipes are exhausted (superlike counts as a swipe)
    if (isLikesExhausted) {
      onOutOfSwipes?.();
      return;
    }

    // Decrement local quota
    incrementSuperLikeUsage();

    // Visual indication (swipe up-right)
    await controls.start({ x: 500, y: -200, opacity: 0, transition: { duration: 0.3 } });
    
    // Pass 'superlike' direction to parent (App.tsx writes to DB)
    triggerSwipe('superlike');
  };

  // --- Styles helper ---
  const getCardStyles = (tier: SubscriptionTier) => {
    if (tier === 'kova_pro') {
      return {
        container: 'border-2 border-gold shadow-[0_0_25px_rgba(214,167,86,0.5)]',
        badgeBg: 'bg-[#B8860B]', 
        badgeText: '👑 KOVA PRO USER',
        glow: true
      };
    }
    if (tier === 'kova_plus') {
      return {
        container: 'border-2 border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.5)]',
        badgeBg: 'bg-emerald-700',
        badgeText: '💎 KOVA PLUS USER',
        glow: true
      };
    }
    return {
      container: 'border border-white/10 shadow-xl',
      badgeBg: '',
      badgeText: '',
      glow: false
    };
  };

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
        {/* Allow undo even at end of deck (if tier allows) */}
        {history && (
           <button 
             onClick={handleUndo}
             className="flex items-center gap-2 px-6 py-3 bg-surface border border-white/10 rounded-xl hover:bg-white/5 transition-colors text-text-muted hover:text-white"
           >
             {userTier === 'free' ? <Lock size={16} /> : <RotateCcw size={16} />} 
             Undo Last Swipe
           </button>
        )}
      </div>
    );
  }

  const styles = getCardStyles(activeUser.subscriptionTier);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden p-4 md:p-8 perspective-1000 flex-col">
      
      {/* Daily Limit Counter (Only show for Free users) */}
      {userTier === 'free' && (
        <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-black/60 backdrop-blur-md rounded-full px-4 py-1.5 border flex items-center gap-2 shadow-lg transition-colors ${isLikesExhausted ? 'border-red-500/50' : 'border-white/10'}`}>
          <span className="text-xs text-text-muted font-medium">Daily Swipes:</span>
          <span className={`text-xs font-bold ${isLikesExhausted ? 'text-red-400' : 'text-white'}`}>
            {displayRemainingLikes ?? 0} / 30
          </span>
        </div>
      )}

      {/* Background Card (Next User) */}
      {nextUser && (
        <div className="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-full max-w-sm md:max-w-md h-[60vh] md:h-[65vh] bg-surface rounded-3xl border border-white/5 shadow-xl overflow-hidden transform scale-95 translate-y-[-46%] -z-10 opacity-40 filter blur-[1px]">
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
        drag
        dragConstraints={{ left: -200, right: 200, top: -300, bottom: 300 }}
        dragElastic={0.1}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        whileTap={{ cursor: 'grabbing', scale: 1.02 }}
        className={`relative w-full max-w-sm md:max-w-md h-[60vh] md:h-[65vh] bg-surface rounded-3xl flex flex-col overflow-hidden z-20 cursor-grab ${styles.container}`}
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

      {/* Floating Action Buttons Row */}
      <div className="relative mt-6 w-full max-w-sm md:max-w-md flex justify-center items-center gap-3 md:gap-5 z-20">
          
          {/* Toast for Super Like limit */}
          <AnimatePresence>
            {showSuperLikeToast && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute -top-12 left-1/2 -translate-x-1/2 bg-black/90 text-white text-xs px-4 py-2 rounded-full whitespace-nowrap shadow-xl border border-white/10 z-50 pointer-events-none"
              >
                {toastMessage}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 1. Undo Button */}
          <button 
            className={`w-12 h-12 md:w-14 md:h-14 rounded-full border border-white/10 flex items-center justify-center shadow-lg backdrop-blur-sm transition-all relative ${
              history 
              ? 'bg-surface text-text-muted hover:text-white hover:bg-white/10 hover:scale-105' 
              : 'bg-surface/50 text-white/20 cursor-not-allowed'
            }`}
            onClick={handleUndo}
            disabled={!history && userTier !== 'free'} // Allow free users to click so they see upsell
            title="Undo"
          >
            {userTier === 'free' ? (
              <div className="relative">
                <RotateCcw size={20} className="opacity-50" />
                <Lock size={10} className="absolute -top-1 -right-1 text-gold" />
              </div>
            ) : (
              <RotateCcw size={20} />
            )}
          </button>

          {/* 2. Skip Button */}
          <button 
            className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-surface border border-red-500/30 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-xl hover:scale-110 hover:border-red-500 backdrop-blur-sm"
            onClick={() => handleButtonSwipe('left')}
            title="Skip"
          >
            <X size={28} />
          </button>

          {/* 3. Connect Button */}
          <button 
            className={`w-14 h-14 md:w-16 md:h-16 rounded-full border flex items-center justify-center transition-all shadow-xl backdrop-blur-sm ${
              isLikesExhausted 
                ? 'bg-surface border-white/10 text-text-muted hover:bg-white/10' 
                : 'bg-surface border-emerald-500/30 text-emerald-500 hover:bg-emerald-500 hover:text-white hover:scale-110 hover:border-emerald-500'
            }`}
            onClick={() => handleButtonSwipe('right')}
            title="Connect"
          >
            {isLikesExhausted ? <Lock size={24} /> : <Check size={28} />}
          </button>

          {/* 4. Super Like Button */}
          <button 
            className="relative w-12 h-12 md:w-14 md:h-14 rounded-full bg-surface border border-primary/30 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all shadow-lg hover:scale-105 hover:border-primary backdrop-blur-sm group"
            onClick={handleSuperLike}
            title={`Super Like (${superLikesLeft} left)`}
          >
            <ThumbsUp size={20} className="group-hover:animate-bounce" />
            <span className="absolute -top-1 -right-1 bg-primary text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full border border-surface shadow-sm">
              {superLikesLeft}
            </span>
          </button>

      </div>
    </div>
  );
};

export default SwipeDeck;