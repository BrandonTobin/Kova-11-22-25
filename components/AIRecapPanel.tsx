import React from 'react';
import { Sparkles, Lock, RefreshCw } from 'lucide-react';
import { SubscriptionTier } from '../types';

interface AIRecapPanelProps {
  subscriptionTier: SubscriptionTier;
  onUpgrade: (tier: SubscriptionTier) => void;
}

const AIRecapPanel: React.FC<AIRecapPanelProps> = ({ subscriptionTier, onUpgrade }) => {
  // Feature is currently in "Coming Soon" mode for everyone
  
  return (
    <div className="flex flex-col w-full h-full bg-surface/40 backdrop-blur-xl border border-white/5 rounded-3xl shadow-xl overflow-hidden relative">
      
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2 text-text-main">
          <div className="p-1.5 rounded-lg bg-gold/10">
             <Sparkles size={16} className="text-gold" />
          </div>
          <div>
            <h3 className="text-base font-bold">AI Accountability Recap</h3>
            <p className="text-[11px] text-text-muted mt-0.5">Weekly performance summary</p>
          </div>
        </div>
        <span className="px-2 py-1 rounded-full bg-background/50 border border-white/10 text-[9px] font-bold flex items-center gap-1 text-text-muted uppercase tracking-wider">
            <Lock className="w-2.5 h-2.5" />
            Pro
        </span>
      </div>

      {/* Content Area - BLURRED & LOCKED (Coming Soon State) */}
      <div className="flex-1 min-h-0 relative">
          
          {/* Skeleton Background to provide visual texture under blur */}
          <div className="flex flex-col h-full pointer-events-none select-none p-5 space-y-4 opacity-50 blur-[4px]">
               {/* Insight Skeleton */}
               <div className="bg-background/40 rounded-xl p-4 border border-white/5 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 rounded bg-white/20"></div>
                    <div className="h-3 w-24 bg-white/20 rounded"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 w-full bg-white/10 rounded"></div>
                    <div className="h-2 w-11/12 bg-white/10 rounded"></div>
                    <div className="h-2 w-3/4 bg-white/10 rounded"></div>
                  </div>
               </div>

               {/* Action Items Skeleton */}
               <div className="space-y-3">
                  <div className="h-2 w-20 bg-white/20 rounded mb-2"></div>
                  <div className="flex items-start gap-2 p-3 bg-black/10 rounded-lg border border-white/5">
                    <div className="w-1 h-10 rounded bg-gold/20 shrink-0"></div>
                    <div className="space-y-2 w-full pt-1">
                        <div className="h-2 w-10/12 bg-white/10 rounded"></div>
                        <div className="h-2 w-1/2 bg-white/10 rounded"></div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-black/10 rounded-lg border border-white/5">
                    <div className="w-1 h-10 rounded bg-gold/20 shrink-0"></div>
                    <div className="space-y-2 w-full pt-1">
                        <div className="h-2 w-11/12 bg-white/10 rounded"></div>
                    </div>
                  </div>
               </div>
          </div>

          {/* "Coming Soon" Overlay Pill */}
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/10">
            <div className="px-4 py-2 rounded-full bg-black/80 flex items-center gap-2 border border-white/10 shadow-xl backdrop-blur-md">
               <Lock size={12} className="text-zinc-400" />
               <span className="text-xs font-semibold tracking-wide text-white">
                 Kova Pro | Coming Soon
               </span>
            </div>
          </div>

          {/* Fixed Bottom Button Area (Skeleton/Blurred) */}
          <div className="absolute bottom-0 w-full p-4 border-t border-white/5 bg-surface/30 backdrop-blur-md shrink-0 opacity-30 pointer-events-none blur-[2px]">
              <button className="w-full py-3 bg-gold/10 text-gold border border-gold/20 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2">
                <RefreshCw size={14} />
                Generate New Recap
              </button>
          </div>
      </div>
    </div>
  );
};

export default AIRecapPanel;