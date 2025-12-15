import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Send,
  Video,
  Phone,
  Bot,
  UserPlus,
  Search,
  Loader2,
  ArrowLeft,
  MapPin,
  Flag,
  Tag,
  Clock,
  UserMinus,
  X,
  Briefcase,
  Globe,
  Target,
  MessageCircle,
  Link as LinkIcon,
  Users,
  Hash,
  Trash2,
  Star,
  Headphones,
  Mic,
  MicOff,
  LogOut,
  Volume2,
  Shield,
  AlertCircle,
  Lock,
  PauseCircle,
  XCircle,
  ShieldCheck
} from 'lucide-react';
import { User, Match, Message, SubscriptionTier, hasPlusAccess, CallType, MatchStatus } from '../types';
import { supabase } from '../supabaseClient';
import { DEFAULT_PROFILE_IMAGE } from '../constants';
import { getDisplayName } from '../utils/nameUtils';
import PartnershipStatusPanel from './PartnershipStatusPanel';
import GhostPreventionModal from './GhostPreventionModal';
import AIRecapPanel from './AIRecapPanel';
import { startSession, endSession } from '../services/sessionService';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useVoiceChannel } from '../hooks/useVoiceChannel';

// Separate sound JUST for incoming chat messages (not the match sound)
const incomingMessageSound = new Audio(
  'https://dbbtpkgiclzrsigdwdig.supabase.co/storage/v1/object/public/assets/chat.mp3'
);
incomingMessageSound.preload = 'auto';
incomingMessageSound.volume = 0.025;

interface ChatInterfaceProps {
  matches: Match[];
  currentUser: User;
  onStartVideoCall: (match: Match, type: CallType) => void;
  onConnectById: (user: User) => void;
  onUnmatch: (matchId: string) => void;
  newMatchIds?: string[];
  onMatchSeen?: (matchId: string) => void;
  onUpgrade: (tier: SubscriptionTier) => void;
}

// Treat Supabase `timestamp without time zone` as UTC, then let browser show local time.
const parseSupabaseTimestamp = (
  value: string | Date | null | undefined
): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;

  const hasZone = /[zZ]|[+\-]\d{2}:\d{2}$/.test(value);
  const iso = hasZone ? value : `${value}Z`;
  return new Date(iso);
};

// --- WebRTC Config for Voice ---
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

type MessageReactionsState = Record<
  string,
  {
    [emoji: string]: {
      count: number;
      reactedByCurrentUser: boolean;
    };
  }
>;

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  matches,
  currentUser,
  onStartVideoCall,
  onConnectById,
  onUnmatch,
  newMatchIds = [],
  onMatchSeen,
  onUpgrade,
}) => {
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(
    matches[0]?.id || null
  );
  const selectedMatchIdRef = useRef(selectedMatchId);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Live updates for previews/sorting
  const [liveMessageUpdates, setLiveMessageUpdates] = useState<
    Record<string, { text: string; timestamp: Date }>
  >({});

  const [unreadConversationIds, setUnreadConversationIds] =
    useState<Set<string>>(new Set());

  const [clearedChats, setClearedChats] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const [showConnectModal, setShowConnectModal] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [connectionsModalOpen, setConnectionsModalOpen] = useState(false);
  const [connectionsList, setConnectionsList] = useState<User[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(false);

  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement | null>(null);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [otherUserLastReadAt, setOtherUserLastReadAt] = useState<Date | null>(
    null
  );
  const [lastReadAt, setLastReadAt] = useState<Date | null>(null);

  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const typingTimeoutRef = useRef<number | null>(null);
  const otherTypingTimeoutRef = useRef<number | null>(null);

  const [messageReactions, setMessageReactions] =
    useState<MessageReactionsState>({});
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<
    string | null
  >(null);
  const longPressTimeoutRef = useRef<number | null>(null);

  const [activeVoiceMatchIds, setActiveVoiceMatchIds] = useState<Set<string>>(new Set());
  const matchIdsRef = useRef<string[]>([]);

  // Update ref when matches change
  useEffect(() => {
    matchIdsRef.current = matches.map(m => m.id);
  }, [matches]);

  // Initial fetch of active voice sessions
  useEffect(() => {
    if (!currentUser || matches.length === 0) return;

    let isMounted = true;
    const fetchVoiceActivity = async () => {
      const ids = matches.map(m => m.id);
      const { data, error } = await supabase
        .from('voice_sessions')
        .select('match_id')
        .in('match_id', ids)
        .eq('is_active', true);

      if (isMounted && !error && data) {
        const activeSet = new Set<string>(data.map((item: any) => item.match_id as string));
        setActiveVoiceMatchIds(activeSet);
      }
    };

    fetchVoiceActivity();

    return () => {
      isMounted = false;
    };
  }, [matches, currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel(`voice_sessions:global:${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'voice_sessions',
        },
        async (payload: any) => {
          const matchId = payload.new?.match_id || payload.old?.match_id;
          if (!matchId || !matchIdsRef.current.includes(matchId)) return;

          const { data: sessions } = await supabase
            .from('voice_sessions')
            .select('match_id')
            .eq('match_id', matchId)
            .eq('is_active', true);

          setActiveVoiceMatchIds(prev => {
            const next = new Set<string>(prev);
            if (sessions && sessions.length > 0) {
              next.add(matchId as string);
            } else {
              next.delete(matchId as string);
            }
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser.id]);

  const { 
    voiceParticipants, 
    isInVoice, 
    joinVoice, 
    leaveVoice 
  } = useVoiceChannel(selectedMatchId, currentUser.id);

  const [voiceMicOn, setVoiceMicOn] = useState(true);
  const activeVoiceChannelRef = useRef<RealtimeChannel | null>(null);
  const activeVoiceConnectionRef = useRef<RTCPeerConnection | null>(null);
  const voiceLocalStream = useRef<MediaStream | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceSessionId = useRef<string | null>(null);

  const EMOJIS: string[] = ['😀', '😁', '😂', '🤣', '😊', '😍', '🤝', '🔥', '👏', '💡', '📈', '🎯', '🚀', '❤️', '🤝🏻', '💻', '📅', '🤔', '😅', '😎', '🤝🏽', '📊', '📉', '✅'];
  const REACTION_EMOJIS: string[] = ['👍', '🔥', '💡', '✅', '😂'];

  const handleEmojiClick = (emoji: string) => {
    setInputText((prev) => {
      const next = (prev || '') + emoji;
      requestAnimationFrame(() => {
        if (messageInputRef.current) {
          const input = messageInputRef.current;
          const len = next.length;
          input.focus();
          input.setSelectionRange(len, len);
        }
      });
      return next;
    });
    setShowEmojiPicker(false);
  };

  useEffect(() => {
    return () => {
      if (longPressTimeoutRef.current) {
        window.clearTimeout(longPressTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    selectedMatchIdRef.current = selectedMatchId;
    if (selectedMatchId) {
      setUnreadConversationIds((prev) => {
        if (prev.has(selectedMatchId)) {
          const next = new Set(prev);
          next.delete(selectedMatchId);
          return next;
        }
        return prev;
      });
    }
  }, [selectedMatchId]);

  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel(`chat_list_global:${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as any;
          const msgMatchId = newMsg.match_id;
          const msgSenderId = newMsg.sender_id;
          const msgText = newMsg.text;
          const msgCreatedAt = newMsg.created_at;

          setLiveMessageUpdates((prev) => ({
            ...prev,
            [msgMatchId]: {
              text: msgText,
              timestamp: parseSupabaseTimestamp(msgCreatedAt),
            },
          }));

          if (msgSenderId !== currentUser.id) {
            if (selectedMatchIdRef.current !== msgMatchId) {
              setUnreadConversationIds((prev) => {
                const next = new Set(prev);
                next.add(msgMatchId);
                return next;
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser.id]);

  const mergedMatches = useMemo(() => {
    return matches.map((m) => {
      const update = liveMessageUpdates[m.id];
      if (clearedChats[m.id]) {
        return {
          ...m,
          lastMessageText: null,
          lastMessageAt: null,
        };
      }
      if (update) {
        return {
          ...m,
          lastMessageText: update.text,
          lastMessageAt: update.timestamp.toISOString(),
        };
      }
      return m;
    });
  }, [matches, liveMessageUpdates, clearedChats]);

  const sortedMatches = useMemo(() => {
    return [...mergedMatches].sort((a, b) => {
      const aInVoice = activeVoiceMatchIds.has(a.id);
      const bInVoice = activeVoiceMatchIds.has(b.id);
      if (aInVoice !== bInVoice) {
        return bInVoice ? 1 : -1;
      }
      const timeA = a.lastMessageAt
        ? parseSupabaseTimestamp(a.lastMessageAt).getTime()
        : a.timestamp
        ? parseSupabaseTimestamp(a.timestamp as any).getTime()
        : 0;
      const timeB = b.lastMessageAt
        ? parseSupabaseTimestamp(b.lastMessageAt).getTime()
        : b.timestamp
        ? parseSupabaseTimestamp(b.timestamp as any).getTime()
        : 0;
      return timeB - timeA;
    });
  }, [mergedMatches, activeVoiceMatchIds]);

  const filteredMatches = useMemo(
    () =>
      sortedMatches.filter((match) => {
        if (clearedChats[match.id]) return false;
        const rawName = match.user.name || '';
        const displayName = getDisplayName(rawName);
        return displayName.toLowerCase().includes(searchTerm.toLowerCase());
      }),
    [sortedMatches, clearedChats, searchTerm]
  );

  useEffect(() => {
    if (!selectedMatchId && filteredMatches.length > 0) {
      setSelectedMatchId(filteredMatches[0].id);
    }
  }, [filteredMatches, selectedMatchId]);

  const selectedMatch =
    sortedMatches.find((m) => m.id === selectedMatchId) ||
    matches.find((m) => m.id === selectedMatchId);

  const getPresenceStatus = (lastSeenAt?: string | null) => {
    if (!lastSeenAt) return 'offline';
    const last = parseSupabaseTimestamp(lastSeenAt).getTime();
    const now = Date.now();
    const diffMinutes = (now - last) / 1000 / 60;
    if (diffMinutes < 2) return 'online';
    if (diffMinutes < 15) return 'away';
    return 'offline';
  };

  const formatLocalTime = (dateInput: Date | string) => {
    const date = parseSupabaseTimestamp(dateInput);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatSidebarDate = (dateInput: Date | string) => {
    const date = parseSupabaseTimestamp(dateInput);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();
    if (isToday) return formatLocalTime(date);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getDateLabel = (dateInput: Date | string) => {
    const date = parseSupabaseTimestamp(dateInput);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();
    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';
    return date.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const shouldShowDateDivider = (
    currentMsg: Message,
    prevMsg: Message | undefined
  ) => {
    if (!prevMsg) return true;
    const currDate = parseSupabaseTimestamp(currentMsg.timestamp as any);
    const prevDate = parseSupabaseTimestamp(prevMsg.timestamp as any);
    return currDate.toDateString() !== prevDate.toDateString();
  };

  const lastSeenMessageId = useMemo(() => {
    if (!otherUserLastReadAt) return null;
    const cutoff = otherUserLastReadAt.getTime();
    const sentByMe = messages.filter(
      (m) =>
        m.senderId === currentUser.id &&
        parseSupabaseTimestamp(m.timestamp as any).getTime() <= cutoff
    );
    if (sentByMe.length === 0) return null;
    return sentByMe[sentByMe.length - 1].id;
  }, [messages, otherUserLastReadAt, currentUser.id]);

  const firstUnreadIndex = useMemo(() => {
    if (!lastReadAt || messages.length === 0) return -1;
    const cutoff = lastReadAt.getTime();
    return messages.findIndex(
      (m) => parseSupabaseTimestamp(m.timestamp as any).getTime() > cutoff
    );
  }, [messages, lastReadAt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedMatchId]);

  useEffect(() => {
    if (messageInputRef.current) {
      messageInputRef.current.focus();
    }
  }, [selectedMatchId]);

  useEffect(() => {
    if (selectedMatchId && !matches.find((m) => m.id === selectedMatchId)) {
      setSelectedMatchId(null);
    }
  }, [matches, selectedMatchId]);

  useEffect(() => {
    setShowEmojiPicker(false);
    setActiveReactionMessageId(null);
  }, [selectedMatchId]);

  useEffect(() => {
    if (!selectedMatchId) return;
    let isMounted = true;

    const loadMessages = async () => {
      setIsLoadingMessages(true);
      setLastReadAt(null);

      const { data: hiddenRow, error: hiddenError } = await supabase
        .from('hidden_chats')
        .select('cleared_at')
        .eq('user_id', currentUser.id)
        .eq('match_id', selectedMatchId)
        .maybeSingle();

      let query = supabase
        .from('messages')
        .select('*')
        .eq('match_id', selectedMatchId)
        .order('created_at', { ascending: true });

      if (hiddenRow?.cleared_at) {
        query = query.gt('created_at', hiddenRow.cleared_at as string);
      }

      const { data, error } = await query;

      if (!isMounted) return;

      if (data) {
        const loadedMsgs: Message[] = data.map((msg: any) => ({
          id: msg.id,
          matchId: msg.match_id,
          senderId: msg.sender_id,
          text: msg.text,
          timestamp: parseSupabaseTimestamp(msg.created_at || msg.timestamp),
        }));
        setMessages(loadedMsgs);
      }

      try {
        const { data: readRow, error: readError } = await supabase
          .from('message_reads')
          .select('last_read_at')
          .eq('match_id', selectedMatchId)
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (!readError && readRow?.last_read_at) {
          setLastReadAt(parseSupabaseTimestamp(readRow.last_read_at as any));
        } else {
          setLastReadAt(null);
        }
      } catch (err) {
        setLastReadAt(null);
      }

      setIsLoadingMessages(false);
    };

    loadMessages();

    const messageChannel = supabase
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
          const timestamp = parseSupabaseTimestamp(
            newRow.created_at || newRow.timestamp
          );

          if (newRow.sender_id !== currentUser.id) {
            try {
              incomingMessageSound.currentTime = 0;
              incomingMessageSound.play().catch(() => {});
            } catch (e) {}
          }

          const newMsg: Message = {
            id: newRow.id,
            matchId: newRow.match_id,
            senderId: newRow.sender_id,
            text: newRow.text,
            timestamp,
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          setLiveMessageUpdates((prev) => ({
            ...prev,
            [newRow.match_id]: {
              text: newRow.text,
              timestamp,
            },
          }));
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(messageChannel);
    };
  }, [selectedMatchId, currentUser.id]);

  const handleSendMessage = async (text: string = inputText) => {
    if (!text.trim() || !selectedMatchId || !currentUser) return;
    const trimmedText = text.trim();
    const now = new Date();
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      matchId: selectedMatchId,
      senderId: currentUser.id,
      text: trimmedText,
      timestamp: now,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText('');
    setLiveMessageUpdates((prev) => ({
      ...prev,
      [selectedMatchId]: {
        text: trimmedText,
        timestamp: now,
      },
    }));
    sendTypingStatus(false);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([
          {
            match_id: selectedMatchId,
            sender_id: currentUser.id,
            text: trimmedText,
          },
        ])
        .select('*')
        .single();

      if (error || !data) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        alert('Message failed to send.');
        return;
      }

      const realTimestamp = parseSupabaseTimestamp(data.created_at || data.timestamp);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, id: data.id, timestamp: realTimestamp } : m
        )
      );
      setLiveMessageUpdates((prev) => ({
        ...prev,
        [selectedMatchId]: {
          text: trimmedText,
          timestamp: realTimestamp,
        },
      }));
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      alert('Message failed to send.');
    }
  };

  const handleSearchUser = async () => {
    if (!searchId.trim()) return;
    setIsSearching(true);
    setSearchError('');
    setFoundUser(null);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('kova_id', searchId.trim())
        .single();
      if (error || !data) {
        setSearchError('User not found.');
      } else if (data.id === currentUser.id) {
        setSearchError("You cannot connect with yourself.");
      } else {
         const isAlreadyMatched = matches.some(m => m.user.id === data.id);
         if (isAlreadyMatched) {
             setSearchError("You are already matched with this user.");
         } else {
             const mappedUser: User = {
                ...data,
                imageUrl: data.image_url || DEFAULT_PROFILE_IMAGE,
                kovaId: data.kova_id,
                location: { city: data.city || '', state: data.state || '' },
                mainGoal: data.main_goal,
                subscriptionTier: 'free',
                proExpiresAt: null,
                securityQuestion: '',
                securityAnswer: ''
             };
            setFoundUser(mappedUser);
         }
      }
    } catch (err) {
      setSearchError('Search failed.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = () => {
    if (foundUser) {
      onConnectById(foundUser);
      setShowConnectModal(false);
      setFoundUser(null);
      setSearchId('');
    }
  };

  const handleLeaveClick = () => {
    if (!selectedMatchId) return;
    setShowLeaveModal(true);
  };

  const handleConfirmFreeLeave = () => {
    if (selectedMatchId) {
      onUnmatch(selectedMatchId);
      setShowLeaveModal(false);
      setSelectedMatchId(null);
    }
  };

  const handleManagedAction = async (action: MatchStatus) => {
    if (!selectedMatchId) return;
    
    // Update DB status (including 'ended')
    await handleUpdateStatus(action);

    // If ending respectfully, trigger immediate local cleanup (same as Unmatch)
    if (action === 'ended') {
       onUnmatch(selectedMatchId); 
       // This calls the parent handleUnmatch in App.tsx which 
       // updates the 'matches' state and clears newMatchIds immediately.
       setSelectedMatchId(null);
    }

    setShowLeaveModal(false);
  };

  const handleDeleteChat = async () => {
    if (!selectedMatchId || !currentUser) return;
    if (!window.confirm('Delete this chat history on your side?')) return;

    try {
      const { error } = await supabase
        .from('hidden_chats')
        .upsert(
          {
            user_id: currentUser.id,
            match_id: selectedMatchId,
            cleared_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,match_id' }
        );

      if (error) {
        alert('Failed to delete chat.');
        return;
      }

      setMessages([]);
      setLiveMessageUpdates((prev) => {
        const next = { ...prev };
        delete next[selectedMatchId];
        return next;
      });
      setClearedChats((prev) => ({ ...prev, [selectedMatchId]: true }));
    } catch (err) {
      alert('Failed to delete chat.');
    }
  };

  const handleViewConnections = async (userId: string) => {
    setConnectionsModalOpen(true);
    setIsLoadingConnections(true);
    setConnectionsList([]);

    const { data, error } = await supabase
      .from('matches')
      .select(`user1:user1_id(id, name, image_url, role, industry), user2:user2_id(id, name, image_url, role, industry)`)
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

    if (data) {
      const connectedUsers = data.map((m: any) => {
        const other = m.user1.id === userId ? m.user2 : m.user1;
        return {
          id: other.id,
          name: other.name,
          imageUrl: other.image_url || DEFAULT_PROFILE_IMAGE,
          role: other.role,
          industry: other.industry,
          kovaId: '',
          email: '',
          password: '',
          bio: '',
          tags: [],
          badges: [],
          dob: '',
          age: 0,
          gender: 'Male',
          stage: '',
          location: { city: '', state: '' },
          mainGoal: '',
          securityQuestion: '',
          securityAnswer: '',
          subscriptionTier: 'free',
          proExpiresAt: null,
        } as User;
      });
      setConnectionsList(connectedUsers);
    }
    setIsLoadingConnections(false);
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!selectedMatchId) return;
    const alreadyReacted = messageReactions[messageId]?.[emoji]?.reactedByCurrentUser;
    try {
      if (alreadyReacted) {
        await supabase.from('message_reactions').delete().eq('match_id', selectedMatchId).eq('message_id', messageId).eq('user_id', currentUser.id).eq('emoji', emoji);
      } else {
        await supabase.from('message_reactions').insert([{ match_id: selectedMatchId, message_id: messageId, user_id: currentUser.id, emoji }]);
      }
    } catch (err) { console.error(err); }
    setActiveReactionMessageId(null);
  };

  const sendTypingStatus = async (isTyping: boolean) => {
    if (!selectedMatchId || !currentUser) return;
    await supabase.from('typing_status').upsert({ match_id: selectedMatchId, user_id: currentUser.id, is_typing: isTyping, updated_at: new Date().toISOString() }, { onConflict: 'match_id,user_id' });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputText(value);
    if (!selectedMatchId) return;
    sendTypingStatus(true);
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => sendTypingStatus(false), 3000);
  };

  const joinActiveVoiceConnection = async (matchId: string, targetUser: User) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      voiceLocalStream.current = stream;
      setVoiceMicOn(true);
      const sid = await startSession(currentUser.id, targetUser.id, 'audio');
      voiceSessionId.current = sid;
      initializeVoicePeerConnection(stream, matchId, targetUser.id);
      joinVoice();
    } catch (err) {
      alert("Could not access microphone.");
    }
  };

  const leaveActiveVoiceConnection = async () => {
    if (voiceLocalStream.current) {
      voiceLocalStream.current.getTracks().forEach(t => t.stop());
      voiceLocalStream.current = null;
    }
    if (activeVoiceConnectionRef.current) {
      activeVoiceConnectionRef.current.close();
      activeVoiceConnectionRef.current = null;
    }
    if (voiceSessionId.current) {
      await endSession(voiceSessionId.current);
      voiceSessionId.current = null;
    }
    if (activeVoiceChannelRef.current) {
        await activeVoiceChannelRef.current.send({ type: 'broadcast', event: 'leave', payload: {} });
        await supabase.removeChannel(activeVoiceChannelRef.current);
        activeVoiceChannelRef.current = null;
    }
    leaveVoice();
  };

  const handleVoiceToggle = () => {
    if (!selectedMatchId || !selectedMatch) return;
    if (isInVoice) {
      leaveActiveVoiceConnection();
    } else {
      joinActiveVoiceConnection(selectedMatchId, selectedMatch.user);
    }
  };

  const toggleVoiceMic = () => {
    if (voiceLocalStream.current) {
      const audioTrack = voiceLocalStream.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !voiceMicOn;
        setVoiceMicOn(!voiceMicOn);
      }
    }
  };

  const initializeVoicePeerConnection = (stream: MediaStream, matchId: string, partnerId: string) => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    activeVoiceConnectionRef.current = pc;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    pc.ontrack = (event) => {
      if (voiceAudioRef.current) {
        voiceAudioRef.current.srcObject = event.streams[0];
        voiceAudioRef.current.play().catch(() => {});
      }
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        activeVoiceChannelRef.current?.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { candidate: event.candidate }
        });
      }
    };
    const channel = supabase.channel(`voice-audio:${matchId}`);
    activeVoiceChannelRef.current = channel;
    const isInitiator = currentUser.id < partnerId;
    const iceQueue: RTCIceCandidateInit[] = [];

    channel
      .on('broadcast', { event: 'ice-candidate' }, ({ payload }: any) => {
        const candidate = new RTCIceCandidate(payload.candidate);
        if (pc.remoteDescription) {
          pc.addIceCandidate(candidate).catch(() => {});
        } else {
          iceQueue.push(payload.candidate);
        }
      })
      .on('broadcast', { event: 'offer' }, async ({ payload }: any) => {
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        while(iceQueue.length) await pc.addIceCandidate(new RTCIceCandidate(iceQueue.shift()!));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        channel.send({ type: 'broadcast', event: 'answer', payload: { sdp: answer } });
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }: any) => {
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        while(iceQueue.length) await pc.addIceCandidate(new RTCIceCandidate(iceQueue.shift()!));
      })
      .on('broadcast', { event: 'join' }, () => {
         channel.send({ type: 'broadcast', event: 'ack', payload: {} });
         if (isInitiator) createAndSendOffer(pc, channel);
      })
      .on('broadcast', { event: 'ack' }, () => {
         if (isInitiator) createAndSendOffer(pc, channel);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
           channel.send({ type: 'broadcast', event: 'join', payload: {} });
        }
      });
  };

  const createAndSendOffer = async (pc: RTCPeerConnection, channel: any) => {
    if (pc.signalingState !== 'stable') return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    channel.send({ type: 'broadcast', event: 'offer', payload: { sdp: offer } });
  };

  const handleStartVideo = async (match: Match, type: CallType) => {
     if (isInVoice) await leaveActiveVoiceConnection();
     onStartVideoCall(match, type);
  };

  const handleUpdateStatus = async (newStatus: MatchStatus) => {
    if (!selectedMatchId) return;
    const { error } = await supabase.from('matches').update({ status: newStatus }).eq('id', selectedMatchId);
    if (error) {
      alert(`Could not update status: ${error.message}`);
    }
  };

  const isInputDisabled = useMemo(() => {
    if (!selectedMatch?.status) return false;
    return ['paused', 'inactive', 'ended'].includes(selectedMatch.status);
  }, [selectedMatch?.status]);

  const showGhostModal = useMemo(() => {
    return hasPlusAccess(currentUser) && 
           selectedMatch?.status === 'pending' && 
           selectedMatch?.pendingActionUserId === currentUser.id;
  }, [currentUser, selectedMatch]);

  const ProfileDetailView = ({ match }: { match: Match }) => {
    const user = match.user;
    const TagDisplay = ({ tags, icon: Icon }: any) => (
      <div className="flex flex-wrap gap-2 mb-2">
        {tags && tags.length > 0 ? (
          tags.map((tag: any, idx: any) => (
            <span key={idx} className="bg-background border border-white/10 px-3 py-1 rounded-full text-xs text-text-main flex items-center gap-1">
              {Icon && <Icon size={12} className="text-secondary" />}
              {tag}
            </span>
          ))
        ) : (
          <span className="text-text-muted text-xs italic">None listed</span>
        )}
      </div>
    );

    return (
      <div className="p-4 space-y-4">
        <div className="bg-surface border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center">
          <div className="relative group mb-4">
            <div className={`w-24 h-24 rounded-full border-4 ${user.superLikedMe ? 'border-[#00BFFF]' : 'border-background'} shadow-xl overflow-hidden relative`}>
              <img src={user.imageUrl || DEFAULT_PROFILE_IMAGE} alt="Profile" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = DEFAULT_PROFILE_IMAGE; }} />
            </div>
            {user.superLikedMe && (
              <div className="absolute -top-2 -right-2 bg-[rgba(0,191,255,0.2)] border border-[#00BFFF]/50 p-1.5 rounded-full backdrop-blur-sm">
                <Star size={12} className="text-[#00BFFF] fill-[#00BFFF]" />
              </div>
            )}
          </div>
          <h2 className="text-xl font-bold text-text-main">{getDisplayName(user.name)}</h2>
          <p className="text-sm text-text-muted mb-3">{user.role}</p>
          <div className="flex items-center gap-2 text-xs text-text-muted bg-background/50 px-3 py-1.5 rounded-lg border border-white/5 mb-3">
            <Hash size={12} className="text-gold" />
            <span className="font-mono">{user.kovaId || 'N/A'}</span>
          </div>
          <button onClick={() => handleViewConnections(user.id)} className="flex items-center gap-2 px-4 py-2 bg-surface hover:bg-white/5 border border-white/10 rounded-xl text-xs font-medium transition-colors text-text-muted hover:text-primary group">
            <Users size={14} className="group-hover:text-primary transition-colors" /> View Connections
          </button>
        </div>

        {/* Reliability Score (Plus Only) */}
        {hasPlusAccess(currentUser) && (
          <div className="bg-surface border border-emerald-500/20 rounded-2xl p-4 relative overflow-hidden">
             <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl"></div>
             <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Shield size={12} /> Reliability Score
             </h3>
             <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-text-main">{user.reliabilityScore ?? 'N/A'}</span>
                <span className="text-xs text-text-muted">/ 100</span>
             </div>
             <p className="text-[10px] text-text-muted mt-2 leading-relaxed">
               Based on attendance, responsiveness, and partnership duration.
             </p>
          </div>
        )}

        <div className="bg-surface border border-white/10 rounded-2xl p-4">
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4 pb-2 border-b border-white/5">Professional Info</h3>
          <div className="space-y-4">
            <div><label className="block text-xs font-medium text-text-muted mb-1 flex items-center gap-1.5"><Briefcase size={12} /> Title / Role</label><p className="text-sm text-text-main font-medium">{user.role}</p></div>
            <div><label className="block text-xs font-medium text-text-muted mb-1 flex items-center gap-1.5"><Globe size={12} /> Industry</label><p className="text-sm text-text-main">{user.industry}</p></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-xs font-medium text-text-muted mb-1">Stage</label><span className="inline-block px-2.5 py-0.5 bg-primary/10 text-primary rounded text-xs font-bold border border-primary/20">{user.stage}</span></div>
              <div><label className="block text-xs font-medium text-text-muted mb-1">Experience</label><p className="text-sm text-text-main">{user.experienceLevel || 'N/A'}</p></div>
            </div>
            <div><label className="block text-xs font-medium text-text-muted mb-1 flex items-center gap-1.5"><MapPin size={12} /> Location</label><p className="text-sm text-text-main">{user.location && (user.location.city || user.location.state) ? `${user.location.city}${user.location.city && user.location.state ? ', ' : ''}${user.location.state}` : 'Not specified'}</p></div>
          </div>
        </div>
        <div className="bg-surface border border-white/10 rounded-2xl p-4">
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4 pb-2 border-b border-white/5">About</h3>
          <div className="space-y-4">
            <div><label className="block text-xs font-medium text-text-muted mb-1">Bio</label><p className="text-sm text-text-main leading-relaxed opacity-90">{user.bio || 'No bio available.'}</p></div>
            <div><label className="block text-xs font-medium text-text-muted mb-2 flex items-center gap-1.5"><Target size={12} /> Goals</label><ul className="space-y-1.5">{user.goalsList && user.goalsList.filter(Boolean).length > 0 ? (user.goalsList.filter(Boolean).map((goal, idx) => (<li key={idx} className="flex items-start gap-2 text-sm text-text-main"><span className="text-gold mt-1.5">•</span><span className="flex-1">{goal}</span></li>))) : (<li className="text-text-muted text-xs italic">No goals listed.</li>)}</ul></div>
            <div><label className="block text-xs font-medium text-text-muted mb-1">Communication</label><span className="inline-block px-2.5 py-1 bg-surface border border-white/10 rounded-full text-xs text-text-main">{user.communicationStyle || 'Not specified'}</span></div>
          </div>
        </div>
        <div className="bg-surface border border-white/10 rounded-2xl p-4">
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4 pb-2 border-b border-white/5">Interests & Connect</h3>
          <div className="space-y-4">
            <div><label className="block text-xs font-medium text-text-muted mb-2">Skills / Strengths</label><TagDisplay tags={user.skills || []} /></div>
            <div><label className="block text-xs font-medium text-text-muted mb-2">Interests</label><TagDisplay tags={user.tags || []} /></div>
            <div><label className="block text-xs font-medium text-text-muted mb-2 flex items-center gap-1.5"><Target size={12} /> Looking For</label><TagDisplay tags={user.lookingFor || []} /></div>
            <div><label className="block text-xs font-medium text-text-muted mb-2 flex items-center gap-1.5"><Clock size={12} /> Availability</label><TagDisplay tags={user.availability || []} /></div>
            <div><label className="block text-xs font-medium text-text-muted mb-3 flex items-center gap-1.5"><LinkIcon size={12} /> Links</label><div className="flex flex-wrap gap-2">{user.links?.linkedin && (<a href={user.links.linkedin} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 bg-background border border-white/10 rounded-lg text-xs text-text-main hover:text-primary hover:border-primary/50 transition-colors">LinkedIn</a>)}{user.links?.twitter && (<a href={user.links.twitter} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 bg-background border border-white/10 rounded-lg text-xs text-text-main hover:text-primary hover:border-primary/50 transition-colors">Twitter / X</a>)}{user.links?.website && (<a href={user.links.website} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 bg-background border border-white/10 rounded-lg text-xs text-text-main hover:text-primary hover:border-primary/50 transition-colors">Website</a>)}{user.links?.portfolio && (<a href={user.links.portfolio} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 bg-background border border-white/10 rounded-lg text-xs text-text-main hover:text-primary hover:border-primary/50 transition-colors">Portfolio</a>)}{(!user.links || Object.values(user.links).every((v) => !v)) && (<span className="text-text-muted text-xs italic">No links added.</span>)}</div></div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full w-full bg-background overflow-hidden relative">
      <audio ref={voiceAudioRef} autoPlay style={{display: 'none'}} />

      {/* Leave Partnership Modal */}
      {showLeaveModal && selectedMatch && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-sm rounded-2xl border border-white/10 shadow-2xl p-6 relative overflow-hidden flex flex-col">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
                  {hasPlusAccess(currentUser) ? (
                    <>
                      <ShieldCheck size={20} className="text-emerald-400" /> Manage Partnership
                    </>
                  ) : (
                    <>
                      <AlertCircle size={20} className="text-red-400" /> Leave partnership?
                    </>
                  )}
                </h3>
                <button 
                  onClick={() => setShowLeaveModal(false)}
                  className="text-text-muted hover:text-white"
                >
                  <X size={20} />
                </button>
             </div>

             {hasPlusAccess(currentUser) ? (
                <div className="space-y-3">
                   <p className="text-sm text-text-muted mb-2">
                     As a Plus member, you can pause this partnership to take a break, or end it respectfully without losing history.
                   </p>
                   
                   {selectedMatch.status !== 'paused' && (
                     <button 
                       onClick={() => handleManagedAction('paused')}
                       className="w-full flex items-center gap-3 px-4 py-3 bg-surface border border-white/10 hover:bg-white/5 rounded-xl text-sm font-medium text-text-main transition-colors"
                     >
                       <PauseCircle size={18} className="text-amber-400" />
                       Pause Partnership
                     </button>
                   )}

                   {selectedMatch.status !== 'ended' && (
                     <button 
                       onClick={() => handleManagedAction('ended')}
                       className="w-full flex items-center gap-3 px-4 py-3 bg-surface border border-white/10 hover:border-red-500/30 hover:bg-red-500/5 rounded-xl text-sm font-medium text-text-muted hover:text-red-400 transition-colors"
                     >
                       <XCircle size={18} />
                       End Partnership Respectfully
                     </button>
                   )}

                   <button 
                     onClick={() => setShowLeaveModal(false)}
                     className="w-full py-2.5 text-xs font-bold text-text-muted hover:text-white transition-colors mt-2"
                   >
                     Cancel
                   </button>
                </div>
             ) : (
                <div className="space-y-4">
                   <p className="text-sm text-text-muted leading-relaxed">
                     Leaving will end this partnership immediately with no closure or resolution. Messages will be removed.
                   </p>
                   
                   <button 
                     onClick={() => {
                        setShowLeaveModal(false);
                        onUpgrade('kova_plus');
                     }}
                     className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-700 text-white font-bold rounded-xl shadow-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 text-sm"
                   >
                     <Lock size={14} /> Upgrade to manage
                   </button>

                   <button 
                     onClick={handleConfirmFreeLeave}
                     className="w-full py-3 border border-red-500/30 text-red-400 font-medium rounded-xl hover:bg-red-500/10 transition-colors text-sm"
                   >
                     Leave now
                   </button>
                </div>
             )}
          </div>
        </div>
      )}

      {/* Ghost Prevention Modal */}
      {showGhostModal && (
        <GhostPreventionModal 
          onContinue={() => handleUpdateStatus('active')}
          onPause={() => handleUpdateStatus('paused')}
          onEnd={() => handleUpdateStatus('ended')}
        />
      )}

      {connectionsModalOpen && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-md rounded-2xl border border-white/10 shadow-2xl p-6 max-h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h3 className="text-lg font-bold text-text-main flex items-center gap-2"><Users size={18} className="text-gold" /> Connections</h3>
              <button onClick={() => setConnectionsModalOpen(false)} className="text-text-muted hover:text-white"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {isLoadingConnections ? ( <div className="flex justify-center p-8"><Loader2 className="animate-spin text-gold" /></div> ) : connectionsList.length === 0 ? ( <p className="text-center text-text-muted py-8 text-sm">No connections found.</p> ) : (
                <div className="space-y-2">
                  {connectionsList.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 p-3 bg-background/50 rounded-xl border border-white/5">
                      <img src={u.imageUrl} className="w-10 h-10 rounded-full object-cover border border-white/10" onError={(e) => { e.currentTarget.src = DEFAULT_PROFILE_IMAGE; }} />
                      <div><p className="font-bold text-sm text-text-main">{getDisplayName(u.name)}</p><p className="text-xs text-text-muted">{u.role} • {u.industry}</p></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showConnectModal && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-text-main flex items-center gap-2"><UserPlus size={24} className="text-primary" /> Connect by ID</h3><button onClick={() => setShowConnectModal(false)} className="text-text-muted hover:text-white">✕</button></div>
            <p className="text-text-muted text-sm mb-4">Enter a unique Kova ID (e.g. KVA-123456) to connect instantly.</p>
            <div className="flex gap-2 mb-6"><input type="text" placeholder="e.g. KVA-8F2X9A" value={searchId} onChange={(e) => setSearchId(e.target.value)} className="flex-1 bg-background border border-white/10 rounded-lg px-4 py-2 text-base md:text-sm text-text-main focus:border-gold/50 outline-none" /><button onClick={handleSearchUser} disabled={isSearching} className="bg-surface border border-white/10 hover:bg-white/5 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50">{isSearching ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}</button></div>
            {searchError && <p className="text-red-400 text-sm mb-4">{searchError}</p>}
            {foundUser && (<div className="bg-background rounded-xl p-4 mb-6 border border-white/10 flex items-center gap-4"><img src={foundUser.imageUrl} alt={foundUser.name} className="w-12 h-12 rounded-full object-cover" onError={(e) => { e.currentTarget.src = DEFAULT_PROFILE_IMAGE; }} /><div><p className="font-bold text-text-main">{getDisplayName(foundUser.name)}</p><p className="text-xs text-text-muted">{foundUser.role} • {foundUser.industry}</p></div></div>)}
            <div className="flex justify-end gap-3"><button onClick={() => setShowConnectModal(false)} className="px-4 py-2 text-text-muted hover:text-white transition-colors">Cancel</button><button onClick={handleSendRequest} disabled={!foundUser} className="px-4 py-2 bg-primary text-white rounded-lg font-medium disabled:opacity-50 hover:bg-primary-hover transition-colors">Send Request</button></div>
          </div>
        </div>
      )}

      {showProfileModal && selectedMatch && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-lg rounded-3xl border border-white/10 shadow-2xl h-full md:h-[85vh] flex flex-col relative animate-in fade-in zoom-in duration-200">
            <button onClick={() => setShowProfileModal(false)} className="absolute top-4 right-4 z-10 p-2 bg-black/40 rounded-full text.white hover:bg-black/60 transition-colors"><X size={20} /></button>
            <div className="flex-1 overflow-y-auto custom-scrollbar"><ProfileDetailView match={selectedMatch} /></div>
          </div>
        </div>
      )}

      {/* Left Sidebar */}
      <div className={`flex-col border-r border-white/5 bg-surface/50 shrink-0 md:w-64 lg:w-72 ${selectedMatchId ? 'hidden md:flex' : 'flex w-full'}`}>
        <div className="flex flex-col border-b border-white/5 shrink-0">
          <div className="p-3 pb-2 flex justify-between items-center">
            <h2 className="text-lg font-bold text-text-main">Messages</h2>
            <button onClick={() => setShowConnectModal(true)} className="flex items-center gap-2 px-3 py-1.5 bg-background hover:bg-primary/10 hover:text-primary hover:border-primary/20 text-text-muted text-xs font-bold transition-colors rounded-lg border border-white/10"><UserPlus size={14} /> Add</button>
          </div>
          <div className="px-3 pb-3"><div className="relative"><input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search..." className="w-full bg-background border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-text-main focus:outline-none focus:border-gold/50 transition-colors placeholder-text-muted/70" /><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={14} /></div></div>
        </div>

        {selectedMatchId && voiceParticipants.length > 0 && (
          <div className="px-3 py-2 border-b border-white/5 bg-background/30 animate-in fade-in slide-in-from-top-2">
             <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2"><Volume2 size={12} className="text-green-500" /><span className="text-[10px] font-bold text-text-main uppercase tracking-wide">Voice Channel</span></div>
                {isInVoice ? (<button onClick={handleVoiceToggle} className="text-[9px] text-red-400 hover:text-white transition-colors border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 rounded">Disconnect</button>) : (<button onClick={handleVoiceToggle} className="text-[9px] text-primary hover:text-white transition-colors border border-primary/20 bg-primary/10 px-1.5 py-0.5 rounded">Join</button>)}
             </div>
             <div className="space-y-1 pl-1">
                {voiceParticipants.map(participant => (
                   <div key={participant.user_id} className="flex items-center gap-2 p-1 rounded-lg hover:bg-white/5 transition-colors">
                      <div className="relative"><img src={participant.avatar_url || DEFAULT_PROFILE_IMAGE} className="w-5 h-5 rounded-full object-cover border border-white/10" onError={(e) => { e.currentTarget.src = DEFAULT_PROFILE_IMAGE; }} /><div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 border border-black rounded-full"></div></div>
                      <span className={`text-[10px] ${participant.user_id === currentUser.id ? 'text-primary font-bold' : 'text-text-muted'}`}>{participant.display_name}</span>
                   </div>
                ))}
             </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredMatches.length === 0 ? (
            matches.length === 0 ? (
              <div className="p-8 text-center text-text-muted flex flex-col items-center gap-4"><div className="w-16 h-16 bg-background rounded-full flex items-center justify-center border border-white/5"><Bot size={32} className="opacity-20" /></div><p className="text-xs">No matches yet.</p></div>
            ) : (<p className="text-center text-text-muted p-6 text-xs">No matches found.</p>)
          ) : (
            filteredMatches.map((match) => {
              const previewText = match.lastMessageText || 'Chat started';
              const truncatedPreview = previewText.length > 35 ? previewText.slice(0, 35) + '…' : previewText;
              const timeToDisplay = match.lastMessageAt ? formatSidebarDate(match.lastMessageAt) : formatSidebarDate(match.timestamp as any);
              const status = getPresenceStatus(match.user.lastSeenAt);
              const dotClass = status === 'online' ? 'bg-green-500' : status === 'away' ? 'bg-amber-500' : 'bg-gray-500';
              const isNewMatch = newMatchIds.includes(match.id);
              const hasUnread = unreadConversationIds.has(match.id);
              const showNewBadge = isNewMatch || hasUnread;
              const isVoiceActive = activeVoiceMatchIds.has(match.id);

              return (
                <div key={match.id} onClick={() => { setSelectedMatchId(match.id); if (isNewMatch && onMatchSeen) onMatchSeen(match.id); }} className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-background/50 transition-colors border-b border-white/5 ${selectedMatchId === match.id ? 'bg-background/80 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}`}>
                  <div className="relative"><img src={match.user.imageUrl} alt={match.user.name} className="w-10 h-10 rounded-full object-cover border border-white/10" onError={(e) => { e.currentTarget.src = DEFAULT_PROFILE_IMAGE; }} /><div className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${dotClass} rounded-full border-2 border-surface`} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className={`font-medium text-sm truncate ${selectedMatchId === match.id ? 'text-primary' : 'text-text-main'}`}>{getDisplayName(match.user.name)}</h3>
                        {showNewBadge && (<span className="text-[8px] font-bold text-gold bg-gold/10 border border-gold/30 px-1 py-0.5 rounded-full shrink-0">NEW</span>)}
                        {isVoiceActive && (<span className="flex items-center gap-0.5 text-[8px] font-semibold text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded-full border border-emerald-500/30"><Headphones size={8} className="shrink-0" /><span>In Voice</span></span>)}
                      </div>
                      <div className="flex items-center gap-1">
                        {match.user.superLikedMe && (<span className="text-[#00BFFF] text-[9px]" title="Super Liked You">⭐</span>)}
                        <span className="text-[9px] text-text-muted shrink-0 ml-1">{timeToDisplay}</span>
                      </div>
                    </div>
                    <p className="text-xs text-text-muted truncate opacity-80">{truncatedPreview}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className={`flex-1 flex min-w-0 bg-background relative ${!selectedMatchId ? 'hidden md:flex' : 'flex'}`}>
        {selectedMatch ? (
          <>
            {/* Left-Center Panel (Partnership Status) */}
            <div className="hidden 2xl:flex w-80 flex-col border-r border-white/5 bg-surface/30 backdrop-blur-sm shrink-0 h-full">
               <div className="flex-1 overflow-hidden p-3 h-full">
                  <PartnershipStatusPanel 
                    status={selectedMatch.status || 'active'} 
                    isPlusOrPro={hasPlusAccess(currentUser)} 
                    onUpdateStatus={handleUpdateStatus} 
                    onUpgrade={onUpgrade}
                    lastActivityDate={selectedMatch.lastMessageAt || selectedMatch.timestamp}
                  />
               </div>
            </div>

            {/* Center Chat */}
            <div className="flex-1 flex flex-col min-w-0 bg-background">
              <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 shrink-0 bg-surface/30 backdrop-blur-md z-10">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button onClick={() => setSelectedMatchId(null)} className="md:hidden text-text-muted hover:text-white shrink-0 p-1"><ArrowLeft size={22} /></button>
                  <img src={selectedMatch.user.imageUrl} alt={selectedMatch.user.name} className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0 cursor-pointer" onError={(e) => { e.currentTarget.src = DEFAULT_PROFILE_IMAGE; }} onClick={() => setShowProfileModal(true)} />
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setShowProfileModal(true)}>
                    <h3 className="font-bold text-text-main truncate text-base leading-tight">{getDisplayName(selectedMatch.user.name)}</h3>
                    {selectedMatch.user.superLikedMe && (<p className="text-[#00BFFF] text-[10px] font-semibold mt-0.5 flex items-center gap-1">⭐ Super Liked you</p>)}
                    {!selectedMatch.user.superLikedMe && (<p className="text-xs text-text-muted truncate flex items-center gap-1.5"><span className={getPresenceStatus(selectedMatch.user.lastSeenAt) === 'online' ? 'text-green-500' : 'text-gray-500'}>●</span> {getPresenceStatus(selectedMatch.user.lastSeenAt) === 'online' ? 'Online' : 'Offline'}<span className="text-white/20">|</span><span className="truncate">{selectedMatch.user.role}</span></p>)}
                  </div>
                </div>
                <div className="flex items-center justify-center gap-3 shrink-0">
                  <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1 border border-white/5">
                      {!isInVoice ? (<button onClick={handleVoiceToggle} className="px-3 py-1.5 text-text-muted hover:text-primary hover:bg-white/5 rounded-md transition-colors flex items-center justify-center gap-1.5" title="Join Voice Channel"><Headphones size={16} /><span className="hidden lg:inline text-xs font-medium">Voice</span></button>) : (<div className="flex items-center gap-2 px-3 py-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div><button onClick={toggleVoiceMic} className="text-text-main hover:text-white transition-colors">{voiceMicOn ? <Mic size={14} /> : <MicOff size={14} className="text-red-400" />}</button><button onClick={handleVoiceToggle} className="text-xs font-bold text-red-400 hover:text-red-300 ml-1">Leave</button></div>)}
                      <div className="w-px h-4 bg-white/10"></div>
                      <button onClick={() => handleStartVideo(selectedMatch, 'video')} className="px-3 py-1.5 text-text-muted hover:text-white hover:bg-white/5 rounded-md transition-colors flex items-center justify-center gap-1.5" title="Start Video Call"><Video size={16} /><span className="hidden lg:inline text-xs font-medium">Video</span></button>
                  </div>
                  <div className="flex items-center gap-2">
                      <button onClick={handleDeleteChat} className="p-2 text-text-muted hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center justify-center gap-1.5" title="Delete Chat"><Trash2 size={16} /><span className="hidden xl:inline text-xs font-medium">Delete</span></button>
                      <button onClick={handleLeaveClick} className="p-2 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex items-center justify-center gap-1.5" title="Leave Partnership"><UserMinus size={16} /><span className="hidden xl:inline text-xs font-medium">Leave</span></button>
                  </div>
                </div>
              </div>

              {/* Status Banner */}
              {selectedMatch.status === 'paused' && (
                <div className="bg-amber-500/10 border-b border-amber-500/20 py-2 px-4 flex items-center justify-center gap-2">
                   <AlertCircle size={14} className="text-amber-400" />
                   <span className="text-xs font-medium text-amber-200">Partnership paused. Messaging is disabled.</span>
                </div>
              )}
              {selectedMatch.status === 'inactive' && (
                <div className="bg-white/5 border-b border-white/10 py-2 px-4 flex items-center justify-center gap-2">
                   <Lock size={14} className="text-text-muted" />
                   <span className="text-xs font-medium text-text-muted">This partnership is inactive.</span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-0 scroll-smooth custom-scrollbar">
                <div className="w-full max-w-3xl mx-auto px-6 py-6 space-y-2">
                  {isLoadingMessages && <div className="flex justify-center p-4"><Loader2 className="animate-spin text-gold" /></div>}
                  {messages.length === 0 && !isLoadingMessages && (
                    <div className="flex flex-col items-center justify-center h-[300px] text-center text-text-muted opacity-60">
                      <p className="mb-1">This is the start of your conversation with {getDisplayName(selectedMatch.user.name)}.</p>
                      <p className="text-xs">Say hello to start collaborating!</p>
                    </div>
                  )}
                  {messages.map((msg, idx) => {
                    const isMe = msg.senderId === currentUser.id;
                    const prevMsg = messages[idx - 1];
                    const nextMsg = messages[idx + 1];
                    const isSameSenderNext = nextMsg && nextMsg.senderId === msg.senderId;
                    const showDate = shouldShowDateDivider(msg, prevMsg);
                    const showNewDivider = firstUnreadIndex !== -1 && idx === firstUnreadIndex;
                    const reactionsForMsg = messageReactions[msg.id] || {};

                    return (
                      <React.Fragment key={msg.id}>
                        {showDate && (<div className="w-full flex justify-center my-4 pt-2"><span className="text-[10px] font-bold text-text-muted uppercase tracking-wider bg-surface/50 px-2 py-0.5 rounded-md border border-white/5">{getDateLabel(msg.timestamp as any)}</span></div>)}
                        {showNewDivider && (<div className="w-full flex justify-center my-4"><div className="flex items-center justify-center gap-2 opacity-80"><div className="h-px bg-gold/40 w-16" /><span className="text-[10px] font-bold uppercase tracking-wider text-gold">New messages</span><div className="h-px bg-gold/40 w-16" /></div></div>)}
                        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} group relative ${isSameSenderNext ? 'mb-0.5' : 'mb-4'}`} onContextMenu={(e) => { e.preventDefault(); setActiveReactionMessageId(msg.id); }}>
                          {activeReactionMessageId === msg.id && (<div className={`absolute -top-10 ${isMe ? 'right-0' : 'left-0'} bg-surface border border-white/10 rounded-full px-2 py-1 shadow-xl flex gap-1 z-20`}>{REACTION_EMOJIS.map((emoji) => (<button key={emoji} type="button" onClick={() => handleToggleReaction(msg.id, emoji)} className="text-lg leading-none px-1 hover:scale-125 transition-transform">{emoji}</button>))}</div>)}
                          <div className={`max-w-[85%] md:max-w-[75%] lg:max-w-[65%] px-5 py-3 rounded-2xl shadow-sm text-base leading-relaxed ${isMe ? 'bg-primary text-white rounded-tr-sm' : 'bg-surface border border-white/10 text-text-main rounded-tl-sm'}`}>
                            <p>{msg.text}</p>
                            <div className={`mt-1 flex items-center gap-1.5 ${isMe ? 'justify-end' : 'justify-start'} opacity-60`}><span className="text-[10px]">{formatLocalTime(msg.timestamp as any)}</span>{isMe && msg.id === lastSeenMessageId && (<span className="text-[10px] font-bold text-emerald-300">Read</span>)}</div>
                            {Object.keys(reactionsForMsg).length > 0 && (<div className={`flex items-center gap-1 flex-wrap mt-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}>{Object.entries(reactionsForMsg).map(([emoji, info]) => (<button key={emoji} type="button" onClick={() => handleToggleReaction(msg.id, emoji)} className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors ${info.reactedByCurrentUser ? 'bg-gold/20 border-gold/60 text-gold' : 'bg-black/20 border-white/10 text-white/80'}`}><span>{emoji}</span><span>{info.count}</span></button>))}</div>)}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                  {isOtherTyping && (<div className="flex justify-start mb-4"><div className="bg-surface border border-white/10 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1"><div className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce delay-100"></div><div className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce delay-200"></div></div></div>)}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input Area */}
              {selectedMatch.status !== 'ended' && (
                <div className={`p-4 border-t border-white/5 bg-surface/30 backdrop-blur-md shrink-0 transition-opacity ${isInputDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="w-full max-w-3xl mx-auto">
                      <div className="flex gap-3 items-end">
                          <div className="flex-1 relative bg-background border border-white/10 rounded-2xl focus-within:border-gold/50 focus-within:ring-1 focus-within:ring-gold/50 transition-all shadow-inner">
                              <button type="button" onClick={() => setShowEmojiPicker((prev) => !prev)} className="absolute left-3 top-1/2 -translate-y-1/2 text-xl hover:scale-110 transition-transform p-1">🙂</button>
                              <input ref={messageInputRef} type="text" value={inputText} onChange={handleInputChange} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder={isInputDisabled ? "Messaging unavailable" : "Type a message..."} disabled={isInputDisabled} className="w-full bg-transparent text-text-main rounded-2xl pl-12 pr-4 py-3.5 focus:outline-none placeholder-gray-500/50 text-base" />
                              {showEmojiPicker && (<div className="absolute bottom-14 left-0 bg-surface border border-white/10 shadow-xl rounded-xl p-3 z-50 grid grid-cols-8 gap-2 text-xl">{EMOJIS.map((e, i) => (<button key={i} type="button" onClick={() => handleEmojiClick(e)} className="hover:scale-125 transition-transform">{e}</button>))}</div>)}
                          </div>
                          <button onClick={() => handleSendMessage()} disabled={!inputText.trim() || isInputDisabled} className="bg-primary text-white p-3.5 rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shrink-0"><Send size={20} /></button>
                      </div>
                  </div>
                </div>
              )}
              {selectedMatch.status === 'ended' && (
                <div className="p-6 border-t border-white/5 bg-surface/50 text-center">
                   <p className="text-text-muted text-sm italic">This partnership has ended. Messages are archived.</p>
                </div>
              )}
            </div>
            
            {/* Right Panel */}
            <div className="hidden 2xl:flex w-80 flex-col border-l border-white/5 bg-surface/30 backdrop-blur-sm shrink-0 h-full">
               <div className="flex-1 overflow-hidden p-3 h-full"><AIRecapPanel subscriptionTier={currentUser.subscriptionTier} onUpgrade={onUpgrade} /></div>
            </div>
            
            <aside className="hidden xl:flex flex-col w-80 shrink-0 border-l border-white/5 bg-surface/30 h-full backdrop-blur-sm">
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                    <div className="block 2xl:hidden space-y-3">
                        <div className="h-64 shrink-0">
                          <PartnershipStatusPanel 
                            status={selectedMatch.status || 'active'} 
                            isPlusOrPro={hasPlusAccess(currentUser)} 
                            onUpdateStatus={handleUpdateStatus} 
                            onUpgrade={onUpgrade}
                            lastActivityDate={selectedMatch.lastMessageAt || selectedMatch.timestamp}
                          />
                        </div>
                        <div className="h-48 shrink-0"><AIRecapPanel subscriptionTier={currentUser.subscriptionTier} onUpgrade={onUpgrade} /></div>
                    </div>
                    <div className="bg-surface/50 border border-white/5 rounded-2xl overflow-hidden shrink-0"><ProfileDetailView match={selectedMatch} /></div>
                </div>
            </aside>
          </>
        ) : (
          <div className="w-full h-full hidden md:flex flex-col items-center justify-center bg-background p-8 text-center">
            <h3 className="text-2xl font-bold text-text-main mb-3">No conversation selected</h3>
            <p className="text-text-muted max-w-sm mx-auto leading-relaxed">Choose a match on the left or add a fellow founder via Kova ID to start collaborating.</p>
            <button onClick={() => setShowConnectModal(true)} className="mt-8 px-6 py-3 bg-surface hover:bg-white/5 border border-white/10 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 text-gold"><UserPlus size={16} /> Connect New User</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
