import React, { useState, useEffect } from 'react';
import { Lock, Target, CheckCircle, Plus, Trash2, Circle } from 'lucide-react';
import { SubscriptionTier } from '../types';
import { getDisplayName } from '../utils/nameUtils';

interface SharedGoal {
  id: string;
  text: string;
  completed: boolean;
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

  // Load goals for this match from localStorage
  useEffect(() => {
    const key = `kova_shared_goals_${matchId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setGoals(JSON.parse(saved));
      } catch (e) {
        setGoals([]);
      }
    } else {
      setGoals([]);
    }
  }, [matchId]);

  // Save goals whenever they change
  useEffect(() => {
    if (matchId) {
      const key = `kova_shared_goals_${matchId}`;
      localStorage.setItem(key, JSON.stringify(goals));
    }
  }, [goals, matchId]);

  const addGoal = () => {
    if (!inputValue.trim()) return;
    const newGoal: SharedGoal = {
      id: Date.now().toString(),
      text: inputValue.trim(),
      completed: false
    };
    setGoals(prev => [...prev, newGoal]);
    setInputValue('');
  };

  const toggleGoal = (id: string) => {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, completed: !g.completed } : g));
  };

  const deleteGoal = (id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') addGoal();
  };

  return (
    <aside className="hidden xl:flex flex-col w-[500px] shrink-0 h-full bg-surface/40 backdrop-blur-xl border border-white/5 rounded-3xl shadow-xl overflow-hidden relative">
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
                onClick={addGoal}
                disabled={!inputValue.trim()}
                className="bg-primary hover:bg-primary-hover text-white rounded-xl px-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center"
              >
                <Plus size={18} />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {goals.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-text-muted opacity-50 text-sm text-center border-2 border-dashed border-white/5 rounded-2xl mx-1">
                  <Target size={24} className="mb-2 opacity-50" />
                  <p>No goals yet.</p>
                  <p className="text-[10px] mt-1">Set a target to crush together!</p>
                </div>
              )}
              
              {goals.map(goal => (
                <div key={goal.id} className="group bg-background/40 hover:bg-background/60 rounded-xl p-3 border border-white/5 hover:border-white/10 transition-all flex items-start gap-3 shadow-sm">
                  <button 
                    onClick={() => toggleGoal(goal.id)}
                    className={`mt-0.5 shrink-0 transition-colors ${goal.completed ? 'text-emerald-500' : 'text-text-muted hover:text-gold'}`}
                  >
                    {goal.completed ? <CheckCircle size={18} /> : <Circle size={18} />}
                  </button>
                  <p className={`flex-1 text-sm leading-relaxed ${goal.completed ? 'text-text-muted line-through opacity-70' : 'text-text-main'}`}>
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
             <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background/50 pointer-events-none"></div>
             
             <div className="relative z-10 space-y-5 px-4">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10 shadow-lg">
                   <Lock size={24} className="text-text-muted" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-main mb-1">Unlock Shared Goals</h3>
                  <p className="text-xs text-text-muted leading-relaxed max-w-[200px] mx-auto">
                    Track milestones and tasks directly in your chat.
                  </p>
                </div>
                <ul className="text-xs text-text-muted/80 space-y-3 text-left bg-black/20 p-4 rounded-xl border border-white/5">
                  <li className="flex items-center gap-2"><CheckCircle size={12} className="text-gold" /> Assign tasks to each other</li>
                  <li className="flex items-center gap-2"><CheckCircle size={12} className="text-gold" /> Track weekly progress</li>
                  <li className="flex items-center gap-2"><CheckCircle size={12} className="text-gold" /> AI accountability summaries</li>
                </ul>
                <button
                  type="button"
                  onClick={() => onUpgrade('kova_plus')}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-gold to-amber-600 hover:opacity-90 text-white font-bold shadow-lg transition-all flex items-center justify-center gap-2 text-xs"
                >
                  <Lock size={14} /> Upgrade to Plus
                </button>
             </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default SharedGoalsPanel;