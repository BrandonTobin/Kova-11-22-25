
import React, { useState, useMemo, useEffect } from 'react';
import { 
  motion, 
  useMotionValue, 
  useTransform, 
  useAnimation, 
  PanInfo, 
  AnimatePresence 
} from 'framer-motion';
import { User, SubscriptionTier, getAvatarStyle } from '../types';
import { 
  X, 
  Check, 
  Briefcase, 
  Crown, 
  Gem, 
  RotateCcw, 
  ThumbsUp,
  Lock, 
  RefreshCw, 
  Star, 
  Flag, 
  AlertTriangle, 
  ShieldOff,
  Loader2 
} from 'lucide-react';
import { DEFAULT_PROFILE_IMAGE } from '../constants';
import { getDisplayName } from '../utils/nameUtils';
import { supabase } from '../supabaseClient';

interface SwipeDeckProps {
  users: User[];
  onSwipe: (direction: 'left' | 'right' | 'superlike', user: User) => void;
  remainingLikes?: number | null; // Legacy prop, we will use local DB state instead
  userTier?: SubscriptionTier; // Initial tier, refreshed from DB
  onUpgrade?: (tier: SubscriptionTier) => void;
  onOutOfSwipes?: () => void;
  currentUserId?: string;
  onRefresh?: () => void;
  isLoading?: boolean;
}

const REPORT_REASONS = [
  "Spam or scam",
  "Inappropriate content",
  "Harassment or hate",
  "Fake / misleading profile",
  "Other"
];

const SwipeDeck: React.FC<SwipeDeckProps> = ({ 
  users, 
  onSwipe, 
  remainingLikes, 
  userTier = 'free', 
  onUpgrade, 
  onOutOfSwipes,
  currentUserId,
  onRefresh,
  isLoading = false
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const controls = useAnimation();

  // --- Local State for DB Counters ---
  const [dailySwipes, setDailySwipes] = useState(0);
  const [dailySuperLikes, setDailySuperLikes] = useState(0);
  const [dailyRewinds, setDailyRewinds] = useState(0);
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>(userTier);

  // History stack for Undo
  const [history, setHistory] = useState<{ index: number; user: User; direction: string } | null>(null);
  
  // Toast State
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // --- Report & Block State ---
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [blockChecked, setBlockChecked] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // --- Limits ---
  const DAILY_SWIPE_LIMIT = 30;
  const FREE_SUPERLIKE_LIMIT = 1;
  const PAID_SUPERLIKE_LIMIT = 5;
  const PAID_REWIND_LIMIT = 5;

  const isFree = currentTier === 'free';
  const isSwipesExhausted = isFree && dailySwipes >= DAILY_SWIPE_LIMIT;
  
  const superLikesLimit = isFree ? FREE_SUPERLIKE_LIMIT : PAID_SUPERLIKE_LIMIT;
  const superLikesLeft = Math.max(0, superLikesLimit - dailySuperLikes);
  
  const rewindsLimit = isFree ? 0 : PAID_REWIND_LIMIT;
  const rewindsLeft = Math.max(0, rewindsLimit - dailyRewinds);

  // --- Fetch User Stats on Mount ---
  useEffect(() => {
    if (!currentUserId) return;
    
    const fetchUserStats = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('subscription_tier, daily_swipes_count, daily_superlikes_count, daily_rewinds_count')
          .eq('id', currentUserId)
          .single();

        if (data && !error) {
          setDailySwipes(data.daily_swipes_count || 0);
          setDailySuperLikes(data.daily_superlikes_count || 0);
          setDailyRewinds(data.daily_rewinds_count || 0);
          
          // Normalize tier
          let tier: SubscriptionTier = 'free';
          if (data.subscription_tier === 'plus') tier = 'kova_plus';
          else if (data.subscription_tier === 'pro') tier = 'kova_pro';
          setCurrentTier(tier);
        }
      } catch (err) {
        console.error("Error fetching user stats:", err);
      }
    };

    fetchUserStats();
  }, [currentUserId]);

  const updateUserCounters = async (updates: any) => {
    if (!currentUserId) return;
    
    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', currentUserId);

    if (error) {
      console.error('Failed to update counters:', error);
      triggerToast('Error syncing progress. Please check connection.');
    }
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const sortedUsers = useMemo(() => [...users], [users]);
  const activeUser = sortedUsers[currentIndex];
  const nextUser = sortedUsers[currentIndex + 1];

  // Motion Values
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-5, 5]);
  const likeOpacity = useTransform(x, [20, 150], [0, 1]);
  const nopeOpacity = useTransform(x, [-20, -150], [0, 1]);

  // --- Logic ---

  const handleDragEnd = async (_: any, info: PanInfo) => {
    const threshold = 100;
    const velocityThreshold = 500;
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    const isSwipeRight = offset > threshold || (velocity > velocityThreshold && offset > -50);
    const isSwipeLeft = offset < -threshold || (velocity < -velocityThreshold && offset < 50);

    if (isSwipeRight) {
      // SWIPE RIGHT (LIKE)
      if (isSwipesExhausted) {
        // Limit reached: Snap back
        await controls.start({ x: 0, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
        triggerToast("You’re out of daily swipes. Upgrade for unlimited.");
        onOutOfSwipes?.();
      } else {
        // Success
        await controls.start({ x: 500, opacity: 0, transition: { duration: 0.2 } });
        triggerSwipe('right');
      }
    } else if (isSwipeLeft) {
      // SWIPE LEFT (NOPE) - Skips allowed even if exhausted (card dismissal)
      await controls.start({ x: -500, opacity: 0, transition: { duration: 0.2 } });
      triggerSwipe('left');
    } else {
      // No Swipe: Snap back
      controls.start({ x: 0, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
    }
  };

  const triggerSwipe = (direction: 'left' | 'right' | 'superlike') => {
    if (!activeUser) return;
    
    // Save to history
    setHistory({ index: currentIndex, user: activeUser, direction });

    // Call parent handler (performs insert)
    onSwipe(direction, activeUser);

    // Update Counters
    const isChargeable = direction === 'right' || direction === 'superlike';
    let newSwipesCount = dailySwipes;
    const updates: any = {};

    if (isChargeable) {
      newSwipesCount = dailySwipes + 1;
      setDailySwipes(newSwipesCount);
      updates.daily_swipes_count = newSwipesCount;
    }
    
    if (direction === 'superlike') {
      const newSuperLikes = dailySuperLikes + 1;
      setDailySuperLikes(newSuperLikes);
      updates.daily_superlikes_count = newSuperLikes;
    }

    if (Object.keys(updates).length > 0) {
      updateUserCounters(updates);
    }
    
    // Reset Motion
    x.set(0);
    y.set(0);
    controls.set({ x: 0, y: 0, rotate: 0, opacity: 1 });

    setCurrentIndex(prev => prev + 1);
  };

  // --- Button Handlers ---

  const handleUndo = async () => {
    if (isFree) {
      triggerToast("Rewind is a Kova Plus / Pro feature.");
      onUpgrade?.('kova_plus');
      return;
    }

    if (dailyRewinds >= rewindsLimit) {
      triggerToast("You’ve used your 5 rewinds for today. They’ll reset tomorrow.");
      return;
    }

    if (!history) return;

    const newRewinds = dailyRewinds + 1;
    setDailyRewinds(newRewinds);
    updateUserCounters({ daily_rewinds_count: newRewinds });

    const prevIndex = history.index;
    setCurrentIndex(prevIndex);
    setHistory(null);

    x.set(0);
    y.set(0);
    await controls.start({ x: 0, y: 0, opacity: 1, rotate: 0, transition: { duration: 0.3 } });
  };

  const handleButtonSwipe = async (direction: 'left' | 'right') => {
    if (direction === 'right' && isSwipesExhausted) {
      triggerToast("You’re out of daily swipes. Upgrade for unlimited.");
      onOutOfSwipes?.();
      return;
    }

    const targetX = direction === 'right' ? 500 : -500;
    await controls.start({ x: targetX, opacity: 0, transition: { duration: 0.3 } });
    triggerSwipe(direction);
  };

  const handleSuperLike = async () => {
    if (dailySuperLikes >= superLikesLimit) {
      if (isFree) {
        triggerToast("You’ve used your daily Super Like. Upgrade for 5 per day.");
        onUpgrade?.('kova_plus');
      } else {
        triggerToast("You’ve used your 5 daily Super Likes. They’ll reset tomorrow.");
      }
      return;
    }

    if (isSwipesExhausted) {
      triggerToast("You’re out of daily swipes.");
      onOutOfSwipes?.();
      return;
    }

    await controls.start({ x: 500, y: -200, opacity: 0, transition: { duration: 0.3 } });
    triggerSwipe('superlike');
  };

  // --- Report & Block Handlers ---

  const handleCloseReportModal = () => {
    setShowReportModal(false);
    setReportReason('');
    setReportDetails('');
    setBlockChecked(false);
  };

  const handleReportSubmit = async () => {
    if (!currentUserId || !activeUser) return;
    if (!reportReason) {
      triggerToast("Please select a reason.");
      return;
    }

    setIsSubmittingReport(true);

    try {
      const isOther = reportReason === 'Other';

      // 1. Insert Report (match user_reports schema)
      const { error: reportError } = await supabase.from('user_reports').insert({
        reporter_user_id: currentUserId,
        reported_id: activeUser.id,
        reason: reportReason,
        other_reason: isOther ? (reportDetails || null) : null,
        details: !isOther ? (reportDetails || null) : null
      });

      if (reportError) throw reportError;

      // 3. Block if checked (match user_blocks schema)
      if (blockChecked) {
        const { error: blockError } = await supabase.from('user_blocks').insert({
          blocker_id: currentUserId,
          blocked_id: activeUser.id
        });
        if (blockError) throw blockError;
      }

      triggerToast("Thanks for your report — our team will review it.");
      
      handleCloseReportModal();
      await handleButtonSwipe('left');
    } catch (error) {
      console.error("Report failed:", error);
      triggerToast("Couldn't submit report, please try again.");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleBlockOnly = async () => {
    if (!currentUserId || !activeUser) return;
    
    setIsSubmittingReport(true);
    try {
      const { error } = await supabase.from('user_blocks').insert({
        blocker_id: currentUserId,
        blocked_id: activeUser.id
      });

      if (error) throw error;

      triggerToast("User blocked.");
      handleCloseReportModal();
      await handleButtonSwipe('left');
    } catch (err) {
      console.error("Block failed:", err);
      triggerToast("Couldn't block user.");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const getCardStyles = (tier: SubscriptionTier, superLikedMe?: boolean) => {
    // Super Like Received (Highest Priority Overlay)
    if (superLikedMe) {
      return {
        container: 'border-[3px] border-[#00BFFF] shadow-[0_0_25px_rgba(0,191,255,0.6)] transition-all duration-200',
        badgeBg: 'bg-[rgba(0,191,255,0.18)] backdrop-blur-md',
        badgeText: '⭐ Super Liked You',
        badgeColor: 'text-[#00BFFF]',
        glow: true
      };
    }

    if (tier === 'kova_pro') {
      return {
        container: 'border-2 border-gold shadow-[0_0_25px_rgba(214,167,86,0.5)]',
        badgeBg: 'bg-[#B8860B]', 
        badgeText: '👑 KOVA PRO USER',
        badgeColor: 'text-white',
        glow: true
      };
    }
    if (tier === 'kova_plus') {
      return {
        container: 'border-2 border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.5)]',
        badgeBg: 'bg-emerald-600', // Emerald for Plus badge
        badgeText: '💎 KOVA PLUS USER',
        badgeColor: 'text-white',
        glow: true
      };
    }
    return {
      container: 'border border-white/10 shadow-xl',
      badgeBg: '',
      badgeText: '',
      badgeColor: '',
      glow: false
    };
  };

  // --- Loading State ---
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full animate-in fade-in">
        <Loader2 className="w-10 h-10 text-gold animate-spin mb-4" />
        <p className="text-text-muted text-sm animate-pulse">Finding matches...</p>
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
        
        <div className="flex flex-col gap-3">
          {onRefresh && (
            <button 
              onClick={() => {
                // Reset index when refreshing to show newly loaded users immediately
                setCurrentIndex(0);
                onRefresh();
              }}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-hover transition-colors shadow-lg"
            >
              <RefreshCw size={18} />
              Check for New Profiles
            </button>
          )}

          {history && (
             <button 
               onClick={handleUndo}
               className="flex items-center gap-2 px-6 py-3 bg-surface border border-white/10 rounded-xl hover:bg-white/5 transition-colors text-text-muted hover:text-white justify-center"
             >
               {isFree ? <Lock size={16} /> : <RotateCcw size={16} />} 
               Undo Last Swipe
             </button>
          )}
        </div>
      </div>
    );
  }

  const styles = getCardStyles(activeUser.subscriptionTier, activeUser.superLikedMe);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden p-4 md:p-8 perspective-1000 flex-col">
      
      {/* Report Modal */}
      <AnimatePresence>
        {showReportModal && activeUser && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface w-full max-w-md rounded-2xl border border-white/10 shadow-2xl p-6 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/10">
                <h3 className="text-xl font-bold text-text-main flex items-center gap-2">
                  <AlertTriangle className="text-gold" size={20} />
                  Report User
                </h3>
                <button 
                  onClick={handleCloseReportModal}
                  className="text-text-muted hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <p className="text-text-muted text-sm mb-4">
                  Why are you reporting <span className="font-bold text-text-main">{getDisplayName(activeUser.name)}</span>?
                </p>

                <div className="space-y-3 mb-6">
                  {REPORT_REASONS.map((reason) => (
                    <label 
                      key={reason}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        reportReason === reason 
                          ? 'bg-primary/20 border-primary' 
                          : 'bg-background border-white/5 hover:bg-white/5'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="reportReason" 
                        value={reason}
                        checked={reportReason === reason}
                        onChange={(e) => setReportReason(e.target.value)}
                        className="hidden"
                      />
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        reportReason === reason ? 'border-primary' : 'border-text-muted'
                      }`}>
                        {reportReason === reason && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <span className={`text-sm ${reportReason === reason ? 'text-white font-medium' : 'text-text-muted'}`}>
                        {reason}
                      </span>
                    </label>
                  ))}
                </div>

                {reportReason === 'Other' && (
                  <div className="mb-6 animate-in fade-in slide-in-from-top-2">
                    <label className="block text-xs font-bold text-text-muted uppercase mb-2">Details</label>
                    <textarea 
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                      className="w-full bg-background border border-white/10 rounded-xl p-3 text-sm text-text-main focus:outline-none focus:border-gold/50 resize-none h-24"
                      placeholder="Please tell us more..."
                    />
                  </div>
                )}

                <div className="bg-white/5 rounded-xl p-4 border border-white/5 mb-6">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={blockChecked}
                      onChange={(e) => setBlockChecked(e.target.checked)}
                      className="mt-1 accent-gold"
                    />
                    <div>
                      <span className="block text-sm font-bold text-text-main">Also block this user</span>
                      <span className="block text-xs text-text-muted mt-1 leading-relaxed">
                        You won't see each other in Discover, matches, or chat.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-2 pt-4 border-t border-white/10">
                <button 
                  onClick={handleReportSubmit}
                  disabled={!reportReason || isSubmittingReport}
                  className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmittingReport ? "Submitting..." : "Submit Report"}
                </button>
                
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleCloseReportModal}
                    className="flex-1 py-3 text-sm text-text-muted hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleBlockOnly}
                    className="flex-1 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <ShieldOff size={14} /> Block User
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Daily Limit Counter (Only show for Free users) */}
      {isFree && (
        <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-black/60 backdrop-blur-md rounded-full px-4 py-1.5 border flex items-center gap-2 shadow-lg transition-colors ${isSwipesExhausted ? 'border-red-500/50' : 'border-white/10'}`}>
          <span className="text-xs text-text-muted font-medium">Daily Swipes:</span>
          <span className={`text-xs font-bold ${isSwipesExhausted ? 'text-red-400' : 'text-white'}`}>
            {Math.min(dailySwipes, DAILY_SWIPE_LIMIT)} / {DAILY_SWIPE_LIMIT}
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
            style={getAvatarStyle(nextUser)}
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
        {/* Special Banner Logic */}
        {styles.badgeText && (
           <div className={`absolute top-4 left-4 z-40 px-3 py-1.5 rounded-xl text-[13px] font-bold shadow-lg flex items-center justify-center whitespace-nowrap ${styles.badgeBg} ${styles.badgeColor}`}>
             {activeUser.superLikedMe && <Star size={14} className="mr-1 fill-current" />}
             {styles.badgeText}
           </div>
        )}

        {/* Premium/SuperLike Glow */}
        {styles.glow && (
           <div className={`absolute inset-0 z-0 bg-gradient-to-b ${activeUser.superLikedMe ? 'from-[#00BFFF]/10' : 'from-white/5'} to-transparent pointer-events-none animate-pulse`} />
        )}

        {/* Report Button */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 items-end z-20 max-w-[80%]">
           {/* Tier Badge */}
           {activeUser.subscriptionTier !== 'free' && (
             <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-lg">
               {activeUser.subscriptionTier === 'kova_pro' ? <Crown size={14} className="text-gold" /> : <Gem size={14} className="text-emerald-400" />}
             </div>
           )}
           
           {/* Report Button */}
           <button
             onPointerDown={(e) => e.stopPropagation()}
             onClick={(e) => {
               e.stopPropagation();
               setShowReportModal(true);
             }}
             className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-lg text-white/50 hover:text-white hover:bg-black/60 transition-colors"
             title="Report User"
           >
             <Flag size={14} />
           </button>
        </div>

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
            style={getAvatarStyle(activeUser)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent opacity-90" />
          
          {activeUser.subscriptionTier === 'kova_pro' && (
            <div className="absolute inset-0 z-10 bg-gradient-to-tr from-transparent via-gold/10 to-transparent translate-x-[-100%] animate-[shimmer_3s_infinite]" />
          )}
          
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
          
          <AnimatePresence>
            {showToast && (
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

          {/* 1. Rewind Button (Left) */}
          <button 
            className={`w-12 h-12 md:w-14 md:h-14 rounded-full border border-white/10 flex items-center justify-center shadow-lg backdrop-blur-sm transition-all relative ${
              history 
              ? 'bg-surface text-text-muted hover:text-white hover:bg-white/10 hover:scale-105' 
              : 'bg-surface/50 text-white/20 cursor-not-allowed'
            }`}
            onClick={handleUndo}
            disabled={!history && !isFree}
            title={isFree ? "Upgrade to Rewind" : `Rewind (${rewindsLeft} left)`}
          >
            {isFree ? (
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
              isSwipesExhausted 
                ? 'bg-surface border-white/10 text-text-muted hover:bg-white/10 cursor-not-allowed opacity-70' 
                : 'bg-surface border-emerald-500/30 text-emerald-500 hover:bg-emerald-500 hover:text-white hover:scale-110 hover:border-emerald-500'
            }`}
            onClick={() => handleButtonSwipe('right')}
            disabled={isSwipesExhausted}
            title={isSwipesExhausted ? "Daily Limit Reached" : "Connect"}
          >
            {isSwipesExhausted ? <Lock size={24} /> : <Check size={28} />}
          </button>

          {/* 4. Super Like Button (Right) */}
          <button 
            className={`relative w-12 h-12 md:w-14 md:h-14 rounded-full bg-surface border flex items-center justify-center transition-all shadow-lg backdrop-blur-sm group ${
               dailySuperLikes >= superLikesLimit || isSwipesExhausted
               ? 'border-white/10 text-text-muted hover:bg-white/5'
               : 'border-primary/30 text-primary hover:bg-primary hover:text-white hover:scale-105 hover:border-primary'
            }`}
            onClick={handleSuperLike}
            title={`Super Like (${superLikesLeft} left)`}
          >
            <ThumbsUp size={20} className={dailySuperLikes < superLikesLimit ? "group-hover:animate-bounce" : ""} />
            <span className="absolute -top-1 -right-1 bg-primary text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full border border-surface shadow-sm">
              {superLikesLeft}
            </span>
          </button>

      </div>
    </div>
  );
};

export default SwipeDeck;
