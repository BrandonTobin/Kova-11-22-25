
import { supabase } from '../supabaseClient';
import { CallType } from '../types';

export const startSession = async (hostId: string, partnerId: string, callType: CallType = 'video'): Promise<string | null> => {
  try {
    // 1. Check for ANY existing active session between these two users
    // We check both directions (host/partner or partner/host) just in case
    const { data: existingSession, error: fetchError } = await supabase
      .from('sessions')
      .select('id')
      .or(`and(host_id.eq.${hostId},partner_id.eq.${partnerId}),and(host_id.eq.${partnerId},partner_id.eq.${hostId})`)
      .is('ended_at', null) // Only look for active sessions
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error("Error checking existing session:", fetchError);
    }

    // If an active session exists, join it instead of creating a new one
    if (existingSession) {
      console.log("Joining existing session:", existingSession.id);
      return existingSession.id;
    }

    // 2. If no active session found, create a new one
    const { data, error } = await supabase
      .from('sessions')
      .insert([
        {
          host_id: hostId,
          partner_id: partnerId,
          started_at: new Date().toISOString(),
          call_type: callType
        }
      ])
      .select('id')
      .single();

    if (error) throw error;
    console.log("Created new session:", data.id);
    return data.id;
  } catch (err) {
    console.error("Error starting session:", err);
    return null;
  }
};

export const endSession = async (sessionId: string) => {
  try {
    const { error } = await supabase
      .from('sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) throw error;
  } catch (err) {
    console.error("Error ending session:", err);
  }
};
