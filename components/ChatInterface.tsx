
import React, { useState, useEffect, useRef } from 'react';
import { Send, Video, MoreVertical, Sparkles, Bot, UserPlus, Search, Loader2, ArrowLeft, MapPin, Briefcase, Flag, Tag, Clock } from 'lucide-react';
import { User, Match, Message } from '../types';
import { generateIcebreaker } from '../services/geminiService';
import { supabase } from '../supabaseClient';
import { DEFAULT_PROFILE_IMAGE } from '../constants';

// Supabase sends `timestamp without time zone` as a plain string (UTC).
// We force it to be treated as UTC by appending `Z`, then JS converts to local.
const parseSupabaseTimestamp = (value: string | null | undefined): Date => {
  if (!value) return new Date();
  const iso = typeof value === 'string' && !value.endsWith('Z') ? `${value}Z` : value;
  return new Date(iso);
};

interface ChatInterfaceProps {
  matches: Match[];
  currentUser: User;
  onStartVideoCall: (match: Match) => void;
  onConnectById: (user: User) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ matches, currentUser, onStartVideoCall, onConnectById }) => {
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(matches[0]?.id || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  
  // Connect Modal State
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedMatch = matches.find(m => m.id === selectedMatchId);

  // --- Time Formatting Helper (Local Time) ---
  const formatLocalTime = (dateInput: Date | string) => {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatSidebarDate = (dateInput: Date | string) => {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && 
                    date.getMonth() === now.getMonth() && 
                    date.getFullYear() === now.getFullYear();

    if (isToday) {
       return formatLocalTime(date);
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getDateLabel = (dateInput: Date | string) => {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && 
                    date.getMonth() === now.getMonth() && 
                    date.getFullYear() === now.getFullYear();
    
    // Check for Yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.getDate() === yesterday.getDate() && 
                        date.getMonth() === yesterday.getMonth() && 
                        date.getFullYear() === yesterday.getFullYear();

    if (isToday) return "Today";
    if (isYesterday) return "Yesterday";
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Helper to check if we need a date divider
  const shouldShowDateDivider = (currentMsg: Message, prevMsg: Message | undefined) => {
    if (!prevMsg) return true;
    const currDate = currentMsg.timestamp instanceof Date ? currentMsg.timestamp : new Date(currentMsg.timestamp);
    const prevDate = prevMsg.timestamp instanceof Date ? prevMsg.timestamp : new Date(prevMsg.timestamp);
    return currDate.toDateString() !== prevDate.toDateString();
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedMatchId]);

  // Load Messages & Subscribe to Realtime Updates
  useEffect(() => {
    if (!selectedMatchId) return;
    
    let isMounted = true;

    // 1. Initial Load of History
    const loadMessages = async () => {
      setIsLoadingMessages(true);
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', selectedMatchId)
        .order('created_at', { ascending: true });

      if (!isMounted) return;

      if (error) {
        console.error("Error loading messages:", error);
      } else if (data) {
        const loadedMsgs: Message[] = data.map((msg: any) => ({
           id: msg.id,
           matchId: msg.match_id,
           senderId: msg.sender_id,
           text: msg.text,
           // Explicitly convert to Date object for local time rendering
           timestamp: parseSupabaseTimestamp(msg.created_at || msg.timestamp)
        }));
        setMessages(loadedMsgs);
      }
      setIsLoadingMessages(false);
    };

    loadMessages();

    // 2. Realtime Subscription
    const channel = supabase
      .channel(`match_messages:${selectedMatchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${selectedMatchId}`,
        },
        (payload) => {
          if (!isMounted) return;

          const newRow = payload.new as any;
          const newMsg: Message = {
            id: newRow.id,
            matchId: newRow.match_id,
            senderId: newRow.sender_id,
            text: newRow.text,
            // Explicitly convert to Date object for local time rendering
            timestamp: parseSupabaseTimestamp(newRow.created_at || newRow.timestamp)
          };

          setMessages((prev) => {
            // Deduplication: If we already have this message (e.g. from initial load or optimistic update), don't add it again.
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    // 3. Cleanup
    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [selectedMatchId]);

  const handleSendMessage = async (text: string = inputText) => {
    if (!text.trim() || !selectedMatchId || !currentUser) return;

    // Optimistic Update (Show immediately in UI with local time)
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      matchId: selectedMatchId,
      senderId: currentUser.id,
      text: text,
      timestamp: new Date(), // Local browser time
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setInputText('');

    try {
      // Save to Supabase
      // We do NOT send 'id' or 'created_at' - let the DB generate them.
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          match_id: selectedMatchId,
          sender_id: currentUser.id,
          text: text
        }])
        .select()
        .single();

      if (error) throw error;
      
      // Update state after successful send
      if (data) {
         setMessages(prev => {
             // Check if the Realtime subscription already added the real message while we were waiting
             const alreadyHasRealMsg = prev.some(m => m.id === data.id);

             if (alreadyHasRealMsg) {
                 // If Realtime beat us to it, just remove our optimistic temp message
                 return prev.filter(m => m.id !== optimisticMsg.id);
             } else {
                 // Otherwise, update our optimistic message with the real ID and timestamp from DB
                 return prev.map(m => m.id === optimisticMsg.id ? { 
                     ...m, 
                     id: data.id,
                     // Ensure newly created timestamp is also converted to Date object
                     timestamp: new Date(data.created_at)
                 } : m);
             }
         });
      }

    } catch (err) {
      console.error("Failed to send message:", err);
      // Optionally allow retry or show error state for the temp message
    }
  };

  const handleAiIcebreaker = async () => {
    if (!selectedMatch) return;
    setIsGenerating(true);
    const icebreaker = await generateIcebreaker(currentUser, selectedMatch.user);
    setInputText(icebreaker);
    setIsGenerating(false);
  };

  // Supabase Search (Connect by ID)
  const handleSearchUser = async () => {
    setIsSearching(true);
    setSearchError('');
    setFoundUser(null);

    const term = searchId.trim();
    if (!term) {
        setIsSearching(false);
        return;
    }

    try {
      // Search users table by kova_id
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('kova_id', term)
        .single();

      if (error || !data) {
        setSearchError('User not found.');
      } else {
        if (data.id === currentUser.id) {
           setSearchError('You cannot connect with yourself.');
        } else {
           // Map DB user to App user type
           const appUser: User = {
             id: data.id,
             kovaId: data.kova_id,
             name: data.name,
             email: data.email,
             password: '', 
             role: data.role,
             industry: data.industry,
             bio: data.bio,
             imageUrl: data.image_url || DEFAULT_PROFILE_IMAGE,
             tags: data.tags || [],
             badges: data.badges || [],
             dob: data.dob,
             age: data.age,
             gender: data.gender,
             stage: data.stage,
             location: {
                city: data.city || '',
                state: data.state || '',
             },
             mainGoal: data.main_goal,
             securityQuestion: '',
             securityAnswer: ''
           };
           setFoundUser(appUser);
        }
      }
    } catch (e) {
      setSearchError('Error searching for user.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = () => {
    if (foundUser) {
      onConnectById(foundUser);
      setShowConnectModal(false);
      setSearchId('');
      setFoundUser(null);
    }
  };

  return (
    <div className="flex h-full w-full bg-background overflow-hidden border-t border-white/5 relative">
      
      {/* Connect By ID Modal Overlay */}
      {showConnectModal && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-text-main flex items-center gap-2">
                  <UserPlus size={24} className="text-primary"/> Connect by ID
                </h3>
                <button onClick={() => setShowConnectModal(false)} className="text-text-muted hover:text-white">✕</button>
              </div>
              
              <p className="text-text-muted text-sm mb-4">Enter a unique Kova ID (e.g., KVA-123456) to connect instantly.</p>
              
              <div className="flex gap-2 mb-6">
                <input 
                  type="text" 
                  placeholder="e.g. KVA-8F2X9A"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  className="flex-1 bg-background border border-white/10 rounded-lg px-4 py-2 text-text-main focus:border-gold/50 outline-none"
                />
                <button 
                  onClick={handleSearchUser}
                  disabled={isSearching}
                  className="bg-surface border border-white/10 hover:bg-white/5 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSearching ? <Loader2 size={20} className="animate-spin"/> : <Search size={20} />}
                </button>
              </div>

              {searchError && <p className="text-red-400 text-sm mb-4">{searchError}</p>}

              {foundUser && (
                 <div className="bg-background rounded-xl p-4 mb-6 border border-white/10 flex items-center gap-4">
                    <img 
                      src={foundUser.imageUrl} 
                      alt={foundUser.name} 
                      className="w-12 h-12 rounded-full object-cover" 
                      onError={(e) => { e.currentTarget.src = DEFAULT_PROFILE_IMAGE; }}
                    />
                    <div>
                       <p className="font-bold text-text-main">{foundUser.name}</p>
                       <p className="text-xs text-text-muted">{foundUser.role} • {foundUser.industry}</p>
                    </div>
                 </div>
              )}

              <div className="flex justify-end gap-3">
                 <button onClick={() => setShowConnectModal(false)} className="px-4 py-2 text-text-muted hover:text-white transition-colors">Cancel</button>
                 <button 
                   onClick={handleSendRequest}
                   disabled={!foundUser}
                   className="px-4 py-2 bg-primary text-white rounded-lg font-medium disabled:opacity-50 hover:bg-primary-hover transition-colors"
                 >
                   Send Request
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* --- Column 1: Sidebar List (Left Side) --- */}
      <div className={`w-full md:w-72 lg:w-80 bg-surface border-r border-white/5 flex flex-col shrink-0 ${selectedMatchId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-surface sticky top-0 z-10">
          <h2 className="text-xl font-bold text-text-main">Messages</h2>
          <button 
            onClick={() => setShowConnectModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-background hover:bg-primary/10 hover:text-primary hover:border-primary/20 text-text-muted text-xs font-bold transition-colors rounded-lg border border-white/10"
          >
             <UserPlus size={14} /> Add via Kova ID
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {matches.length === 0 ? (
             <div className="p-8 text-center text-text-muted flex flex-col items-center gap-4">
               <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center border border-white/5">
                 <Bot size={32} className="opacity-20" />
               </div>
               <p>No matches yet. Start swiping or add by ID!</p>
             </div>
          ) : (
            matches.map((match) => (
              <div
                key={match.id}
                onClick={() => setSelectedMatchId(match.id)}
                className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-background/50 transition-colors border-b border-white/5 ${selectedMatchId === match.id ? 'bg-background/80 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}`}
              >
                <div className="relative">
                  <img 
                    src={match.user.imageUrl} 
                    alt={match.user.name} 
                    className="w-12 h-12 rounded-full object-cover border border-white/10" 
                    onError={(e) => { e.currentTarget.src = DEFAULT_PROFILE_IMAGE; }}
                  />
                  {/* Simple Online Indicator (Mock) */}
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-surface"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className={`font-medium truncate ${selectedMatchId === match.id ? 'text-primary' : 'text-text-main'}`}>
                      {match.user.name}
                    </h3>
                    <span className="text-[10px] text-text-muted shrink-0 ml-2">
                      {formatSidebarDate(match.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-text-muted truncate opacity-80">{match.lastMessage || "Chat started"}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* --- Column 2: Main Chat Area (Center) --- */}
      <div className={`flex-1 flex flex-col min-w-0 bg-background relative ${!selectedMatchId ? 'hidden md:flex' : 'flex'}`}>
        {selectedMatch ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-6 bg-surface/50 backdrop-blur-md shrink-0 sticky top-0 z-20">
              <div className="flex items-center gap-3 min-w-0">
                 <button onClick={() => setSelectedMatchId(null)} className="md:hidden text-text-muted hover:text-white mr-2">
                   <ArrowLeft size={20} />
                 </button>
                 <img 
                   src={selectedMatch.user.imageUrl} 
                   alt={selectedMatch.user.name} 
                   className="w-10 h-10 rounded-full object-cover border border-white/10" 
                   onError={(e) => { e.currentTarget.src = DEFAULT_PROFILE_IMAGE; }}
                 />
                 <div className="min-w-0">
                   <h3 className="font-bold text-text-main truncate">{selectedMatch.user.name}</h3>
                   <p className="text-xs text-text-muted truncate flex items-center gap-1.5">
                      <span className="text-green-500">●</span> Online
                      <span className="text-white/20">|</span>
                      <span>{selectedMatch.user.role}</span>
                      <span className="hidden sm:inline">• {selectedMatch.user.stage}</span>
                      <span className="hidden sm:inline">• {selectedMatch.user.industry}</span>
                   </p>
                 </div>
              </div>
              <div className="flex items-center gap-2">
                 <button 
                    onClick={() => onStartVideoCall(selectedMatch)}
                    className="p-2.5 text-text-muted hover:text-gold hover:bg-gold/10 rounded-full transition-colors" 
                    title="Start Co-working Session"
                 >
                   <Video size={20} />
                 </button>
                 <button className="p-2.5 text-text-muted hover:text-white rounded-full hover:bg-white/5">
                   <MoreVertical size={20} />
                 </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
              <div className="w-full space-y-4">
                {isLoadingMessages && (
                  <div className="flex justify-center p-4"><Loader2 className="animate-spin text-gold"/></div>
                )}
                
                {messages.length === 0 && !isLoadingMessages && (
                  <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center text-text-muted opacity-60">
                     <Sparkles className="w-12 h-12 mb-4 text-gold/50" />
                     <p>This is the start of your conversation with {selectedMatch.user.name}.</p>
                     <p className="text-xs mt-2">Say hello or generate an icebreaker!</p>
                  </div>
                )}
                
                {messages.map((msg, idx) => {
                  const isMe = msg.senderId === currentUser.id;
                  const prevMsg = messages[idx - 1];
                  const showDate = shouldShowDateDivider(msg, prevMsg);

                  return (
                    <React.Fragment key={msg.id}>
                      {showDate && (
                        <div className="flex items-center justify-center my-6">
                           <div className="h-px bg-white/5 flex-1 max-w-[100px]"></div>
                           <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider px-4">
                             {getDateLabel(msg.timestamp)}
                           </span>
                           <div className="h-px bg-white/5 flex-1 max-w-[100px]"></div>
                        </div>
                      )}
                      
                      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                        <div className={`max-w-[85%] md:max-w-[70%] lg:max-w-[60%] p-3.5 rounded-2xl shadow-sm ${isMe ? 'bg-primary text-white rounded-tr-sm' : 'bg-surface border border-white/5 text-text-main rounded-tl-sm'}`}>
                          <p className="text-sm md:text-base leading-relaxed">{msg.text}</p>
                          <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <span className={`text-[10px] ${isMe ? 'text-white/60' : 'text-text-muted/60'}`}>
                              {formatLocalTime(msg.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area */}
            <div className="p-4 bg-surface border-t border-white/5 shrink-0">
              <div className="max-w-4xl mx-auto w-full">
                {messages.length < 3 && (
                  <div className="mb-3 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    <button 
                      onClick={handleAiIcebreaker}
                      disabled={isGenerating}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gold/10 to-transparent text-gold text-xs font-medium rounded-full border border-gold/20 hover:border-gold/50 transition-colors whitespace-nowrap"
                    >
                      {isGenerating ? <span className="animate-spin">⏳</span> : <Sparkles size={12} />}
                      Generate Icebreaker
                    </button>
                    <button 
                      onClick={() => setInputText("Hey! Would you be up for a quick co-working session?")}
                      className="px-4 py-2 bg-background text-text-muted text-xs font-medium rounded-full hover:bg-white/5 transition-colors whitespace-nowrap border border-white/10 hover:border-white/20"
                    >
                      Suggest Co-working
                    </button>
                  </div>
                )}
                <div className="flex gap-2 items-end">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Type a message..."
                      className="w-full bg-background text-text-main border border-white/10 rounded-2xl px-5 py-3.5 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all placeholder-gray-600 pr-12"
                    />
                  </div>
                  <button 
                    onClick={() => handleSendMessage()}
                    disabled={!inputText.trim()}
                    className="bg-primary text-white p-3.5 rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Empty State (Desktop) */
          <div className="w-full h-full hidden md:flex flex-col items-center justify-center bg-background p-8 text-center">
             <div className="w-24 h-24 bg-surface rounded-full flex items-center justify-center mb-6 border border-white/5 shadow-xl">
               <Bot size={48} className="text-primary opacity-80" />
             </div>
             <h3 className="text-2xl font-bold text-text-main mb-3">No conversation selected</h3>
             <p className="text-text-muted max-w-sm mx-auto leading-relaxed">
               Choose a match on the left or add a fellow founder via Kova ID to start collaborating.
             </p>
             <button 
               onClick={() => setShowConnectModal(true)}
               className="mt-8 px-6 py-3 bg-surface hover:bg-white/5 border border-white/10 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 text-gold"
             >
                <UserPlus size={16} /> Connect New User
             </button>
          </div>
        )}
      </div>

      {/* --- Column 3: Profile Context Panel (Desktop Only) --- */}
      {selectedMatch && (
        <div className="hidden lg:flex w-80 bg-surface/50 border-l border-white/5 flex-col shrink-0 overflow-y-auto">
           <div className="p-8 flex flex-col items-center text-center border-b border-white/5">
              <img 
                src={selectedMatch.user.imageUrl} 
                alt={selectedMatch.user.name} 
                className="w-24 h-24 rounded-full object-cover border-4 border-surface shadow-xl mb-4" 
                onError={(e) => { e.currentTarget.src = DEFAULT_PROFILE_IMAGE; }}
              />
              <h2 className="text-xl font-bold text-text-main">{selectedMatch.user.name}</h2>
              <p className="text-sm text-gold font-medium mt-1">{selectedMatch.user.role}</p>
              
              <div className="flex gap-2 mt-4">
                 <span className="px-3 py-1 bg-background rounded-full text-xs font-bold text-text-muted border border-white/5 uppercase tracking-wide">
                   {selectedMatch.user.stage}
                 </span>
                 <span className="px-3 py-1 bg-background rounded-full text-xs font-bold text-text-muted border border-white/5 uppercase tracking-wide">
                   {selectedMatch.user.industry}
                 </span>
              </div>
           </div>

           <div className="p-6 space-y-8">
              {/* About Section */}
              <div>
                 <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">About</h4>
                 <p className="text-sm text-text-main leading-relaxed opacity-90">
                    {selectedMatch.user.bio || "No bio available."}
                 </p>
              </div>

              {/* Location */}
              {selectedMatch.user.location && (selectedMatch.user.location.city || selectedMatch.user.location.state) && (
                <div>
                   <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Location</h4>
                   <div className="flex items-center gap-2 text-sm text-text-main">
                      <MapPin size={16} className="text-secondary" />
                      {selectedMatch.user.location.city}, {selectedMatch.user.location.state}
                   </div>
                </div>
              )}

              {/* Main Goal */}
              <div>
                 <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Current Focus</h4>
                 <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 flex items-start gap-3">
                    <Flag size={16} className="text-primary mt-0.5 shrink-0" />
                    <p className="text-sm text-primary font-medium">{selectedMatch.user.mainGoal}</p>
                 </div>
              </div>

              {/* Tags */}
              {selectedMatch.user.tags && selectedMatch.user.tags.length > 0 && (
                <div>
                   <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Interests</h4>
                   <div className="flex flex-wrap gap-2">
                      {selectedMatch.user.tags.map(tag => (
                        <span key={tag} className="text-xs px-2.5 py-1 bg-background border border-white/10 rounded-md text-text-muted flex items-center gap-1">
                           <Tag size={10} /> {tag}
                        </span>
                      ))}
                   </div>
                </div>
              )}
              
              {/* Join Date */}
              <div>
                 <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Member Since</h4>
                 <div className="flex items-center gap-2 text-sm text-text-muted">
                    <Clock size={14} />
                    {new Date(matches.find(m => m.id === selectedMatch.id)?.timestamp || Date.now()).toLocaleDateString([], {month: 'long', year: 'numeric'})}
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;
