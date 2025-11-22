
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
// You can paste your Supabase keys directly here if not using .env files.
// If using .env, ensure variables are named VITE_SUPABASE_URL (Vite) or REACT_APP_SUPABASE_URL (CRA).

const MANUAL_URL = 'https://dbbtpkgiclzrsigdwdig.supabase.co'; // Paste URL here if needed, e.g. 'https://xyz.supabase.co'
const MANUAL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiYnRwa2dpY2x6cnNpZ2R3ZGlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NDg1MTUsImV4cCI6MjA3OTQyNDUxNX0.6AVxG_lXvP_1ad2XMhGLW-1iWJwVevslqTL_Fo9Eg2c'; // Paste Anon Key here if needed

// ---------------------

const getEnvVar = (key: string, viteKey: string, reactKey: string): string => {
  // 1. Try Vite (import.meta.env)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      const val = import.meta.env[key] || import.meta.env[viteKey];
      if (val) return val;
    }
  } catch (e) {}

  // 2. Try Node/CRA (process.env)
  try {
    if (typeof process !== 'undefined' && process.env) {
      const val = process.env[key] || process.env[reactKey];
      if (val) return val;
    }
  } catch (e) {}

  return '';
};

// Logic: Use Manual -> Then Env -> Then Placeholder
const supabaseUrl = MANUAL_URL || getEnvVar('SUPABASE_URL', 'VITE_SUPABASE_URL', 'REACT_APP_SUPABASE_URL') || 'https://placeholder.supabase.co';
const supabaseAnonKey = MANUAL_KEY || getEnvVar('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'REACT_APP_SUPABASE_ANON_KEY') || 'placeholder-key';

// Initialize Client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
