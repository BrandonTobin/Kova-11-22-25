import React, { useState } from 'react';
import { Sparkles, Lock, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { SubscriptionTier } from '../types';

interface AIRecapPanelProps {
  subscriptionTier: SubscriptionTier;
}

const AIRecapPanel: React.FC<AIRecapPanelProps> = ({ subscriptionTier }) => {
  const isPro = subscriptionTier === 'kova_pro';
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div 
      className={`w-full bg-surface/40 backdrop-blur-xl border border-white/5 rounded-3xl shadow-xl overflow-hidden relative transition-all duration-300 ease-in-out ${
        !isPro ? 'h-[160px]' : isExpanded ? 'h-auto' : 'h-[76px]'
      }`}
    >
      {/* Header */}
      <div 
        className={`flex items-center justify-between p-5 ${isPro ? 'cursor-pointer' : ''}`}
        onClick={() => isPro && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 text-text-main">
          <div className={`p-1.5 rounded-lg ${isPro ? 'bg-gold/10' : 'bg-white/5'}`}>
             <Sparkles size={16} className={isPro ? "text-gold" : "text-text-muted"} />
          </div>
          <h3 className="text-sm font-bold">AI Accountability Recap</h3>
        </div>
        {isPro ? (
          <button className="text-text-muted hover:text-white transition-colors">
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        ) : (
          <Lock size={16} className="text-text-muted" />
        )}
      </div>

      {/* Pro Content (Expanded) */}
      {isPro && (
        <div className={`px-5 pb-5 transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 hidden'}`}>
            <div className="bg-background/50 rounded-xl p-4 border border-white/5 text-xs text-text-muted leading-relaxed mb-4">
              <p className="mb-2 italic opacity-70">No recap generated for this week yet.</p>
              <p>Your AI assistant analyzes shared goals and chat activity to summarize progress every Sunday.</p>
            </div>
            <button className="w-full py-3 bg-gold/10 hover:bg-gold/20 text-gold border border-gold/20 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-colors shadow-sm">
              <RefreshCw size={14} /> Generate New Recap
            </button>
        </div>
      )}

      {/* Locked Content Simulation (Blurred) */}
      {!isPro && (
        <div className="px-5 pb-5 opacity-20 blur-[2px] select-none pointer-events-none flex flex-col gap-3" aria-hidden="true">
            <div className="bg-background/50 rounded-xl p-4 border border-white/5 h-16"></div>
            <div className="w-full h-10 bg-gold/10 rounded-xl"></div>
        </div>
      )}

      {/* Lock Overlay */}
      {!isPro && (
         <div className="absolute inset-0 top-[60px] z-20 flex flex-col items-center justify-center text-center p-4">
            <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 shadow-xl flex flex-col items-center gap-2 max-w-[240px]">
               <div className="p-1.5 bg-gold/10 rounded-full">
                 <Lock size={14} className="text-gold" />
               </div>
               <p className="text-xs font-medium text-white leading-relaxed">
                 Upgrade to Pro to unlock AI weekly accountability summaries
               </p>
            </div>
         </div>
      )}
    </div>
  );
};

export default AIRecapPanel;