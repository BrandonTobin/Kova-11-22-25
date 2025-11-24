
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
  created_at?: string;
  completed_at?: string;
  user_id?: string;
}

export interface UserLinks {
  linkedin?: string;
  website?: string;
  twitter?: string;
  portfolio?: string;
}

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

  // Extended Profile Fields
  experienceLevel?: string;
  communicationStyle?: string;
  skills?: string[];
  lookingFor?: string[];
  availability?: string[];
  goalsList?: string[]; // Specific text goals for profile display
  links?: UserLinks;

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

export const isProUser = (user: User | null): boolean => {
  if (!user) return false;
  return user.subscriptionTier === 'pro';
};
