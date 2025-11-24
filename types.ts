
export enum ViewState {
  DISCOVER = 'DISCOVER',
  MATCHES = 'MATCHES',
  VIDEO_ROOM = 'VIDEO_ROOM',
  DASHBOARD = 'DASHBOARD',
  PROFILE = 'PROFILE',
  REGISTER = 'REGISTER',
  LOGIN = 'LOGIN'
}

export type SubscriptionTier = 'free' | 'pro';

export interface User {
  id: string;
  kovaId: string;
  name: string;
  role: string;
  industry: string;
  bio: string;
  imageUrl: string;
  tags: string[];
  badges: Badge[];

  // Auth fields
  email: string;
  password: string;

  // Subscription
  subscriptionTier: SubscriptionTier;
  proExpiresAt: string | null;

  // Personal details
  dob: string;
  age: number;
  gender: 'Male' | 'Female';

  // Startup info
  stage: string;
  location: {
    city: string;
    state: string;
  };
  mainGoal: string;

  // Security recovery
  securityQuestion: string;
  securityAnswer: string;
}


export interface Match {
  id: string;
  user: User;
  lastMessage?: string;
  timestamp: Date;
  unread: number;
}

export interface Message {
  id: string;
  matchId: string; // Foreign key to Match
  senderId: string;
  text: string;
  timestamp: Date;
}

export interface Badge {
  id: string;
  icon: string;
  name: string;
  color: string;
  criteria: string;
}

export interface Goal {
  id: string;
  text: string;
  completed: boolean;
}

export interface ChartData {
  name: string;
  value: number;
}

// Helper function to check Pro status
export function isProUser(user: User | null): boolean {
  if (!user) return false;
  if (user.subscriptionTier !== 'pro') return false;
  // If tier is pro but no expiry date, assume lifetime or error (fail safe to true for now)
  if (!user.proExpiresAt) return true; 
  return new Date(user.proExpiresAt).getTime() > Date.now();
}
