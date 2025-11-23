
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { User, Badge } from '../types';
import { supabase } from '../supabaseClient';
import {
  TrendingUp,
  Target,
  Award,
  Sparkles,
  Calendar,
  Clock,
  ArrowRight,
  Activity,
  Zap,
  X,
  Lock,
  HelpCircle,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { ALL_BADGES } from '../constants';
import { getDisplayName } from '../utils/nameUtils';

interface DashboardProps {
  user: User;
}

interface CalendarDay {
  date: Date;
  dateKey: string; // 'YYYY-MM-DD'
  count: number; // raw activity count
  intensity: number; // 0-4
  isInCurrentYear: boolean;
}

interface DashboardMetrics {
  totalHours: number;
  hoursChange: number; // Percent change vs last week
  completedGoals: number;
  totalGoals: number;
  weeklyMessages: { name: string; value: number }[]; // value = hours focused that day
  calendarDays: CalendarDay[];
  scheduledSessions: ScheduledSession[];
}

interface ScheduledSession {
  id: string;
  title: string;
  scheduled_at: string;
  partner_email?: string;
}

// Kova Color Palette
const getHeatmapColor = (intensity: number) => {
  switch (intensity) {
    case 4:
      return 'bg-gold shadow-[0_0_8px_rgba(214,167,86,0.5)] border border-gold/50'; // Peak (Gold)
    case 3:
      return 'bg-primary/40 border border-primary/20'; // High (Faded Emerald)
    case 2:
      return 'bg-primary border border-primary-hover'; // Medium (Deep Emerald)
    case 1:
      return 'bg-secondary border border-secondary/50'; // Low (Soft Teal)
    default:
      return 'bg-surface border border-white/5'; // None
  }
};

const mapCountToIntensity = (count: number): number => {
  if (count === 0) return 0;
  if (count <= 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
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
          <div
            className={`text-4xl mb-1 transition-transform ${
              isEarned ? 'group-hover:scale-110 filter drop-shadow-md' : 'grayscale opacity-30'
            }`}
          >
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
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Heatmap constants
  const CELL_SIZE = 15;
  const CELL_GAP = 3;
  const GRID_OFFSET = CELL_SIZE + CELL_GAP;
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      setError('');

      try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const startOfYear = new Date(currentYear, 0, 1);
        const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);

        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(now.getDate() - 14);

        // --- 1. Fetch Sessions (Co-working Time) ---
        const { data: sessions } = await supabase
          .from('sessions')
          .select('started_at, ended_at')
          .or(`host_id.eq.${user.id},partner_id.eq.${user.id}`)
          .not('ended_at', 'is', null);

        let totalMinutes = 0;
        let thisWeekMinutes = 0;
        let lastWeekMinutes = 0;

        sessions?.forEach((s: any) => {
          const startTime = new Date(s.started_at);
          const endTime = s.ended_at ? new Date(s.ended_at) : null;

          const minutes = endTime
            ? Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 60000))
            : 0;

          totalMinutes += minutes;

          if (startTime >= sevenDaysAgo) {
            thisWeekMinutes += minutes;
          } else if (startTime >= fourteenDaysAgo && startTime < sevenDaysAgo) {
            lastWeekMinutes += minutes;
          }
        });

        const totalHours = parseFloat((totalMinutes / 60).toFixed(1));
        const hoursChange =
          lastWeekMinutes > 0
            ? Math.round(((thisWeekMinutes - lastWeekMinutes) / lastWeekMinutes) * 100)
            : thisWeekMinutes > 0
            ? 100
            : 0;

        // --- 2. Fetch Goals ---
        const { data: goalsData } = await supabase.from('goals').select('*').eq('user_id', user.id);

        const totalGoals = goalsData?.length || 0;
        const completedGoals = goalsData?.filter((g: any) => g.completed).length || 0;

        // --- 3. Weekly Focus (Hours per day from sessions) ---
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const weeklyMinutesMap = new Map<string, number>();

        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(now.getDate() - i);
          const dateKey = d.toLocaleDateString('en-CA'); // YYYY-MM-DD
          weeklyMinutesMap.set(dateKey, 0);
        }

        sessions?.forEach((s: any) => {
          const startTime = new Date(s.started_at);
          const endTime = s.ended_at ? new Date(s.ended_at) : null;

          const minutes = endTime
            ? Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 60000))
            : 0;

          const dateKey = startTime.toLocaleDateString('en-CA');

          if (weeklyMinutesMap.has(dateKey)) {
            weeklyMinutesMap.set(dateKey, (weeklyMinutesMap.get(dateKey) || 0) + minutes);
          }
        });

        const weeklyMessages = Array.from(weeklyMinutesMap.entries()).map(([dateKey, minutes]) => {
          const d = new Date(dateKey);
          const dayName = dayNames[d.getDay()];
          const hours = parseFloat((minutes / 60).toFixed(1));
          return { name: dayName, value: hours };
        });

        // --- 4. Consistency Heatmap (Full Year - GitHub Style) ---
        const startIso = startOfYear.toISOString();
        const endIso = endOfYear.toISOString();

        const { data: recentSwipes } = await supabase
          .from('swipes')
          .select('created_at')
          .eq('swiper_id', user.id)
          .gte('created_at', startIso)
          .lte('created_at', endIso);

        const { data: recentMsgs } = await supabase
          .from('messages')
          .select('created_at')
          .eq('sender_id', user.id)
          .gte('created_at', startIso)
          .lte('created_at', endIso);

        const { data: recentSessions } = await supabase
          .from('sessions')
          .select('started_at')
          .or(`host_id.eq.${user.id},partner_id.eq.${user.id}`)
          .gte('started_at', startIso)
          .lte('started_at', endIso);

        const activityCounts = new Map<string, number>();

        const recordActivity = (isoDate: string) => {
          const dateKey = new Date(isoDate).toLocaleDateString('en-CA');
          activityCounts.set(dateKey, (activityCounts.get(dateKey) || 0) + 1);
        };

        recentSwipes?.forEach((s: any) => recordActivity(s.created_at));
        recentMsgs?.forEach((m: any) => recordActivity(m.created_at));
        recentSessions?.forEach((s: any) => recordActivity(s.started_at));

        // Build Calendar Grid aligned to start on Sunday
        const calendarDays: CalendarDay[] = [];

        // Find Sunday before Jan 1
        const startDayOfWeek = startOfYear.getDay(); // 0=Sun..6=Sat
        const gridStart = new Date(startOfYear);
        gridStart.setDate(startOfYear.getDate() - startDayOfWeek);

        // Find Saturday after Dec 31
        const endDayOfWeek = endOfYear.getDay();
        const gridEnd = new Date(endOfYear);
        gridEnd.setDate(endOfYear.getDate() + (6 - endDayOfWeek));

        const d = new Date(gridStart);
        while (d <= gridEnd) {
          const dateKey = d.toLocaleDateString('en-CA');
          const count = activityCounts.get(dateKey) || 0;
          const intensity = mapCountToIntensity(count);

          const isInYear = d >= startOfYear && d <= endOfYear;
          const isFuture = d > now;

          calendarDays.push({
            date: new Date(d),
            dateKey,
            count,
            intensity: isInYear && !isFuture ? intensity : 0,
            isInCurrentYear: isInYear,
          });

          d.setDate(d.getDate() + 1);
        }

        // --- 5. Upcoming Sessions ---
        const { data: scheduled } = await supabase
          .from('scheduled_sessions')
          .select('*')
          .eq('user_id', user.id)
          .gte('scheduled_at', now.toISOString())
          .order('scheduled_at', { ascending: true })
          .limit(5);

        setMetrics({
          totalHours,
          hoursChange,
          totalGoals,
          completedGoals,
          weeklyMessages,
          calendarDays,
          scheduledSessions: scheduled || [],
        });
      } catch (err) {
        console.error('Dashboard data load error:', err);
        setError('Failed to load dashboard metrics.');
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.id) {
      loadDashboardData();
    }
  }, [user.id]);

  // --- Month label positions (in columns) ---
  const monthLabels: { month: number; colIndex: number }[] = [];
  if (metrics && metrics.calendarDays) {
    metrics.calendarDays.forEach((day, index) => {
      if (day.isInCurrentYear && day.date.getDate() === 1) {
        const month = day.date.getMonth();
        const exists = monthLabels.some((m) => m.month === month);
        if (!exists) {
          const colIndex = Math.floor(index / 7); // week column for this day
          monthLabels.push({ month, colIndex });
        }
      }
    });
  }

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background text-text-muted">
        <Loader2 className="animate-spin w-8 h-8 text-gold" />
        <span className="ml-3 text-sm font-medium">Loading insights...</span>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="h-full w-full p-8 bg-background text-text-main">
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400 text-center">
          {error || 'Could not load data.'}
        </div>
      </div>
    );
  }

  // Find index of last in-year day
  const lastInYearIndex = metrics.calendarDays.reduceRight(
    (acc, day, index) => (acc === -1 && day.isInCurrentYear ? index : acc),
    -1
  );

  // Fallback: if somehow not found, keep current behavior
  const visibleWeeks =
    lastInYearIndex === -1
      ? Math.ceil(metrics.calendarDays.length / 7)
      : Math.floor(lastInYearIndex / 7) + 1;

  const GRID_WIDTH = visibleWeeks * GRID_OFFSET - CELL_GAP;
  const GRID_HEIGHT = 7 * CELL_SIZE + 6 * CELL_GAP;

  return (
    <div className="h-full w-full overflow-y-auto p-4 md:p-8 bg-background text-text-main relative">
      {/* Badges Modal */}
      {showBadgesModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          onClick={() => setShowBadgesModal(false)}
        >
          <div
            className="bg-surface w-full max-w-3xl rounded-3xl border border-white/10 shadow-2xl p-8 overflow-y-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold text-text-main flex items-center gap-2">
                  <Award className="text-gold" /> Achievements
                </h2>
                <p className="text-text-muted mt-1">Earn badges by staying consistent and collaborating.</p>
              </div>
              <button
                onClick={() => setShowBadgesModal(false)}
                className="p-2 rounded-full hover:bg-background text-text-muted hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {ALL_BADGES.map((badge) => {
                const isEarned = user.badges.some((b) => b.id === badge.id);
                return <BadgeCard key={badge.id} badge={badge} isEarned={isEarned} />;
              })}
            </div>

            <div className="mt-8 text-center">
              <p className="text-xs text-text-muted">
                Progress: <span className="text-gold font-bold">{user.badges.length}</span> / {ALL_BADGES.length} Unlocked
              </p>
              <div className="w-full max-w-md mx-auto h-1.5 bg-background rounded-full mt-2 overflow-hidden border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-primary to-gold"
                  style={{ width: `${(user.badges.length / ALL_BADGES.length) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-text-main mb-2">
          Welcome back, {getDisplayName(user.name).split(' ')[0]}
        </h1>
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
              <span className="text-[10px] bg-gold/10 text-gold px-2 py-0.5 rounded-full border border-gold/20 uppercase tracking-wider">
                Beta
              </span>
            </h3>
            <p className="text-text-muted text-sm leading-relaxed max-w-3xl">
              "You've been crushing your morning sessions! 🚀 Your focus score peaks between 9 AM and 11 AM. Try
              scheduling a deep-work block this Thursday to maintain your streak."
            </p>
          </div>
        </div>
      </div>

      {/* Key Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-surface p-5 rounded-2xl border border-white/5 shadow-lg hover:border-gold/20 transition-colors group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-primary/20 rounded-xl text-primary group-hover:bg-primary group-hover:text-white transition-colors">
              <TrendingUp size={22} />
            </div>
            <span
              className={`text-sm font-medium flex items-center gap-1 ${
                metrics.hoursChange >= 0 ? 'text-gold' : 'text-red-400'
              }`}
            >
              <Activity size={12} /> {metrics.hoursChange > 0 ? '+' : ''}
              {metrics.hoursChange}%
            </span>
          </div>
          <h3 className="text-2xl font-bold text-text-main">{metrics.totalHours} hrs</h3>
          <p className="text-sm text-text-muted">Total Co-working Time</p>
        </div>

        <div className="bg-surface p-5 rounded-2xl border border-white/5 shadow-lg hover:border-gold/20 transition-colors group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-secondary/20 rounded-xl text-secondary group-hover:bg-secondary group-hover:text-white transition-colors">
              <Target size={22} />
            </div>
            <span className="text-primary text-sm font-medium">
              {metrics.totalGoals > 0 ? Math.round((metrics.completedGoals / metrics.totalGoals) * 100) : 0}%
            </span>
          </div>
          <h3 className="text-2xl font-bold text-text-main">
            {metrics.completedGoals} / {metrics.totalGoals}
          </h3>
          <p className="text-sm text-text-muted">Goals Completed</p>
        </div>

        <div className="bg-surface p-5 rounded-2xl border border-white/5 shadow-lg hover:border-gold/20 transition-colors group relative">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-gold/10 rounded-xl text-gold group-hover:bg-gold group-hover:text-surface transition-colors">
              <Award size={22} />
            </div>
            <span className="text-text-muted text-sm font-medium">
              Lvl {Math.floor(user.badges.length / 3) + 1}
            </span>
          </div>
          <h3 className="text-2xl font-bold text-text-main">{user.badges.length}</h3>
          <p className="text-sm text-text-muted">Badges Earned</p>

          <button
            onClick={() => setShowBadgesModal(true)}
            className="mt-3 inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-gold border border-dashed border-white/10 rounded-full px-3 py-1 transition-colors"
          >
            See all available badges <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {/* 2. Charts & Sessions Grid */}
      <div className="flex flex-col gap-6">
        {/* Weekly Focus Chart - Full Width */}
        <div className="bg-surface p-6 rounded-2xl border border-white/5 shadow-lg min-h-[300px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-text-main flex items-center gap-2">
              <Clock size={18} className="text-text-muted" /> Weekly Focus Hours
            </h3>
            <select className="bg-background border border-white/10 text-xs rounded-lg px-2 py-1 text-text-muted outline-none focus:border-gold/50">
              <option>This Week</option>
            </select>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.weeklyMessages}>
                <XAxis dataKey="name" stroke="#C7C8C9" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis
                  stroke="#C7C8C9"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 12]}
                  ticks={[0, 2, 4, 6, 8, 10, 12]}
                  tickFormatter={(value: number) => (value === 12 ? '12+h' : `${value}h`)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111414',
                    borderColor: '#D6A756',
                    borderRadius: '12px',
                    color: '#F5F4EE',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                  }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)', radius: 4 }}
                  formatter={(value: number) => [`${value} hrs`, 'Focus']}
                />
                <Bar dataKey="value" name="Focus Hours" radius={[2, 2, 2, 2]} barSize={32}>
                  {metrics.weeklyMessages.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.value > 5 ? '#D6A756' : '#4FB1A7'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom Row: Heatmap & Upcoming Sessions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 3. Consistency Heatmap */}
          <div className="bg-surface p-6 rounded-2xl border border-white/5 shadow-lg h-full flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-main flex items-center gap-2">
                <Zap size={18} className="text-gold" /> Consistency Heatmap
              </h3>
              <span className="text-xs text-text-muted">{new Date().getFullYear()}</span>
            </div>

            {/* Heatmap Container - Scrollable if too narrow */}
            <div className="w-full pb-2 overflow-x-auto no-scrollbar">
              <div className="flex items-start gap-4 w-full justify-center min-w-max">
                {/* Y-axis labels (Mon / Wed / Fri) */}
                <div
                  className="relative shrink-0 text-[10px] text-text-muted font-medium w-8 text-right mr-2 pt-[20px]"
                  style={{ height: GRID_HEIGHT + 20 }} // +20 for padding matching months row offset approx
                >
                  {[
                    { label: 'Mon', dayIndex: 1 },
                    { label: 'Wed', dayIndex: 3 },
                    { label: 'Fri', dayIndex: 5 },
                  ].map(({ label, dayIndex }) => (
                    <span
                      key={label}
                      className="absolute right-0 flex items-center justify-end"
                      style={{
                        // Align to top of the row
                        top: 20 + (dayIndex * GRID_OFFSET), 
                        height: CELL_SIZE,
                      }}
                    >
                      {label}
                    </span>
                  ))}
                </div>

                {/* Right side: months + grid */}
                <div className="flex flex-col gap-[3px]">
                  {/* Month labels */}
                  <div className="relative h-[16px]" style={{ width: GRID_WIDTH }}>
                    {monthLabels.map((item) => (
                      <span
                        key={item.month}
                        className="absolute text-[10px] text-text-muted -translate-x-1/2"
                        style={{
                          left: item.colIndex * GRID_OFFSET + CELL_SIZE / 2,
                          top: 0,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {MONTH_NAMES[item.month]}
                      </span>
                    ))}
                  </div>

                  {/* Heatmap grid */}
                  <div className="relative" style={{ width: GRID_WIDTH, height: GRID_HEIGHT }}>
                    {metrics.calendarDays.map((day, index) => {
                      const weekIndex = Math.floor(index / 7);
                      const dayOfWeek = day.date.getDay(); // 0=Sun..6=Sat

                      // Do not render cells that would sit beyond the visible width
                      if (weekIndex >= visibleWeeks) return null;

                      const left = weekIndex * GRID_OFFSET;
                      const top = dayOfWeek * GRID_OFFSET;
                      
                      // Flip tooltip for bottom rows (Thu-Sat) to prevent clipping
                      const isBottomRow = dayOfWeek >= 4; 

                      return (
                        <div
                          key={day.dateKey}
                          className="absolute group"
                          style={{
                            width: CELL_SIZE,
                            height: CELL_SIZE,
                            left,
                            top,
                          }}
                        >
                          <div
                            className={`w-full h-full rounded-[3px] transition-all duration-300 ${
                              day.isInCurrentYear ? getHeatmapColor(day.intensity) : 'bg-transparent'
                            }`}
                          />
                          {day.isInCurrentYear && (
                            <div className={`absolute ${isBottomRow ? 'bottom-full mb-1' : 'top-full mt-1'} left-1/2 -translate-x-1/2 hidden group-hover:block z-50 w-max px-2.5 py-1.5 bg-background text-text-main text-xs rounded-lg shadow-xl border border-white/10 pointer-events-none`}>
                              <p className="font-semibold text-text-muted">
                                {day.date.toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </p>
                              <p className="font-bold mt-0.5">
                                {day.count === 0
                                  ? 'No activity'
                                  : `${day.count} contribution${day.count !== 1 ? 's' : ''}`}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-4 text-xs text-text-muted w-full">
              <span className="mr-1">Less</span>
              <div className="flex items-center gap-1">
                <div className="w-[15px] h-[15px] rounded-[2px] bg-surface border border-white/5"></div>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-[15px] h-[15px] rounded-[2px] bg-secondary border border-secondary/50"></div>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-[15px] h-[15px] rounded-[2px] bg-primary border border-primary-hover"></div>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-[15px] h-[15px] rounded-[2px] bg-primary/40 border border-primary/20"></div>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-[15px] h-[15px] rounded-[2px] bg-gold shadow-[0_0_4px_rgba(214,167,86,0.5)] border border-gold/50"></div>
              </div>
              <span className="ml-1">More</span>
            </div>
          </div>

          {/* 4. Upcoming Sessions */}
          <div className="bg-surface p-6 rounded-2xl border border-white/5 shadow-lg h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-main">Upcoming Sessions</h3>
              <Calendar size={18} className="text-text-muted" />
            </div>
            <div className="space-y-4 flex-1">
              {metrics.scheduledSessions.length > 0 ? (
                metrics.scheduledSessions.map((session) => (
                  <div
                    key={session.id}
                    className="group p-3 rounded-xl bg-background/50 border border-white/5 hover:bg-background hover:border-gold/30 transition-all cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold bg-gold/10 text-gold px-2 py-0.5 rounded uppercase">
                          {new Date(session.scheduled_at).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <span className="text-sm font-bold text-text-main">
                          {new Date(session.scheduled_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <ArrowRight
                        size={16}
                        className="text-text-muted group-hover:text-gold transition-colors transform group-hover:translate-x-1"
                      />
                    </div>
                    <div>
                      <h4 className="font-medium text-text-main group-hover:text-gold transition-colors">
                        {session.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] text-white font-bold border border-primary-hover">
                          P
                        </div>
                        <p className="text-xs text-text-muted">
                          {session.partner_email ? `with ${session.partner_email}` : 'Solo Session'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-text-muted text-center py-4">No upcoming sessions scheduled.</div>
              )}
            </div>

            <div className="mt-4 pt-2">
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
