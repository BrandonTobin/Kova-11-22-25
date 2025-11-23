
import React, { useState } from 'react';
import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import { User } from '../types';
import { X, Check, Briefcase, Tag, MapPin, Star } from 'lucide-react';
import { DEFAULT_PROFILE_IMAGE } from '../constants';

interface SwipeDeckProps {
  users: User[];
  onSwipe: (direction: 'left' | 'right', user: User) => void;
}

const SwipeDeck: React.FC<SwipeDeckProps> = ({ users, onSwipe }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exitX, setExitX] = useState<number | null>(null);

  const activeUser = users[currentIndex];
  const nextUser = users[currentIndex + 1];

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacityLike = useTransform(x, [50, 150], [0, 1]);
  const opacityNope = useTransform(x, [-50, -150], [0, 1]);

  const onDragEnd = (_e: any, info: PanInfo) => {
    const threshold = 100;
    if (info.offset.x > threshold) {
      setExitX(1000);
      setTimeout(() => handleSwipe('right'), 200);
    } else if (info.offset.x < -threshold) {
      setExitX(-1000);
      setTimeout(() => handleSwipe('left'), 200);
    }
  };

  const handleSwipe = (direction: 'left' | 'right') => {
    const userSwiped = activeUser;
    onSwipe(direction, userSwiped);

    setCurrentIndex((prev) => prev + 1);
    setExitX(null);
    x.set(0);
  };

  if (currentIndex >= users.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-in fade-in">
        <div className="w-24 h-24 bg-surface rounded-full flex items-center justify-center mb-6 animate-pulse border border-white/5 shadow-xl">
          <Briefcase className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-3xl font-bold text-text-main mb-3">That's everyone!</h2>
        <p className="text-text-muted max-w-md text-lg leading-relaxed mb-6">
          You've seen all active entrepreneurs in your area. Check back later for more potential matches.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden p-4 md:p-8">
      
      {/* Next Card (Background Stack) */}
      {nextUser && (
        <div className="absolute w-full max-w-sm md:max-w-md h-[65vh] md:h-[70vh] bg-surface rounded-3xl border border-white/5 shadow-xl overflow-hidden transform scale-95 translate-y-4 -z-10 opacity-60 filter grayscale-[0.5]">
          <img
            src={nextUser.imageUrl || DEFAULT_PROFILE_IMAGE}
            alt={nextUser.name}
            className="w-full h-3/5 object-cover"
            onError={(e) => { e.currentTarget.src = DEFAULT_PROFILE_IMAGE; }}
          />
           <div className="p-6 bg-surface h-2/5 flex flex-col">
             <h2 className="text-2xl font-bold text-text-main mb-1">{nextUser.name}</h2>
             <p className="text-secondary text-sm">{nextUser.role}</p>
           </div>
        </div>
      )}

      {/* Active Card */}
      <AnimatePresence>
        <motion.div
          key={activeUser.id}
          style={{ x, rotate, cursor: 'grab' }}
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={exitX ? { x: exitX, opacity: 0 } : { scale: 1, opacity: 1, y: 0, x: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={onDragEnd}
          whileTap={{ cursor: 'grabbing' }}
          className="absolute w-full max-w-sm md:max-w-md h-[65vh] md:h-[70vh] bg-surface rounded-3xl shadow-2xl border border-white/10 flex flex-col overflow-hidden z-10"
        >
          {/* Swipe Indicators */}
          <motion.div 
            style={{ opacity: opacityLike }}
            className="absolute top-8 left-8 z-20 border-4 border-green-500 rounded-lg px-4 py-2 transform -rotate-12"
          >
            <span className="text-3xl font-bold text-green-500 uppercase tracking-widest">Connect</span>
          </motion.div>
          
          <motion.div 
             style={{ opacity: opacityNope }}
             className="absolute top-8 right-8 z-20 border-4 border-red-500 rounded-lg px-4 py-2 transform rotate-12"
          >
            <span className="text-3xl font-bold text-red-500 uppercase tracking-widest">Skip</span>
          </motion.div>

          {/* Image Section */}
          <div className="relative h-[60%] w-full bg-gray-900">
            <img
              src={activeUser.imageUrl || DEFAULT_PROFILE_IMAGE}
              alt={activeUser.name}
              className="w-full h-full object-cover pointer-events-none"
              onError={(e) => { e.currentTarget.src = DEFAULT_PROFILE_IMAGE; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
            
            {/* Badges Overlay */}
            <div className="absolute top-4 right-4 flex flex-wrap justify-end gap-2 max-w-[80%]">
              {activeUser.badges.slice(0, 3).map((badge) => (
                <div key={badge.id} className="bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-gold/20 shadow-lg">
                   <span className="text-xs">{badge.icon}</span>
                   <span className="text-[10px] font-bold text-gold uppercase tracking-wide">{badge.name}</span>
                </div>
              ))}
            </div>
            
            {/* Stage Tag */}
            <div className="absolute bottom-4 left-4">
                <span className="bg-primary/90 backdrop-blur text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg border border-primary-hover">
                    {activeUser.stage} Stage
                </span>
            </div>
          </div>

          {/* Info Section */}
          <div className="flex-1 p-6 flex flex-col bg-surface relative">
            <div>
              <div className="flex justify-between items-start mb-1">
                <h2 className="text-3xl font-bold text-text-main tracking-tight">{activeUser.name}, {activeUser.age}</h2>
                <div className="flex items-center gap-1 text-gold bg-gold/10 px-2 py-1 rounded-lg border border-gold/20">
                   <Star size={12} fill="currentColor" /> 
                   <span className="text-xs font-bold">{activeUser.badges.length}</span>
                </div>
              </div>
              
              <p className="text-gold font-medium text-sm uppercase tracking-wide mb-2 flex items-center gap-2">
                <Briefcase size={14} /> {activeUser.role}
              </p>
              
              {activeUser.location && (
                <p className="text-text-muted text-xs flex items-center gap-1.5 mb-4">
                   <MapPin size={12} /> {activeUser.location.city}, {activeUser.location.state}
                </p>
              )}

              <p className="text-text-muted text-sm leading-relaxed line-clamp-3 opacity-90">
                {activeUser.bio}
              </p>
            </div>

            <div className="mt-auto pt-4">
              <div className="flex flex-wrap gap-2">
                {activeUser.tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="px-2.5 py-1 bg-background border border-white/10 text-text-muted rounded-md text-[10px] font-medium uppercase tracking-wide flex items-center gap-1">
                    <Tag size={10} className="text-secondary" /> {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Floating Action Buttons */}
      <div className="absolute bottom-6 md:bottom-10 w-full flex justify-center items-center gap-6 z-20 px-4">
          <button 
            className="w-16 h-16 rounded-full bg-surface border border-red-500/30 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-2xl hover:scale-110 hover:border-red-500 group"
            onClick={() => { setExitX(-1000); setTimeout(() => handleSwipe('left'), 200); }}
          >
            <X size={32} className="group-hover:scale-110 transition-transform" />
          </button>

          <button 
            className="w-16 h-16 rounded-full bg-surface border border-green-500/30 text-green-500 flex items-center justify-center hover:bg-green-500 hover:text-white transition-all shadow-2xl hover:scale-110 hover:border-green-500 group"
            onClick={() => { setExitX(1000); setTimeout(() => handleSwipe('right'), 200); }}
          >
            <Check size={32} className="group-hover:scale-110 transition-transform" />
          </button>
      </div>
    </div>
  );
};

export default SwipeDeck;
