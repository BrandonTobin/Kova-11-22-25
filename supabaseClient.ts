import { createClient } from '@supabase/supabase-js';

// Optional manual fallback for local/dev only.
// In a real production build, you can set these to '' and rely entirely on env vars.
const MANUAL_URL = 'https://dbbtpkgiclzrsigdwdig.supabase.co';
const MANUAL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiYnRwa2dpY2x6cnNpZ2R3ZGlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NDg1MTUsImV4cCI6MjA3OTQyNDUxNX0.6AVxG_lXvP_1ad2XMhGLW-1iWJwVevslqTL_Fo9Eg2c';

const getEnvVar = (key: string, viteKey: string, reactKey: string): string => {
  // 1. Vite (import.meta.env)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      const val = import.meta.env[key] || import.meta.env[viteKey];
      if (val) return val;
    }
  } catch (e) {}

  // 2. CRA / Node (process.env)
  try {
    if (typeof process !== 'undefined' && process.env) {
      const val = process.env[key] || process.env[reactKey];
      if (val) return val;
    }
  } catch (e) {}

  return '';
};

// Prefer ENV → fallback to manual → otherwise crash loudly
const supabaseUrl =
  getEnvVar('SUPABASE_URL', 'VITE_SUPABASE_URL', 'REACT_APP_SUPABASE_URL') ||
  MANUAL_URL;

const supabaseAnonKey =
  getEnvVar(
    'SUPABASE_ANON_KEY',
    'VITE_SUPABASE_ANON_KEY',
    'REACT_APP_SUPABASE_ANON_KEY'
  ) || MANUAL_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase URL or anon key is missing. Check your environment variables.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
