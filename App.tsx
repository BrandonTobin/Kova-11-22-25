
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
import { LayoutGrid, MessageSquare, Users, User as UserIcon, LogOut, X, Crown, Search } from 'lucide-react';
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

  // --- State: Interaction ---
  const [newMatch, setNewMatch] = useState<User | null>(null);
  const [showMatchPopup, setShowMatchPopup] = useState(false);
  const [activeVideoMatch, setActiveVideoMatch] = useState<Match | null>(null);

  // --- 1. Initialize & Auth Check ---
  useEffect(() => {
    checkSession();
  }, []);

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
          imageUrl: data.image_url || DEFAULT_PROFILE_IMAGE,
          kovaId: data.kova_id,
          mainGoal: data.main_goal,
          subscriptionTier: data.subscription_tier || 'free',
          proExpiresAt: data.pro_expires_at,
          location: { city: data.city || '', state: data.state || '' },
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
            proExpiresAt: c.pro_expires_at
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
              proExpiresAt: otherUserRaw.pro_expires_at
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

  const handleLogin = async (email: string, pass: string) => {
    setIsLoading(true);
    setAuthError('');
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('password', pass)
        .single();

      if (error || !data) {
        setAuthError('Invalid email or password.');
        setIsLoading(false);
        return;
      }

      localStorage.setItem('kova_current_user_id', data.id);
      await fetchUserProfile(data.id);

    } catch (err) {
      console.error("Login error:", err);
      setAuthError('An unexpected error occurred.');
      setIsLoading(false);
    }
  };

  const handleRegister = async (newUser: User) => {
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

      const { data: createdUser, error: createError } = await supabase
        .from('users')
        .insert([{
           kova_id: newUser.kovaId,
           email: newUser.email,
           password: newUser.password,
           name: newUser.name,
           role: newUser.role,
           industry: newUser.industry,
           bio: newUser.bio,
           image_url: newUser.imageUrl,
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

    } catch (err: any) {
      console.error("Registration error:", err);
      setAuthError(err.message || "Registration failed.");
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('kova_current_user_id');
    setUser(null);
    setCurrentView(ViewState.LOGIN);
  };

  const handleSwipe = async (direction: 'left' | 'right', swipedUser: User) => {
    if (!user) return;

    setUsersToSwipe(prev => prev.filter(u => u.id !== swipedUser.id));
    if (direction === 'right') {
        setDailySwipes(prev => prev + 1);
    }

    await supabase.from('swipes').insert([{
      swiper_id: user.id,
      swiped_id: swipedUser.id,
      direction: direction
    }]);

    if (direction === 'right') {
      const { data: reciprocal } = await supabase
        .from('swipes')
        .select('*')
        .eq('swiper_id', swipedUser.id)
        .eq('swiped_id', user.id)
        .eq('direction', 'right')
        .single();

      if (reciprocal) {
        const { data: matchData, error } = await supabase
          .from('matches')
          .insert([{ user1_id: user.id, user2_id: swipedUser.id }])
          .select()
          .single();

        if (!error && matchData) {
          setNewMatch(swipedUser);
          setShowMatchPopup(true);
          fetchMatches();
        }
      }
    }
  };

  const handleUpdateProfile = async (updatedUser: User) => {
    if (!user) return;
    setIsLoading(true);

    const { error } = await supabase
      .from('users')
      .update({
        name: updatedUser.name,
        role: updatedUser.role,
        industry: updatedUser.industry,
        bio: updatedUser.bio,
        image_url: updatedUser.imageUrl,
        tags: updatedUser.tags,
        stage: updatedUser.stage,
        main_goal: updatedUser.mainGoal
      })
      .eq('id', user.id);

    if (!error) {
      setUser(updatedUser);
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

  // --- Render Views ---

  if (isLoading && !user) {
    return (
      <div className="h-screen w-full bg-background flex flex-col items-center justify-center text-text-main">
        <div className="w-16 h-16 border-4 border-gold border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="animate-pulse">Loading Kova...</p>
      </div>
    );
  }

  if (!user) {
    if (showRegister) {
      return (
        <RegisterScreen 
          onRegister={handleRegister} 
          onBack={() => setShowRegister(false)}
          isLoading={isLoading}
          error={authError}
        />
      );
    }
    return (
      <LoginScreen 
        onLogin={handleLogin} 
        onRegisterClick={() => setShowRegister(true)}
        error={authError}
        isLoading={isLoading}
      />
    );
  }

  return (
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
           <div className="bg-surface max-w-md w-full p-8 rounded-3xl border border-gold/30 text-center shadow-2xl relative">
              <button onClick={() => setShowUpgradeModal(false)} className="absolute top-4 right-4 text-text-muted hover:text-white"><X /></button>
              <div className="w-16 h-16 bg-gradient-to-br from-gold to-amber-600 rounded-full mx-auto mb-6 flex items-center justify-center text-white shadow-lg">
                 <Crown size={32} fill="currentColor" />
              </div>
              <h2 className="text-2xl font-bold text-text-main mb-2">Upgrade to Kova Pro</h2>
              
              <div className="space-y-1 mb-6">
                <p className="text-text-muted">Unlock unlimited swipes, deep analytics, and AI insights.</p>
                <p className="text-xs text-gold/80 italic">More premium features coming soon...</p>
              </div>

              <div className="mb-6 bg-gold/5 border border-gold/20 rounded-xl p-3 inline-block px-6">
                 <p className="text-2xl font-bold text-gold">$7.99 <span className="text-sm font-normal text-text-muted">/ month</span></p>
              </div>

              <button 
                onClick={() => setShowUpgradeModal(false)} 
                className="w-full py-3 bg-gold text-surface font-bold rounded-xl hover:bg-gold-hover transition-colors"
              >
                Get Pro
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
                  onSave={handleUpdateProfile} 
                  onUpgrade={() => setShowUpgradeModal(true)}
                />
             </div>
          )}
      </main>

      {/* Bottom Navigation Bar - Visible on all screens EXCEPT Video Room */}
      {currentView !== ViewState.VIDEO_ROOM && (
        <nav className="bg-black border-t border-white/10 px-6 pb-safe shrink-0 z-50">
           <div className="flex justify-between items-center h-20 w-full max-w-5xl mx-auto">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className={`flex flex-col items-center justify-center w-20 h-full gap-1.5 transition-all duration-200 ${currentView === item.id ? 'text-gold' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  <item.icon size={24} className={currentView === item.id ? 'stroke-[2.5px]' : 'stroke-2'} />
                  <span className="text-[10px] font-bold tracking-widest">{item.label}</span>
                </button>
              ))}
              <button 
                onClick={handleLogout}
                className="flex flex-col items-center justify-center w-20 h-full gap-1.5 text-gray-500 hover:text-red-400 transition-all duration-200"
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

export default App;
