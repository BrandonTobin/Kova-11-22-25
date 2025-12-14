
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import LoginScreen from './components/LoginScreen';
import RegisterScreen from './components/RegisterScreen';
import OnboardingScreen from './components/OnboardingScreen';
import SwipeDeck from './components/SwipeDeck';
import MatchPopup from './components/MatchPopup';
import ChatInterface from './components/ChatInterface';
import VideoRoom from './components/VideoRoom';
import Dashboard from './components/Dashboard';
import ProfileEditor from './components/ProfileEditor';
import Notes from './components/Notes';
import PaymentSuccess from './components/PaymentSuccess';

// Legal Pages
import PrivacyPolicy from './components/legal/PrivacyPolicy';
import TermsOfService from './components/legal/TermsOfService';
import RefundPolicy from './components/legal/RefundPolicy';
import ContactPage from './components/legal/ContactPage';

import IncomingCallPopup from './components/IncomingCallPopup';

import { User, Match, ViewState, SubscriptionTier, IncomingCall, CallType } from './types';
import {
  LayoutGrid,
  MessageSquare,
  User as UserIcon,
  LogOut,
  X,
  Crown,
  Search,
  Sun,
  Moon,
  Lock,
  Sparkles,
  Loader2,
  Check,
  Gem
} from 'lucide-react';

import { DEFAULT_PROFILE_IMAGE, SUBSCRIPTION_PLANS } from './constants';
import TimerOverlay from './components/TimerOverlay';

// ✅ Your Supabase audio URL
const NOTIFICATION_SOUND_URL =
  'https://dbbtpkgiclzrsigdwdig.supabase.co/storage/v1/object/public/assets/notifications.mp3';

/**
 * Normalize DB (free | plus | pro | null) -> FE (free | kova_plus | kova_pro)
 */
const normalizeTierFromDb = (dbTier?: string | null): SubscriptionTier => {
  if (dbTier === 'plus') return 'kova_plus';
  if (dbTier === 'pro') return 'kova_pro';
  return 'free';
};

/**
 * Encode FE tier (free | kova_plus | kova_pro) -> DB (free | plus | pro)
 */
const encodeTierForDb = (tier: SubscriptionTier): string => {
  if (tier === 'kova_plus') return 'plus';
  if (tier === 'kova_pro') return 'pro';
  return 'free';
};

const getTierWeight = (tier: SubscriptionTier): number => {
  if (tier === 'kova_pro') return 3;
  if (tier === 'kova_plus') return 2;
  return 1;
};

// Weighted shuffle helper (Efraimidis and Spirakis A-Res)
const weightedShuffle = <T,>(items: T[], getWeight: (item: T) => number): T[] => {
  const arr = [...items];

  const scored = arr.map((item) => {
    const w = Math.max(getWeight(item), 1);
    const r = Math.random();
    const key = -Math.log(r) / w;
    return { item, key };
  });

  scored.sort((a, b) => a.key - b.key);
  return scored.map((x) => x.item);
};

// ✅ Password recovery detection (FIX)
const isRecoveryUrl = (): boolean => {
  if (typeof window === 'undefined') return false;

  const path = window.location.pathname || '';
  if (path === '/reset-password') return true;

  const hash = window.location.hash || '';
  const search = window.location.search || '';

  // Supabase commonly provides access_token/type=recovery in hash
  const blob = `${hash} ${search}`.toLowerCase();
  if (blob.includes('type=recovery')) return true;
  if (blob.includes('access_token=')) return true;
  if (blob.includes('refresh_token=')) return true;

  return false;
};

function App() {
  // --- State: Auth & User ---
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  
  // Initialize showRegister based on whether a draft exists
  const [showRegister, setShowRegister] = useState(() => {
    if (typeof window !== 'undefined') {
      return !!sessionStorage.getItem('kova_register_form');
    }
    return false;
  });
  
  const [isPasswordRecoveryMode, setIsPasswordRecoveryMode] = useState(false);

  // --- State: Onboarding ---
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kova_seen_onboarding') === 'true';
    }
    return false;
  });

  // --- State: App Data ---
  const [usersToSwipe, setUsersToSwipe] = useState<User[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [swipedUserIds, setSwipedUserIds] = useState<Set<string>>(new Set());
  const [dailySwipes, setDailySwipes] = useState(0);
  const [isDeckLoading, setIsDeckLoading] = useState(false);

  // NEW tags for matches
  const [newMatchIds, setNewMatchIds] = useState<string[]>([]);

  // --- State: UI/Navigation ---
  const [currentView, setCurrentView] = useState<ViewState>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;

      if (path === '/privacy') return ViewState.PRIVACY;
      if (path === '/terms') return ViewState.TERMS;
      if (path === '/refunds') return ViewState.REFUND;
      if (path === '/contact') return ViewState.CONTACT;
      if (path === '/payment-success') return ViewState.PAYMENT_SUCCESS;

      const stored = localStorage.getItem('kova_current_view') as ViewState;

      if (
        [
          ViewState.DISCOVER,
          ViewState.MATCHES,
          ViewState.DASHBOARD,
          ViewState.PROFILE,
          ViewState.NOTES
        ].includes(stored)
      ) {
        return stored;
      }
    }
    return ViewState.DISCOVER;
  });

  const [upgradeTargetTier, setUpgradeTargetTier] = useState<SubscriptionTier | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Global modals
  const [showWelcomeOverlay, setShowWelcomeOverlay] = useState(false);
  const [showOutOfSwipesModal, setShowOutOfSwipesModal] = useState(false);

  // --- Theme ---
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kova_theme');
      if (saved) return saved === 'dark';
      return document.documentElement.classList.contains('dark');
    }
    return true;
  });

  // --- Interaction ---
  const [newMatch, setNewMatch] = useState<User | null>(null);
  const [showMatchPopup, setShowMatchPopup] = useState(false);
  const [activeVideoMatch, setActiveVideoMatch] = useState<Match | null>(null);
  const [activeCallType, setActiveCallType] = useState<CallType>('video');
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  // --- Notification Sound ---
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);

  // --- Tab Notification Badges ---
  const [tabNotifications, setTabNotifications] =
    useState<Partial<Record<ViewState, number>>>({});

  // -----------------------------
  // Notification helpers
  // -----------------------------
  useEffect(() => {
    notificationAudioRef.current = new Audio(NOTIFICATION_SOUND_URL);
  }, []);

  const playNotificationSound = () => {
    const audio = notificationAudioRef.current;
    if (!audio) return;

    try {
      audio.currentTime = 0;
      audio.play().catch((err) => {
        console.warn('Notification sound blocked or failed to play:', err);
      });
    } catch (err) {
      console.warn('Notification sound error:', err);
    }
  };

  const addTabNotification = (views: ViewState | ViewState[]) => {
    setTabNotifications((prev) => {
      const next = { ...prev };
      const list = Array.isArray(views) ? views : [views];
      for (const v of list) next[v] = (next[v] ?? 0) + 1;
      return next;
    });
  };

  const clearTabNotification = (view: ViewState) => {
    setTabNotifications((prev) => {
      if (!prev[view]) return prev;
      const next = { ...prev };
      next[view] = 0;
      return next;
    });
  };

  // -----------------------------
  // Session + Theme Effects
  // -----------------------------
  useEffect(() => {
    // ✅ FIX: If user lands directly on /reset-password (or has recovery tokens),
    // force recovery mode even if Supabase event doesn’t fire yet.
    if (isRecoveryUrl()) {
      setIsPasswordRecoveryMode(true);
      // ensure we’re in the auth flow so the LoginScreen can show reset UI
      setCurrentView(ViewState.LOGIN);
    }

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecoveryMode(true);
        setCurrentView(ViewState.LOGIN);
      }
    });

    checkSession();

    return () => {
      authListener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('kova_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('kova_theme', 'light');
    }
  }, [isDarkMode]);

  // Presence heartbeat
  useEffect(() => {
    if (!user) return;

    const updateLastSeen = async () => {
      await supabase
        .from('users')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', user.id);
    };

    updateLastSeen();
    const interval = setInterval(updateLastSeen, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const toggleTheme = () => setIsDarkMode((prev) => !prev);

  // Fetch data when user changes
  useEffect(() => {
    if (user) {
      setUsersToSwipe([]);
      fetchMatches();
      fetchUsersToSwipe();

      const interval = setInterval(fetchMatches, 30000);
      return () => clearInterval(interval);
    } else {
      setUsersToSwipe([]);
      setMatches([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Track current view for realtime callbacks
  const currentViewRef = useRef(currentView);
  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  // 🔔 Realtime listener for incoming sessions (CALLS)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`incoming_calls:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sessions',
          filter: `partner_id=eq.${user.id}`,
        },
        async (payload: any) => {
          const newSession = payload.new;
          if (!newSession) return;

          // Voice channels do not trigger popup
          if (newSession.call_type !== 'video') return;

          const startTime = new Date(newSession.started_at).getTime();
          const now = Date.now();
          if (now - startTime > 60000) return;

          if (currentViewRef.current === ViewState.VIDEO_ROOM) return;

          const callerId = newSession.host_id;
          const { data: callerData } = await supabase
            .from('users')
            .select('*')
            .eq('id', callerId)
            .single();

          if (callerData) {
            const caller: User = {
              ...callerData,
              imageUrl: callerData.image_url || DEFAULT_PROFILE_IMAGE,
              kovaId: callerData.kova_id,
              mainGoal: callerData.main_goal,
              location: { city: callerData.city, state: callerData.state },
              subscriptionTier: normalizeTierFromDb(callerData.subscription_tier),
              proExpiresAt: callerData.pro_expires_at,
              experienceLevel: callerData.experience_level,
              communicationStyle: callerData.communication_style,
              skills: callerData.skills,
              lookingFor: callerData.looking_for,
              availability: callerData.availability,
              goalsList: callerData.goals_list,
              links: callerData.links,
              lastSeenAt: callerData.last_seen_at,
              badges: callerData.badges || [],
              tags: callerData.tags || [],
              password: '',
              securityQuestion: '',
              securityAnswer: '',
              // Map DB columns to camelCase for local use
              avatarZoom: callerData.avatar_zoom,
              avatarOffsetX: callerData.avatar_offset_x,
              avatarOffsetY: callerData.avatar_offset_y
            };

            setIncomingCall({
              sessionId: newSession.id,
              caller,
              callType: 'video',
            });
            playNotificationSound();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // 🔔 Realtime listener for unread message notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`message_notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload: any) => {
          const newMsg = payload.new;
          if (!newMsg) return;

          setMatches((prevMatches) => {
            const matchIndex = prevMatches.findIndex((m) => m.id === newMsg.match_id);
            if (matchIndex === -1) return prevMatches;

            const updatedMatch = {
              ...prevMatches[matchIndex],
              lastMessageText: newMsg.text,
              lastMessageAt: newMsg.created_at || new Date().toISOString(),
            };

            const otherMatches = prevMatches.filter((_, idx) => idx !== matchIndex);
            return [updatedMatch, ...otherMatches];
          });

          if (newMsg.sender_id === user.id) return;
          if (currentViewRef.current === ViewState.MATCHES) return;

          addTabNotification([ViewState.MATCHES]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // -----------------------------
  // Auth + Profile
  // -----------------------------
  const checkSession = async () => {
    setIsLoading(true);
    try {
      const storedId = localStorage.getItem('kova_current_user_id');
      if (storedId) {
        await fetchUserProfile(storedId);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Session check failed', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
      if (error) throw error;

      if (data) {
        const mappedUser: User = {
          ...data,
          imageUrl: data.image_url || DEFAULT_PROFILE_IMAGE,
          kovaId: data.kova_id,
          mainGoal: data.main_goal,
          subscriptionTier: normalizeTierFromDb(data.subscription_tier),
          proExpiresAt: data.pro_expires_at,
          location: { city: data.city || '', state: data.state || '' },
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
          // Map DB columns to camelCase
          avatarZoom: data.avatar_zoom,
          avatarOffsetX: data.avatar_offset_x,
          avatarOffsetY: data.avatar_offset_y
        };
        setUser(mappedUser);
      }
    } catch (error) {
      console.error('Error fetching profile', error);
      localStorage.removeItem('kova_current_user_id');
      setUser(null);
    }
  };

  const fetchUsersToSwipe = async () => {
    if (!user) return;
    setIsDeckLoading(true);

    try {
      const { data: swipes } = await supabase
        .from('swipes')
        .select('swiped_id')
        .eq('swiper_id', user.id);

      const swipedIds = new Set<string>((swipes?.map((s: any) => s.swiped_id) as string[]) || []);
      swipedIds.add(user.id);
      setSwipedUserIds(swipedIds);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('swipes')
        .select('*', { count: 'exact', head: true })
        .eq('swiper_id', user.id)
        .gte('created_at', today.toISOString());

      setDailySwipes(count || 0);

      let query = supabase.from('users').select('*').neq('id', user.id);

      if (swipedIds.size > 0) {
        const excludedIds = Array.from(swipedIds);
        query = query.not('id', 'in', `(${excludedIds.map((id) => `"${id}"`).join(',')})`);
      }

      const { data: candidates } = await query.limit(50);

      if (candidates) {
        const candidateIds = candidates.map((c: any) => c.id);
        let superLikerIds = new Set<string>();

        if (candidateIds.length > 0) {
          const { data: incomingSuperLikes } = await supabase
            .from('swipes')
            .select('swiper_id')
            .eq('swiped_id', user.id)
            .eq('direction', 'superlike')
            .in('swiper_id', candidateIds);

          if (incomingSuperLikes) {
            superLikerIds = new Set(incomingSuperLikes.map((s: any) => s.swiper_id));
          }
        }

        const seenIds = new Set<string>();

        const filtered = candidates
          .filter((c: any) => {
            if (seenIds.has(c.id)) return false;
            if (swipedIds.has(c.id)) return false;
            seenIds.add(c.id);
            return true;
          })
          .map((c: any) => ({
            ...c,
            imageUrl: c.image_url || DEFAULT_PROFILE_IMAGE,
            kovaId: c.kova_id,
            mainGoal: c.main_goal,
            location: { city: c.city, state: c.state },
            subscriptionTier: normalizeTierFromDb(c.subscription_tier),
            proExpiresAt: c.pro_expires_at,
            experienceLevel: c.experience_level,
            communicationStyle: c.communication_style,
            skills: c.skills,
            lookingFor: c.looking_for,
            availability: c.availability,
            goalsList: c.goals_list,
            links: c.links,
            lastSeenAt: c.last_seen_at,
            badges: c.badges || [],
            tags: c.tags || [],
            password: '',
            securityQuestion: '',
            securityAnswer: '',
            superLikedMe: superLikerIds.has(c.id),
            // Map DB columns
            avatarZoom: c.avatar_zoom,
            avatarOffsetX: c.avatar_offset_x,
            avatarOffsetY: c.avatar_offset_y
          })) as User[];

        const randomized = weightedShuffle(filtered, (u) => {
          let weight = getTierWeight(u.subscriptionTier);
          if (u.superLikedMe) weight += 10;
          return weight;
        });

        setUsersToSwipe(randomized);
      }
    } finally {
      setIsDeckLoading(false);
    }
  };

  const fetchMatches = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('matches')
      .select(
        `
        id,
        created_at,
        user1:user1_id(*),
        user2:user2_id(*)
      `
      )
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

    if (error) {
      console.error('Error fetching matches:', error);
      return;
    }

    if (data) {
      const partnerIds = data.map((m: any) => (m.user1.id === user.id ? m.user2.id : m.user1.id));

      let superLikerIds = new Set<string>();
      if (partnerIds.length > 0) {
        const { data: superLikes } = await supabase
          .from('swipes')
          .select('swiper_id')
          .eq('swiped_id', user.id)
          .eq('direction', 'superlike')
          .in('swiper_id', partnerIds);

        if (superLikes) {
          superLikerIds = new Set(superLikes.map((s: any) => s.swiper_id));
        }
      }

      const formattedMatchesResults = await Promise.all(
        data.map(async (m: any) => {
          if (!m.user1 || !m.user2) return null;

          const otherUserRaw = m.user1.id === user.id ? m.user2 : m.user1;

          const otherUser: User = {
            ...otherUserRaw,
            imageUrl: otherUserRaw.image_url || DEFAULT_PROFILE_IMAGE,
            kovaId: otherUserRaw.kova_id,
            mainGoal: otherUserRaw.main_goal,
            location: { city: otherUserRaw.city, state: otherUserRaw.state },
            subscriptionTier: normalizeTierFromDb(otherUserRaw.subscription_tier),
            proExpiresAt: otherUserRaw.pro_expires_at,
            experienceLevel: otherUserRaw.experience_level,
            communicationStyle: otherUserRaw.communication_style,
            skills: otherUserRaw.skills,
            lookingFor: otherUserRaw.looking_for,
            availability: otherUserRaw.availability,
            goalsList: otherUserRaw.goals_list,
            links: otherUserRaw.links,
            lastSeenAt: otherUserRaw.last_seen_at,
            badges: otherUserRaw.badges || [],
            tags: otherUserRaw.tags || [],
            password: '',
            securityQuestion: '',
            securityAnswer: '',
            superLikedMe: superLikerIds.has(otherUserRaw.id),
            // Map DB columns
            avatarZoom: otherUserRaw.avatar_zoom,
            avatarOffsetX: otherUserRaw.avatar_offset_x,
            avatarOffsetY: otherUserRaw.avatar_offset_y
          };

          let lastMessageText = null;
          let lastMessageAt = null;

          // FIX: Use maybeSingle() to avoid 406 errors when no messages exist yet
          const { data: lastMsgData } = await supabase
            .from('messages')
            .select('text, created_at')
            .eq('match_id', m.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastMsgData) {
            lastMessageText = lastMsgData.text;
            lastMessageAt = lastMsgData.created_at;
          }

          return {
            id: m.id,
            user: otherUser,
            timestamp: new Date(m.created_at),
            unread: 0,
            lastMessageText,
            lastMessageAt,
          } as Match;
        })
      );

      const validMatches = formattedMatchesResults.filter((m): m is Match => m !== null);

      validMatches.sort((a, b) => {
        const timeA = a.lastMessageAt
          ? new Date(a.lastMessageAt).getTime()
          : a.timestamp
          ? new Date(a.timestamp).getTime()
          : 0;
        const timeB = b.lastMessageAt
          ? new Date(b.lastMessageAt).getTime()
          : b.timestamp
          ? new Date(b.timestamp).getTime()
          : 0;
        return timeB - timeA;
      });

      setMatches(validMatches);
    }
  };

  // -----------------------------
  // Auth Handlers
  // -----------------------------
  const handleLogin = async (email: string, pass: string) => {
    setIsLoading(true);
    setAuthError('');

    try {
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });

      if (authErr || !authData.user) {
        console.error('Supabase auth error:', authErr);
        setAuthError('Invalid email or password.');
        setIsLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (profileError || !profile) {
        console.error('Profile fetch error:', profileError);
        setAuthError('Account found, but profile is missing.');
        setIsLoading(false);
        return;
      }

      // Cleanup registration drafts if login successful
      sessionStorage.removeItem('kova_register_form');
      sessionStorage.removeItem('kova_register_step');
      setShowRegister(false);

      localStorage.setItem('kova_current_user_id', profile.id);
      await fetchUserProfile(profile.id);

      setUsersToSwipe([]);
      setIsDeckLoading(true);
      setCurrentView(ViewState.DISCOVER);

      setIsLoading(false);
    } catch (err) {
      console.error('Login error:', err);
      setAuthError('An unexpected error occurred.');
      setIsLoading(false);
    }
  };

  const handleRegister = async (newUser: User, profileImage?: File) => {
    setIsLoading(true);
    setAuthError('');

    try {
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', newUser.email)
        .maybeSingle();

      if (existing) {
        setAuthError('An account with this email already exists.');
        setIsLoading(false);
        return;
      }

      const password = newUser.password ?? '';
      if (!password) {
        setAuthError('Password is missing. Please try registering again.');
        setIsLoading(false);
        return;
      }

      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: newUser.email,
        password,
      });

      if (authErr || !authData.user) {
        console.error('Supabase signUp error:', authErr);
        setAuthError(authErr?.message ?? 'Failed to create account.');
        setIsLoading(false);
        return;
      }

      let finalImageUrl = newUser.imageUrl;

      if (profileImage && authData.user) {
        try {
          const fileExt = profileImage.name.split('.').pop() || 'jpg';
          const fileName = `profiles/${authData.user.id}-${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, profileImage, { cacheControl: '3600', upsert: true });

          if (uploadError) {
            console.error('Failed to upload profile image:', uploadError);
          } else {
            const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
            if (publicUrlData) finalImageUrl = publicUrlData.publicUrl;
          }
        } catch (uploadErr) {
          console.error('Exception during image upload:', uploadErr);
        }
      }

      const { data: createdUser, error: createError } = await supabase
        .from('users')
        .insert([
          {
            id: authData.user.id,
            kova_id: newUser.kovaId,
            email: newUser.email,
            name: newUser.name,
            role: newUser.role,
            industry: newUser.industry,
            bio: newUser.bio,
            image_url: finalImageUrl,
            tags: newUser.tags,
            badges: newUser.badges,
            dob: newUser.dob,
            age: newUser.age,
            gender: newUser.gender,
            stage: newUser.stage,
            city: newUser.location.city,
            state: newUser.location.state,
            main_goal: newUser.mainGoal,
            security_question: newUser.securityQuestion,
            security_answer: newUser.securityAnswer,
            subscription_tier: 'free',
            last_seen_at: new Date().toISOString(),
            // Save Avatar Positioning
            avatar_zoom: newUser.avatarZoom,
            avatar_offset_x: newUser.avatarOffsetX,
            avatar_offset_y: newUser.avatarOffsetY
          },
        ])
        .select()
        .single();

      if (createError) throw createError;

      if (createdUser) {
        // Clear draft on successful registration
        sessionStorage.removeItem('kova_register_form');
        sessionStorage.removeItem('kova_register_step');
        setShowRegister(false);

        localStorage.setItem('kova_current_user_id', createdUser.id);
        await fetchUserProfile(createdUser.id);

        setShowWelcomeOverlay(true);
        setCurrentView(ViewState.DISCOVER);
      }

      setIsLoading(false);
    } catch (err: any) {
      console.error('Registration error:', err);
      setAuthError(err.message || 'Registration failed.');
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Error signing out of Supabase auth', e);
    }

    // Clean up all local state
    localStorage.removeItem('kova_current_user_id');
    localStorage.removeItem('kova_current_view');
    // Ensure draft is cleared if they somehow made one before logging out (unlikely but safe)
    sessionStorage.removeItem('kova_register_form');
    sessionStorage.removeItem('kova_register_step');

    setUser(null);
    setShowRegister(false); // Reset this so they land on login
    setCurrentView(ViewState.LOGIN);

    setUsersToSwipe([]);
    setMatches([]);
    setSwipedUserIds(new Set());
    setDailySwipes(0);
    setNewMatchIds([]);
    setIsDeckLoading(false);
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete account');
      }

      localStorage.removeItem('kova_current_user_id');
      localStorage.removeItem('kova_current_view');
      localStorage.removeItem('kova_seen_onboarding');
      sessionStorage.removeItem('kova_register_form');
      sessionStorage.removeItem('kova_register_step');

      setUser(null);
      setCurrentView(ViewState.LOGIN);
    } catch (err) {
      console.error('Delete account error:', err);
      alert('Failed to delete account. Please try again or contact support.');
    } finally {
      setIsLoading(false);
    }
  };

  // -----------------------------
  // Swipes / Matches
  // -----------------------------
  const handleSwipe = async (direction: 'left' | 'right' | 'superlike', swipedUser: User) => {
    if (!user) return;

    if (direction === 'right' || direction === 'superlike') {
      setDailySwipes((prev) => prev + 1);
    }

    setSwipedUserIds((prev) => {
      const next = new Set(prev);
      next.add(swipedUser.id);
      return next;
    });

    const { error: swipeError } = await supabase.from('swipes').insert([
      { swiper_id: user.id, swiped_id: swipedUser.id, direction },
    ]);

    if (swipeError) {
      console.error('Error inserting swipe:', swipeError);
      return;
    }

    if (direction === 'right' || direction === 'superlike') {
      const { data: reciprocal, error: reciprocalError } = await supabase
        .from('swipes')
        .select('id')
        .eq('swiper_id', swipedUser.id)
        .eq('swiped_id', user.id)
        .in('direction', ['right', 'superlike'])
        .maybeSingle();

      if (reciprocalError) {
        console.error('Error checking reciprocal swipe:', reciprocalError);
        return;
      }

      if (reciprocal) {
        const { data: existingMatch } = await supabase
          .from('matches')
          .select('id')
          .or(
            `and(user1_id.eq.${user.id},user2_id.eq.${swipedUser.id}),and(user1_id.eq.${swipedUser.id},user2_id.eq.${user.id})`
          )
          .maybeSingle();

        if (existingMatch) {
          setNewMatch(swipedUser);
          setShowMatchPopup(true);
          return;
        }

        const { data: matchData, error: matchError } = await supabase
          .from('matches')
          .insert([{ user1_id: user.id, user2_id: swipedUser.id }])
          .select()
          .single();

        if (matchError) {
          console.error('Error creating match:', matchError);
          return;
        }

        if (matchData) {
          setNewMatch(swipedUser);
          setShowMatchPopup(true);
          playNotificationSound();
          addTabNotification([ViewState.MATCHES, ViewState.DASHBOARD]);

          setNewMatchIds((prev) => (prev.includes(matchData.id) ? prev : [...prev, matchData.id]));
          fetchMatches();
        }
      }
    }
  };

  const handleUpdateProfile = async (updatedUser: User, profileImage?: File) => {
    if (!user) return;
    setIsLoading(true);

    let finalImageUrl = user.imageUrl;

    if (profileImage) {
      try {
        const fileExt = profileImage.name.split('.').pop() || 'jpg';
        const fileName = `profiles/${user.id}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, profileImage, { cacheControl: '3600', upsert: true });

        if (uploadError) {
          console.error('Failed to upload profile image:', uploadError);
        } else {
          const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
          if (publicUrlData) finalImageUrl = publicUrlData.publicUrl;
        }
      } catch (uploadErr) {
        console.error('Exception during image upload:', uploadErr);
      }
    } else {
      if (
        updatedUser.imageUrl &&
        !updatedUser.imageUrl.startsWith('blob:') &&
        !updatedUser.imageUrl.startsWith('data:')
      ) {
        finalImageUrl = updatedUser.imageUrl;
      }
    }

    const { error } = await supabase
      .from('users')
      .update({
        name: updatedUser.name,
        role: updatedUser.role,
        industry: updatedUser.industry,
        bio: updatedUser.bio,
        image_url: finalImageUrl,
        tags: updatedUser.tags,
        stage: updatedUser.stage,
        main_goal: updatedUser.mainGoal,
        city: updatedUser.location.city,
        state: updatedUser.location.state,
        experience_level: updatedUser.experienceLevel,
        communication_style: updatedUser.communicationStyle,
        skills: updatedUser.skills,
        looking_for: updatedUser.lookingFor,
        availability: updatedUser.availability,
        goals_list: updatedUser.goalsList,
        links: updatedUser.links,
        subscription_tier: encodeTierForDb(updatedUser.subscriptionTier),
        // Update Avatar Positioning
        avatar_zoom: updatedUser.avatarZoom,
        avatar_offset_x: updatedUser.avatarOffsetX,
        avatar_offset_y: updatedUser.avatarOffsetY
      })
      .eq('id', user.id);

    if (!error) {
      setUser({ ...updatedUser, imageUrl: finalImageUrl });
    } else {
      console.error('Profile update failed:', error);
    }

    setIsLoading(false);
  };

  const handleConnectById = async (targetUser: User) => {
    if (!user) return;

    const existing = matches.find((m) => m.user.id === targetUser.id);
    if (existing) {
      alert('You are already matched!');
      return;
    }

    const { data, error } = await supabase
      .from('matches')
      .insert([{ user1_id: user.id, user2_id: targetUser.id }])
      .select()
      .single();

    if (!error && data) {
      setNewMatchIds((prev) => (prev.includes(data.id) ? prev : [...prev, data.id]));
      fetchMatches();
      setCurrentView(ViewState.MATCHES);
    } else if (error) {
      alert('Failed to connect.');
    }
  };

  const handleUnmatch = async (matchId: string) => {
    try {
      console.log('[UNMATCH] Starting unmatch for matchId =', matchId);

      const { error: msgError } = await supabase.from('messages').delete().eq('match_id', matchId);
      if (msgError) console.error('[UNMATCH] Failed to delete messages for match:', msgError);

      const { error: matchError } = await supabase.from('matches').delete().eq('id', matchId);
      if (matchError) {
        console.error('[UNMATCH] Failed to delete match row:', matchError);
        alert('Failed to unmatch. Please check the console for details.');
        return;
      }

      setMatches((prev) => prev.filter((m) => m.id !== matchId));
      setNewMatchIds((prev) => prev.filter((id) => id !== matchId));
    } catch (err) {
      console.error('[UNMATCH] Unexpected error while unmatching:', err);
      alert('Unexpected error while unmatching. Please try again.');
    }
  };

  const handleMatchSeen = (matchId: string) => {
    setNewMatchIds((prev) => prev.filter((id) => id !== matchId));
  };

  // -----------------------------
  // Navigation
  // -----------------------------
  const navItems = [
    { id: ViewState.DISCOVER, label: 'DISCOVER', icon: Search },
    { id: ViewState.MATCHES, label: 'MATCHES', icon: MessageSquare },
    { id: ViewState.DASHBOARD, label: 'DASHBOARD', icon: LayoutGrid },
    { id: 'KOVA_AI', label: 'KOVA AI', icon: Sparkles, isLocked: true, onClick: () => {} },
    { id: ViewState.PROFILE, label: 'PROFILE', icon: UserIcon },
  ];

  const handleNavClick = (view: ViewState) => {
    setCurrentView(view);
    clearTabNotification(view);
  };

  const handleNavigateLegal = (view: ViewState) => {
    setCurrentView(view);
  };

  useEffect(() => {
    if (!user) return;
    try {
      if (
        currentView !== ViewState.PAYMENT_SUCCESS &&
        ![ViewState.PRIVACY, ViewState.TERMS, ViewState.REFUND, ViewState.CONTACT].includes(
          currentView
        )
      ) {
        localStorage.setItem('kova_current_view', currentView);
      }
    } catch (e) {
      console.warn('Failed to persist current view', e);
    }
  }, [currentView, user?.id]);

  // -----------------------------
  // Subscription Upgrading
  // -----------------------------
  const handleUpgradeSubscription = async (tier: SubscriptionTier) => {
    if (!user) return;

    if (tier === 'kova_pro') {
      alert('Kova Pro is coming soon!');
      return;
    }

    if (tier === 'kova_plus') {
      setIsProcessingPayment(true);
      try {
        const response = await fetch('/api/stripe/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: tier, userId: user.id }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Payment initiation failed');
        }

        const { url } = await response.json();
        if (url) window.location.href = url;
        else throw new Error('No payment URL returned');
      } catch (error: any) {
        console.error('Payment Error:', error);
        alert('Failed to start payment. Please try again later.');
        setIsProcessingPayment(false);
      }
    }
  };

  const handlePaymentSuccessContinue = () => {
    if (user) fetchUserProfile(user.id);
    window.history.replaceState({}, document.title, '/');
    setCurrentView(ViewState.DASHBOARD);
  };

  // --- Call Handlers ---
  const handleIncomingCallAccept = () => {
    if (incomingCall && matches) {
      const callerMatch = matches.find((m) => m.user.id === incomingCall.caller.id);

      if (callerMatch) {
        setActiveVideoMatch(callerMatch);
        setActiveCallType(incomingCall.callType);
        setCurrentView(ViewState.VIDEO_ROOM);
        setIncomingCall(null);
      } else {
        alert('Could not find match data for this call.');
        setIncomingCall(null);
      }
    }
  };

  const handleIncomingCallDecline = () => {
    setIncomingCall(null);
  };

  // -----------------------------
  // Render
  // -----------------------------
  if (currentView === ViewState.PRIVACY) {
    return (
      <>
        <button
          onClick={toggleTheme}
          className="fixed top-4 right-4 z-[100] p-2.5 rounded-full bg-surface/80 border border-text-muted/20 backdrop-blur-md shadow-lg text-text-main hover:bg-surface hover:scale-105 transition-all"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <PrivacyPolicy
          onBack={() => {
            window.history.replaceState({}, document.title, '/');
            setCurrentView(user ? ViewState.DASHBOARD : (showRegister ? ViewState.REGISTER : ViewState.LOGIN));
          }}
        />
      </>
    );
  }

  if (currentView === ViewState.TERMS) {
    return (
      <>
        <button
          onClick={toggleTheme}
          className="fixed top-4 right-4 z-[100] p-2.5 rounded-full bg-surface/80 border border-text-muted/20 backdrop-blur-md shadow-lg text-text-main hover:bg-surface hover:scale-105 transition-all"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <TermsOfService
          onBack={() => {
            window.history.replaceState({}, document.title, '/');
            setCurrentView(user ? ViewState.DASHBOARD : (showRegister ? ViewState.REGISTER : ViewState.LOGIN));
          }}
        />
      </>
    );
  }

  if (currentView === ViewState.REFUND) {
    return (
      <>
        <button
          onClick={toggleTheme}
          className="fixed top-4 right-4 z-[100] p-2.5 rounded-full bg-surface/80 border border-text-muted/20 backdrop-blur-md shadow-lg text-text-main hover:bg-surface hover:scale-105 transition-all"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <RefundPolicy
          onBack={() => {
            window.history.replaceState({}, document.title, '/');
            setCurrentView(user ? ViewState.DASHBOARD : (showRegister ? ViewState.REGISTER : ViewState.LOGIN));
          }}
        />
      </>
    );
  }

  if (currentView === ViewState.CONTACT) {
    return (
      <>
        <button
          onClick={toggleTheme}
          className="fixed top-4 right-4 z-[100] p-2.5 rounded-full bg-surface/80 border border-text-muted/20 backdrop-blur-md shadow-lg text-text-main hover:bg-surface hover:scale-105 transition-all"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <ContactPage
          onBack={() => {
            window.history.replaceState({}, document.title, '/');
            setCurrentView(user ? ViewState.DASHBOARD : (showRegister ? ViewState.REGISTER : ViewState.LOGIN));
          }}
        />
      </>
    );
  }

  let content: React.ReactNode;

  if (isLoading && !user) {
    content = (
      <div className="h-screen w-full bg-background flex flex-col items-center justify-center text-text-main">
        <div className="w-16 h-16 border-4 border-gold border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="animate-pulse">Loading Kova...</p>
      </div>
    );
  } else if (isPasswordRecoveryMode) {
    content = (
      <LoginScreen
        onLogin={handleLogin}
        onRegisterClick={() => setShowRegister(true)}
        error={authError}
        isLoading={isLoading}
        onNavigateLegal={handleNavigateLegal}
        isPasswordRecovery={true}
        onPasswordUpdated={() => {
          setIsPasswordRecoveryMode(false);
          setCurrentView(ViewState.DASHBOARD);
          window.history.replaceState({}, document.title, '/');
        }}
      />
    );
  } else if (!user) {
    if (!hasSeenOnboarding) {
      content = (
        <OnboardingScreen
          onFinish={() => {
            setHasSeenOnboarding(true);
            localStorage.setItem('kova_seen_onboarding', 'true');
          }}
        />
      );
    } else if (showRegister) {
      content = (
        <RegisterScreen
          onRegister={handleRegister}
          onBack={() => setShowRegister(false)}
          isLoading={isLoading}
          error={authError}
          onClearError={() => setAuthError('')}
          onNavigateLegal={handleNavigateLegal}
        />
      );
    } else {
      content = (
        <LoginScreen
          onLogin={handleLogin}
          onRegisterClick={() => setShowRegister(true)}
          error={authError}
          isLoading={isLoading}
          onNavigateLegal={handleNavigateLegal}
        />
      );
    }
  } else {
    // ... existing authenticated user logic ...
    const upgradeModalContent = upgradeTargetTier ? SUBSCRIPTION_PLANS[upgradeTargetTier] : null;

    content = (
      <div className="h-screen w-full bg-background flex flex-col overflow-hidden relative">
        {/* ... existing overlays ... */}
        {incomingCall && (
          <IncomingCallPopup
            caller={incomingCall.caller}
            callType={incomingCall.callType}
            onAccept={handleIncomingCallAccept}
            onDecline={handleIncomingCallDecline}
          />
        )}

        {showMatchPopup && newMatch && (
          <MatchPopup
            matchedUser={newMatch}
            currentUser={user}
            onClose={() => {
              setShowMatchPopup(false);
              setNewMatch(null);
            }}
            onChat={() => {
              setShowMatchPopup(false);
              setNewMatch(null);
              setCurrentView(ViewState.MATCHES);
            }}
          />
        )}

        {showWelcomeOverlay && (
          <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-500">
            <div className="bg-surface rounded-3xl border border-white/10 max-w-md w-full p-8 text-center shadow-2xl relative">
              <h2 className="text-3xl font-bold text-text-main mb-4">
                Welcome to Kova, {user.name.split(' ')[0]}! 👋
              </h2>
              <p className="text-text-muted text-lg mb-8 leading-relaxed">
                You’re all set. Start swiping to find your next accountability partner, brainstorm buddy, or co-founder.
              </p>
              <button
                onClick={() => setShowWelcomeOverlay(false)}
                className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg hover:bg-primary-hover transition-all"
              >
                Start Swiping
              </button>
            </div>
          </div>
        )}

        {showOutOfSwipesModal && user.subscriptionTier === 'free' && (
          <div
            className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300"
            onClick={() => setShowOutOfSwipesModal(false)}
          >
            {/* ... Out of swipes modal content ... */}
            <div
              className="bg-surface rounded-3xl border border-white/10 max-w-4xl w-full p-6 md:p-8 shadow-2xl relative overflow-y-auto max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowOutOfSwipesModal(false)}
                className="absolute top-4 right-4 text-text-muted hover:text-white"
              >
                <X size={24} />
              </button>

              <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-text-main mb-2">
                  You're out of swipes for today
                </h2>
                <p className="text-text-muted">
                  Free accounts get 30 swipes per day. Upgrade to continue connecting.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="border border-white/10 bg-white/5 p-6 rounded-2xl flex flex-col relative opacity-80 shadow-sm">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white/10 border border-white/10 text-text-muted text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Current Plan
                  </div>
                  <h3 className="text-xl font-bold text-text-main mt-2 mb-4 text-center">Free</h3>
                  <ul className="space-y-3 mb-6 flex-1 text-sm text-text-muted">
                    <li className="flex items-center gap-2">
                      <Check size={14} /> 30 swipes per day
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} /> Basic matching
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} /> Chat & video rooms
                    </li>
                  </ul>
                  <button
                    disabled
                    className="w-full py-3 rounded-xl border border-white/10 text-text-muted text-xs font-bold cursor-default"
                  >
                    Active
                  </button>
                </div>

                <div className="border-2 border-emerald-500 bg-surface p-6 rounded-2xl flex flex-col relative shadow-[0_0_20px_rgba(16,185,129,0.2)] transform scale-105 z-10">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">
                    Recommended
                  </div>
                  <div className="text-center mb-4 mt-2">
                    <h3 className="text-xl font-bold text-emerald-400">Kova Plus</h3>
                    <p className="text-2xl font-bold text-text-main mt-1">
                      $9.99<span className="text-sm font-normal text-text-muted">/mo</span>
                    </p>
                  </div>
                  <ul className="space-y-3 mb-6 flex-1 text-sm text-text-main">
                    <li className="flex items-center gap-2">
                      <Gem size={14} className="text-emerald-400" /> Unlimited Swipes
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-400" /> See who liked you
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-400" /> Daily Profile Boost
                    </li>
                  </ul>
                  <button
                    onClick={() => {
                      setShowOutOfSwipesModal(false);
                      handleUpgradeSubscription('kova_plus');
                    }}
                    disabled={isProcessingPayment}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {isProcessingPayment ? <Loader2 className="animate-spin" size={16} /> : 'Upgrade to Plus'}
                  </button>
                </div>

                <div className="relative border border-gold/30 bg-gold/5 p-6 rounded-2xl flex flex-col overflow-hidden pointer-events-none select-none">
                  <div className="opacity-30 blur-[6px] flex flex-col h-full">
                    <h3 className="text-xl font-bold text-gold mt-2 mb-4 text-center">Kova Pro</h3>
                    <ul className="space-y-3 mb-6 flex-1 text-sm text-text-muted">
                      <li className="flex items-center gap-2">
                        <Crown size={14} className="text-gold" /> All Plus features
                      </li>
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-gold" /> AI Insights
                      </li>
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-gold" /> Consistency Heatmap
                      </li>
                    </ul>
                    <div className="w-full py-3 rounded-xl border border-transparent"></div>
                  </div>

                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="px-3 py-1.5 rounded-full bg-black/90 border border-gold/30 flex items-center gap-2 shadow-xl">
                      <Lock size={12} className="text-zinc-400" />
                      <span className="text-[10px] font-bold text-gold tracking-wider uppercase">
                        Kova Pro | Coming Soon
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={() => setShowOutOfSwipesModal(false)}
                  className="text-sm text-text-muted hover:text-white transition-colors"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </div>
        )}

        {upgradeTargetTier && upgradeModalContent && !showOutOfSwipesModal && (
          <div
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !isProcessingPayment && setUpgradeTargetTier(null)}
          >
            <div
              className={`bg-surface max-w-md w-full p-8 rounded-3xl border text-center shadow-2xl relative animate-in fade-in zoom-in duration-200 ${
                upgradeTargetTier === 'kova_plus' ? 'border-emerald-500/50' : 'border-gold/30'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setUpgradeTargetTier(null)}
                disabled={isProcessingPayment}
                className="absolute top-4 right-4 text-text-muted hover:text-white disabled:opacity-50"
              >
                <X />
              </button>

              <div
                className={`w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center text-white shadow-lg ${
                  upgradeTargetTier === 'kova_plus'
                    ? 'bg-emerald-500'
                    : 'bg-gradient-to-br from-gold to-amber-600'
                }`}
              >
                {upgradeTargetTier === 'kova_plus' ? (
                  <Gem size={32} fill="currentColor" />
                ) : (
                  <Crown size={32} fill="currentColor" />
                )}
              </div>

              <h2
                className={`text-2xl font-bold mb-2 ${
                  upgradeTargetTier === 'kova_plus' ? 'text-emerald-400' : 'text-gold'
                }`}
              >
                Upgrade to {upgradeModalContent.name}
              </h2>

              <p className="text-text-muted mb-6">{upgradeModalContent.description}</p>

              <button
                onClick={() => handleUpgradeSubscription(upgradeTargetTier)}
                disabled={isProcessingPayment}
                className={`w-full py-3 text-white font-bold rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mb-4 ${
                  upgradeTargetTier === 'kova_plus'
                    ? 'bg-emerald-500 hover:bg-emerald-600'
                    : 'bg-gold hover:bg-gold-hover text-surface'
                }`}
              >
                {isProcessingPayment ? <Loader2 className="animate-spin" size={20} /> : null}
                Get {upgradeModalContent.name.replace('Kova ', '')} for {upgradeModalContent.price}
              </button>

              <div className="text-[10px] text-text-muted space-y-1">
                <p>
                  No refunds. See our{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setUpgradeTargetTier(null);
                      setCurrentView(ViewState.REFUND);
                    }}
                    className="text-primary hover:underline"
                  >
                    Refund Policy
                  </button>{' '}
                  for details.
                </p>

                <p>
                  By subscribing you agree to our{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setUpgradeTargetTier(null);
                      setCurrentView(ViewState.TERMS);
                    }}
                    className="text-primary hover:underline"
                  >
                    Terms of Service
                  </button>{' '}
                  and{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setUpgradeTargetTier(null);
                      setCurrentView(ViewState.PRIVACY);
                    }}
                    className="text-primary hover:underline"
                  >
                    Privacy Policy
                  </button>
                  .
                </p>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 relative overflow-hidden">
          {currentView === ViewState.PAYMENT_SUCCESS && (
            <PaymentSuccess onContinue={handlePaymentSuccessContinue} />
          )}

          {currentView === ViewState.DISCOVER && (
            <SwipeDeck
              users={usersToSwipe}
              onSwipe={handleSwipe}
              remainingLikes={user.subscriptionTier === 'free' ? 30 - dailySwipes : null}
              userTier={user.subscriptionTier}
              onUpgrade={(tier) => setUpgradeTargetTier(tier)}
              onOutOfSwipes={() => setShowOutOfSwipesModal(true)}
              currentUserId={user.id}
              onRefresh={fetchUsersToSwipe}
              isLoading={isDeckLoading}
            />
          )}

          <div className={currentView === ViewState.MATCHES ? 'h-full w-full' : 'hidden'}>
            <ChatInterface
              matches={matches}
              currentUser={user}
              onStartVideoCall={(match, type) => {
                setActiveVideoMatch(match);
                setActiveCallType(type);
                setCurrentView(ViewState.VIDEO_ROOM);
              }}
              onConnectById={handleConnectById}
              onUnmatch={handleUnmatch}
              newMatchIds={newMatchIds}
              onMatchSeen={handleMatchSeen}
              onUpgrade={(tier) => setUpgradeTargetTier(tier)}
            />
          </div>

          {currentView === ViewState.VIDEO_ROOM && activeVideoMatch && (
            <VideoRoom
              match={activeVideoMatch}
              allMatches={matches}
              currentUser={user}
              callType={activeCallType}
              onEndCall={() => {
                setActiveVideoMatch(null);
                setCurrentView(ViewState.DASHBOARD);
              }}
              onReturnToDashboard={() => {
                setActiveVideoMatch(null);
                setCurrentView(ViewState.DASHBOARD);
              }}
            />
          )}

          {currentView === ViewState.DASHBOARD && (
            <Dashboard
              user={user}
              matches={matches}
              onUpgrade={(tier) => setUpgradeTargetTier(tier)}
              onJoinSession={(match) => {
                setActiveVideoMatch(match);
                setActiveCallType('video');
                setCurrentView(ViewState.VIDEO_ROOM);
              }}
              onNavigateLegal={handleNavigateLegal}
            />
          )}

          {currentView === ViewState.NOTES && <Notes user={user} />}

          {currentView === ViewState.PROFILE && (
            <div className="h-full p-4 md:p-6 overflow-y-auto">
              <ProfileEditor
                user={user}
                onSave={handleUpdateProfile}
                onUpgrade={(tier) => setUpgradeTargetTier(tier)}
                matches={matches}
                onDeleteAccount={handleDeleteAccount}
              />
            </div>
          )}
        </main>

        {currentView !== ViewState.VIDEO_ROOM && currentView !== ViewState.PAYMENT_SUCCESS && (
          <TimerOverlay
            onNotesClick={() => handleNavClick(ViewState.NOTES)}
            isNotesActive={currentView === ViewState.NOTES}
          />
        )}

        {currentView !== ViewState.VIDEO_ROOM && currentView !== ViewState.PAYMENT_SUCCESS && (
          <nav className="bg-white dark:bg-surface border-t border-black/5 dark:border-white/10 px-4 md:px-6 pb-[max(1rem,env(safe-area-inset-bottom))] shrink-0 z-50 transition-colors duration-300">
            <div className="flex md:justify-center md:gap-12 items-center h-20 w-full max-w-5xl mx-auto">
              {navItems.map((item: any) => {
                const count = !item.isLocked ? tabNotifications[item.id as ViewState] ?? 0 : 0;
                const isActive = currentView === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.id === 'KOVA_AI') return;
                      item.onClick ? item.onClick() : handleNavClick(item.id);
                    }}
                    title={item.isLocked ? 'Kova Pro • Coming Soon' : undefined}
                    disabled={item.id === 'KOVA_AI'}
                    className={`relative flex flex-col items-center justify-center flex-1 md:flex-none md:w-20 h-full gap-1.5 transition-all duration-200 ${
                      isActive
                        ? 'text-gold'
                        : 'text-gray-500 hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-200'
                    } ${item.isLocked ? 'hover:!text-gold group' : ''} ${
                      item.id === 'KOVA_AI' ? 'cursor-not-allowed opacity-80' : ''
                    }`}
                  >
                    {count > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center">
                        {count > 9 ? '9+' : count}
                      </span>
                    )}

                    {item.isLocked && (
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-3/4 bg-black/90 backdrop-blur-md border border-white/15 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-[0_0_10px_rgba(0,0,0,0.5)] z-20 whitespace-nowrap pointer-events-none">
                        <Lock size={8} className="text-zinc-400" />
                        <span className="text-[8px] font-bold text-white tracking-wider">
                          COMING SOON
                        </span>
                      </div>
                    )}

                    <item.icon size={20} className={isActive ? 'stroke-[2.5px]' : 'stroke-2'} />
                    <span className="text-[9px] md:text-[10px] font-bold tracking-widest flex items-center gap-0.5">
                      {item.label}
                    </span>
                  </button>
                );
              })}

              <button
                onClick={handleLogout}
                className="flex flex-col items-center justify-center flex-1 md:flex-none md:w-20 h-full gap-1.5 text-gray-500 hover:text-red-400 dark:text-gray-400 dark:hover:text-red-300 transition-all duration-200"
              >
                <LogOut size={20} strokeWidth={2} />
                <span className="text-[9px] md:text-[10px] font-bold tracking-widest">LOGOUT</span>
              </button>
            </div>
          </nav>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-[100] p-2.5 rounded-full bg-surface/80 border border-text-muted/20 backdrop-blur-md shadow-lg text-text-main hover:bg-surface hover:scale-105 transition-all"
        aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>
      {content}
    </>
  );
}

export default App;
