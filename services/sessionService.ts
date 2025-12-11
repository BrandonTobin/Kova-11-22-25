
import { supabase } from '../supabaseClient';
import { CallType } from '../types';

export const startSession = async (hostId: string, partnerId: string, callType: CallType = 'video'): Promise<string | null> => {
  try {
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
