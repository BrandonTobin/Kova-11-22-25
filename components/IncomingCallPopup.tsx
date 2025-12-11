
import React from 'react';
import { Phone, Video, X } from 'lucide-react';
import { User, CallType } from '../types';
import { getDisplayName } from '../utils/nameUtils';
import { DEFAULT_PROFILE_IMAGE } from '../constants';

interface IncomingCallPopupProps {
  caller: User;
  callType: CallType;
  onAccept: () => void;
  onDecline: () => void;
}

const IncomingCallPopup: React.FC<IncomingCallPopupProps> = ({ caller, callType, onAccept, onDecline }) => {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="bg-surface/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-4 flex items-center gap-4">
        {/* Caller Avatar with Pulse */}
        <div className="relative shrink-0">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/50 relative z-10">
            <img 
              src={caller.imageUrl || DEFAULT_PROFILE_IMAGE} 
              alt={caller.name}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.src = DEFAULT_PROFILE_IMAGE; }}
            />
          </div>
          <div className="absolute inset-0 bg-primary/30 rounded-full animate-ping z-0"></div>
        </div>

        {/* Text Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-text-main truncate text-sm">
            {getDisplayName(caller.name)}
          </h3>
          <p className="text-xs text-text-muted flex items-center gap-1.5">
            {callType === 'video' ? <Video size={10} /> : <Phone size={10} />}
            Incoming {callType === 'audio' ? 'voice' : 'video'} call...
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={onDecline}
            className="w-10 h-10 rounded-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 flex items-center justify-center transition-all"
            title="Decline"
          >
            <X size={20} />
          </button>
          
          <button 
            onClick={onAccept}
            className="w-10 h-10 rounded-full bg-green-500 text-white shadow-lg shadow-green-500/30 hover:scale-105 transition-all flex items-center justify-center animate-pulse"
            title="Accept"
          >
            {callType === 'video' ? <Video size={20} /> : <Phone size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallPopup;
