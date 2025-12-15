
import React from 'react';
import { ShieldCheck, PauseCircle, XCircle, PlayCircle, Lock, Activity, Clock, AlertCircle } from 'lucide-react';
import { MatchStatus, SubscriptionTier } from '../types';

interface PartnershipStatusPanelProps {
  status: MatchStatus;
  isPlusOrPro: boolean;
  onUpdateStatus: (newStatus: MatchStatus) => void;
  onUpgrade: (tier: SubscriptionTier) => void;
}

const PartnershipStatusPanel: React.FC<PartnershipStatusPanelProps> = ({ 
  status, 
  isPlusOrPro, 
  onUpdateStatus, 
  onUpgrade 
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

  const currentInfo = getStatusDisplay(status);
  const StatusIcon = currentInfo.icon;

  const timelineStates: MatchStatus[] = ['active', 'paused', 'pending', 'inactive'];

  return (
    <div className="flex flex-col w-full h-full bg-surface/40 backdrop-blur-xl border border-white/5 rounded-3xl shadow-xl overflow-hidden relative">
      <div className="flex flex-col h-full p-5 overflow-y-auto custom-scrollbar">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-6 shrink-0">
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

        {/* 1. Main Status Card (Top Anchored) */}
        <div className={`flex flex-col items-start p-4 rounded-2xl border ${currentInfo.bg} ${currentInfo.border} mb-6 relative overflow-hidden shrink-0`}>
           <div className={`absolute top-0 right-0 p-3 opacity-20 ${currentInfo.color}`}>
              <StatusIcon size={48} />
           </div>
           <div className="relative z-10">
             <span className={`text-[10px] font-bold uppercase tracking-widest opacity-80 ${currentInfo.color} mb-1 block`}>Current State</span>
             <h3 className={`text-xl font-bold ${currentInfo.color}`}>{currentInfo.label}</h3>
           </div>
        </div>

        {/* 2. What This Means */}
        <div className="mb-8 shrink-0">
           <h4 className="text-xs font-bold text-text-main mb-2">What this means</h4>
           <p className="text-xs text-text-muted leading-relaxed">
             {getMeaningText(status)}
           </p>
        </div>

        {/* 3. Vertical Status Timeline */}
        <div className="mb-8 shrink-0">
           <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4 ml-1">Lifecycle States</h4>
           <div className="space-y-0 relative ml-2">
              {/* Vertical Line */}
              <div className="absolute left-[5px] top-2 bottom-2 w-px bg-white/10 z-0"></div>

              {timelineStates.map((s) => {
                 const isActive = s === status;
                 const info = getStatusDisplay(s);
                 
                 return (
                   <div key={s} className="relative z-10 flex items-center gap-3 py-2">
                      <div className={`w-3 h-3 rounded-full border-2 shrink-0 transition-all ${isActive ? `${info.color} border-current bg-surface shadow-[0_0_8px_currentColor]` : 'border-white/10 bg-surface'}`}></div>
                      <span className={`text-xs font-medium transition-colors ${isActive ? 'text-text-main' : 'text-text-muted/50'}`}>
                        {info.label}
                      </span>
                   </div>
                 );
              })}
           </div>
        </div>

        {/* 4. Controls / Upgrade CTA */}
        <div className="mt-auto shrink-0">
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
            <div className="p-4 bg-black/20 rounded-xl border border-white/5 mt-2">
               <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <Lock size={16} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-text-main">Management Controls</p>
                    <p className="text-[10px] text-text-muted">Pause, resume, or end anytime.</p>
                  </div>
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
