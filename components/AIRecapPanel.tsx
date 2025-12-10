import React, { useState } from 'react';
import { Sparkles, Lock, RefreshCw, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { SubscriptionTier } from '../types';

interface AIRecapPanelProps {
  subscriptionTier: SubscriptionTier;
  onUpgrade: (tier: SubscriptionTier) => void;
}

const AIRecapPanel: React.FC<AIRecapPanelProps> = ({ subscriptionTier, onUpgrade }) => {
  const isPro = subscriptionTier === 'kova_pro';
  // Always expanded by default if Pro, effectively fills the container in the new layout
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="flex flex-col w-full h-full bg-surface/40 backdrop-blur-xl border border-white/5 rounded-3xl shadow-xl overflow-hidden relative">
      
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2 text-text-main">
          <div className={`p-1.5 rounded-lg ${isPro ? 'bg-gold/10' : 'bg-white/5'}`}>
             <Sparkles size={16} className={isPro ? "text-gold" : "text-text-muted"} />
          </div>
          <div>
            <h3 className="text-base font-bold">AI Accountability Recap</h3>
            <p className="text-[11px] text-text-muted mt-0.5">Weekly performance summary</p>
          </div>
        </div>
        {!isPro && (
          <span className="px-2 py-1 rounded-full bg-background/50 border border-white/10 text-[9px] font-bold flex items-center gap-1 text-text-muted uppercase tracking-wider">
            <Lock className="w-2.5 h-2.5" />
            Pro
          </span>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 relative">
        {isPro ? (
          <div className="flex flex-col h-full">
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-4">
               {/* Placeholder content representing AI analysis */}
               <div className="bg-background/40 rounded-xl p-4 border border-white/5">
                  <h4 className="text-xs font-bold text-text-main mb-2 flex items-center gap-2">
                    <Sparkles size={12} className="text-gold" /> Weekly Insight
                  </h4>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Based on your chat activity and goal completion, you've maintained a 85% consistency rate this week. Your partnership with this founder is highly active in the mornings.
                  </p>
               </div>

               <div className="space-y-2">
                  <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">Action Items</h4>
                  <div className="flex items-start gap-2 text-xs text-text-muted bg-black/10 p-3 rounded-lg border border-white/5">
                    <div className="mt-0.5 min-w-[4px] h-1 w-1 rounded-full bg-gold"></div>
                    <p>Review the marketing strategy discussed on Tuesday.</p>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-text-muted bg-black/10 p-3 rounded-lg border border-white/5">
                    <div className="mt-0.5 min-w-[4px] h-1 w-1 rounded-full bg-gold"></div>
                    <p>Follow up on the introduction to the angel investor.</p>
                  </div>
               </div>
               
               {/* Spacer to ensure scrolling works well with fixed button visual balance */}
               <div className="h-4"></div>
            </div>

            {/* Fixed Bottom Button Area */}
            <div className="p-4 border-t border-white/5 bg-surface/30 backdrop-blur-md shrink-0">
              <button className="w-full py-3 bg-gold/10 hover:bg-gold/20 text-gold border border-gold/20 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-colors shadow-sm group">
                <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" /> 
                Generate New Recap
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col justify-center h-full text-center relative overflow-hidden">
             {/* Locked Background */}
             <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background/50 pointer-events-none"></div>
             
             <div className="relative z-10 space-y-5 px-4 flex flex-col items-center justify-center h-full">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center border border-white/10 shadow-lg">
                   <Lock size={24} className="text-text-muted" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-main mb-1">Unlock AI Insights</h3>
                  <p className="text-xs text-text-muted leading-relaxed max-w-[200px] mx-auto">
                    Get deep weekly analysis of your partnership progress.
                  </p>
                </div>
                <ul className="text-xs text-text-muted/80 space-y-3 text-left bg-black/20 p-4 rounded-xl border border-white/5 w-full max-w-[240px]">
                  <li className="flex items-center gap-2"><CheckCircle size={12} className="text-gold" /> Weekly AI-generated summaries</li>
                  <li className="flex items-center gap-2"><CheckCircle size={12} className="text-gold" /> Improve accountability</li>
                </ul>
                <button
                  type="button"
                  onClick={() => onUpgrade('kova_pro')}
                  className="w-full max-w-[240px] py-3 rounded-xl bg-gradient-to-r from-gold to-amber-600 hover:opacity-90 text-white font-bold shadow-lg transition-all flex items-center justify-center gap-2 text-xs"
                >
                  <Lock size={14} /> Upgrade to Pro
                </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIRecapPanel;