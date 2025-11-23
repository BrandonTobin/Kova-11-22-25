
import React, { useState, useEffect, useRef } from 'react';
import { Send, Video, MoreVertical, Sparkles, Bot, UserPlus, Search, Loader2 } from 'lucide-react';
import { User, Match, Message } from '../types';
import { generateIcebreaker } from '../services/geminiService';
import { supabase } from '../supabaseClient';

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
             imageUrl: data.image_url,
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
    <div className="flex h-full w-full bg-background overflow-hidden rounded-lg border border-white/10 relative">
      
      {/* Connect By ID Modal Overlay */}
      {showConnectModal && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
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
                    <img src={foundUser.imageUrl} alt={foundUser.name} className="w-12 h-12 rounded-full object-cover" />
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

      {/* Sidebar List */}
      <div className={`w-full md:w-80 bg-surface border-r border-background flex flex-col ${selectedMatchId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-background flex justify-between items-center">
          <h2 className="text-xl font-bold text-text-main">Messages</h2>
          <button 
            onClick={() => setShowConnectModal(true)}
            className="p-2 bg-background hover:bg-white/5 text-secondary rounded-full transition-colors border border-white/5" 
            title="Add by ID"
          >
             <UserPlus size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {matches.length === 0 ? (
             <div className="p-8 text-center text-text-muted">No matches yet. Start swiping or add by ID!</div>
          ) : (
            matches.map((match) => (
              <div
                key={match.id}
                onClick={() => setSelectedMatchId(match.id)}
                className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-background/50 transition-colors ${selectedMatchId === match.id ? 'bg-background/80 border-l-4 border-primary' : 'border-l-4 border-transparent'}`}
              >
                <div className="relative">
                  <img src={match.user.imageUrl} alt={match.user.name} className="w-12 h-12 rounded-full object-cover border border-white/10" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-medium text-text-main truncate">{match.user.name}</h3>
                    {/* Render local time for sidebar */}
                    <span className="text-xs text-text-muted">
                      {formatSidebarDate(match.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-text-muted truncate">{match.lastMessage || "Chat started"}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      {selectedMatch ? (
        <div className={`flex-1 flex flex-col bg-background/50 ${!selectedMatchId ? 'hidden md:flex' : 'flex'}`}>
          {/* Header */}
          <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-surface">
            <div className="flex items-center gap-3">
               <button onClick={() => setSelectedMatchId(null)} className="md:hidden text-text-muted hover:text-white mr-2">←</button>
               <img src={selectedMatch.user.imageUrl} alt={selectedMatch.user.name} className="w-10 h-10 rounded-full object-cover border border-white/10" />
               <div>
                 <h3 className="font-bold text-text-main">{selectedMatch.user.name}</h3>
                 <p className="text-xs text-secondary flex items-center gap-1">● Online</p>
               </div>
            </div>
            <div className="flex items-center gap-4">
               <button 
                  onClick={() => onStartVideoCall(selectedMatch)}
                  className="p-2 text-gold hover:bg-gold/10 rounded-full transition-colors" 
                  title="Start Co-working Session"
               >
                 <Video size={24} />
               </button>
               <button className="p-2 text-text-muted hover:text-white rounded-full">
                 <MoreVertical size={20} />
               </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {isLoadingMessages && (
               <div className="flex justify-center p-4"><Loader2 className="animate-spin text-gold"/></div>
            )}
            
            {messages.length === 0 && !isLoadingMessages && (
              <div className="text-center text-text-muted mt-8">
                 <p>No messages yet. Start the conversation!</p>
              </div>
            )}
            
            {messages.map((msg) => {
               const isMe = msg.senderId === currentUser.id;
               return (
                 <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                   <div className={`max-w-[70%] p-3 rounded-2xl border ${isMe ? 'bg-primary border-primary text-white rounded-tr-sm' : 'bg-surface border-white/5 text-text-main rounded-tl-sm'}`}>
                     <p className="text-sm md:text-base">{msg.text}</p>
                     <span className={`text-[10px] block mt-1 opacity-70 ${isMe ? 'text-white/70' : 'text-text-muted'}`}>
                       {/* Use formatLocalTime to ensure correct timezone display */}
                       {formatLocalTime(msg.timestamp)}
                     </span>
                   </div>
                 </div>
               );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-surface border-t border-white/5">
            {messages.length < 3 && (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                <button 
                  onClick={handleAiIcebreaker}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-gold text-xs rounded-full border border-gold/20 hover:bg-primary/20 transition-colors whitespace-nowrap"
                >
                   {isGenerating ? <span className="animate-spin">⏳</span> : <Sparkles size={12} />}
                   Generate Icebreaker
                </button>
                <button 
                  onClick={() => setInputText("Hey! Would you be up for a quick co-working session?")}
                  className="px-3 py-1.5 bg-background text-text-muted text-xs rounded-full hover:bg-white/5 transition-colors whitespace-nowrap border border-white/5"
                >
                   Suggest Co-working
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 bg-background text-text-main border border-white/10 rounded-full px-4 py-2 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all placeholder-gray-600"
              />
              <button 
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim()}
                className="bg-primary text-text-main p-2.5 rounded-full hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-background/50 text-text-muted">
           <Bot size={64} className="mb-4 opacity-20 text-primary" />
           <p>Select a match or connect via ID to chat</p>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;
