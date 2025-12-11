
import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, CheckSquare, FileText, Sparkles, Plus, Loader2, ArrowRight, Monitor, MonitorOff, Users, UserPlus, X, ArrowLeft, MessageSquare, Send, Phone } from 'lucide-react';
import { Match, Goal, User, CallType } from '../types';
import { generateSharedGoals, generateMeetingSummary } from '../services/geminiService';
import { startSession, endSession } from '../services/sessionService';
import { DEFAULT_PROFILE_IMAGE } from '../constants';
import { getDisplayName } from '../utils/nameUtils';
import { supabase } from '../supabaseClient';

interface VideoRoomProps {
  match: Match;
  allMatches: Match[];
  currentUser: User;
  onEndCall: () => void;
  onReturnToDashboard: () => void;
  callType?: CallType;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Date;
}

// WebRTC Config
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const VideoRoom: React.FC<VideoRoomProps> = ({ match, allMatches, currentUser, onEndCall, onReturnToDashboard, callType = 'video' }) => {
  // Call State
  // participants list tracks active remote connections.
  const [participants, setParticipants] = useState<Match[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Media State
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(callType === 'video'); // Default based on call type
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Tools State
  const [activeTool, setActiveTool] = useState<'goals' | 'notes'>('goals');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoal, setNewGoal] = useState('');
  const [notes, setNotes] = useState('');
  const [aiSuggesting, setAiSuggesting] = useState(false);

  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Refs for WebRTC & Media
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<any>(null);
  const isInitiator = useRef<boolean>(false);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);

  // Summary State
  const [showSummary, setShowSummary] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // --- 1. Initialize Session & Media ---
  useEffect(() => {
    // Start backend session tracking
    if (!sessionId && currentUser && match?.user) {
      startSession(currentUser.id, match.user.id, callType).then((id) => {
        if (id) setSessionId(id);
      });
    }

    const initMedia = async () => {
      try {
        const constraints = {
          audio: true,
          video: callType === 'video'
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setLocalStream(stream);
      } catch (err) {
        console.error("Error accessing media devices:", err);
      }
    };

    initMedia();

    setChatMessages([{
        id: 'system-1',
        senderId: 'system',
        senderName: 'System',
        text: `Welcome to the ${callType} room! Connecting to secure channel...`,
        timestamp: new Date()
    }]);

    // Cleanup on unmount
    return () => {
      cleanupCall();
    };
  }, []); // Run once on mount

  // --- 2. Attach Local Stream to Video Element ---
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // --- 3. Attach Remote Stream to Video Element ---
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // --- 4. WebRTC Initialization (Once Local Stream is Ready) ---
  useEffect(() => {
    if (localStream && !peerConnection.current) {
      initializePeerConnection(localStream);
    }
  }, [localStream]);

  // --- WebRTC Logic ---
  const initializePeerConnection = (stream: MediaStream) => {
    // Determine initiator based on ID comparison (lower ID initiates)
    isInitiator.current = currentUser.id < match.user.id;
    console.log(`[WebRTC] Initializing. Am I initiator? ${isInitiator.current}. Room ID: video-signaling:${match.id}`);

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnection.current = pc;

    // Add local tracks
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { candidate: event.candidate }
        });
      }
    };

    // Handle Remote Stream
    // IMPORTANT: This is the ONLY place we add the participant for the UI grid
    // This ensures the tile only appears when video/audio is actually received.
    pc.ontrack = (event) => {
      console.log("[WebRTC] Remote track received", event.streams[0]);
      setRemoteStream(event.streams[0]);
      setParticipants(prev => prev.find(p => p.id === match.id) ? prev : [...prev, match]);
    };

    // Handle Connection State
    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE State: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        console.log("[WebRTC] Peer disconnected");
        setRemoteStream(null);
        // Remove participant so the tile disappears
        setParticipants(prev => prev.filter(p => p.id !== match.id));
      }
    };

    // Set up Signaling Channel
    const channel = supabase.channel(`video-signaling:${match.id}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'ice-candidate' }, ({ payload }: any) => {
        const candidate = new RTCIceCandidate(payload.candidate);
        if (pc.remoteDescription && pc.remoteDescription.type) {
          pc.addIceCandidate(candidate).catch(e => console.error("Error adding candidate", e));
        } else {
          iceCandidatesQueue.current.push(payload.candidate);
        }
      })
      .on('broadcast', { event: 'offer' }, async ({ payload }: any) => {
        if (!peerConnection.current) return;
        console.log("[WebRTC] Received offer");

        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        
        while (iceCandidatesQueue.current.length > 0) {
            const c = iceCandidatesQueue.current.shift();
            if(c) await peerConnection.current.addIceCandidate(new RTCIceCandidate(c));
        }

        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        
        channel.send({
          type: 'broadcast',
          event: 'answer',
          payload: { sdp: answer }
        });
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }: any) => {
        if (!peerConnection.current) return;
        console.log("[WebRTC] Received answer");

        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        
        while (iceCandidatesQueue.current.length > 0) {
            const c = iceCandidatesQueue.current.shift();
            if(c) await peerConnection.current.addIceCandidate(new RTCIceCandidate(c));
        }
      })
      // SIGNAL: 'join' -> Peer entering the room
      .on('broadcast', { event: 'join' }, () => {
        console.log("[WebRTC] Peer joined (received 'join' signal)");
        
        // Note: We DO NOT add to participants here anymore. 
        // We wait for the 'ontrack' event to add them to the UI grid.

        channel.send({ type: 'broadcast', event: 'ack', payload: {} });

        if (isInitiator.current) {
            createAndSendOffer();
        }
      })
      // SIGNAL: 'ack' -> Peer confirming they are already in the room
      .on('broadcast', { event: 'ack' }, () => {
        console.log("[WebRTC] Peer ack received");
        
        if (isInitiator.current) {
            createAndSendOffer();
        }
      })
      .on('broadcast', { event: 'leave' }, () => {
        console.log("[WebRTC] Peer left (received 'leave' signal)");
        setRemoteStream(null);
        setParticipants(prev => prev.filter(p => p.id !== match.id));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log("[WebRTC] Channel subscribed. Sending join signal.");
          channel.send({ type: 'broadcast', event: 'join', payload: {} });
        }
      });
  };

  const createAndSendOffer = async () => {
    const pc = peerConnection.current;
    if (!pc) return;
    
    if (pc.signalingState !== "stable") {
        console.log("[WebRTC] Skipping offer creation, signaling state is:", pc.signalingState);
        return;
    }

    console.log("[WebRTC] Creating offer...");
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    channelRef.current?.send({
      type: 'broadcast',
      event: 'offer',
      payload: { sdp: offer }
    });
  };

  const cleanupCall = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event: 'leave', payload: {} }).then(() => {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
      }).catch(() => {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
      });
    } else {
        setRemoteStream(null);
        iceCandidatesQueue.current = [];
    }
  };

  // --- UI & Logic Handlers ---

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => track.enabled = camOn);
      localStream.getAudioTracks().forEach(track => track.enabled = micOn);
    }
  }, [camOn, micOn, localStream]);

  const toggleGoal = (id: string) => {
    setGoals(goals.map(g => g.id === id ? { ...g, completed: !g.completed } : g));
  };

  const addGoal = () => {
    if (!newGoal.trim()) return;
    setGoals([...goals, { id: Date.now().toString(), text: newGoal, completed: false }]);
    setNewGoal('');
  };

  const handleAiGoals = async () => {
      setAiSuggesting(true);
      const suggestions = await generateSharedGoals("SaaS Growth Strategy");
      const newGoals = suggestions.map(text => ({
          id: Math.random().toString(36).substr(2, 9),
          text,
          completed: false
      }));
      setGoals(prev => [...prev, ...newGoals]);
      setAiSuggesting(false);
  };

  const handleSendChatMessage = () => {
    if (!chatInput.trim()) return;
    
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderId: currentUser.id,
      senderName: getDisplayName(currentUser.name),
      text: chatInput,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, newMessage]);
    setChatInput('');
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      if (localStream && peerConnection.current) {
         const videoTrack = localStream.getVideoTracks()[0];
         const senders = peerConnection.current.getSenders();
         const sender = senders.find(s => s.track?.kind === 'video');
         if (sender && videoTrack) sender.replaceTrack(videoTrack);
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        screenStreamRef.current = stream;
        setIsScreenSharing(true);

        if (peerConnection.current) {
           const screenTrack = stream.getVideoTracks()[0];
           const senders = peerConnection.current.getSenders();
           const sender = senders.find(s => s.track?.kind === 'video');
           if (sender) sender.replaceTrack(screenTrack);
           
           screenTrack.onended = () => {
              setIsScreenSharing(false);
              screenStreamRef.current = null;
              if (localStream) {
                 const camTrack = localStream.getVideoTracks()[0];
                 if (camTrack) sender.replaceTrack(camTrack);
              }
           };
        }

        setTimeout(() => {
          if (screenShareVideoRef.current) {
            screenShareVideoRef.current.srcObject = stream;
          }
        }, 100);

      } catch (err) {
        console.error("Error starting screen share:", err);
      }
    }
  };

  const handleEndCallClick = async () => {
    if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsGeneratingSummary(true);
    try {
      const summary = await generateMeetingSummary(goals, notes);
      setSummaryText(summary);
      setIsGeneratingSummary(false);
      setShowSummary(true);
    } catch (e) {
      handleReturnToDashboard(); // Fallback
    }
  };

  const handleReturnToDashboard = async () => {
     if (sessionId) {
      try { await endSession(sessionId); } catch (e) {}
    }
    cleanupCall();
    onReturnToDashboard();
  };

  const inviteParticipant = (newMatch: Match) => {
    if (!participants.find(p => p.id === newMatch.id)) {
      setParticipants([...participants, newMatch]);
    }
    setShowInviteModal(false);
  };

  // Determine grid layout based on number of visible tiles
  const totalVisible = 1 + (participants.length > 0 ? participants.length : 0); // Me + (Remote Users only if streams active)
  const getGridClass = () => {
    if (totalVisible === 1) return 'grid-cols-1';
    if (totalVisible === 2) return 'grid-cols-1 md:grid-cols-2';
    return 'grid-cols-2';
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-background text-text-main overflow-hidden relative">
      
      {/* Invite Modal */}
      {showInviteModal && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-bold text-text-main flex items-center gap-2">
                 <UserPlus size={24} className="text-primary"/> Add Guest
               </h3>
               <button onClick={() => setShowInviteModal(false)} className="text-text-muted hover:text-white">
                 <X size={24} />
               </button>
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-2 mb-4 pr-2">
               {allMatches.filter(m => !participants.find(p => p.id === m.id)).length === 0 ? (
                 <p className="text-center text-text-muted py-8">No other available matches to invite.</p>
               ) : (
                 allMatches
                  .filter(m => !participants.find(p => p.id === m.id))
                  .map(match => (
                    <div key={match.id} className="flex items-center justify-between p-3 bg-background rounded-xl border border-white/5 hover:border-gold/30 transition-colors">
                       <div className="flex items-center gap-3">
                          <img 
                            src={match.user.imageUrl} 
                            alt={match.user.name} 
                            className="w-10 h-10 rounded-full object-cover" 
                            onError={(e) => { e.currentTarget.src = DEFAULT_PROFILE_IMAGE; }}
                          />
                          <div>
                             <p className="font-bold text-sm text-text-main">{getDisplayName(match.user.name)}</p>
                             <p className="text-xs text-text-muted">{match.user.role}</p>
                          </div>
                       </div>
                       <button 
                         onClick={() => inviteParticipant(match)}
                         className="bg-primary/10 text-primary hover:bg-primary hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-primary/20"
                       >
                         Invite
                       </button>
                    </div>
                  ))
               )}
            </div>
          </div>
        </div>
      )}

      {/* AI Summary Modal */}
      {(isGeneratingSummary || showSummary) && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          {isGeneratingSummary ? (
            <div className="text-center animate-in fade-in zoom-in duration-300">
              <div className="relative mx-auto w-20 h-20 mb-6">
                <div className="absolute inset-0 bg-primary rounded-full opacity-20 animate-ping"></div>
                <div className="relative bg-surface rounded-full w-full h-full flex items-center justify-center border border-primary/50">
                   <Loader2 className="w-10 h-10 text-primary animate-spin" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-text-main mb-2">Wrapping Up Session...</h3>
              <p className="text-text-muted">AI is analyzing your goals and notes.</p>
            </div>
          ) : (
            <div className="bg-surface border border-gold/20 rounded-3xl max-w-lg w-full p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-10 duration-300">
               <div className="flex items-center gap-4 mb-8">
                  <div className="p-4 bg-gradient-to-br from-primary to-secondary rounded-2xl shadow-lg border border-white/10">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-text-main">Session Recap</h2>
                    <p className="text-text-muted">Here's what you achieved today</p>
                  </div>
               </div>
               <div className="bg-background rounded-2xl p-6 mb-8 border border-white/10 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-gold"></div>
                  <p className="text-lg text-text-main leading-relaxed italic">"{summaryText}"</p>
               </div>
               <button 
                 onClick={handleReturnToDashboard}
                 className="w-full py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
               >
                 Back to Dashboard <ArrowRight size={20} />
               </button>
            </div>
          )}
        </div>
      )}

      {/* Main Video Section */}
      <div className="flex-1 flex flex-col relative h-full min-h-0">
        
        {/* Mobile Top Bar */}
        <div className="md:hidden h-14 bg-surface border-b border-white/5 flex items-center justify-between px-4 shrink-0 z-10 pr-20">
           <button onClick={handleReturnToDashboard} className="p-2 text-text-muted hover:text-white">
              <ArrowLeft size={20} />
           </button>
           <span className="font-bold text-text-main text-sm">Co-working Session</span>
           <div className="w-8"></div>
        </div>

        {/* Video Grid */}
        <div className={`flex-1 grid ${getGridClass()} gap-4 p-4 overflow-y-auto`}>
          
          {/* 1. Local User (You) */}
          <div className="relative bg-surface rounded-2xl overflow-hidden shadow-lg border border-white/10 group min-h-[180px]">
            {isScreenSharing ? (
              <video 
                ref={screenShareVideoRef}
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-contain bg-black"
              />
            ) : (
              <video 
                ref={localVideoRef}
                autoPlay 
                playsInline 
                muted 
                className={`w-full h-full object-cover transform scale-x-[-1] ${!camOn ? 'hidden' : ''}`}
              />
            )}
            
            {(!camOn && !isScreenSharing) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background text-text-muted gap-2">
                {callType === 'audio' ? (
                   <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/10">
                      <img src={currentUser.imageUrl} className="w-full h-full object-cover" />
                   </div>
                ) : <VideoOff size={48} />}
                {callType === 'audio' && <span className="text-xs font-bold text-text-muted">Audio Only</span>}
              </div>
            )}
            
            <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-lg text-sm font-medium backdrop-blur-sm text-white flex items-center gap-2">
              {isScreenSharing ? "You (Sharing Screen)" : "You"}
            </div>
            {!micOn && (
              <div className="absolute top-4 right-4 bg-red-500/80 p-1.5 rounded-full text-white">
                <MicOff size={14} />
              </div>
            )}
          </div>

          {/* 2. Remote Participant (Partner) */}
          {/* Tile only renders if participant exists in state, which only happens on 'ontrack' now */}
          {participants.find(p => p.id === match.id) && (
            <div className="relative bg-surface rounded-2xl overflow-hidden shadow-lg border border-white/10 min-h-[180px]">
                <video 
                  ref={remoteVideoRef}
                  autoPlay 
                  playsInline 
                  className={`w-full h-full object-cover ${(!remoteStream || remoteStream.getVideoTracks().length === 0) ? 'hidden' : ''}`}
                />
              
              {/* Show avatar if remote stream has no video (audio only) */}
              {(!remoteStream || remoteStream.getVideoTracks().length === 0) && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-background gap-3">
                    <div className="w-24 h-24 rounded-full border-4 border-primary/20 overflow-hidden shadow-xl relative">
                        <img 
                          src={match.user.imageUrl} 
                          alt={match.user.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.src = DEFAULT_PROFILE_IMAGE; }}
                        />
                        <div className="absolute inset-0 bg-primary/20 animate-pulse rounded-full"></div>
                    </div>
                    <div className="text-center">
                       <p className="font-bold text-text-main text-lg">{getDisplayName(match.user.name)}</p>
                       <p className="text-xs text-text-muted">Audio Call</p>
                    </div>
                 </div>
              )}

              <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-lg text-sm font-medium backdrop-blur-sm text-white flex items-center gap-2">
                {getDisplayName(match.user.name)}
                <span className={`w-2 h-2 rounded-full ${remoteStream ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></span>
              </div>
              
              <div className="absolute top-4 right-4 bg-primary/80 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                {match.user.role}
              </div>
            </div>
          )}

          {/* 3. Extra Invited Participants (if any) */}
          {participants.filter(p => p.id !== match.id).map((participant) => (
            <div key={participant.id} className="relative bg-surface rounded-2xl overflow-hidden shadow-lg border border-white/10 min-h-[180px]">
                <div className="absolute inset-0 flex items-center justify-center bg-background">
                   <p className="text-text-muted">Guest: {getDisplayName(participant.user.name)}</p>
                </div>
            </div>
          ))}

        </div>

        {/* Controls Bar */}
        <div className="h-20 bg-surface border-t border-white/5 flex items-center justify-center gap-3 md:gap-6 px-4 shrink-0 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setMicOn(!micOn)}
            className={`p-3 md:p-4 rounded-full transition-all border shrink-0 ${micOn ? 'bg-background hover:bg-primary hover:border-primary border-white/10' : 'bg-red-500 hover:bg-red-600 border-red-500'}`}
          >
            {micOn ? <Mic size={20} className="text-text-main" /> : <MicOff size={20} className="text-white" />}
          </button>
          
          <button 
            onClick={() => setCamOn(!camOn)}
            disabled={isScreenSharing}
            className={`p-3 md:p-4 rounded-full transition-all border shrink-0 ${camOn ? 'bg-background hover:bg-primary hover:border-primary border-white/10' : 'bg-red-500 hover:bg-red-600 border-red-500'} ${isScreenSharing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {camOn ? <VideoIcon size={20} className="text-text-main" /> : <VideoOff size={20} className="text-white" />}
          </button>

          <button 
            onClick={toggleScreenShare}
            className={`p-3 md:p-4 rounded-full transition-all border shrink-0 ${isScreenSharing ? 'bg-blue-600 hover:bg-blue-700 border-blue-600 text-white' : 'bg-background hover:bg-primary hover:border-primary border-white/10 text-text-main'}`}
          >
            {isScreenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
          </button>

          <button 
            onClick={() => setShowInviteModal(true)}
            className="p-3 md:p-4 rounded-full transition-all border shrink-0 bg-background hover:bg-gold hover:border-gold border-white/10 text-text-main hover:text-white group"
          >
             <Users size={20} className="group-hover:scale-110 transition-transform" />
          </button>

          <div className="w-px h-8 bg-white/10 mx-2 shrink-0"></div>

          <button 
            onClick={handleEndCallClick}
            className="p-3 md:p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all px-6 md:px-8 shadow-lg shadow-red-900/20 shrink-0"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      </div>

      {/* Sidebar Tools & Chat */}
      <div className="w-full md:w-96 bg-surface border-t md:border-t-0 md:border-l border-white/5 flex flex-col h-[50vh] md:h-full shrink-0">
        
        {/* TOP HALF: Tools */}
        <div className="flex-1 flex flex-col min-h-0 border-b border-white/10">
          <div className="flex border-b border-white/5 bg-black/20 shrink-0">
            <button 
              onClick={() => setActiveTool('goals')}
              className={`flex-1 py-3 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${activeTool === 'goals' ? 'text-gold border-b-2 border-gold bg-white/5' : 'text-text-muted hover:text-text-main'}`}
            >
              <CheckSquare size={14} /> <span className="hidden sm:inline">Checklist</span>
            </button>
            <button 
              onClick={() => setActiveTool('notes')}
              className={`flex-1 py-3 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${activeTool === 'notes' ? 'text-gold border-b-2 border-gold bg-white/5' : 'text-text-muted hover:text-text-main'}`}
            >
              <FileText size={14} /> <span className="hidden sm:inline">Notes</span>
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto bg-background relative">
            {activeTool === 'goals' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-text-main font-semibold text-sm">Session Goals</h3>
                  <button 
                    onClick={handleAiGoals}
                    disabled={aiSuggesting}
                    className="text-xs text-gold hover:text-gold-hover flex items-center gap-1"
                  >
                    <Sparkles size={12} /> {aiSuggesting ? 'Thinking...' : 'AI Suggest'}
                  </button>
                </div>
                
                <div className="space-y-2">
                  {goals.map(goal => (
                    <div 
                      key={goal.id} 
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${goal.completed ? 'bg-primary/10 border-primary/30 opacity-60' : 'bg-surface border-white/5'}`}
                    >
                      <button 
                        onClick={() => toggleGoal(goal.id)}
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${goal.completed ? 'bg-primary border-primary text-white' : 'border-text-muted hover:border-gold'}`}
                      >
                        {goal.completed && <CheckSquare size={14} />}
                      </button>
                      <span className={`flex-1 text-xs md:text-sm ${goal.completed ? 'line-through text-text-muted' : 'text-text-main'}`}>
                        {goal.text}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 mt-4">
                  <input
                    type="text"
                    value={newGoal}
                    onChange={(e) => setNewGoal(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addGoal()}
                    placeholder="Add a goal..."
                    className="flex-1 bg-surface border border-white/10 rounded-lg px-3 py-2 text-xs md:text-sm text-text-main focus:outline-none focus:border-gold/50"
                  />
                  <button 
                    onClick={addGoal}
                    className="bg-surface border border-white/10 hover:bg-primary hover:border-primary text-white p-2 rounded-lg transition-colors"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            )}
            
            {activeTool === 'notes' && (
              <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-2 duration-200">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="flex-1 bg-transparent text-text-muted resize-none focus:outline-none font-mono text-xs md:text-sm leading-relaxed p-2 h-full"
                  placeholder="Type your shared notes here..."
                />
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM HALF: Chat */}
        <div className="h-[45%] md:h-[50%] flex flex-col bg-background/50 border-t border-white/10 shrink-0">
             <div className="px-4 py-2 border-b border-white/5 flex items-center gap-2 shrink-0 bg-surface/30">
                 <MessageSquare size={14} className="text-text-muted" />
                 <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Session Chat</span>
             </div>

             <div className="flex-1 overflow-y-auto space-y-3 p-4">
                {chatMessages.length === 0 && (
                   <div className="text-center text-text-muted text-xs mt-4 opacity-60">
                      Start the conversation...
                   </div>
                )}
                {chatMessages.map((msg) => {
                  const isMe = msg.senderId === currentUser.id;
                  const isSystem = msg.senderId === 'system';
                  
                  if (isSystem) {
                    return (
                      <div key={msg.id} className="text-center my-2">
                         <span className="text-[10px] bg-white/5 text-text-muted px-2 py-1 rounded-full border border-white/5">
                           {msg.text}
                         </span>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                       <div className={`max-w-[90%] rounded-2xl px-3 py-2 text-xs md:text-sm ${
                         isMe 
                           ? 'bg-primary text-white rounded-tr-sm' 
                           : 'bg-surface border border-white/10 text-text-main rounded-tl-sm'
                       }`}>
                         <p>{msg.text}</p>
                       </div>
                       <div className={`flex items-center gap-1 mt-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          <span className="text-[10px] text-text-muted font-bold opacity-70">
                             {isMe ? 'You' : msg.senderName}
                          </span>
                       </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
             </div>

             <div className="p-3 border-t border-white/5 bg-surface shrink-0">
                <div className="flex gap-2 items-center">
                   <input
                     type="text"
                     value={chatInput}
                     onChange={(e) => setChatInput(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                     placeholder="Type a message..."
                     className="flex-1 bg-background border border-white/10 rounded-xl px-3 py-2 text-xs md:text-sm text-text-main focus:outline-none focus:border-gold/50 transition-all"
                   />
                   <button 
                     onClick={handleSendChatMessage}
                     disabled={!chatInput.trim()}
                     className="bg-primary/10 text-primary hover:bg-primary hover:text-white p-2 rounded-xl transition-colors disabled:opacity-50"
                   >
                     <Send size={16} />
                   </button>
                </div>
             </div>
        </div>
      </div>
    </div>
  );
};

export default VideoRoom;
