
import React, { useState, useEffect, useRef } from 'react';
import { Lock, Target, CheckCircle, Plus, Trash2, Circle, Loader2 } from 'lucide-react';
import { SubscriptionTier } from '../types';
import { getDisplayName } from '../utils/nameUtils';
import { supabase } from '../supabaseClient';

interface SharedGoal {
  id: string;
  text: string;
  is_done: boolean;
  match_id?: string;
}

interface SharedGoalsPanelProps {
  isPlusOrPro: boolean;
  partnerName?: string;
  onUpgrade: (tier: SubscriptionTier) => void;
  matchId: string;
}

const SharedGoalsPanel: React.FC<SharedGoalsPanelProps> = ({ isPlusOrPro, partnerName, onUpgrade, matchId }) => {
  const firstName = partnerName ? getDisplayName(partnerName).split(' ')[0] : 'Partner';
  const [goals, setGoals] = useState<SharedGoal[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // --- Realtime Sync with Supabase ---
  useEffect(() => {
    if (!matchId || !isPlusOrPro) return;

    // 1. Initial Fetch
    const fetchGoals = async () => {
      setIsLoading(true);
      const { data } = await supabase
        .from('match_goals')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });
      
      if (isMountedRef.current && data) {
        setGoals(data);
      }
      if (isMountedRef.current) setIsLoading(false);
    };

    fetchGoals();

    // 2. Realtime Subscription
    // Using a unique channel name per mount prevents conflicts
    const channelName = `goals:${matchId}:${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'match_goals',
          filter: `match_id=eq.${matchId}` // Explicit filter is more efficient with correct RLS
        }, 
        (payload) => {
           if (!isMountedRef.current) return;

           console.log('Realtime Event Received:', payload.eventType); // Debug log

           if (payload.eventType === 'INSERT') {
              const newGoal = payload.new as SharedGoal;
              setGoals(prev => {
                if (prev.some(g => g.id === newGoal.id)) return prev;
                return [...prev, newGoal];
              });
           } else if (payload.eventType === 'UPDATE') {
              const updated = payload.new as SharedGoal;
              setGoals(prev => prev.map(g => g.id === updated.id ? updated : g));
           } else if (payload.eventType === 'DELETE') {
              setGoals(prev => prev.filter(g => g.id !== payload.old.id));
           }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to goals for match ${matchId}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, isPlusOrPro]);

  const addGoal = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim()) return;
    
    const text = inputValue.trim();
    setInputValue(''); // Clear input immediately

    // 1. Optimistic Update
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticGoal = { id: tempId, text, is_done: false, match_id: matchId };
    
    setGoals(prev => [...prev, optimisticGoal]);

    // 2. Save to Database
    const { data, error } = await supabase.from('match_goals').insert({
      match_id: matchId,
      text: text,
      is_done: false
    }).select().single();

    if (!isMountedRef.current) return;

    if (error) {
      console.error("Error adding goal:", error);
      setGoals(prev => prev.filter(g => g.id !== tempId)); // Revert
      alert("Failed to save goal. Please check your connection.");
    } else if (data) {
      // 3. Swap Temp ID with Real ID
      setGoals(prev => prev.map(g => g.id === tempId ? data : g));
    }
  };

  const toggleGoal = async (id: string, currentStatus: boolean) => {
    // Optimistic update
    setGoals(prev => prev.map(g => g.id === id ? { ...g, is_done: !currentStatus } : g));
    
    if (id.startsWith('temp-')) return;

    await supabase.from('match_goals').update({ is_done: !currentStatus }).eq('id', id);
  };

  const deleteGoal = async (id: string) => {
    // Optimistic delete
    setGoals(prev => prev.filter(g => g.id !== id));

    if (id.startsWith('temp-')) return;

    await supabase.from('match_goals').delete().eq('id', id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') addGoal();
  };

  return (
    <div className="flex flex-col w-full h-full bg-surface/40 backdrop-blur-xl border border-white/5 rounded-3xl shadow-xl overflow-hidden relative">
      <div className="flex flex-col h-full p-5">
        {/* Header */}
        <header className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h2 className="text-base font-bold text-text-main flex items-center gap-2">
              <Target size={18} className="text-gold" />
              Shared Goals
            </h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              Accountability with {firstName}
            </p>
          </div>
          {!isPlusOrPro && (
            <span className="px-2 py-1 rounded-full bg-background/50 border border-white/10 text-[9px] font-bold flex items-center gap-1 text-text-muted uppercase tracking-wider">
              <Lock className="w-2.5 h-2.5" />
              Plus
            </span>
          )}
        </header>

        {isPlusOrPro ? (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Input Area */}
            <div className="flex gap-2 mb-4 shrink-0">
              <input 
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a new goal..."
                className="flex-1 bg-background/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-gold/50 transition-colors placeholder-text-muted/50"
              />
              <button 
                type="button"
                onClick={addGoal}
                disabled={!inputValue.trim()}
                className="bg-primary hover:bg-primary-hover text-white rounded-xl px-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center shrink-0"
              >
                <Plus size={18} />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {isLoading && goals.length === 0 && (
                 <div className="flex justify-center p-4"><Loader2 className="animate-spin text-gold" size={20} /></div>
              )}
              
              {!isLoading && goals.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-text-muted opacity-50 text-sm text-center border-2 border-dashed border-white/5 rounded-2xl mx-1">
                  <Target size={24} className="mb-2 opacity-50" />
                  <p>No goals yet.</p>
                  <p className="text-[10px] mt-1">Set a target to crush together!</p>
                </div>
              )}
              
              {goals.map(goal => (
                <div key={goal.id} className="group bg-background/40 hover:bg-background/60 rounded-xl p-3 border border-white/5 hover:border-white/10 transition-all flex items-start gap-3 shadow-sm">
                  <button 
                    onClick={() => toggleGoal(goal.id, goal.is_done)}
                    className={`mt-0.5 shrink-0 transition-colors ${goal.is_done ? 'text-emerald-500' : 'text-text-muted hover:text-gold'}`}
                  >
                    {goal.is_done ? <CheckCircle size={18} /> : <Circle size={18} />}
                  </button>
                  <p className={`flex-1 text-sm leading-relaxed ${goal.is_done ? 'text-text-muted line-through opacity-70' : 'text-text-main'}`}>
                    {goal.text}
                  </p>
                  <button 
                    onClick={() => deleteGoal(goal.id)}
                    className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-opacity p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col justify-center h-full text-center relative rounded-2xl overflow-hidden">
             {/* Locked Background */}
             <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background/50 pointer-events-none"></div>
             
             <div className="relative z-10 space-y-5 px-4 flex flex-col items-center justify-center h-full">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center border border-white/10 shadow-lg">
                   <Lock size={24} className="text-text-muted" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-main mb-1">Unlock Shared Goals</h3>
                  <p className="text-xs text-text-muted leading-relaxed max-w-[200px] mx-auto">
                    Collaborate effectively with accountability partners.
                  </p>
                </div>
                <ul className="text-xs text-text-muted/80 space-y-3 text-left bg-black/20 p-4 rounded-xl border border-white/5 w-full max-w-[240px]">
                  <li className="flex items-center gap-2"><CheckCircle size={12} className="text-gold" /> Assign tasks to each other</li>
                  <li className="flex items-center gap-2"><CheckCircle size={12} className="text-gold" /> Track weekly progress</li>
                </ul>
                <button
                  type="button"
                  onClick={() => onUpgrade('kova_plus')}
                  className="w-full max-w-[240px] py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-700 hover:opacity-90 text-white font-bold shadow-lg transition-all flex items-center justify-center gap-2 text-xs"
                >
                  <Lock size={14} /> Upgrade to Plus
                </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SharedGoalsPanel;
