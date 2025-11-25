import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import LoginScreen from './components/LoginScreen';
import RegisterScreen from './components/RegisterScreen';
import SwipeDeck from './components/SwipeDeck';
import MatchPopup from './components/MatchPopup';
import ChatInterface from './components/ChatInterface';
import VideoRoom from './components/VideoRoom';
import Dashboard from './components/Dashboard';
import ProfileEditor from './components/ProfileEditor';
import { User, Match, ViewState, isProUser } from './types';
import { LayoutGrid, MessageSquare, Users, User as UserIcon, LogOut, X, Crown, Search, Sun, Moon } from 'lucide-react';
import { DEFAULT_PROFILE_IMAGE } from './constants';

function App() {
  // --- State: Auth & User ---
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [showRegister, setShowRegister] = useState(false);

  // --- State: App Data ---
  const [usersToSwipe, setUsersToSwipe] = useState<User[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [swipedUserIds, setSwipedUserIds] = useState<Set<string>>(new Set());
  const [dailySwipes, setDailySwipes] = useState(0);

  // --- State: UI/Navigation ---
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DISCOVER);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
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

  // --- 1. Initialize & Auth Check ---
  useEffect(() => {
    checkSession();
  }, []);

  // --- Theme Effect ---
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

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  // --- 2. Data Fetching on User Change ---
  useEffect(() => {
    if (user) {
      fetchMatches();
      fetchUsersToSwipe();
    }
  }, [user?.id]);

  const checkSession = async () => {
    setIsLoading(true);
    try {
      // Check Local Storage for persistent ID
      const storedId = localStorage.getItem('kova_current_user_id');
      if (storedId) {
        await fetchUserProfile(storedId);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Session check failed", error);
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
          // Map image_url from DB to imageUrl in app. Fallback only if null.
          imageUrl: data.image_url || DEFAULT_PROFILE_IMAGE,
          kovaId: data.kova_id,
          mainGoal: data.main_goal,
          subscriptionTier: data.subscription_tier || 'free',
          proExpiresAt: data.pro_expires_at,
          location: { city: data.city || '', state: data.state || '' },
          // Map snake_case DB fields to camelCase
          experienceLevel: data.experience_level,
          communicationStyle: data.communication_style,
          skills: data.skills,
          lookingFor: data.looking_for,
          availability: data.availability,
          goalsList: data.goals_list,
          links: data.links,
          securityQuestion: '', 
          securityAnswer: '' 
        };
        setUser(mappedUser);
        // Restore last view if possible, or default to DISCOVER
        setCurrentView(ViewState.DISCOVER);
      }
    } catch (error) {
      console.error("Error fetching profile", error);
      // If fetch fails (e.g. user deleted), clear session
      localStorage.removeItem('kova_current_user_id');
      setUser(null);
    }
  };

  const fetchUsersToSwipe = async () => {
    if (!user) return;
    
    // Fetch IDs user has already swiped on
    const { data: swipes } = await supabase
      .from('swipes')
      .select('swiped_id')
      .eq('swiper_id', user.id);
      
    const swipedIds = new Set<string>((swipes?.map((s: any) => s.swiped_id) as string[]) || []);
    swipedIds.add(user.id); // Don't show self
    setSwipedUserIds(swipedIds);

    // Count daily swipes for limit
    const today = new Date();
    today.setHours(0,0,0,0);
    const { count } = await supabase
        .from('swipes')
        .select('*', { count: 'exact', head: true })
        .eq('swiper_id', user.id)
        .gte('created_at', today.toISOString());
    
    setDailySwipes(count || 0);

    // Fetch candidates
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
            links: c.links
        }));
      setUsersToSwipe(filtered);
    }
  };

  const fetchMatches = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('matches')
      .select(`
        id,
        created_at,
        user1:user1_id(*),
        user2:user2_id(*)
      `)
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

    if (data) {
      const formattedMatches: Match[] = data
        .map((m: any) => {
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
              links: otherUserRaw.links
          };

          return {
              id: m.id,
              user: otherUser,
              timestamp: new Date(m.created_at),
              unread: 0
          };
        })
        .filter((m): m is Match => m !== null);

      setMatches(formattedMatches);
    }
  };

  // --- Actions ---

  // LOGIN: now uses Supabase Auth instead of querying users.password
  const handleLogin = async (email: string, pass: string) => {
    setIsLoading(true);
    setAuthError('');

    try {
      // 1) Auth against Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });

      if (authError || !authData.user) {
        console.error('Supabase auth error:', authError);
        setAuthError('Invalid email or password.');
        setIsLoading(false);
        return;
      }

      // 2) Fetch profile row from public.users by email
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

      // 3) Store id and hydrate state
      localStorage.setItem('kova_current_user_id', profile.id);
      await fetchUserProfile(profile.id);

      setIsLoading(false);
    } catch (err) {
      console.error("Login error:", err);
      setAuthError('An unexpected error occurred.');
      setIsLoading(false);
    }
  };

  // REGISTER: creates Supabase auth user, uploads image to Storage, then profile row
  const handleRegister = async (newUser: User, profileImage?: File) => {
    setIsLoading(true);
    setAuthError('');

    try {
      // 1) See if a profile with this email already exists (safety check)
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

      // 2) Create the auth user
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

      // 3) Handle Profile Picture Upload
      // newUser.imageUrl comes from RegisterScreen with the ui-avatars fallback.
      // We overwrite it ONLY if a file is successfully uploaded.
      let finalImageUrl = newUser.imageUrl; 
      
      if (profileImage && authData.user) {
        try {
          const fileExt = profileImage.name.split('.').pop() || 'jpg';
          const fileName = `profiles/${authData.user.id}-${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, profileImage, {
              cacheControl: '3600',
              upsert: true
            });

          if (uploadError) {
             console.error("Failed to upload profile image:", uploadError);
             // On fail, finalImageUrl remains the fallback
          } else {
             const { data: publicUrlData } = supabase.storage
               .from('avatars')
               .getPublicUrl(fileName);
             
             if (publicUrlData) {
               finalImageUrl = publicUrlData.publicUrl;
             }
          }
        } catch (uploadErr) {
           console.error("Exception during image upload:", uploadErr);
        }
      }

      // 4) Insert profile row into public.users
      const { data: createdUser, error: createError } = await supabase
        .from('users')
        .insert([{
           id: authData.user.id, // tie profile to auth user
           kova_id: newUser.kovaId,
           email: newUser.email,
           name: newUser.name,
           role: newUser.role,
           industry: newUser.industry,
           bio: newUser.bio,
           image_url: finalImageUrl, // Use the real uploaded URL (or fallback)
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
           subscription_tier: 'free'
        }])
        .select()
        .single();

      if (createError) throw createError;

      if (createdUser) {
        localStorage.setItem('kova_current_user_id', createdUser.id);
        await fetchUserProfile(createdUser.id);
      }

      setIsLoading(false);
    } catch (err: any) {
      console.error("Registration error:", err);
      setAuthError(err.message || "Registration failed.");
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
    setUser(null);
    setCurrentView(ViewState.LOGIN);
  };

  // MUTUAL-ONLY MATCHES: popup only when *both* users have swiped right
  const handleSwipe = async (direction: 'left' | 'right', swipedUser: User) => {
    if (!user) return;

    // Don't touch usersToSwipe here – SwipeDeck controls the visible card

    // Increment daily swipes on right-swipe
    if (direction === 'right') {
      setDailySwipes(prev => prev + 1);
    }

    // Record swipe
    const { error: swipeError } = await supabase.from('swipes').insert([{
      swiper_id: user.id,
      swiped_id: swipedUser.id,
      direction: direction
    }]);

    if (swipeError) {
      console.error('Error inserting swipe:', swipeError);
      return;
    }

    // Only proceed to match logic on right swipes
    if (direction !== 'right') return;

    // 1) Check if the other user has already swiped right on you
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

    // No reciprocal right swipe yet → no match
    if (!reciprocal) return;

    // 2) Check if a match already exists in either direction
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

    // If match already exists, just show popup so it feels responsive
    if (existingMatch) {
      setNewMatch(swipedUser);
      setShowMatchPopup(true);
      fetchMatches();
      return;
    }

    // 3) Create a new match row
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
      // Show popup + refresh list
      setNewMatch(swipedUser);
      setShowMatchPopup(true);
      fetchMatches();
    }
  };

  // UPDATE PROFILE: Uploads new image if present, then updates DB
  const handleUpdateProfile = async (updatedUser: User, profileImage?: File) => {
    if (!user) return;
    setIsLoading(true);


    let finalImageUrl = user.imageUrl; // Default to current URL

    // If user selected a new file, upload it
    if (profileImage) {
        try {
            const fileExt = profileImage.name.split('.').pop() || 'jpg';
            // Use same naming convention as registration
            const fileName = `profiles/${user.id}-${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, profileImage, {
                cacheControl: '3600',
                upsert: true
            });

            if (uploadError) {
                console.error("Failed to upload profile image:", uploadError);
            } else {
                const { data: publicUrlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);
                
                if (publicUrlData) {
                    finalImageUrl = publicUrlData.publicUrl;
                }
            }
        } catch (uploadErr) {
            console.error("Exception during image upload:", uploadErr);
        }
    } else {
        // No new file. Ensure we don't accidentally save a blob/base64 preview URL if passed.
        // We only want to keep the existing URL if it's not a local preview.
        if (updatedUser.imageUrl && !updatedUser.imageUrl.startsWith('blob:') && !updatedUser.imageUrl.startsWith('data:')) {
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
        image_url: finalImageUrl, // Persist the real URL
        tags: updatedUser.tags,
        stage: updatedUser.stage,
        main_goal: updatedUser.mainGoal,
        city: updatedUser.location.city,
        state: updatedUser.location.state,
        // Update new fields
        experience_level: updatedUser.experienceLevel,
        communication_style: updatedUser.communicationStyle,
        skills: updatedUser.skills,
        looking_for: updatedUser.lookingFor,
        availability: updatedUser.availability,
        goals_list: updatedUser.goalsList,
        links: updatedUser.links
      })
      .eq('id', user.id);

    if (!error) {
      // Optimistically update local state with the new final URL
      setUser({ ...updatedUser, imageUrl: finalImageUrl });
    } else {
      console.error("Profile update failed:", error);
    }
    setIsLoading(false);
  };

  const handleConnectById = async (targetUser: User) => {
     if (!user) return;
     const existing = matches.find(m => m.user.id === targetUser.id);
     if (existing) {
        alert("You are already matched!");
        return;
     }
     const { error } = await supabase
        .from('matches')
        .insert([{ user1_id: user.id, user2_id: targetUser.id }]);
        
     if (!error) {
        fetchMatches();
        setCurrentView(ViewState.MATCHES);
     } else {
        alert("Failed to connect.");
     }
  };

  const handleUnmatch = async (matchId: string) => {
     const { error } = await supabase.from('matches').delete().eq('id', matchId);
     if (!error) {
        setMatches(prev => prev.filter(m => m.id !== matchId));
     }
  };

  // --- Navigation Configuration ---
  const navItems = [
    { id: ViewState.DISCOVER, label: 'DISCOVER', icon: Search },
    { id: ViewState.MATCHES, label: 'MATCHES', icon: MessageSquare },
    { id: ViewState.DASHBOARD, label: 'DASHBOARD', icon: LayoutGrid },
    { id: ViewState.PROFILE, label: 'PROFILE', icon: UserIcon },
  ];

  // --- Render Views Determination ---
  let content;
  
  if (isLoading && !user) {
    content = (
      <div className="h-screen w-full bg-background flex flex-col items-center justify-center text-text-main">
        <div className="w-16 h-16 border-4 border-gold border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="animate-pulse">Loading Kova...</p>
      </div>
    );
  } else if (!user) {
    if (showRegister) {
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
    content = (
      <div className="h-screen w-full bg-background flex flex-col overflow-hidden">
        {/* Global Modals */}
        {showMatchPopup && newMatch && (
          <MatchPopup 
            matchedUser={newMatch} 
            currentUser={user}
            onClose={() => { setShowMatchPopup(false); setNewMatch(null); }}
            onChat={() => { 
              setShowMatchPopup(false); 
              setNewMatch(null);
              setCurrentView(ViewState.MATCHES); 
            }}
          />
        )}

        {showUpgradeModal && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface max-w-md w-full p-8 rounded-3xl border border-gold/30 text-center shadow-2xl relative animate-in fade-in zoom-in duration-200">
                <button onClick={() => setShowUpgradeModal(false)} className="absolute top-4 right-4 text-text-muted hover:text-white"><X /></button>
                <div className="w-16 h-16 bg-gradient-to-br from-gold to-amber-600 rounded-full mx-auto mb-6 flex items-center justify-center text-white shadow-lg">
                  <Crown size={32} fill="currentColor" />
                </div>
                <h2 className="text-2xl font-bold text-text-main mb-2">Upgrade to Kova Pro</h2>
                <p className="text-text-muted mb-6">Unlock unlimited swipes, deep analytics, and AI insights.</p>
                <button 
                  onClick={() => setShowUpgradeModal(false)} 
                  className="w-full py-3 bg-gold text-surface font-bold rounded-xl hover:bg-gold-hover transition-colors shadow-lg"
                >
                  Get Pro for $7.99/mo
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
                  remainingLikes={isProUser(user) ? null : 30 - dailySwipes}
                  isPro={isProUser(user)}
                  onUpgrade={() => setShowUpgradeModal(true)}
              />
            )}

            {currentView === ViewState.MATCHES && (
              <ChatInterface 
                  matches={matches} 
                  currentUser={user} 
                  onStartVideoCall={(match) => { setActiveVideoMatch(match); setCurrentView(ViewState.VIDEO_ROOM); }}
                  onConnectById={handleConnectById}
                  onUnmatch={handleUnmatch}
              />
            )}

            {/* Video Room takes over full screen within main, nav is hidden via conditional rendering below */}
            {currentView === ViewState.VIDEO_ROOM && activeVideoMatch && (
              <VideoRoom 
                match={activeVideoMatch} 
                allMatches={matches} 
                currentUser={user} 
                onEndCall={() => { setActiveVideoMatch(null); setCurrentView(ViewState.DASHBOARD); }} 
                onReturnToDashboard={() => { setActiveVideoMatch(null); setCurrentView(ViewState.DASHBOARD); }} 
              />
            )}

            {currentView === ViewState.DASHBOARD && (
              <Dashboard user={user} matches={matches} onUpgrade={() => setShowUpgradeModal(true)} />
            )}

            {currentView === ViewState.PROFILE && (
              <div className="h-full p-4 md:p-6 overflow-y-auto">
                  <ProfileEditor 
                    user={user}
                    matches={matches}
                    onSave={handleUpdateProfile}
                    onUpgrade={() => setShowUpgradeModal(true)}
                  />
              </div>
            )}
        </main>

        {/* Bottom Navigation Bar - Visible on all screens EXCEPT Video Room */}
        {currentView !== ViewState.VIDEO_ROOM && (
          <nav className="bg-white dark:bg-surface border-t border-black/5 dark:border-white/10 px-6 pb-safe shrink-0 z-50 transition-colors duration-300">
            <div className="flex justify-between items-center h-20 w-full max-w-5xl mx-auto">
                {navItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setCurrentView(item.id)}
                    className={`flex flex-col items-center justify-center w-20 h-full gap-1.5 transition-all duration-200 ${currentView === item.id ? 'text-gold' : 'text-gray-500 hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-200'}`}
                  >
                    <item.icon size={24} className={currentView === item.id ? 'stroke-[2.5px]' : 'stroke-2'} />
                    <span className="text-[10px] font-bold tracking-widest">{item.label}</span>
                  </button>
                ))}
                <button 
                  onClick={handleLogout}
                  className="flex flex-col items-center justify-center w-20 h-full gap-1.5 text-gray-500 hover:text-red-400 dark:text-gray-400 dark:hover:text-red-300 transition-all duration-200"
                >
                  <LogOut size={24} strokeWidth={2} />
                  <span className="text-[10px] font-bold tracking-widest">LOGOUT</span>
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
        aria-label={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
      >
        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>
      {content}
    </>
  );
}

export default App;
