
import { User, Badge, Match, Message } from './types';

export const DEFAULT_PROFILE_IMAGE = 'https://ui-avatars.com/api/?background=0D8ABC&color=fff&name=User';

export const ALL_BADGES: Badge[] = [
  { id: '1', icon: '🚀', name: 'Early Adopter', color: 'text-gold', criteria: 'Join Kova during the beta launch phase.' },
  { id: '2', icon: '🔥', name: '7 Day Streak', color: 'text-gold', criteria: 'Log in and complete a session 7 days in a row.' },
  { id: '3', icon: '🤝', name: 'Super Connector', color: 'text-secondary', criteria: 'Match with 10 different entrepreneurs.' },
  { id: '4', icon: '🎯', name: 'Goal Crusher', color: 'text-gold', criteria: 'Complete 50 session goals.' },
  { id: '5', icon: '🦉', name: 'Night Owl', color: 'text-secondary', criteria: 'Complete 5 sessions between 10 PM and 4 AM.' },
  { id: '6', icon: '☀️', name: 'Early Bird', color: 'text-gold', criteria: 'Complete 5 sessions between 5 AM and 9 AM.' },
  { id: '7', icon: '🎤', name: 'Pitch Perfect', color: 'text-secondary', criteria: 'Receive 5 positive reviews on your pitch practice.' },
  { id: '8', icon: '👑', name: 'Consistency King', color: 'text-gold', criteria: 'Maintain a 30-day activity streak.' },
  { id: '9', icon: '📚', name: 'Mentor Material', color: 'text-secondary', criteria: 'Help 3 early-stage founders in mentor sessions.' },
  { id: '10', icon: '🦄', name: 'Unicorn Hunter', color: 'text-gold', criteria: 'Connect with a founder in the "Scaling" stage.' },
  { id: '11', icon: '💼', name: 'Deal Closer', color: 'text-secondary', criteria: 'Mark a partnership goal as "Signed" or "Completed".' },
  { id: '12', icon: '💡', name: 'Idea Machine', color: 'text-gold', criteria: 'Create 20 shared notes in brainstorming sessions.' }
];

export const SECURITY_QUESTIONS = [
  "What is your mother's maiden name?",
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is the name of your favorite book?",
  "What was the model of your first car?",
  "What is the name of the first school you attended?",
  "What is your favorite food?"
];

// Empty arrays to ensure no mock data is ever loaded
export const MOCK_BADGES: Badge[] = [];
// Removed MOCK_USERS entirely to force localStorage auth
export const INITIAL_MATCHES: Match[] = [];
export const INITIAL_MESSAGES: Message[] = [];

// Helper to create a blank/default user if needed, but auth should handle this.
export const BLANK_USER_TEMPLATE: User = {
  id: '',
  kovaId: '',
  name: '',
  email: '',
  password: '',
  role: '',
  industry: '',
  bio: '',
  imageUrl: DEFAULT_PROFILE_IMAGE,
  tags: [],
  badges: [],
  dob: '',
  age: 0,
  gender: 'Male',
  stage: '',
  location: { city: '', state: '' },
  mainGoal: '',
  securityQuestion: '',
  securityAnswer: '',
  subscriptionTier: 'free',
  proExpiresAt: null
};
