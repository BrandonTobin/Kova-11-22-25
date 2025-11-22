
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, MessageSquare, User as UserIcon, Search, LogOut, Sun, Moon } from 'lucide-react';
import { ViewState, User, Match } from './types';
import { AnimatePresence } from 'framer-motion';

import ChatInterface from './components/ChatInterface';
import VideoRoom from './components/VideoRoom';
import Dashboard from './components/Dashboard';
import ProfileEditor from './components/ProfileEditor';
import LoginScreen from './components/LoginScreen';
import RegisterScreen from './components/RegisterScreen';
import SwipeDeck from './components/SwipeDeck';

// Persistent Storage Keys - DO NOT CHANGE
const USERS_STORAGE_KEY = 'kova_users';
const CURRENT_USER_ID_KEY = 'kova_current_user_id';
const MATCHES_PREFIX = 'kova_matches_';

const App: React.FC = () => {
  // --- 1. Auth & Persistence Helpers ---

  const getStoredUsers = (): User[] => {
    try {
      const saved = localStorage.getItem(USERS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load users from storage", e);
      return [];
    }
  };

  const saveUsersToStorage = (users: User[]) => {
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch (e) {
      console.error("Failed to save users to storage", e);
    }
  };

  // --- 2. State Initialization ---
  
  // Users Registry: Initialized from storage (Authentication ONLY)
  const [usersRegistry, setUsersRegistry] = useState<User[]>(getStoredUsers);

  // Current User Session: Initialized from storage ID
  const [user, setUser] = useState<User | null>(() => {
    try {
      const currentId = localStorage.getItem(CURRENT_USER_ID_KEY);
      if (!currentId) return null;
      const users = getStoredUsers();
      return users.find(u => u.id === currentId) || null;
    } catch (e) {
      return null;
    }
  });

  // View State Logic
  const [currentView, setCurrentView] = useState<ViewState>(() => {
    // 1. If logged in, go to Discover
    const currentId = localStorage.getItem(CURRENT_USER_ID_KEY);
    if (currentId) return ViewState.DISCOVER;
    
    // 2. Default to Login
    return ViewState.LOGIN;
  });

  const [matches, setMatches] = useState<Match[]>([]);
  const [loginError, setLoginError] = useState('');
  const [activeVideoMatch, setActiveVideoMatch] = useState<Match | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  // Discover Queue State
  const [discoverQueue, setDiscoverQueue] = useState<User[]>([]);

  // --- 3. Effects ---

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // FORCE REFRESH of User Registry and Matches on View Change
  useEffect(() => {
    if (currentView === ViewState.DISCOVER || currentView === ViewState.MATCHES || currentView === ViewState.LOGIN) {
      const freshUsers = getStoredUsers();
      setUsersRegistry(freshUsers);
    }
  }, [currentView]);

  // --- STRICT DISCOVER LOGIC START ---
  // This effect implements the "Single Source of Truth" rule for Discover
  useEffect(() => {
    if (currentView === ViewState.DISCOVER && user) {
      console.log("Loading Discover Queue...");
      // 1. Load ALL users from localStorage (Source of Truth)
      const allUsers = getStoredUsers();
      
      // 2. Filter: Show EVERYONE except the current user.
      // No other filters (no likes, no matches, no stage checks) as requested.
      const validCandidates = allUsers.filter(u => u.id !== user.id);
      
      console.log(`Found ${validCandidates.length} potential matches.`);
      setDiscoverQueue(validCandidates);
    }
  }, [currentView, user]);
  // --- STRICT DISCOVER LOGIC END ---

  // Load matches when user changes or view changes
  useEffect(() => {
    if (user) {
      try {
        const myMatchesKey = `${MATCHES_PREFIX}${user.id}`;
        const savedMatches = localStorage.getItem(myMatchesKey);
        if (savedMatches) {
          const parsedMatches = JSON.parse(savedMatches);
          const hydratedMatches = parsedMatches.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }));
          setMatches(hydratedMatches);
        } else {
          setMatches([]);
        }
      } catch (e) {
        console.error("Failed to load matches", e);
        setMatches([]);
      }
    } else {
      setMatches([]);
    }
  }, [user, currentView]); 

  // --- 4. Auth Handlers ---

  const handleRegister = (newUser: User) => {
    const email = newUser.email?.toLowerCase().trim();
    if (!email) {
        alert("Email is required.");
        return;
    }
    if (!newUser.password) {
        alert("Password is required.");
        return;
    }

    const currentUsers = getStoredUsers();

    // Check Duplicates
    if (currentUsers.some(u => u.email?.toLowerCase().trim() === email)) {
      alert("User with this email already exists.");
      return;
    }

    const updatedRegistry = [...currentUsers, newUser];
    saveUsersToStorage(updatedRegistry);
    setUsersRegistry(updatedRegistry);

    localStorage.setItem(CURRENT_USER_ID_KEY, newUser.id);
    setUser(newUser);
    setLoginError('');
    setCurrentView(ViewState.DISCOVER);
  };

  const handleSignIn = (email: string, pass: string) => {
    const cleanEmail = email.toLowerCase().trim();
    const currentUsers = getStoredUsers();
    
    const foundUser = currentUsers.find(u => {
      const uEmail = u.email ? u.email.toLowerCase().trim() : '';
      return uEmail === cleanEmail && u.password === pass;
    });
    
    if (foundUser) {
      localStorage.setItem(CURRENT_USER_ID_KEY, foundUser.id);
      setUser(foundUser);
      setUsersRegistry(currentUsers);
      setLoginError('');
      setCurrentView(ViewState.DISCOVER);
    } else {
      setLoginError('Invalid email or password.');
    }
  };

  // Step 1: Get Security Question by Email
  const handleGetSecurityQuestion = (email: string): string | null => {
    const cleanEmail = email.toLowerCase().trim();
    const currentUsers = getStoredUsers();
    const foundUser = currentUsers.find(u => u.email?.toLowerCase().trim() === cleanEmail);
    
    if (foundUser && foundUser.securityQuestion) {
      return foundUser.securityQuestion;
    }
    return null;
  };

  // Step 2: Verify Answer and Reset Password
  const handleResetPasswordWithSecurity = (email: string, answer: string, newPass: string): { success: boolean; message: string } => {
    const cleanEmail = email.toLowerCase().trim();
    const currentUsers = getStoredUsers();
    const userIndex = currentUsers.findIndex(u => u.email?.toLowerCase().trim() === cleanEmail);

    if (userIndex === -1) {
      return { success: false, message: 'User not found.' };
    }

    const user = currentUsers[userIndex];
    const cleanAnswer = answer.trim().toLowerCase();
    const storedAnswer = user.securityAnswer?.trim().toLowerCase();

    if (!storedAnswer || cleanAnswer !== storedAnswer) {
      return { success: false, message: 'Incorrect answer to security question.' };
    }

    // Update Password
    currentUsers[userIndex].password = newPass;

    saveUsersToStorage(currentUsers);
    setUsersRegistry(currentUsers);

    return { success: true, message: 'Password updated successfully.' };
  };

  const handleSignOut = () => {
    localStorage.removeItem(CURRENT_USER_ID_KEY);
    setUser(null);
    setCurrentView(ViewState.LOGIN);
    setActiveVideoMatch(null);
    setLoginError('');
    setMatches([]); 
  };

  // --- 5. Other Handlers ---

  const handleUpdateProfile = (updatedUser: User) => {
    setUser(updatedUser);
    const currentUsers = getStoredUsers();
    const updatedRegistry = currentUsers.map(u => u.id === updatedUser.id ? updatedUser : u);
    saveUsersToStorage(updatedRegistry);
    setUsersRegistry(updatedRegistry);
  };

  const persistMatches = (userId: string, newMatches: Match[]) => {
    localStorage.setItem(`${MATCHES_PREFIX}${userId}`, JSON.stringify(newMatches));
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleStartVideoCall = (match: Match) => {
    setActiveVideoMatch(match);
    setCurrentView(ViewState.VIDEO_ROOM);
  };

  const handleEndVideoCall = () => {
    setActiveVideoMatch(null);
    setCurrentView(ViewState.DASHBOARD);
  };

  // Connect By ID - Manual connection only
  const handleConnectById = (targetUser: User) => {
    if (!user) return;
    
    // Check existing match to prevent duplicates
    if (matches.some(m => m.user.id === targetUser.id)) {
      setCurrentView(ViewState.MATCHES);
      return;
    }

    // Create Match for Current User
    const myNewMatch: Match = {
      id: `m-${Date.now()}-${targetUser.id}`,
      user: targetUser,
      timestamp: new Date(),
      unread: 0,
    };
    const myUpdatedMatches = [myNewMatch, ...matches];
    setMatches(myUpdatedMatches);
    persistMatches(user.id, myUpdatedMatches);

    // Create Match for Other User (Manual Sync)
    const theirKey = `${MATCHES_PREFIX}${targetUser.id}`;
    try {
      const theirExistingMatchesStr = localStorage.getItem(theirKey);
      const theirExistingMatches: Match[] = theirExistingMatchesStr ? JSON.parse(theirExistingMatchesStr) : [];
      
      if (!theirExistingMatches.some(m => m.user.id === user.id)) {
          const theirNewMatch: Match = {
            id: `m-${Date.now()}-${user.id}`,
            user: user,
            timestamp: new Date(),
            unread: 0,
          };
          persistMatches(targetUser.id, [theirNewMatch, ...theirExistingMatches]);
      }
    } catch (e) {
      console.error("Error updating peer matches", e);
    }

    setCurrentView(ViewState.MATCHES);
  };

  // Simple Swipe Handler - No complex auto-matching logic
  const handleSwipe = (direction: 'left' | 'right', swipedUser: User) => {
    if (!user) return;
    
    // We just log the swipe for now to keep functionality extremely simple as requested.
    // This ensures visual feedback works (card flies off) without data side-effects.
    console.log(`User ${user.name} swiped ${direction} on ${swipedUser.name}`);
    
    // Note: To implement matching later, we would check if swipedUser has liked 'user'
    // and then call handleConnectById(swipedUser).
    // For now, strictly no auto-matching.
  };

  // --- 6. Render Logic ---
  const renderContent = () => {
    if (currentView === ViewState.LOGIN) {
      return (
        <LoginScreen 
          onLogin={handleSignIn} 
          onRegisterClick={() => setCurrentView(ViewState.REGISTER)}
          error={loginError}
          onGetSecurityQuestion={handleGetSecurityQuestion}
          onVerifyAndReset={handleResetPasswordWithSecurity}
        />
      );
    }

    if (currentView === ViewState.REGISTER) {
      return (
        <RegisterScreen 
          onRegister={handleRegister}
          onBack={() => setCurrentView(ViewState.LOGIN)}
        />
      );
    }

    // Safety Check: If we are in a protected view but have no user, fallback to Login.
    if (!user) {
      return (
        <LoginScreen 
          onLogin={handleSignIn} 
          onRegisterClick={() => setCurrentView(ViewState.REGISTER)}
          error={loginError}
          onGetSecurityQuestion={handleGetSecurityQuestion}
          onVerifyAndReset={handleResetPasswordWithSecurity}
        />
      );
    }

    return (
      <div className={`flex flex-col h-screen bg-background text-text-main transition-colors duration-300 overflow-hidden ${isDarkMode ? 'dark' : ''}`}>
        
        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden relative">
          {currentView === ViewState.DISCOVER && (
             <SwipeDeck users={discoverQueue} onSwipe={handleSwipe} />
          )}
          
          {currentView === ViewState.MATCHES && (
            <div className="h-full p-4 md:p-6">
               <ChatInterface 
                  matches={matches} 
                  currentUser={user}
                  allUsers={usersRegistry} 
                  onStartVideoCall={handleStartVideoCall}
                  onConnectById={handleConnectById}
               />
            </div>
          )}
          
          {currentView === ViewState.VIDEO_ROOM && activeVideoMatch && (
             <VideoRoom 
               match={activeVideoMatch} 
               allMatches={matches}
               currentUser={user} 
               onEndCall={handleEndVideoCall}
               onReturnToDashboard={handleEndVideoCall}
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

        {/* Bottom Navigation */}
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
                {matches.some(m => m.unread > 0) && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-surface animate-pulse"></span>
                )}
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
      {/* Global Theme Toggle - Appears on every page */}
      <div className="fixed top-4 right-4 z-[100]">
         <button 
             onClick={toggleTheme} 
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
