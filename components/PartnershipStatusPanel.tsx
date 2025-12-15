
import React from 'react';
import { ShieldCheck, PauseCircle, XCircle, PlayCircle, Lock, Activity, Clock, AlertCircle } from 'lucide-react';
import { MatchStatus, SubscriptionTier } from '../types';

interface PartnershipStatusPanelProps {
  status: MatchStatus;
  isPlusOrPro: boolean;
  onUpdateStatus: (newStatus: MatchStatus) => void;
  onUpgrade: (tier: SubscriptionTier) => void;
  lastActivityDate?: string | Date;
}

const PartnershipStatusPanel: React.FC<PartnershipStatusPanelProps> = ({ 
  status, 
  isPlusOrPro, 
  onUpdateStatus, 
  onUpgrade,
  lastActivityDate
}) => {
  
  const getStatusDisplay = (s: MatchStatus) => {
    switch(s) {
      case 'active': 
        return { label: 'Active', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: Activity };
      case 'paused': 
        return { label: 'Paused', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: PauseCircle };
      case 'pending': 
        return { label: 'Pending Response', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: Clock };
      case 'inactive': 
        return { label: 'Inactive', color: 'text-gray-400', bg: 'bg-white/5', border: 'border-white/10', icon: AlertCircle };
      case 'ended': 
        return { label: 'Ended', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: XCircle };
      default: 
        return { label: 'Active', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: Activity };
    }
  };

  const getMeaningText = (s: MatchStatus) => {
     switch(s) {
        case 'active': return "You and this partner are communicating consistently. No action is required right now.";
        case 'paused': return "Messaging and scheduling are disabled until one of you resumes the partnership.";
        case 'pending': return "We've detected a lull in conversation. Waiting for a check-in to keep this active.";
        case 'inactive': return "This partnership has become inactive due to lack of recent engagement.";
        case 'ended': return "This connection has been permanently closed. History is archived.";
        default: return "Current status of the partnership.";
     }
  };

  const getLifecycleMicrocopy = (s: MatchStatus) => {
    switch(s) {
      case 'active': return "Communication is open";
      case 'paused': return "Messaging is limited";
      case 'pending': return "Action needed";
      case 'inactive': return "Partnership is closed";
      default: return "";
    }
  };

  const formatActivityDate = (date: string | Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - d.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  const currentInfo = getStatusDisplay(status);
  const StatusIcon = currentInfo.icon;

  const timelineStates: MatchStatus[] = ['active', 'paused', 'pending', 'inactive'];

  return (
    <div className="flex flex-col w-full h-full bg-surface/40 backdrop-blur-xl border border-white/5 rounded-3xl shadow-xl overflow-hidden relative">
      <div className="flex flex-col h-full p-5 overflow-hidden">
        
        {/* --- ZONE 1: TOP (Anchored) --- */}
        <div className="shrink-0">
          {/* Header */}
          <header className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-text-main flex items-center gap-2">
                <ShieldCheck size={18} className="text-gold" />
                Partnership Status
              </h2>
              <p className="text-[11px] text-text-muted mt-0.5">
                Health & Lifecycle
              </p>
            </div>
            {!isPlusOrPro && (
              <span className="px-2 py-1 rounded-full bg-background/50 border border-white/10 text-[9px] font-bold flex items-center gap-1 text-text-muted uppercase tracking-wider">
                <Lock className="w-2.5 h-2.5" />
                Plus
              </span>
            )}
          </header>

          {/* Main Status Card */}
          <div className={`flex flex-col items-start py-3 px-4 rounded-2xl border ${currentInfo.bg} ${currentInfo.border} mb-5 relative overflow-hidden`}>
             <div className={`absolute top-0 right-0 p-2 opacity-20 ${currentInfo.color}`}>
                <StatusIcon size={40} />
             </div>
             <div className="relative z-10">
               <span className={`text-[9px] font-bold uppercase tracking-widest opacity-80 ${currentInfo.color} mb-0.5 block`}>Current State</span>
               <h3 className={`text-lg font-bold ${currentInfo.color}`}>{currentInfo.label}</h3>
             </div>
          </div>

          {/* Explanation */}
          <div className="mb-6">
             <h4 className="text-xs font-bold text-text-main mb-1.5">What this means</h4>
             <p className="text-xs text-text-muted leading-relaxed">
               {getMeaningText(status)}
             </p>
          </div>
          
          <div className="h-px bg-white/5 w-full" />
        </div>

        {/* --- ZONE 2: MIDDLE (Lifecycle + Fill) --- */}
        <div className="flex-1 flex flex-col justify-center relative min-h-0 py-4">
           {/* Visual Fill: Subtle Vertical Line/Gradient */}
           <div className="absolute top-4 bottom-4 left-[9px] w-0.5 bg-gradient-to-b from-transparent via-white/5 to-transparent rounded-full z-0 pointer-events-none" />

           <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-6 pl-1 relative z-10">Lifecycle Context</h4>
           
           <div className="space-y-6 relative ml-2 z-10">
              {timelineStates.map((s) => {
                 const isActive = s === status;
                 const info = getStatusDisplay(s);
                 const microcopy = getLifecycleMicrocopy(s);
                 
                 return (
                   <div key={s} className="relative flex flex-col justify-center">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full border-2 shrink-0 transition-all z-10 ${isActive ? `${info.color} border-current bg-surface shadow-[0_0_8px_currentColor] scale-125` : 'border-white/10 bg-surface'}`}></div>
                        <span className={`text-xs transition-colors ${isActive ? 'font-bold text-text-main' : 'font-medium text-text-muted/40'}`}>
                            {info.label}
                        </span>
                      </div>
                      {isActive && (
                        <div className="ml-6 mt-1 text-[10px] text-text-muted font-medium animate-in fade-in slide-in-from-left-2 opacity-80">
                          {microcopy}
                        </div>
                      )}
                   </div>
                 );
              })}
           </div>
        </div>

        {/* --- ZONE 3: BOTTOM (Controls) --- */}
        <div className="shrink-0 mt-auto pt-2 border-t border-white/5">
          
          {/* Last Activity Row */}
          {lastActivityDate && (
            <div className="flex items-center justify-center gap-2 mb-4 mt-2 opacity-60">
               <Clock size={10} className="text-text-muted" />
               <span className="text-[10px] text-text-muted font-medium uppercase tracking-wide">
                 Last activity: {formatActivityDate(lastActivityDate)}
               </span>
            </div>
          )}

          {isPlusOrPro ? (
            <div className="space-y-3">
               <p className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-2">Actions</p>
               
               {status === 'active' && (
                 <button 
                   onClick={() => onUpdateStatus('paused')}
                   className="w-full flex items-center justify-between px-4 py-3 bg-surface border border-white/10 hover:bg-white/5 rounded-xl text-xs font-medium text-text-main transition-colors group"
                 >
                   <span className="flex items-center gap-2"><PauseCircle size={14} className="text-amber-400"/> Pause Partnership</span>
                 </button>
               )}

               {(status === 'paused' || status === 'inactive') && (
                 <button 
                   onClick={() => onUpdateStatus('active')}
                   className="w-full flex items-center justify-between px-4 py-3 bg-surface border border-emerald-500/20 hover:bg-emerald-500/10 rounded-xl text-xs font-medium text-emerald-400 transition-colors"
                 >
                   <span className="flex items-center gap-2"><PlayCircle size={14} /> Resume Partnership</span>
                 </button>
               )}

               {status !== 'ended' && (
                 <button 
                   onClick={() => onUpdateStatus('ended')}
                   className="w-full flex items-center justify-between px-4 py-3 bg-surface border border-white/10 hover:border-red-500/30 hover:bg-red-500/5 rounded-xl text-xs font-medium text-text-muted hover:text-red-400 transition-colors"
                 >
                   <span className="flex items-center gap-2"><XCircle size={14} /> End Partnership</span>
                 </button>
               )}
            </div>
          ) : (
            <div className="bg-black/20 rounded-xl border border-white/5 p-4">
               <div className="mb-3">
                  <h5 className="text-xs font-bold text-text-main flex items-center gap-2 mb-1">
                    <Lock size={12} className="text-emerald-400" />
                    Management Controls
                  </h5>
                  <p className="text-[10px] text-text-muted leading-tight ml-5">
                    Pause, resume, or end anytime.
                  </p>
               </div>
               <button
                  type="button"
                  onClick={() => onUpgrade('kova_plus')}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-700 hover:opacity-90 text-white font-bold text-xs shadow-lg transition-all"
                >
                  Upgrade to control this partnership
                </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default PartnershipStatusPanel;
