import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Send,
  Video,
  Sparkles,
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
} from 'lucide-react';
import { User, Match, Message } from '../types';
import { generateIcebreaker } from '../services/geminiService';
import { supabase } from '../supabaseClient';
import { DEFAULT_PROFILE_IMAGE } from '../constants';
import { getDisplayName } from '../utils/nameUtils';

interface ChatInterfaceProps {
  matches: Match[];
  currentUser: User;
  onStartVideoCall: (match: Match) => void;
  onConnectById: (user: User) => void;
  onUnmatch: (matchId: string) => void;
  // NEW: highlight brand-new matches
  newMatchIds?: string[];
  onMatchSeen?: (matchId: string) => void;
}

// Supabase `timestamp without time zone` is effectively UTC.
// This helper makes sure we treat it as UTC, then the browser
// converts it to the viewer's local time zone.
const parseSupabaseTimestamp = (
  value: string | Date | null | undefined
): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;

  // If the string already has a timezone/offset or Z, leave it.
  const hasZone = /[zZ]|[+\-]\d{2}:\d{2}$/.test(value);
  const iso = hasZone ? value : `${value}Z`;
  return new Date(iso);
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  matches,
  currentUser,
  onStartVideoCall,
  onConnectById,
  onUnmatch,
  newMatchIds = [],
  onMatchSeen,
}) => {
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(
    matches[0]?.id || null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Local state to track live message updates for sorting/previews (keyed by matchId)
  const [liveMessageUpdates, setLiveMessageUpdates] = useState<
    Record<string, { text: string; timestamp: Date }>
  >({});
  
  // Local state for cleared chats in this session
  const [clearedChats, setClearedChats] = useState<Record<string, boolean>>({});

  // Search Matches State
  const [searchTerm, setSearchTerm] = useState('');

  // Connect Modal State
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Profile Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Connections Modal State
  const [connectionsModalOpen, setConnectionsModalOpen] = useState(false);
  const [connectionsList, setConnectionsList] = useState<User[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement | null>(null);

  // --- Emoji picker ---
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const EMOJIS: string[] = [
    '😀',
    '😁',
    '😂',
    '🤣',
    '😊',
    '😍',
    '🤝',
    '🔥',
    '👏',
    '💡',
    '📈',
    '🎯',
    '🚀',
    '❤️',
    '🤝🏻',
    '💻',
    '📅',
    '🤔',
    '😅',
    '😎',
    '🤝🏽',
    '📊',
    '📉',
    '✅',
  ];

  const handleEmojiClick = (emoji: string) => {
    setInputText((prev) => (prev || '') + emoji);
    setShowEmojiPicker(false);
  };

  // Merge props with live updates to determine sorting
  const mergedMatches = useMemo(() => {
    return matches.map((m) => {
      const update = liveMessageUpdates[m.id];

      // If this chat was cleared in this session, hide preview + lastMessageAt
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

  // Sort matches by latest activity (lastMessageAt or timestamp)
  const sortedMatches = useMemo(() => {
    return [...mergedMatches].sort((a, b) => {
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
  }, [mergedMatches]);

  const selectedMatch =
    sortedMatches.find((m) => m.id === selectedMatchId) ||
    matches.find((m) => m.id === selectedMatchId);

  // Filter Matches based on search
  const filteredMatches = sortedMatches.filter((match) => {
    // If this chat was cleared in this session, hide it from the sidebar
    if (clearedChats[match.id]) return false;

    const rawName = match.user.name || '';
    const displayName = getDisplayName(rawName);
    return displayName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Helper to determine presence status
  const getPresenceStatus = (lastSeenAt?: string | null) => {
    if (!lastSeenAt) return 'offline';
    const last = parseSupabaseTimestamp(lastSeenAt).getTime();
    const now = Date.now();
    const diffMinutes = (now - last) / 1000 / 60;

    if (diffMinutes < 2) return 'online';
    if (diffMinutes < 15) return 'away';
    return 'offline';
  };

  // --- Time Formatting Helper (Local Time) ---
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

    if (isToday) {
      return formatLocalTime(date);
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getDateLabel = (dateInput: Date | string) => {
    const date = parseSupabaseTimestamp(dateInput);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    // Check for Yesterday
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

  // Helper to check if we need a date divider
  const shouldShowDateDivider = (
    currentMsg: Message,
    prevMsg: Message | undefined
  ) => {
    if (!prevMsg) return true;
    const currDate = parseSupabaseTimestamp(currentMsg.timestamp as any);
    const prevDate = parseSupabaseTimestamp(prevMsg.timestamp as any);
    return currDate.toDateString() !== prevDate.toDateString();
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedMatchId]);

  useEffect(() => {
    if (messageInputRef.current) {
      messageInputRef.current.focus();
    }
  }, [selectedMatchId]);

  // Safety: If selected match is removed from the list (e.g. unmatch), clear selection
  useEffect(() => {
    if (selectedMatchId && !matches.find((m) => m.id === selectedMatchId)) {
      setSelectedMatchId(null);
    }
  }, [matches, selectedMatchId]);

  // Close emoji picker when changing conversations
  useEffect(() => {
    setShowEmojiPicker(false);
  }, [selectedMatchId]);

  // Load Messages & Subscribe to Realtime Updates
  useEffect(() => {
    if (!selectedMatchId) return;

    let isMounted = true;

    // 1. Initial Load of History
    const loadMessages = async () => {
      setIsLoadingMessages(true);

      // 1) Check if this chat is hidden for the current user
      const { data: hiddenRow, error: hiddenError } = await supabase
        .from('hidden_chats')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('match_id', selectedMatchId)
        .maybeSingle();

      if (hiddenError) {
        console.error('Error checking hidden_chats:', hiddenError);
      }

      // If user has hidden this chat, start with an empty history.
      // Realtime subscription (below) will still show brand new messages.
      if (hiddenRow) {
        if (!isMounted) return;
        setMessages([]);
        setIsLoadingMessages(false);
        return;
      }

      // 2) Normal message load when not hidden
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', selectedMatchId)
        .order('created_at', { ascending: true });

      if (!isMounted) return;

      if (error) {
        console.error('Error loading messages:', error);
      } else if (data) {
        const loadedMsgs: Message[] = data.map((msg: any) => ({
          id: msg.id,
          matchId: msg.match_id,
          senderId: msg.sender_id,
          text: msg.text,
          timestamp: parseSupabaseTimestamp(msg.created_at || msg.timestamp),
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
          const timestamp = parseSupabaseTimestamp(
            newRow.created_at || newRow.timestamp
          );

          const newMsg: Message = {
            id: newRow.id,
            matchId: newRow.match_id,
            senderId: newRow.sender_id,
            text: newRow.text,
            timestamp,
          };

          setMessages((prev) => {
            // Deduplication
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          // Update the live tracker for sorting/preview
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

    // 3. Cleanup
    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [selectedMatchId, currentUser.id]);

  const handleSendMessage = async (text: string = inputText) => {
    if (!text.trim() || !selectedMatchId || !currentUser) return;

    const now = new Date();

    // Optimistic Update (local time)
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      matchId: selectedMatchId,
      senderId: currentUser.id,
      text: text,
      timestamp: now,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText('');

    // Immediately update live tracker to jump conversation to top
    setLiveMessageUpdates((prev) => ({
      ...prev,
      [selectedMatchId]: {
        text: text,
        timestamp: now,
      },
    }));

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([
          {
            match_id: selectedMatchId,
            sender_id: currentUser.id,
            text: text,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const realTimestamp = parseSupabaseTimestamp(data.created_at);
        setMessages((prev) => {
          const alreadyHasRealMsg = prev.some((m) => m.id === data.id);

          if (alreadyHasRealMsg) {
            return prev.filter((m) => m.id !== optimisticMsg.id);
          } else {
            return prev.map((m) =>
              m.id === optimisticMsg.id
                ? {
                    ...m,
                    id: data.id,
                    timestamp: realTimestamp,
                  }
                : m
            );
          }
        });

        setLiveMessageUpdates((prev) => ({
          ...prev,
          [selectedMatchId]: {
            text: text,
            timestamp: realTimestamp,
          },
        }));
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleAiIcebreaker = async () => {
    if (!selectedMatch) return;
    setIsGenerating(true);
    const icebreaker = await generateIcebreaker(
      currentUser,
      selectedMatch.user
    );
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
            securityAnswer: '',
            subscriptionTier: data.subscription_tier || 'free',
            proExpiresAt: data.pro_expires_at || null,
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

  const handleUnmatchClick = () => {
    if (!selectedMatchId) return;

    if (
      window.confirm(
        'Are you sure you want to unmatch? This conversation will be removed.'
      )
    ) {
      onUnmatch(selectedMatchId);
      setSelectedMatchId(null);
    }
  };

  const handleDeleteChat = async () => {
    if (!selectedMatchId || !currentUser) return;

    const confirmed = window.confirm(
      'Delete this chat history on your side? The other person will still keep their messages.'
    );

    if (!confirmed) return;

    try {
      // Mark this match as hidden for the current user
      const { error } = await supabase
        .from('hidden_chats')
        .upsert(
          {
            user_id: currentUser.id,
            match_id: selectedMatchId,
          },
          { onConflict: 'user_id,match_id' }
        );

      if (error) {
        console.error('Error marking chat as hidden for this user:', error);
        alert('Failed to delete chat. Please try again.');
        return;
      }

      // Locally clear the chat history for this user
      setMessages([]);

      setLiveMessageUpdates((prev) => {
        const next = { ...prev };
        delete next[selectedMatchId];
        return next;
      });

      setClearedChats((prev) => ({
        ...prev,
        [selectedMatchId]: true,
      }));
    } catch (err) {
      console.error('Unexpected error hiding chat:', err);
      alert('Failed to delete chat. Please try again.');
    }
  };

  const handleViewConnections = async (userId: string) => {
    setConnectionsModalOpen(true);
    setIsLoadingConnections(true);
    setConnectionsList([]);

    const { data, error } = await supabase
      .from('matches')
      .select(`
          user1:user1_id(id, name, image_url, role, industry),
          user2:user2_id(id, name, image_url, role, industry)
        `)
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

    if (error) {
      console.error('Error fetching connections:', error);
    } else if (data) {
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

  // Reusable Profile Details Component - Matches ProfileEditor Style
  const ProfileDetailView = ({ match }: { match: Match }) => {
    const user = match.user;

    const TagDisplay = ({
      tags,
      icon: Icon,
    }: {
      tags: string[];
      icon?: React.ElementType;
    }) => (
      <div className="flex flex-wrap gap-2 mb-2">
        {tags && tags.length > 0 ? (
          tags.map((tag, idx) => (
            <span
              key={idx}
              className="bg-background border border-white/10 px-3 py-1 rounded-full text-xs text-text-main flex items-center gap-1"
            >
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
      <div className="p-4 space-y-4 pb-20">
        {/* Header / Profile Pic Card */}
        <div className="bg-surface border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center">
          <div className="relative group mb-4">
            <div className="w-24 h-24 rounded-full border-4 border-background shadow-xl overflow-hidden relative">
              <img
                src={user.imageUrl || DEFAULT_PROFILE_IMAGE}
                alt="Profile"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_PROFILE_IMAGE;
                }}
              />
            </div>
          </div>
          <h2 className="text-xl font-bold text-text-main">
            {getDisplayName(user.name)}
          </h2>
          <p className="text-sm text-text-muted mb-3">{user.role}</p>

          <div className="flex items-center gap-2 text-xs text-text-muted bg-background/50 px-3 py-1.5 rounded-lg border border-white/5 mb-3">
            <Hash size={12} className="text-gold" />
            <span className="font-mono">{user.kovaId || 'N/A'}</span>
          </div>

          <button
            onClick={() => handleViewConnections(user.id)}
            className="flex items-center gap-2 px-4 py-2 bg-surface hover:bg-white/5 border border-white/10 rounded-xl text-xs font-medium transition-colors text-text-muted hover:text-primary group"
          >
            <Users
              size={14}
              className="group-hover:text-primary transition-colors"
            />
            View Connections
          </button>
        </div>

        {/* Professional Info Card */}
        <div className="bg-surface border border-white/10 rounded-2xl p-4">
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4 pb-2 border-b border-white/5">
            Professional Info
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1 flex items-center gap-1.5">
                <Briefcase size={12} /> Title / Role
              </label>
              <p className="text-sm text-text-main font-medium">{user.role}</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1 flex items-center gap-1.5">
                <Globe size={12} /> Industry
              </label>
              <p className="text-sm text-text-main">{user.industry}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Stage
                </label>
                <span className="inline-block px-2.5 py-0.5 bg-primary/10 text-primary rounded text-xs font-bold border border-primary/20">
                  {user.stage}
                </span>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Experience
                </label>
                <p className="text-sm text-text-main">
                  {user.experienceLevel || 'N/A'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1 flex items-center gap-1.5">
                <MapPin size={12} /> Location
              </label>
              <p className="text-sm text-text-main">
                {user.location && (user.location.city || user.location.state)
                  ? `${user.location.city}${
                      user.location.city && user.location.state ? ', ' : ''
                    }${user.location.state}`
                  : 'Not specified'}
              </p>
            </div>
          </div>
        </div>

        {/* About You Card */}
        <div className="bg-surface border border-white/10 rounded-2xl p-4">
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4 pb-2 border-b border-white/5">
            About
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Bio
              </label>
              <p className="text-sm text-text-main leading-relaxed opacity-90">
                {user.bio || 'No bio available.'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-2 flex items-center gap-1.5">
                <Target size={12} /> Goals
              </label>
              <ul className="space-y-1.5">
                {user.goalsList && user.goalsList.filter(Boolean).length > 0 ? (
                  user.goalsList
                    .filter(Boolean)
                    .map((goal, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-sm text-text-main"
                      >
                        <span className="text-gold mt-1.5">•</span>{' '}
                        <span className="flex-1">{goal}</span>
                      </li>
                    ))
                ) : (
                  <li className="text-text-muted text-xs italic">
                    No goals listed.
                  </li>
                )}
              </ul>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1 flex items-center gap-1.5">
                <MessageCircle size={12} /> Communication
              </label>
              <span className="inline-block px-2.5 py-1 bg-surface border border-white/10 rounded-full text-xs text-text-main">
                {user.communicationStyle || 'Not specified'}
              </span>
            </div>
          </div>
        </div>

        {/* Interests & Connect Card */}
        <div className="bg-surface border border-white/10 rounded-2xl p-4">
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4 pb-2 border-b border-white/5">
            Interests & Connect
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-2">
                Skills / Strengths
              </label>
              <TagDisplay tags={user.skills || []} />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-2">
                Interests
              </label>
              <TagDisplay tags={user.tags || []} />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-2 flex items-center gap-1.5">
                <Target size={12} /> Looking For
              </label>
              <TagDisplay tags={user.lookingFor || []} />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-2 flex items-center gap-1.5">
                <Clock size={12} /> Availability
              </label>
              <TagDisplay tags={user.availability || []} />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-3 flex items-center gap-1.5">
                <LinkIcon size={12} /> Links
              </label>
              <div className="flex flex-wrap gap-2">
                {user.links?.linkedin && (
                  <a
                    href={user.links.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 bg-background border border-white/10 rounded-lg text-xs text-text-main hover:text-primary hover:border-primary/50 transition-colors"
                  >
                    LinkedIn
                  </a>
                )}
                {user.links?.twitter && (
                  <a
                    href={user.links.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 bg-background border border-white/10 rounded-lg text-xs text-text-main hover:text-primary hover:border-primary/50 transition-colors"
                  >
                    Twitter / X
                  </a>
                )}
                {user.links?.website && (
                  <a
                    href={user.links.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 bg-background border border-white/10 rounded-lg text-xs text-text-main hover:text-primary hover:border-primary/50 transition-colors"
                  >
                    Website
                  </a>
                )}
                {user.links?.portfolio && (
                  <a
                    href={user.links.portfolio}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 bg-background border border-white/10 rounded-lg text-xs text-text-main hover:text-primary hover:border-primary/50 transition-colors"
                  >
                    Portfolio
                  </a>
                )}
                {(!user.links || Object.values(user.links).every((v) => !v)) && (
                  <span className="text-text-muted text-xs italic">
                    No links added.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full w-full bg-background overflow-hidden border-t border-white/5 relative">
      {/* Connections Modal */}
      {connectionsModalOpen && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-md rounded-2xl border border-white/10 shadow-2xl p-6 max-h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center.mb-4 shrink-0">
              <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
                <Users size={18} className="text-gold" /> Connections
              </h3>
              <button
                onClick={() => setConnectionsModalOpen(false)}
                className="text-text-muted hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoadingConnections ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="animate-spin text-gold" />
                </div>
              ) : connectionsList.length === 0 ? (
                <p className="text-center text-text-muted py-8 text-sm">
                  No connections found.
                </p>
              ) : (
                <div className="space-y-2">
                  {connectionsList.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center gap-3 p-3 bg-background/50 rounded-xl border border-white/5"
                    >
                      <img
                        src={u.imageUrl}
                        className="w-10 h-10 rounded-full object-cover border border-white/10"
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_PROFILE_IMAGE;
                        }}
                      />
                      <div>
                        <p className="font-bold text-sm text-text-main">
                          {getDisplayName(u.name)}
                        </p>
                        <p className="text-xs text-text-muted">
                          {u.role} • {u.industry}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Connect By ID Modal Overlay */}
      {showConnectModal && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-text-main flex items-center gap-2">
                <UserPlus size={24} className="text-primary" /> Connect by ID
              </h3>
              <button
                onClick={() => setShowConnectModal(false)}
                className="text-text-muted hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-text-muted text-sm mb-4">
              Enter a unique Kova ID (e.g., KVA-123456) to connect instantly.
            </p>

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
                className="bg-surface border border-white/10 hover:bg-white/5 text-white px-4 py-2 rounded-lg transition-colors.disabled:opacity-50"
              >
                {isSearching ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Search size={20} />
                )}
              </button>
            </div>

            {searchError && (
              <p className="text-red-400 text-sm mb-4">{searchError}</p>
            )}

            {foundUser && (
              <div className="bg-background rounded-xl p-4 mb-6 border border-white/10 flex items-center.gap-4">
                <img
                  src={foundUser.imageUrl}
                  alt={foundUser.name}
                  className="w-12 h-12 rounded-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_PROFILE_IMAGE;
                  }}
                />
                <div>
                  <p className="font-bold text-text-main">
                    {getDisplayName(foundUser.name)}
                  </p>
                  <p className="text-xs text-text-muted">
                    {foundUser.role} • {foundUser.industry}
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConnectModal(false)}
                className="px-4 py-2 text-text-muted hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendRequest}
                disabled={!foundUser}
                className="px-4 py-2 bg-primary text-white rounded-lg font-medium.disabled:opacity-50 hover:bg-primary-hover transition-colors"
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Details Modal (Desktop & Mobile) */}
      {showProfileModal && selectedMatch && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center.justify-center p-4">
          <div className="bg-surface w-full max-w-lg rounded-3xl border border-white/10.shadow-2xl h-[85vh] flex flex-col relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowProfileModal(false)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/40 rounded-full text-white hover:bg-black/60 transition-colors"
            >
              <X size={20} />
            </button>
            <div className="flex-1 overflow-y-auto">
              <ProfileDetailView match={selectedMatch} />
            </div>
          </div>
        </div>
      )}

      {/* --- Column 1: Sidebar List (Left Side) --- */}
      <div
        className={`w-full md:w-72 lg:w-80 bg-surface border-r border-white/5 flex flex-col shrink-0 ${
          selectedMatchId ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="flex flex-col bg-surface border-b border-white/5 shrink-0">
          <div className="p-4 pb-2 flex justify-between items-center">
            <h2 className="text-xl font-bold text-text-main">Messages</h2>
            <button
              onClick={() => setShowConnectModal(true)}
              className="flex items-center.gap-2 px-3 py-1.5 bg-background hover:bg-primary/10 hover:text-primary hover:border-primary/20 text-text-muted text-xs font-bold transition-colors rounded-lg border border-white/10"
            >
              <UserPlus size={14} /> Add via Kova ID
            </button>
          </div>

          {/* Search Bar */}
          <div className="px-4 pb-4">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search connections..."
                className="w-full bg-background border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-text-main focus:outline-none focus:border-gold/50 transition-colors placeholder-text-muted/70"
              />
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                size={14}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredMatches.length === 0 ? (
            matches.length === 0 ? (
              <div className="p-8 text-center text-text-muted flex flex-col.items-center gap-4">
                <div className="w-16 h-16 bg-background rounded-full flex items-center.justify-center border border-white/5">
                  <Bot size={32} className="opacity-20" />
                </div>
                <p>No matches yet. Start swiping or add by ID!</p>
              </div>
            ) : (
              <p className="text-center text-text-muted p-6 text-sm">
                No matches found.
              </p>
            )
          ) : (
            filteredMatches.map((match) => {
              const previewText = match.lastMessageText || 'Chat started';
              const truncatedPreview =
                previewText.length > 40
                  ? previewText.slice(0, 40) + '…'
                  : previewText;
              const timeToDisplay = match.lastMessageAt
                ? formatSidebarDate(match.lastMessageAt)
                : formatSidebarDate(match.timestamp as any);
              const status = getPresenceStatus(match.user.lastSeenAt);
              const dotClass =
                status === 'online'
                  ? 'bg-green-500'
                  : status === 'away'
                  ? 'bg-amber-500'
                  : 'bg-gray-500';

              const isNew = newMatchIds.includes(match.id);

              return (
                <div
                  key={match.id}
                  onClick={() => {
                    setSelectedMatchId(match.id);
                    if (isNew && onMatchSeen) onMatchSeen(match.id);
                  }}
                  className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-background/50 transition-colors border-b border-white/5 ${
                    selectedMatchId === match.id
                      ? 'bg-background/80 border-l-4 border-l-primary'
                      : 'border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="relative">
                    <img
                      src={match.user.imageUrl}
                      alt={match.user.name}
                      className="w-12 h-12 rounded-full object-cover border.border-white/10"
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_PROFILE_IMAGE;
                      }}
                    />
                    <div
                      className={`absolute bottom-0 right-0 w-3 h-3 ${dotClass} rounded-full border-2 border-surface`}
                    ></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3
                          className={`font-medium truncate ${
                            selectedMatchId === match.id
                              ? 'text-primary'
                              : 'text-text-main'
                          }`}
                        >
                          {getDisplayName(match.user.name)}
                        </h3>
                        {isNew && (
                          <span className="text-[9px] font-bold text-gold bg-gold/10 border border-gold/30 px-1.5 py-0.5 rounded-full shrink-0">
                            NEW
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-text-muted shrink-0 ml-2">
                        {timeToDisplay}
                      </span>
                    </div>
                    <p className="text-sm text-text-muted truncate opacity-80">
                      {truncatedPreview}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* --- Column 2: Main Chat Area (Center) --- */}
      <div
        className={`flex-1 flex flex-col min-w-0 bg-background relative ${
          !selectedMatchId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {selectedMatch ? (
          <>
            {/* Chat Header */}
                        {/* Chat Header */}
            <div className="h-16 border-b border-white/5 bg-surface/50 backdrop-blur-md shrink-0 sticky top-0 z-20 px-3 md:px-6 relative">
              {/* Left side: avatar, name, status */}
              <div className="flex items-center gap-3 min-w-0 mr-2 pr-40 h-full">
                <button
                  onClick={() => setSelectedMatchId(null)}
                  className="md:hidden text-text-muted hover:text-white shrink-0 p-1"
                >
                  <ArrowLeft size={22} />
                </button>
                <img
                  src={selectedMatch.user.imageUrl}
                  alt={selectedMatch.user.name}
                  className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0"
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_PROFILE_IMAGE;
                  }}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-text-main truncate">
                    {getDisplayName(selectedMatch.user.name)}
                  </h3>
                  {(() => {
                    const currentStatus = getPresenceStatus(selectedMatch.user.lastSeenAt);
                    const statusLabel =
                      currentStatus === 'online'
                        ? 'Online'
                        : currentStatus === 'away'
                        ? 'Away'
                        : 'Offline';
                    const statusColor =
                      currentStatus === 'online'
                        ? 'text-green-500'
                        : currentStatus === 'away'
                        ? 'text-amber-500'
                        : 'text-gray-500';

                    return (
                      <p className="text-xs text-text-muted truncate flex items-center gap-1.5">
                        <span className={statusColor}>●</span> {statusLabel}
                        <span className="text-white/20">|</span>
                        <span className="truncate">{selectedMatch.user.role}</span>
                        <span className="hidden sm:inline">• {selectedMatch.user.stage}</span>
                        <span className="hidden sm:inline">
                          • {selectedMatch.user.industry}
                        </span>
                      </p>
                    );
                  })()}
                </div>
              </div>

              {/* Right side: actions, pinned to header right */}
              <div className="flex items-center gap-2 shrink-0 absolute right-3 md:right-6 top-1/2 -translate-y-1/2">
                <button
                  onClick={() => onStartVideoCall(selectedMatch)}
                  className="px-3 py-2 text-gold bg-gold/10 hover:bg-gold/20 border border-gold/20 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"
                  title="Start Co-working Session"
                >
                  <Video size={16} />
                  <span className="hidden md:inline">Video Call</span>
                </button>

                <button
                  onClick={handleDeleteChat}
                  className="px-3 py-2 text-text-muted hover:text-white hover:bg-white/5 border border-white/10 hover:border-white/20 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium"
                  title="Delete Chat History"
                >
                  <Trash2 size={16} />
                  <span className="hidden md:inline">Delete Chat</span>
                </button>

                <button
                  onClick={handleUnmatchClick}
                  className="px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium"
                  title="Unmatch"
                >
                  <UserMinus size={16} />
                  <span className="hidden md:inline">Unmatch</span>
                </button>
              </div>
            </div>


            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
              <div className="w-full space-y-4">
                {isLoadingMessages && (
                  <div className="flex justify-center p-4">
                    <Loader2 className="animate-spin text-gold" />
                  </div>
                )}

                {messages.length === 0 && !isLoadingMessages && (
                  <div className="flex flex-col items-center.justify-center h-full min-h-[300px] text-center text-text-muted opacity-60">
                    <Sparkles className="w-12 h-12 mb-4 text-gold/50" />
                    <p>
                      This is the start of your conversation with{' '}
                      {getDisplayName(selectedMatch.user.name)}.
                    </p>
                    <p className="text-xs mt-2">
                      Say hello or generate an icebreaker!
                    </p>
                  </div>
                )}

                {messages.map((msg, idx) => {
                  const isMe = msg.senderId === currentUser.id;
                  const prevMsg = messages[idx - 1];
                  const showDate = shouldShowDateDivider(msg, prevMsg);

                  return (
                    <React.Fragment key={msg.id}>
                      {showDate && (
                        <div className="flex items-center.justify-center my-6">
                          <div className="h-px bg-white/5 flex-1 max-w-[100px]"></div>
                          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider px-4">
                            {getDateLabel(msg.timestamp as any)}
                          </span>
                          <div className="h-px bg-white/5 flex-1 max-w-[100px]"></div>
                        </div>
                      )}

                      <div
                        className={`flex ${
                          isMe ? 'justify-end' : 'justify-start'
                        } group`}
                      >
                        <div
                          className={`max-w-[85%] md:max-w-[70%] lg:max-w-[60%] p-3.5 rounded-2xl shadow-sm ${
                            isMe
                              ? 'bg-primary text-white rounded-tr-sm'
                              : 'bg-surface border border-white/5 text-text-main rounded-tl-sm'
                          }`}
                        >
                          <p className="text-sm md:text-base leading-relaxed">
                            {msg.text}
                          </p>
                          <div
                            className={`flex items-center gap-1 mt-1 ${
                              isMe ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            <span
                              className={`text-[10px] ${
                                isMe ? 'text-white/60' : 'text-text-muted/60'
                              }`}
                            >
                              {formatLocalTime(msg.timestamp as any)}
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
                      className="flex items-center.gap-2 px-4 py-2 bg-gradient-to-r from-gold/10 to-transparent text-gold text-xs font-medium rounded-full border border-gold/20 hover:border-gold/50 transition-colors whitespace-nowrap"
                    >
                      {isGenerating ? (
                        <span className="animate-spin">⏳</span>
                      ) : (
                        <Sparkles size={12} />
                      )}
                      Generate Icebreaker
                    </button>
                    <button
                      onClick={() =>
                        setInputText(
                          'Hey! Would you be up for a quick co-working session?'
                        )
                      }
                      className="px-4 py-2 bg-background text-text-muted text-xs font-medium rounded-full hover:bg-white/5 transition-colors whitespace-nowrap border border-white/10 hover:border-white/20"
                    >
                      Suggest Co-working
                    </button>
                  </div>
                )}
                <div className="flex gap-2 items-end">
                  <div className="flex-1 relative">
                    {/* Emoji toggle button */}
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker((prev) => !prev)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-xl hover:scale-110 transition-transform"
                    >
                      🙂
                    </button>

                    <input
                      ref={messageInputRef}
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Type a message..."
                      className="w-full bg-background text-text-main border border-white/10 rounded-2xl pl-10 pr-12 py-3.5 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all placeholder-gray-600"
                    />

                    {/* Emoji picker panel */}
                    {showEmojiPicker && (
                      <div className="absolute bottom-12 left-0 bg-surface border border-white/10 shadow-xl rounded-xl p-3 z-50 grid grid-cols-8 gap-2 text-xl">
                        {EMOJIS.map((e, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleEmojiClick(e)}
                            className="hover:scale-125 transition-transform"
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!inputText.trim()}
                    className="bg-primary text-white p-3.5 rounded-xl hover:bg-primary-hover transition-colors.disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shrink-0"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Empty State (Desktop) */
          <div className="w-full h-full hidden md:flex flex-col items-center.justify-center bg-background p-8 text-center">
            <h3 className="text-2xl font-bold text-text-main mb-3">
              No conversation selected
            </h3>
            <p className="text-text-muted max-w-sm mx-auto leading-relaxed">
              Choose a match on the left or add a fellow founder via Kova ID to
              start collaborating.
            </p>
            <button
              onClick={() => setShowConnectModal(true)}
              className="mt-8 px-6 py-3 bg-surface hover:bg-white/5 border border-white/10 rounded-xl text-sm font-medium transition-colors flex items-center.gap-2 text-gold"
            >
              <UserPlus size={16} /> Connect New User
            </button>
          </div>
        )}
      </div>

      {/* --- Column 3: Profile Context Panel (Desktop Only) --- */}
      {selectedMatch && (
        <div className="hidden lg:flex w-80 bg-surface/50 border-l border-white/5 flex-col shrink-0 overflow-y-auto">
          <ProfileDetailView match={selectedMatch} />
        </div>
      )}
    </div>
  );
};

export default ChatInterface;