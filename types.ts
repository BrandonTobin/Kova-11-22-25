
export enum ViewState {
  DISCOVER = 'DISCOVER',
  MATCHES = 'MATCHES',
  VIDEO_ROOM = 'VIDEO_ROOM',
  DASHBOARD = 'DASHBOARD',
  PROFILE = 'PROFILE',
  REGISTER = 'REGISTER',
  LOGIN = 'LOGIN'
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
