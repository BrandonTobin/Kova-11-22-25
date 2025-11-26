import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Match, User } from '../types';
import {
  Video,
  PhoneOff,
  Send,
  Search,
  UserPlus,
  Trash2,
  Loader2,
  Circle,
} from 'lucide-react';

interface ChatInterfaceProps {
  matches: Match[];
  currentUser: User;
  onStartVideoCall: (match: Match) => void;
  onConnectById: (targetUser: User) => void;
  onUnmatch: (matchId: string) => void;

  // NEW: for "NEW MATCH!" indicator
  newMatchIds: string[];
  onMatchSeen: (matchId: string) => void;
}

interface ChatMessage {
  id: string;
  match_id: string;
  sender_id: string;
  text: string;
  created_at: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  matches,
  currentUser,
  onStartVideoCall,
  onConnectById,
  onUnmatch,
  newMatchIds,
  onMatchSeen,
}) => {
  // --- Local state ---
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [connectKovaId, setConnectKovaId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  // --- Sort matches: most recent message or match time first ---
  const sortedMatches = useMemo(() => {
    const copy = [...matches];
    copy.sort((a, b) => {
      const aTime = a.lastMessageAt
        ? new Date(a.lastMessageAt).getTime()
        : a.timestamp.getTime();
      const bTime = b.lastMessageAt
        ? new Date(b.lastMessageAt).getTime()
        : b.timestamp.getTime();
      return bTime - aTime;
    });
    return copy;
  }, [matches]);

  // --- Selected match object ---
  const selectedMatch = useMemo(() => {
    if (!sortedMatches.length) return null;
    const found = sortedMatches.find((m) => m.id === selectedMatchId);
    return found || sortedMatches[0];
  }, [sortedMatches, selectedMatchId]);

  // Ensure we always have a selected match when list changes
  useEffect(() => {
    if (!sortedMatches.length) {
      setSelectedMatchId(null);
      setMessages([]);
      return;
    }
    if (!selectedMatchId || !sortedMatches.find((m) => m.id === selectedMatchId)) {
      setSelectedMatchId(sortedMatches[0].id);
    }
  }, [sortedMatches, selectedMatchId]);

  // When we open a chat that is marked as NEW, tell parent we saw it
  useEffect(() => {
    if (selectedMatch && newMatchIds.includes(selectedMatch.id)) {
      onMatchSeen(selectedMatch.id);
    }
  }, [selectedMatch?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Fetch messages for selected match ---
  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedMatch) {
        setMessages([]);
        return;
      }
      setIsLoadingMessages(true);
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('match_id', selectedMatch.id)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setMessages((data || []) as ChatMessage[]);
      } catch (err) {
        console.error('Error loading messages:', err);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    loadMessages();
  }, [selectedMatch?.id]);

  // --- Supabase realtime subscription for new messages ---
  useEffect(() => {
    if (!selectedMatch) return;

    const channel = supabase
      .channel(`messages:match:${selectedMatch.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${selectedMatch.id}`,
        },
        (payload: any) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedMatch?.id]);

  const handleSendMessage = async () => {
    if (!selectedMatch || !messageText.trim()) return;

    const text = messageText.trim();
    setMessageText('');

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([
          {
            match_id: selectedMatch.id,
            sender_id: currentUser.id,
            text,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setMessages((prev) => [...prev, data as ChatMessage]);
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // --- Presence helper ---
  const getPresence = (otherUser: User) => {
    if (!otherUser.lastSeenAt) {
      return { label: 'Offline', color: 'text-text-muted', dot: 'bg-gray-500' };
    }

    const last = new Date(otherUser.lastSeenAt).getTime();
    const now = Date.now();
    const diff = now - last;

    if (diff < 60_000) {
      return { label: 'Online', color: 'text-emerald-400', dot: 'bg-emerald-400' };
    }
    if (diff < 5 * 60_000) {
      return { label: 'Away', color: 'text-amber-400', dot: 'bg-amber-400' };
    }
    return { label: 'Offline', color: 'text-text-muted', dot: 'bg-gray-500' };
  };

  const formatTime = (ts: string | Date) => {
    const d = typeof ts === 'string' ? new Date(ts) : ts;
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const formatDateHeader = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // --- Filtered matches (search on name or last message) ---
  const filteredMatches = useMemo(() => {
    const q = searchTerm.toLowerCase();
    if (!q) return sortedMatches;
    return sortedMatches.filter((m) => {
      const name = m.user.name?.toLowerCase() || '';
      const last = m.lastMessageText?.toLowerCase() || '';
      return name.includes(q) || last.includes(q);
    });
  }, [searchTerm, sortedMatches]);

  // --- Connect by Kova ID ---
  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = connectKovaId.trim();
    if (!trimmed) return;

    setIsConnecting(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('kova_id', trimmed)
        .single();

      if (error) {
        console.error('Error finding user by Kova ID:', error);
        alert('No user found with that Kova ID.');
      } else if (data) {
        const mappedUser: User = {
          ...data,
          imageUrl: data.image_url,
          kovaId: data.kova_id,
          mainGoal: data.main_goal,
          location: { city: data.city, state: data.state },
          subscriptionTier: data.subscription_tier || 'free',
          proExpiresAt: data.pro_expires_at,
          experienceLevel: data.experience_level,
          communicationStyle: data.communication_style,
          skills: data.skills,
          lookingFor: data.looking_for,
          availability: data.availability,
          goalsList: data.goals_list,
          links: data.links,
          lastSeenAt: data.last_seen_at,
          securityQuestion: '',
          securityAnswer: '',
        };
        onConnectById(mappedUser);
        setConnectKovaId('');
      }
    } catch (err) {
      console.error('Error connecting by ID:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  // Group messages by date for nicer headers
  const groupedMessages = useMemo(() => {
    const groups: { date: string; items: ChatMessage[] }[] = [];
    let currentDate = '';

    for (const msg of messages) {
      const d = msg.created_at.split('T')[0];
      if (d !== currentDate) {
        currentDate = d;
        groups.push({ date: d, items: [msg] });
      } else {
        groups[groups.length - 1].items.push(msg);
      }
    }
    return groups;
  }, [messages]);

  return (
    <div className="h-full w-full flex bg-background text-text-main">
      {/* LEFT SIDE: Match list + search + connect-by-ID */}
      <div className="w-full md:w-80 lg:w-96 flex flex-col border-r border-white/5 bg-surface/40">
        {/* Header */}
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold tracking-tight">Matches</h2>
          </div>

          {/* Search matches */}
          <div className="mb-3">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="text"
                placeholder="Search matches..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-text-main focus:outline-none focus:border-gold/50"
              />
            </div>
          </div>

          {/* Connect by Kova ID */}
          <form onSubmit={handleConnectSubmit} className="flex gap-2 items-center">
            <div className="relative flex-1">
              <UserPlus
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="text"
                placeholder="Connect by Kova ID..."
                value={connectKovaId}
                onChange={(e) => setConnectKovaId(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-text-main focus:outline-none focus:border-gold/50"
              />
            </div>
            <button
              type="submit"
              disabled={isConnecting || !connectKovaId.trim()}
              className="px-3 py-2 rounded-lg text-[11px] bg-primary/80 text-white font-semibold hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? <Loader2 size={14} className="animate-spin" /> : 'ADD'}
            </button>
          </form>
        </div>

        {/* Match list */}
        <div className="flex-1 overflow-y-auto">
          {filteredMatches.length === 0 ? (
            <div className="p-6 text-center text-xs text-text-muted">
              No matches yet. Start swiping on Discover.
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredMatches.map((match) => {
                const isActive = selectedMatch?.id === match.id;
                const presence = getPresence(match.user);
                const hasNewTag = newMatchIds.includes(match.id);

                return (
                  <button
                    key={match.id}
                    onClick={() => setSelectedMatchId(match.id)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition-colors ${
                      isActive ? 'bg-white/5 border-l-2 border-gold' : 'border-l-2 border-transparent'
                    }`}
                  >
                    <div className="relative mt-0.5">
                      <div className="h-10 w-10 rounded-full overflow-hidden bg-gradient-to-br from-primary to-gold flex items-center justify-center text-sm font-semibold text-white">
                        {match.user.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={match.user.imageUrl}
                            alt={match.user.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span>{match.user.name?.[0]?.toUpperCase() || '?'}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {match.user.name}
                          </p>
                          {hasNewTag && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gold/15 text-gold font-semibold">
                              NEW
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-text-muted whitespace-nowrap">
                          {match.lastMessageAt
                            ? formatTime(match.lastMessageAt)
                            : formatTime(match.timestamp)}
                        </span>
                      </div>

                      <p className="text-[11px] text-text-muted truncate mt-0.5">
                        {match.lastMessageText || 'Chat started'}
                      </p>

                      <div className="flex items-center gap-1 mt-1">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${presence.dot}`}
                        />
                        <span className={`text-[10px] ${presence.color}`}>
                          {presence.label}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDE: Active chat */}
      <div className="flex-1 flex flex-col bg-background">
        {!selectedMatch ? (
          <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
            No match selected.
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-6 bg-surface/40">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-full overflow-hidden bg-gradient-to-br from-primary to-gold flex items-center justify-center text-sm font-semibold text-white">
                  {selectedMatch.user.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedMatch.user.imageUrl}
                      alt={selectedMatch.user.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{selectedMatch.user.name?.[0]?.toUpperCase() || '?'}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm truncate">
                      {selectedMatch.user.name}
                    </h3>
                    {newMatchIds.includes(selectedMatch.id) && (
                      <span className="px-2 py-0.5 text-[10px] rounded-full bg-gold/20 text-gold font-semibold uppercase tracking-wide">
                        NEW MATCH!
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-text-muted">
                    <Circle
                      size={8}
                      className={getPresence(selectedMatch.user).color
                        .replace('text', 'fill')
                        .replace('-400', '-400')}
                    />
                    <span>{getPresence(selectedMatch.user).label}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onStartVideoCall(selectedMatch)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-primary/90 text-white hover:bg-primary transition-colors"
                >
                  <Video size={14} />
                  Video
                </button>

                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        `Are you sure you want to unmatch with ${selectedMatch.user.name}?`
                      )
                    ) {
                      onUnmatch(selectedMatch.id);
                    }
                  }}
                  className="p-2 rounded-full text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                  title="Unmatch"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
              {isLoadingMessages ? (
                <div className="flex justify-center mt-8">
                  <Loader2 size={20} className="animate-spin text-gold" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-xs text-text-muted mt-8">
                  No messages yet. Say hi and break the ice ✨
                </div>
              ) : (
                groupedMessages.map((group) => (
                  <div key={group.date} className="space-y-2">
                    <div className="flex justify-center my-2">
                      <span className="px-3 py-1 rounded-full text-[10px] bg-surface/60 text-text-muted border border-white/5">
                        {formatDateHeader(group.date)}
                      </span>
                    </div>
                    {group.items.map((msg) => {
                      const isMine = msg.sender_id === currentUser.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${
                            isMine ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-3 py-2 text-xs shadow-sm ${
                              isMine
                                ? 'bg-primary text-white rounded-br-sm'
                                : 'bg-surface text-text-main rounded-bl-sm'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">
                              {msg.text}
                            </p>
                            <p className="mt-1 text-[9px] opacity-70 text-right">
                              {formatTime(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Message input */}
            <div className="border-t border-white/5 px-4 md:px-6 py-3 bg-surface/60">
              <div className="flex items-end gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyPress}
                  className="flex-1 bg-background border border-white/10 rounded-2xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-gold/50"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!messageText.trim()}
                  className="p-2 rounded-full bg-gold text-surface hover:bg-gold-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
