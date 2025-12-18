// supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

/**
 * FINAL / PRODUCTION VERSION
 * -----------------------------------------
 * No import.meta.env
 * No VITE_ variables
 * No runtime lookups
 *
 * These values are now STATIC and guaranteed.
 * Your backend (.env) keeps the private Service Role key.
 * This file only uses the PUBLIC ANON key (safe for frontend).
 */

const supabaseUrl = "https://dbbtpkgiclzrsigdwdig.supabase.co";

// PUBLIC **ANON** KEY ONLY — DO NOT EVER USE THE SERVICE ROLE KEY HERE
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiYnRwa2dpY2x6cnNpZ2R3ZGlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NDg1MTUsImV4cCI6MjA3OTQyNDUxNX0.6AVxG_lXvP_1ad2XMhGLW-1iWJwVevslqTL_Fo9Eg2c";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase client configuration missing. Check supabaseClient.ts");
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
