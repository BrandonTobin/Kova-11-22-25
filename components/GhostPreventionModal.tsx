
import React from 'react';
import { ShieldCheck, Play, Pause, XOctagon } from 'lucide-react';

interface GhostPreventionModalProps {
  onContinue: () => void;
  onPause: () => void;
  onEnd: () => void;
}

const GhostPreventionModal: React.FC<GhostPreventionModalProps> = ({ onContinue, onPause, onEnd }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-surface w-full max-w-md rounded-3xl border border-white/10 shadow-2xl p-8 flex flex-col items-center text-center relative overflow-hidden">
        
        {/* Glow Effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-gold/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="w-16 h-16 rounded-full bg-surface border border-gold/20 flex items-center justify-center mb-6 shadow-lg z-10">
           <ShieldCheck size={32} className="text-gold" />
        </div>

        <h2 className="text-2xl font-bold text-text-main mb-3">Partnership Check-in</h2>
        <p className="text-text-muted text-sm leading-relaxed mb-8 max-w-xs">
          This partnership has gone quiet. As a Plus member, you have control. How would you like to proceed?
        </p>

        <div className="flex flex-col w-full gap-3">
           <button 
             onClick={onContinue}
             className="w-full py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 shadow-lg"
           >
             <Play size={16} fill="currentColor" /> Continue Partnership
           </button>

           <button 
             onClick={onPause}
             className="w-full py-3.5 bg-surface border border-white/10 text-text-main font-medium rounded-xl hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
           >
             <Pause size={16} /> Pause for Now
           </button>

           <button 
             onClick={onEnd}
             className="w-full py-3.5 bg-transparent text-text-muted hover:text-red-400 font-medium text-sm transition-colors flex items-center justify-center gap-2 mt-2"
           >
             <XOctagon size={14} /> End Partnership
           </button>
        </div>

      </div>
    </div>
  );
};

export default GhostPreventionModal;
