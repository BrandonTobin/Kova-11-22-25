import React, { useState, useEffect, useCallback } from 'react';
import { User, Badge, Goal, hasProAccess, Match, SubscriptionTier } from '../types';
import { supabase } from '../supabaseClient';
import {
  TrendingUp,
  Target,
  Award,
  Sparkles,
  Calendar,
  ArrowRight,
  Activity,
  Zap,
  X,
  Lock,
  HelpCircle,
  RotateCcw,
  Loader2,
  BarChart2,
  Users,
  Shield,
  Clock,
  Crown,
  Search,
  Check,
  ChevronDown
} from 'lucide-react';
import { ALL_BADGES } from '../constants';
import { getDisplayName } from '../utils/nameUtils';

interface DashboardProps {
  user: User;
  matches: Match[];
  onUpgrade: (tier: SubscriptionTier) => void;
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
  hoursChange: number;
  completedGoals: number;
  totalGoals: number;
  goals: Goal[];
  weeklyMessages: { name: string; value: number }[];
  calendarDaysProductivity: CalendarDay[];
  calendarDaysConsistency: CalendarDay[];
  calendarDaysGoals: CalendarDay[];
  scheduledSessions: ScheduledSession[];
  weeklyFocusHours: number;
  weeklySessionsCount: number;
  weeklyActiveDays: number;
  weeklyAvgSessionMinutes: number;
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
      return 'bg-gold border border-gold/50';
    case 3:
      return 'bg-primary/40 border border-primary/20';
    case 2:
      return 'bg-primary border border-primary-hover';
    case 1:
      return 'bg-secondary border border-secondary/50';
    default:
      return 'bg-surface/70 border border-black/15 dark:border-white/5';
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

// --- Schedule Modal ---
const ScheduleModal: React.FC<{ matches: Match[]; onClose: () => void; onSchedule: () => void; userId: string }> = ({ matches, onClose, onSchedule, userId }) => {
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredMatches = matches.filter(m =>
    getDisplayName(m.user.name).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSchedule = async () => {
    if (!date || !time) return;
    setIsSubmitting(true);

    try {
      const startDateTime = new Date(`${date}T${time}`);
      const sessionsToCreate = [];

      const title = selectedMatch
        ? `Co-working with ${getDisplayName(selectedMatch.user.name)}`
        : 'Solo Focus Session';

      const partnerEmail = selectedMatch?.user.email || null;

      // Generate occurrences based on recurrence
      let count = 1;
      if (recurrence === 'daily') count = 5; // Schedule next 5 days
      if (recurrence === 'weekly') count = 4; // Schedule next 4 weeks
      if (recurrence === 'monthly') count = 3; // Schedule next 3 months

      for (let i = 0; i < count; i++) {
        const sessionDate = new Date(startDateTime);

        if (recurrence === 'daily') sessionDate.setDate(sessionDate.getDate() + i);
        if (recurrence === 'weekly') sessionDate.setDate(sessionDate.getDate() + i * 7);
        if (recurrence === 'monthly') sessionDate.setMonth(sessionDate.getMonth() + i);

        sessionsToCreate.push({
          user_id: userId,
          partner_email: partnerEmail,
          title: title,
          scheduled_at: sessionDate.toISOString()
        });
      }

      const { error } = await supabase.from('scheduled_sessions').insert(sessionsToCreate);

      if (error) throw error;

      onSchedule();
      onClose();
    } catch (err) {
      console.error('Scheduling failed:', err);
      alert('Failed to schedule session.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface w-full max-w-md rounded-3xl border border-white/10 shadow-2xl p-6 animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-text-main">Schedule Session</h3>
          <button onClick={onClose} className="text-text-muted hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-5">
          {/* 1. Partner Selection */}
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
              Select Partner
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                <Search size={16} />
              </div>
              <input
                type="text"
                placeholder="Search matches..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-text-main focus:border-gold/50 outline-none"
              />
            </div>

            <div className="mt-2 max-h-32 overflow-y-auto border border-white/5 rounded-xl bg-background/50 no-scrollbar">
              <div
                onClick={() => setSelectedMatch(null)}
                className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 border-b border-white/5 ${
                  !selectedMatch ? 'bg-primary/10' : ''
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                  <Users size={14} />
                </div>
                <span className="text-sm font-medium">Solo Session</span>
                {!selectedMatch && <Check size={16} className="ml-auto text-primary" />}
              </div>
              {filteredMatches.map(match => (
                <div
                  key={match.id}
                  onClick={() => setSelectedMatch(match)}
                  className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 border-b border-white/5 last:border-0 ${
                    selectedMatch?.id === match.id ? 'bg-primary/10' : ''
                  }`}
                >
                  <img src={match.user.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                  <span className="text-sm font-medium">{getDisplayName(match.user.name)}</span>
                  {selectedMatch?.id === match.id && <Check size={16} className="ml-auto text-primary" />}
                </div>
              ))}
            </div>
          </div>

          {/* 2. Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-xl px-3 py-3 text-sm text-text-main focus:border-gold/50 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                Time
              </label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-xl px-3 py-3 text-sm text-text-main focus:border-gold/50 outline-none"
              />
            </div>
          </div>

          {/* 3. Recurrence */}
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
              Repeat
            </label>
            <div className="relative">
              <select
                value={recurrence}
                onChange={e => setRecurrence(e.target.value as any)}
                className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-sm text-text-main focus:border-gold/50 outline-none appearance-none"
              >
                <option value="none">Just Once</option>
                <option value="daily">Daily (Next 5 Days)</option>
                <option value="weekly">Weekly (Next 4 Weeks)</option>
                <option value="monthly">Monthly (Next 3 Months)</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-text-muted">
                <ChevronDown size={16} />
              </div>
            </div>
          </div>

          <button
            onClick={handleSchedule}
            disabled={!date || !time || isSubmitting}
            className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg hover:bg-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Confirm Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ user, matches = [], onUpgrade }) => {
  const [showBadgesModal, setShowBadgesModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [heatmapMode, setHeatmapMode] = useState<'productivity' | 'consistency' | 'goals'>('productivity');
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Use new helper for specific feature access
  const isPro = hasProAccess(user);

  // Heatmap constants
  const CELL_SIZE = 15;
  const CELL_GAP = 3;
  const GRID_OFFSET = CELL_SIZE + CELL_GAP;
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const handleHeatmapModeChange = (mode: 'productivity' | 'consistency' | 'goals') => {
    // Allow selecting any mode to show the locked overlay if not pro
    setHeatmapMode(mode);
  };

  const handleScheduleComplete = () => {
    setRefreshKey(prev => prev + 1);
  };

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      setError('');

      // Skip data loading for the mock user used in onboarding
      if (user.id === '00000000-0000-0000-0000-000000000000') {
        const fakeCalendarDays: CalendarDay[] = [];
        const now = new Date();
        const currentYear = now.getFullYear();
        const startOfYear = new Date(currentYear, 0, 1);
        const endOfYear = new Date(currentYear, 11, 31);
        const startDayOfWeek = startOfYear.getDay();
        const gridStart = new Date(startOfYear);
        gridStart.setDate(startOfYear.getDate() - startDayOfWeek);
        const endDayOfWeek = endOfYear.getDay();
        const gridEnd = new Date(endOfYear);
        gridEnd.setDate(endOfYear.getDate() + (6 - endDayOfWeek));

        const d = new Date(gridStart);
        while (d <= gridEnd) {
          const isInYear = d >= startOfYear && d <= endOfYear;
          fakeCalendarDays.push({
            date: new Date(d),
            dateKey: d.toLocaleDateString('en-CA'),
            count: Math.random() > 0.7 ? Math.floor(Math.random() * 5) : 0,
            intensity: isInYear && d <= now ? (Math.random() > 0.7 ? Math.floor(Math.random() * 4) + 1 : 0) : 0,
            isInCurrentYear: isInYear
          });
          d.setDate(d.getDate() + 1);
        }

        setMetrics({
          totalHours: 42.5,
          hoursChange: 12,
          totalGoals: 15,
          completedGoals: 8,
          goals: [
            { id: '1', text: 'Launch Beta', completed: true },
            { id: '2', text: 'Find Co-founder', completed: false }
          ],
          weeklyMessages: [
            { name: 'Sun', value: 2 },
            { name: 'Mon', value: 5 },
            { name: 'Tue', value: 3 },
            { name: 'Wed', value: 6 },
            { name: 'Thu', value: 4 },
            { name: 'Fri', value: 8 },
            { name: 'Sat', value: 3 }
          ],
          calendarDaysProductivity: fakeCalendarDays,
          calendarDaysConsistency: fakeCalendarDays,
          calendarDaysGoals: fakeCalendarDays,
          scheduledSessions: [],
          weeklyFocusHours: 14.2,
          weeklySessionsCount: 5,
          weeklyActiveDays: 4,
          weeklyAvgSessionMinutes: 45
        });
        setIsLoading(false);
        return;
      }

      try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const startOfYear = new Date(currentYear, 0, 1);
        const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);

        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(now.getDate() - 14);

        // --- 1. Fetch Sessions ---
        const { data: sessions } = await supabase
          .from('sessions')
          .select('started_at, ended_at')
          .or(`host_id.eq.${user.id},partner_id.eq.${user.id}`)
          .not('ended_at', 'is', null);

        let totalMinutes = 0;
        let thisWeekMinutes = 0;
        let lastWeekMinutes = 0;
        let thisWeekSessionsCount = 0;

        sessions?.forEach((s: any) => {
          const startTime = new Date(s.started_at);
          const endTime = s.ended_at ? new Date(s.ended_at) : null;

          const minutes = endTime
            ? Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 60000))
            : 0;

          totalMinutes += minutes;

          if (startTime >= sevenDaysAgo) {
            thisWeekMinutes += minutes;
            thisWeekSessionsCount++;
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
          const dateKey = d.toLocaleDateString('en-CA');
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

        const weeklyFocusHours = parseFloat((thisWeekMinutes / 60).toFixed(1));
        const weeklyActiveDays = weeklyMessages.filter(d => d.value > 0).length;
        const weeklyAvgSessionMinutes =
          thisWeekSessionsCount > 0 ? thisWeekMinutes / thisWeekSessionsCount : 0;

        // --- 4. Consistency Heatmap ---
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

        const productivityCounts = new Map<string, number>();
        const consistencyCounts = new Map<string, number>();
        const goalCounts = new Map<string, number>();

        // 4.1 Productivity Mode
        sessions?.forEach((s: any) => {
          const startTime = new Date(s.started_at);
          const endTime = s.ended_at ? new Date(s.ended_at) : null;
          if (!endTime) return;

          const minutes = Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 60000));
          const dateKey = startTime.toLocaleDateString('en-CA');

          productivityCounts.set(dateKey, (productivityCounts.get(dateKey) || 0) + minutes);
        });

        // 4.2 Consistency Mode
        const recordConsistency = (isoDate: string) => {
          const dateKey = new Date(isoDate).toLocaleDateString('en-CA');
          consistencyCounts.set(dateKey, (consistencyCounts.get(dateKey) || 0) + 1);
        };
        recentSwipes?.forEach((s: any) => recordConsistency(s.created_at));
        recentMsgs?.forEach((m: any) => recordConsistency(m.created_at));
        recentSessions?.forEach((s: any) => recordConsistency(s.started_at));

        // 4.3 Deep-Work Quality Mode (replaces Goal Progress logic)
        sessions?.forEach((s: any) => {
          const startTime = new Date(s.started_at);
          const endTime = s.ended_at ? new Date(s.ended_at) : null;
          if (!endTime) return;

          const minutes = Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 60000));
          const dateKey = startTime.toLocaleDateString('en-CA');

          // Heuristic:
          // 1 point roughly every 15 mins
          // Bonus +2 points for long deep work sessions (> 50 mins)
          let sessionScore = Math.floor(minutes / 15);
          if (minutes > 50) sessionScore += 2;
          if (sessionScore === 0 && minutes > 5) sessionScore = 1; // Minimum score for short sessions

          goalCounts.set(dateKey, (goalCounts.get(dateKey) || 0) + sessionScore);
        });

        const buildCalendarDays = (countsMap: Map<string, number>): CalendarDay[] => {
          const calendarDays: CalendarDay[] = [];

          const startDayOfWeek = startOfYear.getDay();
          const gridStart = new Date(startOfYear);
          gridStart.setDate(startOfYear.getDate() - startDayOfWeek);

          const endDayOfWeek = endOfYear.getDay();
          const gridEnd = new Date(endOfYear);
          gridEnd.setDate(endOfYear.getDate() + (6 - endDayOfWeek));

          const d = new Date(gridStart);
          while (d <= gridEnd) {
            const dateKey = d.toLocaleDateString('en-CA');
            const count = countsMap.get(dateKey) || 0;
            const intensity = mapCountToIntensity(count);

            const isInYear = d >= startOfYear && d <= endOfYear;
            const isFuture = d > now;

            calendarDays.push({
              date: new Date(d),
              dateKey,
              count,
              intensity: isInYear && !isFuture ? intensity : 0,
              isInCurrentYear: isInYear
            });

            d.setDate(d.getDate() + 1);
          }
          return calendarDays;
        };

        const calendarDaysProductivity = buildCalendarDays(productivityCounts);
        const calendarDaysConsistency = buildCalendarDays(consistencyCounts);
        const calendarDaysGoals = buildCalendarDays(goalCounts);

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
          goals: goalsData || [],
          weeklyMessages,
          calendarDaysProductivity,
          calendarDaysConsistency,
          calendarDaysGoals,
          scheduledSessions: scheduled || [],
          weeklyFocusHours,
          weeklySessionsCount: thisWeekSessionsCount,
          weeklyActiveDays,
          weeklyAvgSessionMinutes
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
  }, [user.id, refreshKey]);

  const calendarDays = metrics
    ? heatmapMode === 'productivity'
      ? metrics.calendarDaysProductivity
      : heatmapMode === 'consistency'
      ? metrics.calendarDaysConsistency
      : metrics.calendarDaysGoals
    : [];

  const monthLabels: { month: number; colIndex: number }[] = [];
  if (calendarDays.length > 0) {
    calendarDays.forEach((day, index) => {
      if (day.isInCurrentYear && day.date.getDate() === 1) {
        const month = day.date.getMonth();
        const exists = monthLabels.some(m => m.month === month);
        if (!exists) {
          const colIndex = Math.floor(index / 7);
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
  const lastInYearIndex = calendarDays.reduceRight(
    (acc, day, index) => (acc === -1 && day.isInCurrentYear ? index : acc),
    -1
  );

  const visibleWeeks =
    lastInYearIndex === -1 ? Math.ceil(calendarDays.length / 7) : Math.floor(lastInYearIndex / 7) + 1;

  const safeVisibleWeeks = Math.max(1, visibleWeeks);

  const GRID_WIDTH = safeVisibleWeeks * GRID_OFFSET - CELL_GAP;
  const GRID_HEIGHT = 7 * CELL_SIZE + 6 * CELL_GAP;

  // --------- NEW: derived data for Kova Pro Goal Intelligence card ----------
  const activeGoalsForRoadmap = metrics.goals.filter(g => !g.completed);
  const fallbackRoadmapSource =
    activeGoalsForRoadmap.length > 0 ? activeGoalsForRoadmap : metrics.goals;
  const roadmapPreview = fallbackRoadmapSource.slice(0, 3);

  const nowForEta = new Date();
  const estimatedDaysToCompletion =
    activeGoalsForRoadmap.length > 0 ? 7 + activeGoalsForRoadmap.length * 3 : 7;

  const eta = new Date(nowForEta);
  eta.setDate(nowForEta.getDate() + estimatedDaysToCompletion);
  const etaLabel = eta.toLocaleDateString([], { month: 'short', day: 'numeric' });

  const totalGoalsCount = metrics.goals.length || 0;
  const completedGoalsCount = metrics.goals.filter(g => g.completed).length || 0;
  const completionRatio = totalGoalsCount > 0 ? completedGoalsCount / totalGoalsCount : 0;
  const confidence = Math.round(60 + completionRatio * 35);
  // -------------------------------------------------------------------------

  // Locked check for heatmaps (Pro Only)
  const isLockedHeatmap = !isPro && (heatmapMode === 'consistency' || heatmapMode === 'goals');

  return (
    <div className="h-full w-full overflow-y-auto p-4 md:p-8 bg-background text-text-main relative">
      {/* Schedule Modal */}
      {showScheduleModal && (
        <ScheduleModal
          matches={matches}
          onClose={() => setShowScheduleModal(false)}
          onSchedule={handleScheduleComplete}
          userId={user.id}
        />
      )}

      {/* Badges Modal */}
      {showBadgesModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          onClick={() => setShowBadgesModal(false)}
        >
          <div
            className="bg-surface w-full max-w-3xl rounded-3xl border border-white/10 shadow-2xl p-8 overflow-y-auto max-h-[90vh]"
            onClick={e => e.stopPropagation()}
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
                <div
                  className="h-full bg-gradient-to-r from-primary to-gold"
                  style={{ width: `${(user.badges.length / ALL_BADGES.length) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="mb-8 pr-16">
        <h1 className="text-3xl font-bold text-text-main mb-2">
          Welcome back, {getDisplayName(user.name).split(' ')[0]}
        </h1>
        <p className="text-text-muted">Here's your growth overview.</p>
      </header>

      {/* AI Insight Banner – toned down, Pro-gated */}
      <div className="mb-8">
        <div className="relative flex items-start gap-3 rounded-2xl border border-white/10 bg-background/30 backdrop-blur-xl px-4 py-3 md:px-5 md:py-4 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary shrink-0">
            <Sparkles size={18} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-text-main">Kova AI Insight</span>
              <span className="text-[10px] uppercase tracking-wide text-text-muted border border-white/10 rounded-full px-2 py-0.5">
                Beta
              </span>
              {!isPro && (
                <span className="inline-flex items-center gap-1 text-[10px] text-text-muted ml-1">
                  <Lock size={10} /> Pro
                </span>
              )}
            </div>

            <p
              className={`text-xs md:text-sm text-text-muted transition-all ${
                !isPro ? 'md:line-clamp-2 line-clamp-1 blur-[1px]' : ''
              }`}
            >
              You’ve been crushing your morning sessions. Your focus score peaks between 9 AM and 11 AM—try blocking a
              deep-work session mid-week to keep the streak alive.
            </p>
          </div>

          {!isPro && (
            <button
              onClick={() => onUpgrade('kova_pro')}
              className="ml-3 inline-flex items-center whitespace-nowrap rounded-xl border border-gold/40 bg-background/60 px-3 py-1.5 text-[11px] font-semibold text-gold hover:bg-gold/10 transition-colors"
            >
              <Crown size={12} className="mr-1" />
              Upgrade
            </button>
          )}
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
        {/* This Week Summary Card */}
        <div className="bg-surface p-6 rounded-2xl border border-white/5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-main">This Week's Summary</h3>
            <span className="text-xs text-text-muted">Last 7 days</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wide text-text-muted">Focus Hours</span>
              <span className="text-xl font-semibold text-text-main">{metrics.weeklyFocusHours.toFixed(1)}</span>
            </div>

            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wide text-text-muted">Sessions</span>
              <span className="text-xl font-semibold text-text-main">{metrics.weeklySessionsCount}</span>
            </div>

            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wide text-text-muted">Active Days</span>
              <span className="text-xl font-semibold text-text-main">{metrics.weeklyActiveDays}</span>
            </div>

            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wide text-text-muted">Avg Session</span>
              <span className="text-xl font-semibold text-text-main">
                {Math.round(metrics.weeklyAvgSessionMinutes)} min
              </span>
            </div>
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

              <div className="flex items-center gap-3">
                <div className="inline-flex items-center rounded-full bg-background/60 border border-white/5 text-[11px] overflow-hidden">
                  {[
                    { key: 'productivity', label: 'Productivity', locked: false },
                    { key: 'consistency', label: 'Consistency', locked: !isPro },
                    { key: 'goals', label: 'Deep-Work Quality', locked: !isPro }
                  ].map(mode => (
                    <button
                      key={mode.key}
                      type="button"
                      onClick={() => handleHeatmapModeChange(mode.key as any)}
                      className={
                        'px-3 py-1.5 transition-colors flex items-center gap-1 ' +
                        (heatmapMode === mode.key
                          ? 'bg-primary text-white'
                          : 'text-text-muted hover:bg-background')
                      }
                    >
                      {mode.locked && <Lock size={10} className="text-text-muted/70" />}
                      {mode.label}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-text-muted">{new Date().getFullYear()}</span>
              </div>
            </div>

            {/* Heatmap Container */}
            <div className="w-full pb-2 overflow-hidden relative">
              {/* Overlay for locked modes */}
              {isLockedHeatmap && (
                <div 
                   className="absolute inset-0 z-50 flex items-center justify-center bg-black pointer-events-auto cursor-pointer"
                   onClick={() => onUpgrade('kova_pro')}
                >
                   <div className="px-4 py-2 rounded-full bg-black/80 flex items-center gap-2 border border-white/10 shadow-xl">
                      <Lock size={12} className="text-zinc-400" />
                      <span className="text-xs font-semibold tracking-wide text-white">
                        Kova Pro | Coming Soon
                      </span>
                   </div>
                </div>
              )}

              <div className={`origin-top-left scale-[0.45] lg:scale-[0.5] xl:scale-[0.65] 2xl:scale-[0.8] min-[1900px]:scale-100 ${isLockedHeatmap ? 'pointer-events-none' : ''}`}>
                <div className="flex items-start gap-4 w-full justify-center min-w-max">
                  {/* Y-axis labels */}
                  <div
                    className="relative shrink-0 text-[10px] text-text-muted font-medium w-8 text-right mr-2 pt-[20px]"
                    style={{ height: GRID_HEIGHT + 20 }}
                  >
                    {[
                      { label: 'Mon', dayIndex: 1 },
                      { label: 'Wed', dayIndex: 3 },
                      { label: 'Fri', dayIndex: 5 }
                    ].map(({ label, dayIndex }) => (
                      <span
                        key={label}
                        className="absolute right-0 flex items-center justify-end"
                        style={{
                          top: 20 + dayIndex * GRID_OFFSET,
                          height: CELL_SIZE
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
                      {monthLabels.map(item => (
                        <span
                          key={item.month}
                          className="absolute text-[10px] text-text-muted -translate-x-1/2"
                          style={{
                            left: item.colIndex * GRID_OFFSET + CELL_SIZE / 2,
                            top: 0,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {MONTH_NAMES[item.month]}
                        </span>
                      ))}
                    </div>

                    {/* Heatmap grid */}
                    <div className="relative" style={{ width: GRID_WIDTH, height: GRID_HEIGHT }}>
                      {calendarDays.map((day, index) => {
                        const weekIndex = Math.floor(index / 7);
                        const dayOfWeek = day.date.getDay();

                        if (weekIndex >= visibleWeeks) return null;

                        const left = weekIndex * GRID_OFFSET;
                        const top = dayOfWeek * GRID_OFFSET;
                        const isBottomRow = dayOfWeek >= 4;

                        return (
                          <div
                            key={day.dateKey}
                            className="absolute group"
                            style={{
                              width: CELL_SIZE,
                              height: CELL_SIZE,
                              left,
                              top
                            }}
                          >
                            <div
                              className={`
                              w-full h-full rounded-[3px]
                              transition-transform transition-shadow duration-150 ease-out
                              ${day.isInCurrentYear ? getHeatmapColor(day.intensity) : 'bg-transparent border border-transparent'}
                              ${day.count > 0 ? 'shadow-[0_0_4px_rgba(214,167,86,0.35)]' : ''}
                              group-hover:scale-110 group-hover:shadow-[0_0_14px_rgba(214,167,86,0.7)] group-hover:z-10
                              animate-in fade-in
                            `}
                            />

                            {day.isInCurrentYear && (
                              <div
                                className={`absolute ${
                                  isBottomRow ? 'bottom-full mb-1' : 'top-full mt-1'
                                } left-1/2 -translate-x-1/2 hidden group-hover:block z-50 w-max px-2.5 py-1.5 bg-background text-text-main text-xs rounded-lg shadow-xl border border-white/10 pointer-events-none`}
                              >
                                <p className="font-semibold text-text-muted">
                                  {day.date.toLocaleDateString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </p>
                                <p className="font-bold mt-0.5">
                                  {day.count === 0
                                    ? 'No activity'
                                    : heatmapMode === 'goals'
                                    ? `Deep-Work Score: ${day.count}`
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
                <div className="w-[15px] h-[15px] rounded-[2px] bg-gold border border-gold/50 shadow-[0_0_8px_rgba(214,167,86,0.25)]"></div>
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
                metrics.scheduledSessions.map(session => (
                  <div
                    key={session.id}
                    className="group p-3 rounded-xl bg-background/50 border border-white/5 hover:bg-background hover:border-gold/30 transition-all cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold bg-gold/10 text-gold px-2 py-0.5 rounded uppercase">
                          {new Date(session.scheduled_at).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                        <span className="text-sm font-bold text-text-main">
                          {new Date(session.scheduled_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
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
              <button
                onClick={() => setShowScheduleModal(true)}
                className="w-full py-3 rounded-xl bg-primary/10 text-primary font-medium text-sm hover:bg-primary/20 transition-colors flex items-center justify-center gap-2 border border-primary/20"
              >
                <Calendar size={16} /> Schedule New
              </button>
            </div>
          </div>
        </div>

        {/* 5. NEW ROW: AI Roadmap + Pro Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Kova Pro Goal Intelligence (Roadmap + Predictions) */}
          <div
            className={`bg-surface p-6 rounded-2xl border border-white/5 shadow-lg h-full flex flex-col relative overflow-hidden ${
              !isPro ? 'pointer-events-none select-none' : ''
            }`}
          >
            {/* Wrapper to disable interactions */}
            <div className="pointer-events-none h-full flex flex-col relative">
                {isPro && (
                  <div className="absolute top-4 right-4 z-20 bg-gradient-to-r from-gold to-amber-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                    <Sparkles size={12} /> AI Roadmap
                  </div>
                )}

                <div className="relative z-10 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-text-main flex items-center gap-2">
                        Kova Pro Goal Intelligence {!isPro && <Lock size={14} className="text-text-muted" />}
                      </h3>
                      <p className="text-xs text-text-muted mt-0.5">
                        AI-prioritized roadmap and completion predictions based on your goals.
                      </p>
                    </div>
                    <Target size={18} className="text-text-muted" />
                  </div>

                  {/* Roadmap preview */}
                  <div className="space-y-3 mb-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-wide text-text-muted">AI Weekly Roadmap</span>
                      <span className="text-[10px] text-text-muted/80">Preview</span>
                    </div>

                    {roadmapPreview.length > 0 ? (
                      <div className="space-y-2">
                        {roadmapPreview.map((goal, idx) => (
                          <div
                            key={goal.id || idx}
                            className="flex items-center gap-3 p-2.5 rounded-xl bg-background/60 border border-white/5"
                          >
                            <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center text-[11px] text-primary font-semibold">
                              {idx + 1}
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-medium text-text-main line-clamp-1">{goal.text}</p>
                              <p className="text-[10px] text-text-muted mt-0.5">
                                {goal.completed ? 'Marked complete — reinforcing habit' : 'High leverage for this week'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-background/60 border border-white/5 text-xs text-text-muted text-center">
                        Add a few goals to unlock a personalized roadmap.
                      </div>
                    )}
                  </div>

                  {/* Prediction section */}
                  <div className="mt-auto pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] uppercase tracking-wide text-text-muted">Predicted completion</span>
                      <span className="text-[11px] text-text-muted">
                        Confidence: <span className="text-gold font-semibold">{confidence}%</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-text-main">
                        {totalGoalsCount > 0 ? `ETA around ${etaLabel}` : 'Waiting for more data'}
                      </p>
                      <div className="flex items-center gap-1 text-[10px] text-text-muted">
                        <Clock size={12} /> {totalGoalsCount} goals tracked
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lock overlay for free users */}
                {!isPro && (
                  <>
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-md z-10 animate-in fade-in duration-500" />
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 text-center px-4">
                      <div className="relative">
                        <div className="absolute inset-0 rounded-2xl bg-gold/40 blur-xl opacity-80 animate-pulse" />
                        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-gold to-amber-500 flex items-center justify-center shadow-[0_0_30px_rgba(234,179,8,0.6)] border border-gold/70">
                          <Lock size={28} className="text-background" />
                        </div>
                      </div>

                      <div className="space-y-1 max-w-xs">
                        <p className="text-[10px] uppercase tracking-[0.25em] text-gold/85 font-semibold">
                          Kova Pro Feature
                        </p>
                        <p className="text-sm text-text-muted">AI-crafted roadmap for faster, smarter progress.</p>
                      </div>

                      <button
                        disabled
                        className="mt-2 px-6 py-3 rounded-xl bg-gradient-to-r from-gold to-amber-500 text-surface text-sm font-semibold shadow-xl border border-gold/70 transition-all flex items-center gap-2 opacity-60 cursor-not-allowed"
                      >
                        <Crown size={16} className="text-surface" />
                        Upgrade to Kova Pro
                      </button>
                    </div>
                  </>
                )}
            </div>

            {/* NEW COMING SOON OVERLAY */}
            <div 
               className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            >
                <div className="px-4 py-2 rounded-full bg-black/80 flex items-center gap-2 border border-white/10 shadow-xl">
                  <Lock size={12} className="text-zinc-400" />
                  <span className="text-xs font-semibold tracking-wide text-white">
                    Kova Pro | Coming Soon
                  </span>
                </div>
            </div>
          </div>

          {/* Kova Pro Insights (Locked/Unlocked) */}
          <div
            className={`bg-surface p-6 rounded-2xl border border-white/5 shadow-lg h-full flex flex-col relative overflow-hidden ${
              !isPro ? 'pointer-events-none select-none' : ''
            }`}
          >
            <div className="pointer-events-none h-full flex flex-col relative">
                {isPro && (
                  <div className="absolute top-4 right-4 z-20 bg-gradient-to-r from-gold to-amber-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                    <Crown size={12} fill="currentColor" /> Pro Enabled
                  </div>
                )}

                <div className="flex-1 flex flex-col transition-all duration-300 relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-text-main flex items-center gap-2">
                        Kova Pro Insights {!isPro && <Lock size={14} className="text-text-muted" />}
                      </h3>
                      <p className="text-xs text-text-muted mt-0.5">Unlock deeper analytics and personalized insights</p>
                    </div>
                    <Sparkles size={18} className="text-gold" />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-background rounded-xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-surface rounded-lg">
                          <BarChart2 size={16} />
                        </div>
                        <span className="text-sm font-medium">30-day focus trendline</span>
                      </div>
                      {!isPro && <Lock size={12} />}
                    </div>
                    <div className="flex items-center justify-between p-3 bg-background rounded-xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-surface rounded-lg">
                          <Clock size={16} />
                        </div>
                        <span className="text-sm font-medium">Best days & times for deep work</span>
                      </div>
                      {!isPro && <Lock size={12} />}
                    </div>
                    <div className="flex items-center justify-between p-3 bg-background rounded-xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-surface rounded-lg">
                          <Users size={16} />
                        </div>
                        <span className="text-sm font-medium">Top accountability partners</span>
                      </div>
                      {!isPro && <Lock size={12} />}
                    </div>
                    <div className="flex items-center justify-between p-3 bg-background rounded-xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-surface rounded-lg">
                          <Shield size={16} />
                        </div>
                        <span className="text-sm font-medium">Streak protection predictions</span>
                      </div>
                      {!isPro && <Lock size={12} />}
                    </div>
                  </div>
                </div>

                {!isPro && (
                  <>
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-md z-10 animate-in fade-in duration-500" />

                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 text-center px-4">
                      <div className="relative">
                        <div className="absolute inset-0 rounded-2xl bg-gold/40 blur-xl opacity-80 animate-pulse" />
                        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-gold to-amber-500 flex items-center justify-center shadow-[0_0_30px_rgba(234,179,8,0.6)] border border-gold/70">
                          <Lock size={28} className="text-background" />
                        </div>
                      </div>

                      <div className="space-y-1 max-w-xs">
                        <p className="text-[10px] uppercase tracking-[0.25em] text-gold/85 font-semibold">
                          Kova Pro Feature
                        </p>
                        <p className="text-sm text-text-muted">Deep performance insights that refine your focus.</p>
                      </div>

                      <button
                        disabled
                        className="mt-2 px-6 py-3 bg-gradient-to-r from-gold to-amber-500 text-surface text-sm font-semibold rounded-xl shadow-xl border border-gold/70 transition-all flex items-center gap-2 opacity-60 cursor-not-allowed"
                      >
                        <Crown size={16} className="text-surface" />
                        Upgrade to Kova Pro
                      </button>
                    </div>
                  </>
                )}
            </div>

            {/* NEW COMING SOON OVERLAY */}
            <div 
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            >
              <div className="px-4 py-2 rounded-full bg-black/80 flex items-center gap-2 border border-white/10 shadow-xl">
                 <Lock size={12} className="text-zinc-400" />
                 <span className="text-xs font-semibold tracking-wide text-white">
                   Kova Pro | Coming Soon
                 </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;