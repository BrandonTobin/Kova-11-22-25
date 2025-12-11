import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { DEFAULT_PROFILE_IMAGE } from '../constants';
import { getDisplayName } from '../utils/nameUtils';

export interface VoiceParticipant {
  user_id: string;
  display_name: string;
  avatar_url: string;
}

export const useVoiceChannel = (
  matchId: string | null,
  currentUserId: string
) => {
  const [voiceParticipants, setVoiceParticipants] = useState<VoiceParticipant[]>(
    []
  );
  const [isInVoice, setIsInVoice] = useState(false);
  const [isTogglingVoice, setIsTogglingVoice] = useState(false);

  /**
   * Helper: load the current active sessions for this match
   * and resolve them to user display names + avatars.
   */
  const refreshParticipants = useCallback(
    async (activeMatchId: string) => {
      // 1) Get all active sessions for this match
      const { data: sessions, error: sessionsError } = await supabase
        .from('voice_sessions')
        .select('user_id')
        .eq('match_id', activeMatchId)
        .eq('is_active', true);

      if (sessionsError) {
        console.error('Error loading voice_sessions:', sessionsError);
        setVoiceParticipants([]);
        setIsInVoice(false);
        return;
      }

      const userIds = (sessions ?? []).map((s) => s.user_id);

      if (!userIds.length) {
        setVoiceParticipants([]);
        setIsInVoice(false);
        return;
      }

      // 2) Fetch basic user info for those IDs
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, image_url')
        .in('id', userIds);

      if (usersError || !users) {
        console.error('Error fetching voice participant users:', usersError);
        setVoiceParticipants([]);
        setIsInVoice(userIds.includes(currentUserId));
        return;
      }

      const participants: VoiceParticipant[] = users.map((u) => ({
        user_id: u.id,
        display_name: getDisplayName(u.name),
        avatar_url: u.image_url || DEFAULT_PROFILE_IMAGE,
      }));

      setVoiceParticipants(participants);
      setIsInVoice(userIds.includes(currentUserId));
    },
    [currentUserId]
  );

  /**
   * Initial load + realtime subscription for the current matchId.
   */
  useEffect(() => {
    if (!matchId) {
      setVoiceParticipants([]);
      setIsInVoice(false);
      return;
    }

    let isMounted = true;

    // Initial fetch
    refreshParticipants(matchId);

    // Realtime: listen to any change on voice_sessions for this match
    const channel = supabase
      .channel(`voice_sessions:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'voice_sessions',
          filter: `match_id=eq.${matchId}`,
        },
        async () => {
          if (!isMounted) return;
          await refreshParticipants(matchId);
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [matchId, refreshParticipants]);

  /**
   * Join voice for the current match.
   * This does NOT handle WebRTC; ChatInterface.tsx handles that.
   * This only updates DB presence.
   */
  const joinVoice = useCallback(async () => {
    if (!matchId) return;
    setIsTogglingVoice(true);

    try {
      // Clean up any stale rows for this user+match first (no need for onConflict)
      await supabase
        .from('voice_sessions')
        .delete()
        .eq('match_id', matchId)
        .eq('user_id', currentUserId);

      const { error } = await supabase.from('voice_sessions').insert({
        match_id: matchId,
        user_id: currentUserId,
        is_active: true,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error('Error joining voice channel:', error);
      } else {
        setIsInVoice(true);
        // Re-fetch to keep participants in sync
        await refreshParticipants(matchId);
      }
    } finally {
      setIsTogglingVoice(false);
    }
  }, [matchId, currentUserId, refreshParticipants]);

  /**
   * Leave voice for the current match.
   */
  const leaveVoice = useCallback(async () => {
    if (!matchId) return;
    setIsTogglingVoice(true);

    try {
      const { error } = await supabase
        .from('voice_sessions')
        .delete()
        .eq('match_id', matchId)
        .eq('user_id', currentUserId);

      if (error) {
        console.error('Error leaving voice channel:', error);
      } else {
        setIsInVoice(false);
        await refreshParticipants(matchId);
      }
    } finally {
      setIsTogglingVoice(false);
    }
  }, [matchId, currentUserId, refreshParticipants]);

  return {
    isInVoice,
    voiceParticipants,
    isTogglingVoice,
    joinVoice,
    leaveVoice,
  };
};
