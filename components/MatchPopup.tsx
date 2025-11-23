
import React from 'react';
import { motion } from 'framer-motion';
import { User } from '../types';
import { MessageSquare, X, Sparkles } from 'lucide-react';
import { DEFAULT_PROFILE_IMAGE } from '../constants';

interface MatchPopupProps {
  matchedUser: User;
  currentUser: User;
  onClose: () => void;
  onChat: () => void;
}

const MatchPopup: React.FC<MatchPopupProps> = ({ matchedUser, currentUser, onClose, onChat }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="w-full max-w-lg bg-surface rounded-3xl border border-gold/20 shadow-2xl overflow-hidden relative"
      >
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-gold/10 pointer-events-none" />
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-gold/10 rounded-full blur-3xl" />

        <div className="relative p-8 text-center flex flex-col items-center">
          <div className="mb-6">
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gold to-secondary italic transform -rotate-2 font-serif">
              It's a Match!
            </h2>
            <p className="text-text-muted mt-2">You and {matchedUser.name} have connected.</p>
          </div>

          <div className="flex items-center justify-center gap-4 mb-10">
            <div className="relative">
              <img 
                src={currentUser.imageUrl} 
                alt="You" 
                className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-gold shadow-xl" 
                onError={(e) => { e.currentTarget.src = DEFAULT_PROFILE_IMAGE; }}
              />
              <div className="absolute -bottom-2 -right-2 bg-surface p-2 rounded-full border border-gold/30">
                <Sparkles className="text-gold w-5 h-5" />
              </div>
            </div>
            <div className="relative">
               <img 
                src={matchedUser.imageUrl} 
                alt={matchedUser.name} 
                className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-gold shadow-xl" 
                onError={(e) => { e.currentTarget.src = DEFAULT_PROFILE_IMAGE; }}
              />
            </div>
          </div>

          <div className="flex flex-col w-full gap-3">
            <button 
              onClick={onChat}
              className="w-full py-4 bg-gradient-to-r from-primary to-primary-hover hover:opacity-90 text-white font-bold rounded-xl shadow-lg transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2 border border-white/10"
            >
              <MessageSquare size={20} />
              Send a Message
            </button>
            <button 
              onClick={onClose}
              className="w-full py-4 bg-transparent hover:bg-white/5 text-text-muted hover:text-white font-semibold rounded-xl transition-colors border border-white/10"
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
