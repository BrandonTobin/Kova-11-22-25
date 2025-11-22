
import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { User, Badge } from '../types';
import { TrendingUp, Target, Award, Sparkles, Calendar, Clock, ArrowRight, Activity, Zap, X, Lock, HelpCircle, RotateCcw } from 'lucide-react';
import { ALL_BADGES } from '../constants';

interface DashboardProps {
  user: User;
}

const weeklyData = [
  { name: 'Mon', hours: 2.5 },
  { name: 'Tue', hours: 4.0 },
  { name: 'Wed', hours: 3.5 },
  { name: 'Thu', hours: 5.0 },
  { name: 'Fri', hours: 1.5 },
  { name: 'Sat', hours: 6.0 },
  { name: 'Sun', hours: 3.0 },
];

// Mock data for the last 90 days heatmap
const heatmapData = Array.from({ length: 90 }).map((_, i) => ({
  day: i + 1,
  // 0: None, 1: Low, 2: Medium, 3: High, 4: Peak
  intensity: Math.random() > 0.85 ? 4 : Math.random() > 0.65 ? 3 : Math.random() > 0.4 ? 2 : Math.random() > 0.2 ? 1 : 0,
}));

const getHeatmapColor = (intensity: number) => {
  switch (intensity) {
    case 4: return 'bg-gold shadow-[0_0_8px_rgba(214,167,86,0.5)] border border-gold/50'; // Peak (Gold)
    case 3: return 'bg-primary/40 border border-primary/20'; // High (Swapped to Faded Emerald)
    case 2: return 'bg-primary border border-primary-hover'; // Medium (Deep Emerald)
    case 1: return 'bg-secondary border border-secondary/50'; // Low (Swapped to Soft Teal)
    default: return 'bg-surface border border-white/5';
  }
};

interface BadgeCardProps {
  badge: Badge;
  isEarned: boolean;
}

// Internal Badge Card Component
const BadgeCard: React.FC<BadgeCardProps> = ({ badge, isEarned }) => {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div 
      className={`relative p-4 rounded-2xl border flex flex-col items-center text-center gap-3 transition-all duration-300 group h-40 justify-center ${
        isEarned 
          ? 'bg-surface border-gold/30 shadow-lg shadow-gold/5 scale-100' 
          : 'bg-background border-surface opacity-70'
      }`}
    >
      {!showInfo ? (
        <>
          <div className={`text-4xl mb-1 transition-transform ${isEarned ? 'group-hover:scale-110 filter drop-shadow-md' : 'grayscale opacity-30'}`}>
            {badge.icon}
          </div>
          
          <h3 className={`font-bold text-sm ${isEarned ? 'text-text-main' : 'text-text-muted'}`}>
            {badge.name}
          </h3>

          <div className="mt-auto pt-2 w-full flex justify-center flex-col items-center gap-2">
            {isEarned ? (
              <span className="text-[10px] font-bold bg-gold/10 text-gold px-3 py-1 rounded-full border border-gold/20 uppercase tracking-wider">
                Earned
              </span>
            ) : (
              <span className="text-[10px] font-bold bg-surface text-text-muted px-3 py-1 rounded-full border border-white/10 flex items-center gap-1">
                <Lock size={10} /> Locked
              </span>
            )}
            
            <button 
              onClick={() => setShowInfo(true)}
              className="text-[10px] text-secondary hover:text-gold flex items-center gap-1 mt-1 opacity-80 hover:opacity-100 transition-opacity"
            >
              <HelpCircle size={10} /> How to unlock
            </button>
          </div>
        </>
      ) : (
        <div className="absolute inset-0 bg-surface p-4 rounded-2xl flex flex-col items-center justify-center animate-in fade-in zoom-in duration-200 z-10 border border-gold/30">
          <h4 className="text-xs font-bold text-gold mb-2">{badge.name}</h4>
          <p className="text-xs text-text-muted leading-relaxed mb-3">{badge.criteria}</p>
          <button 
            onClick={() => setShowInfo(false)}
            className="text-[10px] bg-background hover:bg-primary text-text-main px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors border border-white/10"
          >
            <RotateCcw size={10} /> Back
          </button>
        </div>
      )}
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [showBadgesModal, setShowBadgesModal] = useState(false);

  return (
    <div className="h-full w-full overflow-y-auto p-4 md:p-8 bg-background text-text-main relative">
      
      {/* Badges Modal */}
      {showBadgesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={() => setShowBadgesModal(false)}>
          <div className="bg-surface w-full max-w-3xl rounded-3xl border border-white/10 shadow-2xl p-8 overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold text-text-main flex items-center gap-2">
                  <Award className="text-gold" /> Achievements
                </h2>
                <p className="text-text-muted mt-1">Earn badges by staying consistent and collaborating.</p>
              </div>
              <button onClick={() => setShowBadgesModal(false)} className="p-2 rounded-full hover:bg-background text-text-muted hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {ALL_BADGES.map(badge => {
                const isEarned = user.badges.some(b => b.id === badge.id);
                return <BadgeCard key={badge.id} badge={badge} isEarned={isEarned} />;
              })}
            </div>
            
            <div className="mt-8 text-center">
              <p className="text-xs text-text-muted">
                Progress: <span className="text-gold font-bold">{user.badges.length}</span> / {ALL_BADGES.length} Unlocked
              </p>
              <div className="w-full max-w-md mx-auto h-1.5 bg-background rounded-full mt-2 overflow-hidden border border-white/5">
                 <div className="h-full bg-gradient-to-r from-primary to-gold" style={{ width: `${(user.badges.length / ALL_BADGES.length) * 100}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-text-main mb-2">Welcome back, {user.name.split(' ')[0]}</h1>
        <p className="text-text-muted">Here's your growth overview.</p>
      </header>

      {/* 1. AI Insights Box */}
      <div className="bg-gradient-to-r from-primary/40 via-background to-background border border-gold/30 p-6 rounded-2xl mb-8 relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-gold/10 rounded-full blur-3xl"></div>
        <div className="flex items-start gap-4 relative z-10">
          <div className="p-3 bg-gradient-to-br from-primary to-secondary rounded-xl shadow-lg text-white shrink-0 border border-white/10">
            <Sparkles size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-text-main mb-1 flex items-center gap-2">
              Kova AI Insight
              <span className="text-[10px] bg-gold/10 text-gold px-2 py-0.5 rounded-full border border-gold/20 uppercase tracking-wider">Beta</span>
            </h3>
            <p className="text-text-muted text-sm leading-relaxed max-w-3xl">
              "You've been crushing your morning sessions! 🚀 Your focus score peaks between 9 AM and 11 AM. Try scheduling a deep-work block this Thursday to maintain your streak. You're only 2 sessions away from the 'Consistency King' badge!"
            </p>
          </div>
        </div>
      </div>

      {/* Key Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-surface p-5 rounded-2xl border border-white/5 shadow-lg hover:border-gold/20 transition-colors group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-primary/20 rounded-xl text-primary group-hover:bg-primary group-hover:text-white transition-colors"><TrendingUp size={22} /></div>
            <span className="text-gold text-sm font-medium flex items-center gap-1"><Activity size={12}/> +12%</span>
          </div>
          <h3 className="text-2xl font-bold text-text-main">24.5 hrs</h3>
          <p className="text-sm text-text-muted">Total Co-working Time</p>
        </div>

        <div className="bg-surface p-5 rounded-2xl border border-white/5 shadow-lg hover:border-gold/20 transition-colors group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-secondary/20 rounded-xl text-secondary group-hover:bg-secondary group-hover:text-white transition-colors"><Target size={22} /></div>
            <span className="text-primary text-sm font-medium">85%</span>
          </div>
          <h3 className="text-2xl font-bold text-text-main">18 / 21</h3>
          <p className="text-sm text-text-muted">Goals Completed</p>
        </div>

        <div className="bg-surface p-5 rounded-2xl border border-white/5 shadow-lg hover:border-gold/20 transition-colors group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-gold/10 rounded-xl text-gold group-hover:bg-gold group-hover:text-surface transition-colors"><Award size={22} /></div>
            <span className="text-text-muted text-sm font-medium">Lvl 4</span>
          </div>
          <h3 className="text-2xl font-bold text-text-main">{user.badges.length}</h3>
          <p className="text-sm text-text-muted">Badges Earned</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Weekly Focus Chart */}
          <div className="bg-surface p-6 rounded-2xl border border-white/5 shadow-lg min-h-[300px]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-text-main flex items-center gap-2">
                <Clock size={18} className="text-text-muted"/> Weekly Activity
              </h3>
              <select className="bg-background border border-white/10 text-xs rounded-lg px-2 py-1 text-text-muted outline-none focus:border-gold/50">
                <option>This Week</option>
                <option>Last Week</option>
              </select>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <XAxis dataKey="name" stroke="#C7C8C9" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#C7C8C9" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111414', borderColor: '#D6A756', borderRadius: '12px', color: '#F5F4EE', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)', radius: 4 }}
                  />
                  <Bar dataKey="hours" radius={[2, 2, 2, 2]} barSize={32}>
                    {weeklyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.hours > 4 ? '#D6A756' : '#4FB1A7'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2. Productivity Heatmap */}
          <div className="bg-surface p-6 rounded-2xl border border-white/5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-main flex items-center gap-2">
                <Zap size={18} className="text-gold"/> Consistency Heatmap
              </h3>
              <span className="text-xs text-text-muted">Last 90 Days</span>
            </div>
            
            <div className="overflow-x-auto no-scrollbar w-full">
              <div className="grid grid-cols-[repeat(30,minmax(0,1fr))] gap-1 w-full">
                {heatmapData.map((data, idx) => (
                  <div key={idx} className="relative group w-full">
                    <div 
                      className={`w-full aspect-square rounded-[2px] transition-all duration-300 ${getHeatmapColor(data.intensity)}`}
                    ></div>
                    <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 w-max px-2 py-1 bg-black text-white text-xs rounded shadow-xl border border-surface left-1/2 -translate-x-1/2 pointer-events-none">
                       Day {data.day}: {data.intensity === 0 ? 'Rest' : data.intensity === 4 ? 'Peak' : data.intensity === 3 ? 'High' : data.intensity === 2 ? 'Medium' : 'Low'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-start gap-4 mt-4 text-xs text-text-muted">
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-[2px] bg-surface border border-white/5"></div> None</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-[2px] bg-secondary border border-secondary/50"></div> Low</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-[2px] bg-primary border border-primary-hover"></div> Med</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-[2px] bg-primary/40 border border-primary/20"></div> High</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-[2px] bg-gold shadow-[0_0_4px_rgba(214,167,86,0.5)]"></div> Peak</div>
            </div>
          </div>
        </div>

        {/* Right Column: Sidebar */}
        <div className="space-y-6">
          {/* 3. Clean Badges Area */}
          <div className="bg-surface p-6 rounded-2xl border border-white/5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-main">Earned Badges</h3>
              <Award size={18} className="text-gold" />
            </div>
            <div className="flex flex-wrap gap-2">
              {user.badges.length > 0 ? (
                user.badges.map(badge => (
                  <div key={badge.id} className="flex items-center gap-2 bg-background/80 px-3 py-2 rounded-full border border-gold/20 shadow-sm hover:border-gold/50 transition-colors cursor-default group">
                    <span className="text-lg filter drop-shadow-md group-hover:scale-110 transition-transform">{badge.icon}</span>
                    <span className="text-xs font-bold text-gold tracking-wide uppercase">{badge.name}</span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-text-muted italic w-full text-center py-4 border border-dashed border-white/10 rounded-xl">
                  No badges yet. Complete your first session!
                </div>
              )}
              <button 
                onClick={() => setShowBadgesModal(true)}
                className="w-full mt-2 py-2 rounded-lg border border-dashed border-white/10 text-text-muted text-xs hover:bg-background hover:text-gold transition-colors flex items-center justify-center gap-1"
              >
                See all available badges <ArrowRight size={12} />
              </button>
            </div>
          </div>
          
          {/* 4. Upcoming Sessions */}
          <div className="bg-surface p-6 rounded-2xl border border-white/5 shadow-lg flex-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-main">Upcoming Sessions</h3>
              <Calendar size={18} className="text-text-muted" />
            </div>
             <div className="space-y-4">
                <div className="group p-3 rounded-xl bg-background/50 border border-white/5 hover:bg-background hover:border-gold/30 transition-all cursor-pointer">
                   <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                         <span className="text-xs font-bold bg-gold/10 text-gold px-2 py-0.5 rounded uppercase">Today</span>
                         <span className="text-sm font-bold text-text-main">14:00</span>
                      </div>
                      <ArrowRight size={16} className="text-text-muted group-hover:text-gold transition-colors transform group-hover:translate-x-1" />
                   </div>
                   <div>
                      <h4 className="font-medium text-text-main group-hover:text-gold transition-colors">Sprint Planning</h4>
                      <div className="flex items-center gap-2 mt-1">
                         <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] text-white font-bold border border-primary-hover">S</div>
                         <p className="text-xs text-text-muted">with Sarah Chen</p>
                      </div>
                   </div>
                </div>

                 <div className="group p-3 rounded-xl bg-background/50 border border-white/5 hover:bg-background hover:border-gold/30 transition-all cursor-pointer">
                   <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                         <span className="text-xs font-bold bg-surface text-text-muted px-2 py-0.5 rounded uppercase border border-white/5">Tom</span>
                         <span className="text-sm font-bold text-text-main">09:00</span>
                      </div>
                   </div>
                   <div>
                      <h4 className="font-medium text-text-main group-hover:text-gold transition-colors">Deep Work Block</h4>
                      <div className="flex items-center gap-2 mt-1">
                         <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[10px] text-white font-bold border border-secondary/50">D</div>
                         <p className="text-xs text-text-muted">with David Kim</p>
                      </div>
                   </div>
                </div>

                <button className="w-full py-3 rounded-xl bg-primary/10 text-primary font-medium text-sm hover:bg-primary/20 transition-colors flex items-center justify-center gap-2 border border-primary/20">
                   <Calendar size={16} /> Schedule New
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;