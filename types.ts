

export enum ViewState {
  DISCOVER = 'DISCOVER',
  MATCHES = 'MATCHES',
  DASHBOARD = 'DASHBOARD',
  NOTES = 'NOTES',
  PROFILE = 'PROFILE',
  REGISTER = 'REGISTER',
  LOGIN = 'LOGIN',
  VIDEO_ROOM = 'VIDEO_ROOM',
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  // Legal Pages
  PRIVACY = 'PRIVACY',
  TERMS = 'TERMS',
  REFUND = 'REFUND',
  CONTACT = 'CONTACT'
}

export type SubscriptionTier = 'free' | 'kova_plus' | 'kova_pro';
export type CallType = 'video' | 'audio';

export interface IncomingCall {
  sessionId: string;
  caller: User;
  callType: CallType;
}

export interface PlanConfig {
  id: SubscriptionTier;
  name: string;
  price: string; // Display price string like "$7.99/mo"
  priceValue: number;
  description: string;
  features: string[];
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
  lastSeenAt?: string | null; // ISO string from Supabase

  // Avatar Positioning
  avatarZoom?: number;
  avatarOffsetX?: number;
  avatarOffsetY?: number;

  // Interaction State
  superLikedMe?: boolean; // True if this user super liked the current user

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
  // New fields for sorting and preview
  lastMessageText?: string | null;
  lastMessageAt?: string | null; // ISO string
}

export interface Message {
  id: string;
  matchId: string; // Foreign key to Match
  senderId: string;
  text: string;
  timestamp: Date;
}

export interface Note {
  id: string;
  user_id: string;
  title: string;
  body: string;
  pinned: boolean;
  category: 'General' | 'Ideas' | 'Competitors' | 'Customers' | 'Goals' | 'Personal';
  created_at: string;
  updated_at: string;
}

// Helper: Does user have at least Plus access? (Plus or Pro)
export const hasPlusAccess = (user: User | null): boolean => {
  if (!user) return false;
  return user.subscriptionTier === 'kova_plus' || user.subscriptionTier === 'kova_pro';
};

// Helper: Does user have Pro access? (Pro only)
export const hasProAccess = (user: User | null): boolean => {
  if (!user) return false;
  return user.subscriptionTier === 'kova_pro';
};

// Legacy helper for backward compatibility, mapping to Pro features
export const isProUser = (user: User | null): boolean => {
  return hasProAccess(user);
};

// Helper to get consistent avatar styles
export const getAvatarStyle = (user: Partial<User>) => {
  const zoom = user.avatarZoom || 1;
  const x = user.avatarOffsetX || 0;
  const y = user.avatarOffsetY || 0;
  return {
    transform: `translate(${x}%, ${y}%) scale(${zoom})`
  };
};