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
import { User, Match, ViewState, isProUser, SubscriptionTier } from './types';
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
  Notebook,
  Lock,
  Sparkles,
} from 'lucide-react';
import { DEFAULT_PROFILE_IMAGE, SUBSCRIPTION_PLANS } from './constants';
import TimerOverlay from './components/TimerOverlay';

// ✅ Your Supabase audio URL
const NOTIFICATION_SOUND_URL =
  'https://dbbtpkgiclzrsigdwdig.supabase.co/storage/v1/object/public/assets/notifications.mp3';

function App() {
  // --- State: Auth & User ---
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [showRegister, setShowRegister] = useState(false);

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

  // 🔹 Track which match rows should show "NEW"/"NEW MATCH!"
  const [newMatchIds, setNewMatchIds] = useState<string[]>([]);

  // --- State: UI/Navigation ---
  // Set default view to DISCOVER (always valid on first render)
  const [currentView, setCurrentView] = useState<ViewState>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('kova_current_view') as ViewState;
      // Only restore main navigable views to avoid stuck states (like Video Room without a match)
      if ([
        ViewState.DISCOVER, 
        ViewState.MATCHES, 
        ViewState.DASHBOARD, 
        ViewState.PROFILE, 
        ViewState.NOTES
      ].includes(stored)) {
        return stored;
      }
    }
    return ViewState.DISCOVER;
  });

  // Stores the tier we want to upsell (kova_plus or kova_pro)
  const [upgradeTargetTier, setUpgradeTargetTier] = useState<SubscriptionTier | null>(null);

  // --- State: Theme ---
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kova_theme');
      if (saved) return saved === 'dark';
      return document.documentElement.classList.contains('dark');
    }
    return true;
  });

  // --- State: Interaction ---
  const [newMatch, setNewMatch] = useState<User | null>(null);
  const [showMatchPopup, setShowMatchPopup] = useState(false);
  const [activeVideoMatch, setActiveVideoMatch] = useState<Match | null>(null);

  // --- State: Notification Sound ---
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);

  // --- State: Tab Notification Badges ---
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
      for (const v of list) {
        next[v] = (next[v] ?? 0) + 1;
      }
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
    checkSession();
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
      fetchMatches();
      fetchUsersToSwipe();
      const interval = setInterval(fetchMatches, 30000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  // 🔔 Realtime listener for unread message notifications
  useEffect(() => {
    if (!user || matches.length === 0) return;

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

          // Ignore messages we sent ourselves
          if (newMsg.sender_id === user.id) return;

          // Only care if the message belongs to one of this user's matches
          const isForMyMatch = matches.some((m) => m.id === newMsg.match_id);
          if (!isForMyMatch) return;

          // 👇 NEW: don't badge while user is already on MATCHES view
          if (currentView === ViewState.MATCHES) return;

          // 🔔 Bump MATCHES tab (badge only, sound handled in ChatInterface)
          addTabNotification([ViewState.MATCHES]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, matches.map((m) => m.id).join(','), currentView]); // 👈 added currentView here

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
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (data) {
        const mappedUser: User = {
          ...data,
          imageUrl: data.image_url || DEFAULT_PROFILE_IMAGE,
          kovaId: data.kova_id,
          mainGoal: data.main_goal,
          subscriptionTier: data.subscription_tier || 'free',
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

    const { data: swipes } = await supabase
      .from('swipes')
      .select('swiped_id')
      .eq('swiper_id', user.id);

    const swipedIds = new Set<string>(
      (swipes?.map((s: any) => s.swiped_id) as string[]) || []
    );
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

    const { data: candidates } = await supabase
      .from('users')
      .select('*')
      .limit(50);

    if (candidates) {
      const filtered = candidates
        .filter((c: any) => !swipedIds.has(c.id))
        .map((c: any) => ({
          ...c,
          imageUrl: c.image_url || DEFAULT_PROFILE_IMAGE,
          kovaId: c.kova_id,
          mainGoal: c.main_goal,
          location: { city: c.city, state: c.state },
          subscriptionTier: c.subscription_tier || 'free',
          proExpiresAt: c.pro_expires_at,
          experienceLevel: c.experience_level,
          communicationStyle: c.communication_style,
          skills: c.skills,
          lookingFor: c.looking_for,
          availability: c.availability,
          goalsList: c.goals_list,
          links: c.links,
          lastSeenAt: c.last_seen_at,
        }));
      setUsersToSwipe(filtered);
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
            subscriptionTier: otherUserRaw.subscription_tier || 'free',
            proExpiresAt: otherUserRaw.pro_expires_at,
            experienceLevel: otherUserRaw.experience_level,
            communicationStyle: otherUserRaw.communication_style,
            skills: otherUserRaw.skills,
            lookingFor: otherUserRaw.looking_for,
            availability: otherUserRaw.availability,
            goalsList: otherUserRaw.goals_list,
            links: otherUserRaw.links,
            lastSeenAt: otherUserRaw.last_seen_at,
          };

          let lastMessageText = null;
          let lastMessageAt = null;

          const { data: lastMsgData } = await supabase
            .from('messages')
            .select('text, created_at')
            .eq('match_id', m.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

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

      const validMatches = formattedMatchesResults.filter(
        (m): m is Match => m !== null
      );
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
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password: pass,
        });

      if (authError || !authData.user) {
        console.error('Supabase auth error:', authError);
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

      localStorage.setItem('kova_current_user_id', profile.id);
      await fetchUserProfile(profile.id);
      
      // Force navigation to Discover screen upon successful login
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

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password,
      });

      if (authError || !authData.user) {
        console.error('Supabase signUp error:', authError);
        setAuthError(authError?.message ?? 'Failed to create account.');
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
            .upload(fileName, profileImage, {
              cacheControl: '3600',
              upsert: true,
            });

          if (uploadError) {
            console.error('Failed to upload profile image:', uploadError);
          } else {
            const { data: publicUrlData } = supabase.storage
              .from('avatars')
              .getPublicUrl(fileName);

            if (publicUrlData) {
              finalImageUrl = publicUrlData.publicUrl;
            }
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
          },
        ])
        .select()
        .single();

      if (createError) throw createError;

      if (createdUser) {
        localStorage.setItem('kova_current_user_id', createdUser.id);
        await fetchUserProfile(createdUser.id);
        // Force navigation to Discover screen upon successful registration
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
    localStorage.removeItem('kova_current_user_id');
    localStorage.removeItem('kova_current_view');
    setUser(null);
    setCurrentView(ViewState.LOGIN);
  };

  // -----------------------------
  // Swipes / Matches
  // -----------------------------
  const handleSwipe = async (direction: 'left' | 'right', swipedUser: User) => {
    if (!user) return;

    if (direction === 'right') {
      setDailySwipes((prev) => prev + 1);
    }

    const { error: swipeError } = await supabase.from('swipes').insert([
      {
        swiper_id: user.id,
        swiped_id: swipedUser.id,
        direction: direction,
      },
    ]);

    if (swipeError) {
      console.error('Error inserting swipe:', swipeError);
      return;
    }

    if (direction !== 'right') return;

    const { data: reciprocal, error: reciprocalError } = await supabase
      .from('swipes')
      .select('id')
      .eq('swiper_id', swipedUser.id)
      .eq('swiped_id', user.id)
      .eq('direction', 'right')
      .maybeSingle();

    if (reciprocalError) {
      console.error('Error checking reciprocal swipe:', reciprocalError);
      return;
    }

    if (!reciprocal) return;

    const { data: existingMatch, error: existingError } = await supabase
      .from('matches')
      .select('id')
      .or(
        `and(user1_id.eq.${user.id},user2_id.eq.${swipedUser.id}),and(user1_id.eq.${swipedUser.id},user2_id.eq.${user.id})`
      )
      .maybeSingle();

    if (existingError) {
      console.error('Error checking existing match:', existingError);
      return;
    }

    // If match already exists, just show popup + mark as "new"
    if (existingMatch) {
      setNewMatch(swipedUser);
      setShowMatchPopup(true);
      playNotificationSound();
      addTabNotification([ViewState.MATCHES, ViewState.DASHBOARD]);

      setNewMatchIds((prev) =>
        prev.includes(existingMatch.id) ? prev : [...prev, existingMatch.id]
      );

      fetchMatches();
      return;
    }

    // Otherwise create a new match
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

      setNewMatchIds((prev) =>
        prev.includes(matchData.id) ? prev : [...prev, matchData.id]
      );

      fetchMatches();
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
          .upload(fileName, profileImage, {
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) {
          console.error('Failed to upload profile image:', uploadError);
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);

          if (publicUrlData) {
            finalImageUrl = publicUrlData.publicUrl;
          }
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
        subscription_tier: updatedUser.subscriptionTier, // In case we upgrade locally before refresh
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
      // new manual connection should also show as "new"
      setNewMatchIds((prev) =>
        prev.includes(data.id) ? prev : [...prev, data.id]
      );
      fetchMatches();
      setCurrentView(ViewState.MATCHES);
    } else if (error) {
      alert('Failed to connect.');
    }
  };

  const handleUnmatch = async (matchId: string) => {
    try {
      console.log('[UNMATCH] Starting unmatch for matchId =', matchId);

      // 1) Delete all messages that belong to this match
      const { error: msgError } = await supabase
        .from('messages')
        .delete()
        .eq('match_id', matchId);

      if (msgError) {
        console.error('[UNMATCH] Failed to delete messages for match:', msgError);
        // we don't return here – we still attempt to delete the match row itself
      } else {
        console.log('[UNMATCH] Messages deleted for matchId =', matchId);
      }

      // 2) Delete the match row itself
      const { error: matchError } = await supabase
        .from('matches')
        .delete()
        .eq('id', matchId);

      if (matchError) {
        console.error('[UNMATCH] Failed to delete match row:', matchError);
        alert('Failed to unmatch. Please check the console for details.');
        return;
      }

      console.log('[UNMATCH] Match row deleted for matchId =', matchId);

      // 3) Update local React state so it disappears immediately from UI
      setMatches((prev) => prev.filter((m) => m.id !== matchId));
      setNewMatchIds((prev) => prev.filter((id) => id !== matchId));
    } catch (err) {
      console.error('[UNMATCH] Unexpected error while unmatching:', err);
      alert('Unexpected error while unmatching. Please try again.');
    }
  };

  // 🔹 called from ChatInterface when user opens a match that had the "NEW" tag
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
    { 
      id: 'KOVA_AI', 
      label: 'KOVA AI', 
      icon: Sparkles,
      isLocked: true,
      onClick: () => {} // Disable click functionality
    },
    { id: ViewState.PROFILE, label: 'PROFILE', icon: UserIcon },
  ];

  const handleNavClick = (view: ViewState) => {
    setCurrentView(view);
    clearTabNotification(view);
  };

  // Persist currentView to localStorage whenever it changes
  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem('kova_current_view', currentView);
    } catch (e) {
      console.warn('Failed to persist current view', e);
    }
  }, [currentView, user?.id]);

  // -----------------------------
  // Subscription Upgrading
  // -----------------------------
  const handleUpgradeSubscription = (tier: SubscriptionTier) => {
    // In a real app, integrate Stripe/Supabase payment here.
    // For now, simulate upgrade by updating local user state.
    if (!user) return;
    
    // Simulating API call
    setTimeout(() => {
      const updatedUser = { ...user, subscriptionTier: tier };
      setUser(updatedUser);
      setUpgradeTargetTier(null); // Close modal
      alert(`Successfully upgraded to ${SUBSCRIPTION_PLANS[tier].name}!`);
    }, 500);
  };

  // -----------------------------
  // Render
  // -----------------------------
  let content;

  if (isLoading && !user) {
    content = (
      <div className="h-screen w-full bg-background flex flex-col items-center justify-center text-text-main">
        <div className="w-16 h-16 border-4 border-gold border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="animate-pulse">Loading Kova...</p>
      </div>
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
        />
      );
    } else {
      content = (
        <LoginScreen
          onLogin={handleLogin}
          onRegisterClick={() => setShowRegister(true)}
          error={authError}
          isLoading={isLoading}
        />
      );
    }
  } else {
    // Helper to get modal content based on tier
    const upgradeModalContent = upgradeTargetTier ? SUBSCRIPTION_PLANS[upgradeTargetTier] : null;

    content = (
      <div className="h-screen w-full bg-background flex flex-col overflow-hidden">
        {/* Global Modals */}
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

        {upgradeTargetTier && upgradeModalContent && (
          <div 
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setUpgradeTargetTier(null)}
          >
            <div 
              className="bg-surface max-w-md w-full p-8 rounded-3xl border border-gold/30 text-center shadow-2xl relative animate-in fade-in zoom-in duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setUpgradeTargetTier(null)}
                className="absolute top-4 right-4 text-text-muted hover:text-white"
              >
                <X />
              </button>
              <div className="w-16 h-16 bg-gradient-to-br from-gold to-amber-600 rounded-full mx-auto mb-6 flex items-center justify-center text-white shadow-lg">
                <Crown size={32} fill="currentColor" />
              </div>
              <h2 className="text-2xl font-bold text-text-main mb-2">
                Upgrade to {upgradeModalContent.name}
              </h2>
              <p className="text-text-muted mb-6">
                {upgradeModalContent.description}
              </p>
              <button
                onClick={() => handleUpgradeSubscription(upgradeTargetTier)}
                className="w-full py-3 bg-gold text-surface font-bold rounded-xl hover:bg-gold-hover transition-colors shadow-lg"
              >
                Get {upgradeModalContent.name.replace('Kova ', '')} for {upgradeModalContent.price}
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 relative overflow-hidden">
          {currentView === ViewState.DISCOVER && (
            <SwipeDeck
              users={usersToSwipe}
              onSwipe={handleSwipe}
              remainingLikes={user.subscriptionTier === 'free' ? 30 - dailySwipes : null}
              userTier={user.subscriptionTier}
              onUpgrade={(tier) => setUpgradeTargetTier(tier)}
            />
          )}

          {currentView === ViewState.MATCHES && (
            <ChatInterface
              matches={matches}
              currentUser={user}
              onStartVideoCall={(match) => {
                setActiveVideoMatch(match);
                setCurrentView(ViewState.VIDEO_ROOM);
              }}
              onConnectById={handleConnectById}
              onUnmatch={handleUnmatch}
              newMatchIds={newMatchIds}
              onMatchSeen={handleMatchSeen}
            />
          )}

          {currentView === ViewState.VIDEO_ROOM && activeVideoMatch && (
            <VideoRoom
              match={activeVideoMatch}
              allMatches={matches}
              currentUser={user}
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
              />
            </div>
          )}
        </main>

        {/* Floating per-user timer overlay + Notes Pill */}
        {currentView !== ViewState.VIDEO_ROOM && (
          <TimerOverlay 
            onNotesClick={() => handleNavClick(ViewState.NOTES)}
            isNotesActive={currentView === ViewState.NOTES}
          />
        )}

        {/* Bottom Navigation Bar - Visible on all screens EXCEPT Video Room */}
        {currentView !== ViewState.VIDEO_ROOM && (
          <nav className="bg-white dark:bg-surface border-t border-black/5 dark:border-white/10 px-4 md:px-6 pb-safe shrink-0 z-50 transition-colors duration-300">
            <div className="flex justify-between md:justify-center md:gap-12 items-center h-20 w-full max-w-5xl mx-auto">
              {navItems.map((item: any) => {
                const count = !item.isLocked ? (tabNotifications[item.id as ViewState] ?? 0) : 0;
                const isActive = currentView === item.id;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.id === 'KOVA_AI') return; // Disable click for locked item
                      item.onClick ? item.onClick() : handleNavClick(item.id);
                    }}
                    title={item.isLocked ? "Kova Pro • Coming Soon" : undefined}
                    disabled={item.id === 'KOVA_AI'}
                    className={`relative flex flex-col items-center justify-center w-16 md:w-20 h-full gap-1.5 transition-all duration-200 ${
                      isActive
                        ? 'text-gold'
                        : 'text-gray-500 hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-200'
                    } ${item.isLocked ? 'hover:!text-gold group' : ''} ${item.id === 'KOVA_AI' ? 'cursor-not-allowed opacity-80' : ''}`}
                  >
                    {count > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center">
                        {count > 9 ? '9+' : count}
                      </span>
                    )}

                    {/* NEW: Coming Soon Pill for Locked Items - CENTERED OVER ICON */}
                    {item.isLocked && (
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-3/4 bg-black/90 backdrop-blur-md border border-white/15 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-[0_0_10px_rgba(0,0,0,0.5)] z-20 whitespace-nowrap pointer-events-none">
                         <Lock size={8} className="text-zinc-400" />
                         <span className="text-[8px] font-bold text-white tracking-wider">COMING SOON</span>
                      </div>
                    )}

                    {/* icon on top */}
                    <item.icon
                      size={20}
                      className={isActive ? 'stroke-[2.5px]' : 'stroke-2'}
                    />

                    {/* label below - always visible, NO LOCK ICON next to text */}
                    <span className="text-[9px] md:text-[10px] font-bold tracking-widest flex items-center gap-0.5">
                      {item.label}
                    </span>
                  </button>
                );
              })}

              {/* Logout button */}
              <button
                onClick={handleLogout}
                className="flex flex-col items-center justify-center w-16 md:w-20 h-full gap-1.5 text-gray-500 hover:text-red-400 dark:text-gray-400 dark:hover:text-red-300 transition-all duration-200"
              >
                <LogOut size={20} strokeWidth={2} />
                <span className="text-[9px] md:text-[10px] font-bold tracking-widest">
                  LOGOUT
                </span>
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