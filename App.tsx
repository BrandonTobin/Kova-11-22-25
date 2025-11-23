
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, MessageSquare, User as UserIcon, Search, LogOut, Sun, Moon, Loader2 } from 'lucide-react';
import { ViewState, User, Match } from './types';
import { supabase } from './supabaseClient';
import { DEFAULT_PROFILE_IMAGE } from './constants';

import ChatInterface from './components/ChatInterface';
import VideoRoom from './components/VideoRoom';
import Dashboard from './components/Dashboard';
import ProfileEditor from './components/ProfileEditor';
import LoginScreen from './components/LoginScreen';
import RegisterScreen from './components/RegisterScreen';
import SwipeDeck from './components/SwipeDeck';
import MatchPopup from './components/MatchPopup';

// --- CONFIGURATION ---
const STORAGE_KEY = 'kova_current_user_id';

// Helper to map Database snake_case to Frontend camelCase
const mapDbUserToAppUser = (dbUser: any): User => ({
  id: dbUser.id,
  kovaId: dbUser.kova_id,
  name: dbUser.name,
  email: dbUser.email,
  password: dbUser.password, // We are storing/reading raw password per instruction
  role: dbUser.role,
  industry: dbUser.industry,
  bio: dbUser.bio,
  imageUrl: (dbUser.image_url && !dbUser.image_url.startsWith('blob:')) ? dbUser.image_url : DEFAULT_PROFILE_IMAGE,
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
const mapAppUserToDbUser = (user: User) => {
  // Final safeguard: Ensure we never save a blob URL to the DB
  let safeImageUrl = user.imageUrl;
  if (!safeImageUrl || safeImageUrl.startsWith('blob:')) {
    safeImageUrl = DEFAULT_PROFILE_IMAGE;
  }

  const payload: any = {
    kova_id: user.kovaId,
    name: user.name,
    email: user.email,
    password: user.password, // Include password for storage
    role: user.role,
    industry: user.industry,
    bio: user.bio,
    image_url: safeImageUrl,
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
  };
  
  // Only include ID if it's set, otherwise let DB generate UUID
  if (user.id) {
    payload.id = user.id;
  }
  
  return payload;
};

// Supabase sends `timestamp without time zone` as a plain string (UTC).
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
  const [registerError, setRegisterError] = useState('');
  const [isLoading, setIsLoading] = useState(true); 
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

  // --- Session Persistence (LocalStorage) ---
  useEffect(() => {
    const restoreSession = async () => {
      setIsLoading(true); // Start loading
      try {
        const storedId = localStorage.getItem(STORAGE_KEY);
        
        if (storedId) {
          // Fetch user directly from public.users
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', storedId)
            .single();

          if (error) {
            console.error("Session restore failed:", error);
            localStorage.removeItem(STORAGE_KEY);
            setUser(null);
            setCurrentView(ViewState.LOGIN);
          } else if (data) {
            const appUser = mapDbUserToAppUser(data);
            setUser(appUser);
            // Load initial data
            await refreshMatches(appUser.id);
            setCurrentView(ViewState.DISCOVER);
          }
        } else {
          setCurrentView(ViewState.LOGIN);
        }
      } catch (err) {
        console.error("Unexpected session error:", err);
      } finally {
        setIsLoading(false); // Always stop loading
      }
    };

    restoreSession();
  }, []);


  // --- Data Loaders ---

  // 1. Fetch Matches
  const refreshMatches = async (currentUserId: string) => {
    try {
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
        const otherUserId = row.user1_id === currentUserId ? row.user2_id : row.user1_id;
        
        const { data: otherUserData } = await supabase
          .from('users')
          .select('*')
          .eq('id', otherUserId)
          .single();

        if (otherUserData) {
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
      const { data: swipes, error: swipeError } = await supabase
        .from('swipes')
        .select('swiped_id')
        .eq('swiper_id', currentUserId);
      
      if (swipeError) throw swipeError;
      
      const swipedIds = swipes?.map(s => s.swiped_id) || [];
      
      const { data: allUsers, error: usersError } = await supabase
        .from('users')
        .select('*');

      if (usersError) throw usersError;

      if (allUsers) {
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


  // --- Auth Handlers (Custom Table Auth) ---

  const handleSignIn = async (email: string, pass: string) => {
    setIsLoading(true);
    setLoginError('');
    
    try {
      // Direct query to public.users table
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('password', pass)
        .single();

      if (error || !data) {
        throw new Error("Invalid email or password.");
      }

      const appUser = mapDbUserToAppUser(data);
      
      // Persist session
      localStorage.setItem(STORAGE_KEY, appUser.id);
      
      // Set State
      setUser(appUser);
      await refreshMatches(appUser.id);
      setCurrentView(ViewState.DISCOVER);

    } catch (err: any) {
      console.error("Login error:", err);
      setLoginError(err.message || 'Login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (newUser: User) => {
    setIsLoading(true);
    setRegisterError('');
    
    try {
      // 1. Check for duplicate email manually
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', newUser.email)
        .maybeSingle();

      if (existingUser) {
        throw new Error("An account with this email already exists. Please sign in instead.");
      }

      // 2. Map to DB format (includes password)
      // Note: newUser.imageUrl is already sanitized/generated in RegisterScreen component
      const dbUserPayload = mapAppUserToDbUser(newUser);
      
      // Ensure we don't send an empty ID string, let DB generate UUID
      if (!dbUserPayload.id) delete dbUserPayload.id;

      const { data, error } = await supabase
        .from('users')
        .insert([dbUserPayload])
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error("Registration failed.");

      const createdUser = mapDbUserToAppUser(data);

      // Persist session
      localStorage.setItem(STORAGE_KEY, createdUser.id);

      // Set State
      setUser(createdUser);
      setCurrentView(ViewState.DISCOVER);
      
    } catch (err: any) {
      console.error("Registration error:", err);
      // Handle Supabase unique violation explicitly just in case race condition
      if (err.code === '23505') {
        setRegisterError("An account with this email already exists. Please sign in instead.");
      } else {
        setRegisterError(err.message || "Registration failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    // Clear Local Storage
    localStorage.removeItem(STORAGE_KEY);
    // Reset State
    setUser(null);
    setMatches([]);
    setDiscoverQueue([]);
    setCurrentView(ViewState.LOGIN);
    setIsLoading(false);
  };

  // --- Feature Handlers ---

  const handleUpdateProfile = async (updatedUser: User) => {
    try {
      const dbUser = mapAppUserToDbUser(updatedUser);
      // Keep password if it exists, otherwise remove it from update payload if empty
      const { id, ...updatePayload } = dbUser;
      
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
      const { data: existingMatch } = await supabase
        .from('matches')
        .select('*')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${targetUser.id}),and(user1_id.eq.${targetUser.id},user2_id.eq.${user.id})`)
        .single();

      if (existingMatch) {
         alert(`You are already matched with ${targetUser.name}!`);
         await refreshMatches(user.id);
         setCurrentView(ViewState.MATCHES);
         return;
      }

       const { error } = await supabase
         .from('matches')
         .insert([
           {
             user1_id: user.id,
             user2_id: targetUser.id
           }
         ]);

       if (error) throw error;

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
      setDiscoverQueue(prev => prev.filter(u => u.id !== swipedUser.id));

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

      if (direction === 'right') {
         const { data: matchRow, error: matchQueryError } = await supabase
            .from('matches')
            .select('*')
            .or(`and(user1_id.eq.${user.id},user2_id.eq.${swipedUser.id}),and(user1_id.eq.${swipedUser.id},user2_id.eq.${user.id})`)
            .single();
        
         if (!matchQueryError && matchRow) {
             setMatchedUser(swipedUser);
             await refreshMatches(user.id);
         }
      }

    } catch (err) {
      console.error("Swipe logic error:", err);
    }
  };

  // --- Security Recovery ---
  const handleGetSecurityQuestion = async (email: string): Promise<string | null> => {
    const { data } = await supabase
      .from('users')
      .select('security_question')
      .eq('email', email)
      .single();
    return data?.security_question || null;
  };

  const handleResetPassword = async (email: string, answer: string, newPass: string) => {
      // Verify security answer first
      const { data } = await supabase
        .from('users')
        .select('security_answer')
        .eq('email', email)
        .single();
      
      if (!data || data.security_answer.toLowerCase() !== answer.toLowerCase()) {
         return { success: false, message: 'Incorrect security answer.' };
      }

      // Update password directly in public.users
      const { error } = await supabase
        .from('users')
        .update({ password: newPass })
        .eq('email', email);

      if (error) return { success: false, message: error.message };
      return { success: true, message: 'Password reset successful! Please log in.' };
  };

  // --- Render ---

  const renderContent = () => {
    if (currentView === ViewState.LOGIN) {
      return (
        <LoginScreen 
          onLogin={handleSignIn} 
          onRegisterClick={() => {
            setRegisterError(''); // Reset error when switching
            setCurrentView(ViewState.REGISTER);
          }}
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
          onBack={() => {
            setRegisterError('');
            setCurrentView(ViewState.LOGIN);
          }}
          isLoading={isLoading}
          error={registerError}
          onClearError={() => setRegisterError('')}
        />
      );
    }

    // Protected Views
    if (!user) {
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
          onRegisterClick={() => {
             setRegisterError('');
             setCurrentView(ViewState.REGISTER);
          }}
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
