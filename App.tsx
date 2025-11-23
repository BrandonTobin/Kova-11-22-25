
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, MessageSquare, User as UserIcon, Search, LogOut, Sun, Moon, Loader2 } from 'lucide-react';
import { ViewState, User, Match } from './types';
import { supabase } from './supabaseClient';

import ChatInterface from './components/ChatInterface';
import VideoRoom from './components/VideoRoom';
import Dashboard from './components/Dashboard';
import ProfileEditor from './components/ProfileEditor';
import LoginScreen from './components/LoginScreen';
import RegisterScreen from './components/RegisterScreen';
import SwipeDeck from './components/SwipeDeck';
import MatchPopup from './components/MatchPopup';

/* 
  SUPABASE TABLES SCHEMA ASSUMPTION:
  
  users: { id, kova_id, email, name, role, ... } (NO PASSWORD COLUMN)
  matches: { id, user1_id, user2_id, created_at }
  messages: { id, match_id, sender_id, text, created_at }
  swipes: { id, swiper_id, swiped_id, direction, created_at }
*/

// Helper to map Database snake_case to Frontend camelCase
const mapDbUserToAppUser = (dbUser: any): User => ({
  id: dbUser.id,
  kovaId: dbUser.kova_id,
  name: dbUser.name,
  email: dbUser.email,
  password: '', // Password is now handled by Supabase Auth, not stored in public table
  role: dbUser.role,
  industry: dbUser.industry,
  bio: dbUser.bio,
  imageUrl: dbUser.image_url,
  tags: dbUser.tags || [],
  badges: dbUser.badges || [],
  dob: dbUser.dob,
  age: dbUser.age,
  gender: dbUser.gender,
  stage: dbUser.stage,
  location: {
  city: dbUser.city || '',
  state: dbUser.state || '',
},
  mainGoal: dbUser.main_goal,
  securityQuestion: dbUser.security_question,
  securityAnswer: dbUser.security_answer,
});

// Helper to map Frontend camelCase to Database snake_case
const mapAppUserToDbUser = (user: User) => ({
  // id is explicitly passed during insert to match Auth ID
  kova_id: user.kovaId,
  name: user.name,
  email: user.email,
  // password: user.password, // DO NOT store raw password in public table
  role: user.role,
  industry: user.industry,
  bio: user.bio,
  image_url: user.imageUrl,
  tags: user.tags,
  badges: user.badges,
  dob: user.dob,
  age: user.age,
  gender: user.gender,
  stage: user.stage,
  city: user.location?.city || '',
  state: user.location?.state || '',
  main_goal: user.mainGoal,
  security_question: user.securityQuestion,
  security_answer: user.securityAnswer,
});

// Supabase sends `timestamp without time zone` as a plain string (UTC).
// We force it to be treated as UTC by appending `Z`, then JS converts to local.
const parseSupabaseTimestamp = (value: string | null | undefined): Date => {
  if (!value) return new Date();
  const iso = typeof value === 'string' && !value.endsWith('Z') ? `${value}Z` : value;
  return new Date(iso);
};

const App: React.FC = () => {
  // --- State ---
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.LOGIN);
  
  // Data containers
  const [discoverQueue, setDiscoverQueue] = useState<User[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  
  // UI State
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(true); // Start true to check session
  const [activeVideoMatch, setActiveVideoMatch] = useState<Match | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [matchedUser, setMatchedUser] = useState<User | null>(null);

  // --- Theme Effect ---
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // --- Session Persistence & Auth Listener ---
  useEffect(() => {
    // 1. Check for active session on mount
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        } else {
          setCurrentView(ViewState.LOGIN);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Session check error:", error);
        setIsLoading(false);
      }
    };

    checkSession();

    // 2. Listen for auth changes (login, logout, auto-refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await fetchUserProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setCurrentView(ViewState.LOGIN);
        setMatches([]);
        setDiscoverQueue([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // --- Data Loaders ---

  // Helper to load the full profile from 'users' table based on Auth ID
  const fetchUserProfile = async (userId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      if (data) {
        const appUser = mapDbUserToAppUser(data);
        setUser(appUser);
        // Load app data
        await refreshMatches(appUser.id);
        // Only switch view if we are currently on Login (prevent resetting view on refresh if possible, though ViewState defaults to Login)
        setCurrentView(prev => prev === ViewState.LOGIN ? ViewState.DISCOVER : prev);
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
      // If auth exists but profile doesn't, might need to handle that edge case
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Fetch Matches
  const refreshMatches = async (currentUserId: string) => {
    try {
      // Fetch matches where current user is user1 OR user2
      // Using 'created_at' as the sort key
      const { data: matchRows, error } = await supabase
        .from('matches')
        .select('*')
        .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
        .order('created_at', { ascending: false });

      console.log('refreshMatches rows', matchRows);

      if (error) throw error;
      if (!matchRows) return;

      const fullMatches: Match[] = [];

      for (const row of matchRows) {
        // Determine who the "other" person is
        const otherUserId = row.user1_id === currentUserId ? row.user2_id : row.user1_id;
        
        // Fetch their profile
        const { data: otherUserData } = await supabase
          .from('users')
          .select('*')
          .eq('id', otherUserId)
          .single();

        if (otherUserData) {
          // Fetch last message for this match to show in sidebar
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('text, created_at')
            .eq('match_id', row.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          fullMatches.push({
            id: row.id,
            user: mapDbUserToAppUser(otherUserData),
            // Explicitly parse created_at to Date object
            timestamp: parseSupabaseTimestamp(lastMsg?.created_at || row.created_at),
            lastMessage: lastMsg?.text || "New Match! Say hello.",
            unread: 0 
          });
        }
      }
      
      setMatches(fullMatches);
    } catch (err) {
      console.error("Error loading matches:", err);
    }
  };

  // 2. Fetch Discover Queue
  const refreshDiscover = async (currentUserId: string) => {
    try {
      // 1. Get IDs of people I've already swiped on (left or right)
      const { data: swipes, error: swipeError } = await supabase
        .from('swipes')
        .select('swiped_id')
        .eq('swiper_id', currentUserId);
      
      if (swipeError) throw swipeError;
      
      const swipedIds = swipes?.map(s => s.swiped_id) || [];
      
      // 2. Fetch ALL users
      // We fetch all then filter locally to ensure robust exclusion
      const { data: allUsers, error: usersError } = await supabase
        .from('users')
        .select('*');

      if (usersError) throw usersError;

      if (allUsers) {
        // Filter in JS: Exclude self AND anyone in swipedIds
        const candidates = allUsers
            .filter(u => u.id !== currentUserId && !swipedIds.includes(u.id))
            .map(mapDbUserToAppUser);
            
        setDiscoverQueue(candidates);
      }
    } catch (err) {
      console.error("Error loading discover queue:", err);
    }
  };

  // --- Effects to trigger data loading ---

  useEffect(() => {
    if (!user) return;

    if (currentView === ViewState.MATCHES) {
      refreshMatches(user.id);
    }

    if (currentView === ViewState.DISCOVER) {
      refreshDiscover(user.id);
    }
  }, [currentView, user]);


  // --- Auth Handlers ---

  const handleSignIn = async (email: string, pass: string) => {
    setIsLoading(true);
    setLoginError('');
    
    try {
      // Use Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: pass,
      });

      if (error) throw error;

      // Success - The onAuthStateChange listener will handle fetching profile and updating state
      
    } catch (err: any) {
      console.error("Login error:", err);
      setLoginError(err.message || 'Invalid email or password.');
      setIsLoading(false);
    }
  };

  const handleRegister = async (newUser: User) => {
    setIsLoading(true);
    setLoginError('');
    
    try {
      // 1. Sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Registration failed: No user returned");

      // 2. Insert into public.users table
      // CRITICAL: Use the ID generated by Supabase Auth
      const dbUserPayload = {
        ...mapAppUserToDbUser(newUser),
        id: authData.user.id 
      };
      
      const { error: profileError } = await supabase
        .from('users')
        .insert([dbUserPayload]);

      if (profileError) {
        // If profile creation fails, we should ideally rollback auth, but for now just throw
        console.error("Profile creation failed:", profileError);
        throw new Error("Failed to create user profile.");
      }

      // 3. Fetch and set user (The Auth Listener will likely pick this up, but we can force it for speed)
      await fetchUserProfile(authData.user.id);
      setCurrentView(ViewState.DISCOVER);

    } catch (err: any) {
      console.error("Registration error:", err);
      setLoginError("Registration failed: " + (err.message || "Unknown error"));
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    // onAuthStateChange handles state clearing
    setIsLoading(false);
  };

  // --- Feature Handlers ---

  const handleUpdateProfile = async (updatedUser: User) => {
    try {
      const dbUser = mapAppUserToDbUser(updatedUser);
      // Remove sensitive/key fields from update just in case
      const { ...updatePayload } = dbUser;
      
      const { error } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', updatedUser.id);

      if (error) throw error;

      setUser(updatedUser); 
    } catch (err) {
      console.error("Profile update failed:", err);
      alert("Failed to save profile.");
    }
  };

  // Connect By ID via Supabase
  const handleConnectById = async (targetUser: User) => {
    if (!user) return;
    
    try {
      // 1. Check if match already exists
      const { data: existingMatch } = await supabase
        .from('matches')
        .select('*')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${targetUser.id}),and(user1_id.eq.${targetUser.id},user2_id.eq.${user.id})`)
        .single();

      if (existingMatch) {
         // Already matched, just switch view
         alert(`You are already matched with ${targetUser.name}!`);
         await refreshMatches(user.id);
         setCurrentView(ViewState.MATCHES);
         return;
      }

       // 2. Insert into matches table
       const { error } = await supabase
         .from('matches')
         .insert([
           {
             user1_id: user.id,
             user2_id: targetUser.id
             // created_at is auto-generated
           }
         ]);

       if (error) throw error;

       // 3. Refresh and go to matches
       await refreshMatches(user.id);
       setCurrentView(ViewState.MATCHES);

    } catch (err) {
      console.error("Failed to connect:", err);
      alert("Failed to create connection.");
    }
  };

  const handleSwipe = async (direction: 'left' | 'right', swipedUser: User) => {
    if (!user) return;

    try {
      // Optimistically remove from Discover
      setDiscoverQueue(prev => prev.filter(u => u.id !== swipedUser.id));

      // 1. Save swipe
      const { error: swipeError } = await supabase
        .from('swipes')
        .insert([{
          swiper_id: user.id,
          swiped_id: swipedUser.id,
          direction: direction
        }]);
      
      if (swipeError) {
        console.error("Error inserting swipe:", swipeError);
        return;
      }

      // 2. If right swipe, see if a match now exists (created by trigger)
      if (direction === 'right') {
         const { data: matchRow, error: matchQueryError } = await supabase
            .from('matches')
            .select('*')
            .or(`and(user1_id.eq.${user.id},user2_id.eq.${swipedUser.id}),and(user1_id.eq.${swipedUser.id},user2_id.eq.${user.id})`)
            .single();
        
         if (!matchQueryError && matchRow) {
             // A real match exists – show popup and refresh list
             setMatchedUser(swipedUser);
             await refreshMatches(user.id);
         }
      }

    } catch (err) {
      console.error("Swipe logic error:", err);
    }
  };

  // --- Security Recovery (Using Supabase Auth Reset) ---
  const handleGetSecurityQuestion = async (email: string): Promise<string | null> => {
    // Deprecated with Supabase Auth, but keeping for compat.
    // We won't actually use this for the reset flow anymore if we are strict about Auth.
    const { data } = await supabase
      .from('users')
      .select('security_question')
      .eq('email', email)
      .single();
    return data?.security_question || null;
  };

  const handleResetPassword = async (email: string, answer: string, newPass: string) => {
      // Standard Supabase Auth Password Reset
      // Note: This sends an email. We cannot change the password directly without a session.
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin, // Redirect back here
        });

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Password reset email sent! Please check your inbox.' };
      } catch (err) {
        return { success: false, message: 'Failed to send reset email.' };
      }
  };

  // --- Render ---

  const renderContent = () => {
    if (currentView === ViewState.LOGIN) {
      return (
        <LoginScreen 
          onLogin={handleSignIn} 
          onRegisterClick={() => setCurrentView(ViewState.REGISTER)}
          error={loginError}
          isLoading={isLoading}
          onGetSecurityQuestion={handleGetSecurityQuestion}
          onVerifyAndReset={handleResetPassword}
        />
      );
    }

    if (currentView === ViewState.REGISTER) {
      return (
        <RegisterScreen 
          onRegister={handleRegister}
          onBack={() => setCurrentView(ViewState.LOGIN)}
          isLoading={isLoading}
        />
      );
    }

    // Protected Views
    if (!user) {
       // Fallback loading state if session check is slow
       if (isLoading) {
          return (
            <div className="flex items-center justify-center h-screen bg-background">
               <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
          );
       }
       return (
        <LoginScreen 
          onLogin={handleSignIn} 
          onRegisterClick={() => setCurrentView(ViewState.REGISTER)}
          error={loginError}
          isLoading={isLoading}
        />
       );
    }

    return (
      <div className={`flex flex-col h-screen bg-background text-text-main transition-colors duration-300 overflow-hidden ${isDarkMode ? 'dark' : ''}`}>
        
        {matchedUser && (
            <MatchPopup 
               matchedUser={matchedUser} 
               currentUser={user} 
               onClose={() => setMatchedUser(null)} 
               onChat={() => {
                   setMatchedUser(null);
                   setCurrentView(ViewState.MATCHES);
               }} 
            />
        )}

        <div className="flex-1 overflow-hidden relative">
          {currentView === ViewState.DISCOVER && (
             <SwipeDeck users={discoverQueue} onSwipe={handleSwipe} />
          )}
          
          {currentView === ViewState.MATCHES && (
            <div className="h-full p-4 md:p-6">
               <ChatInterface 
                  matches={matches} 
                  currentUser={user}
                  onStartVideoCall={(m) => { setActiveVideoMatch(m); setCurrentView(ViewState.VIDEO_ROOM); }}
                  onConnectById={handleConnectById}
               />
            </div>
          )}
          
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
             <Dashboard user={user} />
          )}

          {currentView === ViewState.PROFILE && (
             <div className="h-full p-4 md:p-6 overflow-y-auto">
                <ProfileEditor user={user} onSave={handleUpdateProfile} />
             </div>
          )}
        </div>

        {/* Bottom Nav */}
        {currentView !== ViewState.VIDEO_ROOM && (
          <div className="h-20 bg-surface border-t border-white/5 flex justify-around items-center px-4 md:px-20 relative z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.2)]">
            <button 
              onClick={() => setCurrentView(ViewState.DISCOVER)}
              className={`flex flex-col items-center gap-1 transition-colors ${currentView === ViewState.DISCOVER ? 'text-gold scale-110' : 'text-text-muted hover:text-text-main'}`}
            >
              <Search size={24} />
              <span className="text-[10px] font-medium uppercase tracking-wide">Discover</span>
            </button>
            
            <button 
              onClick={() => setCurrentView(ViewState.MATCHES)}
              className={`flex flex-col items-center gap-1 transition-colors relative ${currentView === ViewState.MATCHES ? 'text-gold scale-110' : 'text-text-muted hover:text-text-main'}`}
            >
              <div className="relative">
                <MessageSquare size={24} />
              </div>
              <span className="text-[10px] font-medium uppercase tracking-wide">Matches</span>
            </button>
            
            <button 
              onClick={() => setCurrentView(ViewState.DASHBOARD)}
              className={`flex flex-col items-center gap-1 transition-colors ${currentView === ViewState.DASHBOARD ? 'text-gold scale-110' : 'text-text-muted hover:text-text-main'}`}
            >
              <LayoutDashboard size={24} />
              <span className="text-[10px] font-medium uppercase tracking-wide">Dashboard</span>
            </button>
            
            <button 
              onClick={() => setCurrentView(ViewState.PROFILE)}
              className={`flex flex-col items-center gap-1 transition-colors ${currentView === ViewState.PROFILE ? 'text-gold scale-110' : 'text-text-muted hover:text-text-main'}`}
            >
              <UserIcon size={24} />
              <span className="text-[10px] font-medium uppercase tracking-wide">Profile</span>
            </button>

            <button 
              onClick={handleSignOut}
              className="flex flex-col items-center gap-1 text-text-muted hover:text-red-400 transition-colors ml-4"
            >
              <LogOut size={24} />
              <span className="text-[10px] font-medium uppercase tracking-wide">Logout</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="fixed top-4 right-4 z-[100]">
         <button 
             onClick={() => setIsDarkMode(!isDarkMode)} 
             className="p-3 rounded-full bg-surface text-text-muted hover:text-gold border border-white/10 shadow-lg transition-colors"
             title="Toggle Theme"
           >
             {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
           </button>
      </div>
      {renderContent()}
    </>
  );
};

export default App;
