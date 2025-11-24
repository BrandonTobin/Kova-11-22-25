
import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  Target,
  Award,
  Sparkles,
  Calendar,
  ArrowRight,
  Activity,
  Zap,
  X as CloseIcon,
  Lock,
  HelpCircle,
  RotateCcw,
  Loader2,
  CheckCircle,
  BarChart3
} from 'lucide-react';

import { supabase } from '../supabaseClient';
import { User, Badge } from '../types';
import { ALL_BADGES } from '../constants';
import { getDisplayName } from '../utils/nameUtils';

// ---------- Types ----------

interface DashboardProps {
  user: User;
  matches?: any[];
  onUpgrade?: () => void;
}

interface CalendarDay {
  date: Date;
  dateKey: string; // 'YYYY-MM-DD'
  count: number; // raw activity count
  intensity: number; // 0–4
  isInCurrentYear: boolean;
}

interface WeeklySummary {
  focusHours: number;
  sessions: number;
  activeDays: number;
  avgSessionMinutes: number;
}

interface GoalStats30 {
  total: number;
  completed: number;
  active: number;
  percentage: number;
}

interface ProInsightsData {
  focusHours7d: number;
  completedGoals7d: number;
  activeDays7d: number;
}

interface DashboardMetrics {
  totalHours: number;
  hoursChange: number;
  completedGoals: number;
  totalGoals: number;
  weeklyMessages: { name: string; value: number }[];
  calendarDays: CalendarDay[]; // Active one based on mode
  calendarDaysProductivity: CalendarDay[];
  calendarDaysConsistency: CalendarDay[];
  calendarDaysGoals: CalendarDay[];
  scheduledSessions: ScheduledSession[];
  weeklySummary: WeeklySummary;
  goalStats30: GoalStats30;
  insights: ProInsightsData;
}

interface ScheduledSession {
  id: string;
  title: string;
  scheduled_at: string;
  partner_email?: string;
}

interface BadgeCardProps {
  badge: Badge;
  isEarned: boolean;
}

// ---------- Heatmap helpers ----------

const CELL_SIZE = 15;
const CELL_GAP = 3;
const GRID_OFFSET = CELL_SIZE + CELL_GAP;
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const getHeatmapColor = (intensity: number) => {
  switch (intensity) {
    case 4:
      return 'bg-gold shadow-[0_0_8px_rgba(214,167,86,0.5)] border border-gold/50';
    case 3:
      return 'bg-primary/40 border border-primary/20';
    case 2:
      return 'bg-primary border border-primary-hover';
    case 1:
      return 'bg-secondary border border-secondary/50';
    default:
      return 'bg-surface border border-white/5';
  }
};

const mapCountToIntensity = (count: number): number => {
  if (count === 0) return 0;
  if (count <= 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
};

// ---------- Internal components ----------

const BadgeCard: React.FC<BadgeCardProps> = ({ badge, isEarned }) => {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div
      className={`relative p-4 rounded-2xl border flex flex-col items-center text-center gap-3 transition-all duration-300 group h-40 justify-center ${
        isEarned
          ? 'bg-surface border-gold/30 shadow-lg shadow-gold/5'
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

// ---------- Main Dashboard ----------

const Dashboard: React.FC<DashboardProps> = ({ user, onUpgrade }) => {
  const [showBadgesModal, setShowBadgesModal] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // which heatmap tab is active
  const [heatmapMode, setHeatmapMode] = useState<'productivity' | 'consistency' | 'goals'>(
    'productivity'
  );

  // Helper for Pro status
  const isPro =
    (user as any)?.subscriptionTier === 'pro' ||
    (user as any)?.subscription_tier === 'pro';

  // Helper to build calendar array for any counts map
  const buildCalendarDays = (
    startOfYear: Date,
    endOfYear: Date,
    now: Date,
    countsMap: Map<string, number>
  ): CalendarDay[] => {
    const days: CalendarDay[] = [];
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

      days.push({
        date: new Date(d),
        dateKey,
        count,
        intensity: isInYear && !isFuture ? intensity : 0,
        isInCurrentYear: isInYear,
      });
      d.setDate(d.getDate() + 1);
    }
    return days;
  };

  useEffect(() => {
    // Skip data fetch for mock users (onboarding demo)
    if (user.id === 'mock-user-id' || user.id === '123e4567-e89b-12d3-a456-426614174000') {
        setIsLoading(false);
        // Set mock metrics for demo
        setMetrics({
            totalHours: 24.5,
            hoursChange: 12,
            completedGoals: 5,
            totalGoals: 8,
            weeklyMessages: [],
            calendarDays: [],
            calendarDaysProductivity: [],
            calendarDaysConsistency: [],
            calendarDaysGoals: [],
            scheduledSessions: [],
            weeklySummary: {
                focusHours: 12.5,
                sessions: 4,
                activeDays: 3,
                avgSessionMinutes: 45
            },
            goalStats30: { total: 0, completed: 0, active: 0, percentage: 0 },
            insights: { focusHours7d: 0, completedGoals7d: 0, activeDays7d: 0 }
        });
        return;
    }

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
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);

        // ---- sessions ----
        const { data: sessions } = await supabase
          .from('sessions')
          .select('started_at, ended_at')
          .or(`host_id.eq.${user.id},partner_id.eq.${user.id}`)
          .not('ended_at', 'is', null);

        let totalMinutes = 0;
        let thisWeekMinutes = 0;
        let lastWeekMinutes = 0;

        let last7TotalMinutes = 0;
        let last7SessionCount = 0;
        const last7ActiveDaysSet = new Set<string>();

        // Maps for different modes
        const productivityCounts = new Map<string, number>();
        const consistencyCounts = new Map<string, number>(); // Will add sessions here too

        sessions?.forEach((s: any) => {
          const startTime = new Date(s.started_at);
          const endTime = s.ended_at ? new Date(s.ended_at) : null;

          const minutes = endTime
            ? Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 60000))
            : 0;

          totalMinutes += minutes;

          // Heatmap Data: Productivity (minutes)
          const dateKey = startTime.toLocaleDateString('en-CA');
          productivityCounts.set(dateKey, (productivityCounts.get(dateKey) || 0) + minutes);
          
          // Heatmap Data: Consistency (count sessions)
          consistencyCounts.set(dateKey, (consistencyCounts.get(dateKey) || 0) + 1);

          if (startTime >= sevenDaysAgo) {
            thisWeekMinutes += minutes;
            last7TotalMinutes += minutes;
            last7SessionCount += 1;
            last7ActiveDaysSet.add(dateKey);
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

        const weeklySummary: WeeklySummary = {
          focusHours: parseFloat((last7TotalMinutes / 60).toFixed(1)),
          sessions: last7SessionCount,
          activeDays: last7ActiveDaysSet.size,
          avgSessionMinutes:
            last7SessionCount > 0 ? Math.round(last7TotalMinutes / last7SessionCount) : 0,
        };

        // ---- goals ----
        const { data: goalsData } = await supabase
          .from('goals')
          .select('*')
          .eq('user_id', user.id);

        const totalGoals = goalsData?.length || 0;
        const completedGoals = goalsData?.filter((g: any) => g.completed).length || 0;
        
        const goalCounts = new Map<string, number>();
        goalsData?.forEach((g: any) => {
            if (g.completed) {
                // Fallback to created_at if completed_at missing
                const d = g.completed_at ? new Date(g.completed_at) : new Date(g.created_at);
                const dk = d.toLocaleDateString('en-CA');
                goalCounts.set(dk, (goalCounts.get(dk) || 0) + 1);
            }
        });

        // Calculate 30 Day Goal Stats
        const recentGoals = goalsData?.filter((g: any) => new Date(g.created_at) >= thirtyDaysAgo) || [];
        const totalGoals30 = recentGoals.length;
        const completedGoals30 = recentGoals.filter((g: any) => g.completed).length;
        const activeGoals30 = totalGoals30 - completedGoals30;
        const pctGoals30 = totalGoals30 > 0 ? Math.round((completedGoals30 / totalGoals30) * 100) : 0;

        // Calculate 7 Day Completed Goals for Insights
        const completedGoals7d = goalsData?.filter((g: any) => 
            g.completed && new Date(g.completed_at || g.created_at) >= sevenDaysAgo
        ).length || 0;

        // ---- heatmap activity (Consistency Mode continued) ----
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

        const recordConsistency = (isoDate: string) => {
          const dateKey = new Date(isoDate).toLocaleDateString('en-CA');
          consistencyCounts.set(dateKey, (consistencyCounts.get(dateKey) || 0) + 1);
        };

        recentSwipes?.forEach((s: any) => recordConsistency(s.created_at));
        recentMsgs?.forEach((m: any) => recordConsistency(m.created_at));
        
        // Build the 3 calendar arrays
        const calendarDaysProductivity = buildCalendarDays(startOfYear, endOfYear, now, productivityCounts);
        const calendarDaysConsistency = buildCalendarDays(startOfYear, endOfYear, now, consistencyCounts);
        const calendarDaysGoals = buildCalendarDays(startOfYear, endOfYear, now, goalCounts);

        // Default current calendarDays to productivity
        const calendarDays = calendarDaysProductivity;

        // ---- upcoming sessions ----
        const { data: scheduled } = await supabase
          .from('scheduled_sessions')
          .select('*')
          .eq('user_id', user.id)
          .gte('scheduled_at', now.toISOString())
          .order('scheduled_at', { ascending: true })
          .limit(20);

        setMetrics({
          totalHours,
          hoursChange,
          totalGoals,
          completedGoals,
          weeklyMessages: [],
          calendarDays,
          calendarDaysProductivity,
          calendarDaysConsistency,
          calendarDaysGoals,
          scheduledSessions: scheduled || [],
          weeklySummary,
          goalStats30: {
              total: totalGoals30,
              completed: completedGoals30,
              active: activeGoals30,
              percentage: pctGoals30
          },
          insights: {
              focusHours7d: weeklySummary.focusHours,
              completedGoals7d: completedGoals7d,
              activeDays7d: weeklySummary.activeDays
          }
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

  // ---- Select active calendar data ----
  let activeCalendarDays: CalendarDay[] = [];
  if (metrics) {
      if (heatmapMode === 'productivity') activeCalendarDays = metrics.calendarDaysProductivity;
      else if (heatmapMode === 'consistency') activeCalendarDays = metrics.calendarDaysConsistency;
      else activeCalendarDays = metrics.calendarDaysGoals;
  }

  // ---- month label positions ----
  const monthLabels: { month: number; colIndex: number }[] = [];
  if (activeCalendarDays.length > 0) {
    activeCalendarDays.forEach((day, index) => {
      if (day.isInCurrentYear && day.date.getDate() === 1) {
        const month = day.date.getMonth();
        const exists = monthLabels.some((m) => m.month === month);
        if (!exists) {
          const colIndex = Math.floor(index / 7);
          monthLabels.push({ month, colIndex });
        }
      }
    });
  }

  // Heatmap interaction handler
  const handleModeSwitch = (mode: 'productivity' | 'consistency' | 'goals') => {
      if (mode === 'productivity') {
          setHeatmapMode(mode);
      } else {
          if (isPro) {
              setHeatmapMode(mode);
          } else {
              // Show simple alert or trigger upgrade modal
              if (onUpgrade) onUpgrade();
              else alert("Upgrade to Kova Pro to unlock consistency and goal heatmaps.");
          }
      }
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

  // heatmap grid dims
  // Find index of last in-year day
  const lastInYearIndex = activeCalendarDays.reduceRight(
    (acc, day, index) => (acc === -1 && day.isInCurrentYear ? index : acc),
    -1
  );

  // Fallback: if somehow not found, keep current behavior
  const visibleWeeks =
    lastInYearIndex === -1
      ? Math.ceil(activeCalendarDays.length / 7)
      : Math.floor(lastInYearIndex / 7) + 1;

  // FIX: Ensure visibleWeeks is at least 1 to prevent negative width calculation
  const safeVisibleWeeks = Math.max(1, visibleWeeks);

  const GRID_WIDTH = safeVisibleWeeks * GRID_OFFSET - CELL_GAP;
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
                <p className="text-text-muted mt-1">
                  Earn badges by staying consistent and collaborating.
                </p>
              </div>
              <button
                onClick={() => setShowBadgesModal(false)}
                className="p-2 rounded-full hover:bg-background text-text-muted hover:text-white transition-colors"
              >
                <CloseIcon size={24} />
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
                Progress:{' '}
                <span className="text-gold font-bold">{user.badges.length}</span> /{' '}
                {ALL_BADGES.length}{' '}
                Unlocked
              </p>
              <div className="w-full max-w-md mx-auto h-1.5 bg-background rounded-full mt-2 overflow-hidden border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-primary to-gold"
                  style={{
                    width: `${(user.badges.length / ALL_BADGES.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-text-main mb-2">
          Welcome back, {getDisplayName(user.name).split(' ')[0]}
        </h1>
        <p className="text-text-muted">Here&apos;s your growth overview.</p>
      </header>

      {/* Kova AI Insight banner */}
      <div className="bg-gradient-to-r from-primary/40 via-background to-background border border-gold/30 p-6 rounded-2xl mb-8 relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-gold/10 rounded-full blur-3xl" />
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
              &quot;You&apos;ve been crushing your morning sessions! 🚀 Your focus score peaks between
              9 AM and 11 AM. Try scheduling a deep-work block this Thursday to maintain your
              streak.&quot;
            </p>
          </div>
        </div>
      </div>

      {/* Top metrics row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Total hours */}
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

        {/* Goals completed */}
        <div className="bg-surface p-5 rounded-2xl border border-white/5 shadow-lg hover:border-gold/20 transition-colors group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-secondary/20 rounded-xl text-secondary group-hover:bg-secondary group-hover:text-white transition-colors">
              <Target size={22} />
            </div>
            <span className="text-primary text-sm font-medium">
              {metrics.totalGoals > 0
                ? Math.round((metrics.completedGoals / metrics.totalGoals) * 100)
                : 0}
              %
            </span>
          </div>
          <h3 className="text-2xl font-bold text-text-main">
            {metrics.completedGoals} / {metrics.totalGoals}
          </h3>
          <p className="text-sm text-text-muted">Goals Completed</p>
        </div>

        {/* Badges */}
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

      {/* This Week Summary row */}
      <div className="bg-surface p-5 rounded-2xl border border-white/5 shadow-lg mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-text-main mb-2">
            This Week Summary
          </h3>
          <p className="text-[11px] text-text-muted/70">Last 7 days</p>
        </div>

        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-text-muted mb-1">
              Focus Hours
            </p>
            <p className="text-lg font-semibold text-text-main">
              {metrics.weeklySummary.focusHours.toFixed(1)}
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-text-muted mb-1">
              Sessions
            </p>
            <p className="text-lg font-semibold text-text-main">
              {metrics.weeklySummary.sessions}
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-text-muted mb-1">
              Active Days
            </p>
            <p className="text-lg font-semibold text-text-main">
              {metrics.weeklySummary.activeDays}
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-text-muted mb-1">
              Avg Session
            </p>
            <p className="text-lg font-semibold text-text-main">
              {metrics.weeklySummary.avgSessionMinutes} min
            </p>
          </div>
        </div>
      </div>

      {/* Middle row: Heatmap + Upcoming Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Heatmap */}
        <div className="bg-surface p-6 rounded-2xl border border-white/5 shadow-lg h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-text-main flex items-center gap-2">
              <Zap size={18} className="text-gold" />
              Consistency Heatmap
            </h3>
            
            <div className="flex items-center gap-3">
                {/* Segmented Control */}
                <div className="flex bg-black/30 rounded-lg p-1 border border-white/5">
                    <button
                        className={`px-3 py-1 rounded-md text-[10px] font-medium transition-colors ${
                        heatmapMode === 'productivity'
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-text-muted hover:text-white'
                        }`}
                        onClick={() => handleModeSwitch('productivity')}
                    >
                        Productivity
                    </button>
                    <button
                        className={`px-3 py-1 rounded-md text-[10px] font-medium transition-colors ${
                        heatmapMode === 'consistency'
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-text-muted hover:text-white'
                        }`}
                        onClick={() => handleModeSwitch('consistency')}
                    >
                        Consistency
                    </button>
                    <button
                        className={`px-3 py-1 rounded-md text-[10px] font-medium transition-colors ${
                        heatmapMode === 'goals'
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-text-muted hover:text-white'
                        }`}
                        onClick={() => handleModeSwitch('goals')}
                    >
                        Goal Progress
                    </button>
                </div>
                <span className="text-xs text-text-muted font-medium">{new Date().getFullYear()}</span>
            </div>
          </div>

          {/* Grid */}
          <div className="w-full pb-2 flex-1 flex flex-col relative">
            {/* Pro Overlay for Locked Modes */}
            {(heatmapMode !== 'productivity' && !isPro) && (
                <div className="absolute inset-0 z-20 bg-surface/80 backdrop-blur-sm flex flex-col items-center justify-center text-center border border-white/5 rounded-xl">
                    <div className="w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center mb-3 border border-gold/20">
                        <Lock size={20} className="text-gold" />
                    </div>
                    <h4 className="text-text-main font-bold mb-1">Pro Feature Locked</h4>
                    <p className="text-text-muted text-xs max-w-xs mb-4">Upgrade to view streaks and goal consistency.</p>
                    <button 
                      onClick={onUpgrade}
                      className="px-4 py-2 bg-gold text-surface text-xs font-bold rounded-lg hover:bg-gold-hover transition-colors"
                    >
                        Upgrade to Pro
                    </button>
                </div>
            )}

            <div className="flex items-start gap-4 w-full justify-center">
              {/* Y labels */}
              <div
                className="relative shrink-0 text-[10px] text-text-muted font-medium w-8 text-right mr-2 pt-[20px]"
                style={{ height: GRID_HEIGHT + 20 }}
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
                      top: 20 + (dayIndex * GRID_OFFSET),
                      height: CELL_SIZE,
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>

              {/* Month labels + cells */}
              <div className="flex flex-col gap-[3px] flex-1">
                {/* Months */}
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

                {/* Cells */}
                <div
                  className="relative"
                  style={{ width: GRID_WIDTH, height: GRID_HEIGHT }}
                >
                  {activeCalendarDays.map((day, index) => {
                    const weekIndex = Math.floor(index / 7);
                    const dayOfWeek = day.date.getDay(); // 0–6

                    // Do not render cells beyond safe width
                    if (weekIndex >= safeVisibleWeeks) return null;

                    const left = weekIndex * GRID_OFFSET;
                    const top = dayOfWeek * GRID_OFFSET;

                    // decide tooltip direction: last 2 rows -> tooltip above
                    const tooltipAbove = dayOfWeek >= 5;

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
                            day.isInCurrentYear
                              ? getHeatmapColor(day.intensity)
                              : 'bg-transparent'
                          }`}
                        />
                        {day.isInCurrentYear && (
                          <div
                            className={`absolute left-1/2 -translate-x-1/2 ${
                              tooltipAbove ? 'bottom-full mb-1' : 'top-full mt-1'
                            } hidden group-hover:block z-50 w-max px-2.5 py-1.5 bg-background text-text-main text-xs rounded-lg shadow-xl border border-white/10 pointer-events-none`}
                          >
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
              <div className="w-[14px] h-[14px] rounded-[2px] bg-surface border border-white/5" />
            </div>
            <div className="flex items-center gap-1">
              <div className="w-[14px] h-[14px] rounded-[2px] bg-secondary border border-secondary/50" />
            </div>
            <div className="flex items-center gap-1">
              <div className="w-[14px] h-[14px] rounded-[2px] bg-primary border border-primary-hover" />
            </div>
            <div className="flex items-center gap-1">
              <div className="w-[14px] h-[14px] rounded-[2px] bg-primary/40 border border-primary/20" />
            </div>
            <div className="flex items-center gap-1">
              <div className="w-[14px] h-[14px] rounded-[2px] bg-gold shadow-[0_0_4px_rgba(214,167,86,0.5)] border border-gold/50" />
            </div>
            <span className="ml-1">More</span>
          </div>
        </div>

        {/* Upcoming Sessions */}
        <div className="bg-surface p-6 rounded-2xl border border-white/5 shadow-lg h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-main">Upcoming Sessions</h3>
            <Calendar size={18} className="text-text-muted" />
          </div>

          <div className="space-y-4 flex-1 overflow-y-auto max-h-[260px] pr-1">
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
                        {session.partner_email
                          ? `with ${session.partner_email}`
                          : 'Solo Session'}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-text-muted text-center py-4">
                No upcoming sessions scheduled.
              </div>
            )}
          </div>

          <div className="mt-4 pt-2">
            <button className="w-full py-3 rounded-xl bg-primary/10 text-primary font-medium text-sm hover:bg-primary/20 transition-colors flex items-center justify-center gap-2 border border-primary/20">
              <Calendar size={16} /> Schedule New
            </button>
          </div>
        </div>
      </div>

      {/* Bottom analytics row (Goal Progress + Pro Insights) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Left: Goal Progress (Free) */}
        <div className="bg-surface p-6 rounded-2xl border border-white/5 shadow-lg flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-text-main flex items-center gap-2">
              <Target size={18} className="text-secondary" /> Goal Progress
            </h3>
            <span className="text-xs text-text-muted">Last 30 Days</span>
          </div>
          
          <p className="text-sm text-text-muted mb-6">
            Track your momentum on active goals.
          </p>

          {metrics.goalStats30.total === 0 ? (
             <div className="flex-1 flex flex-col items-center justify-center text-center py-6 border border-dashed border-white/10 rounded-xl bg-background/30">
                <p className="text-text-muted text-sm">No goals found in the last 30 days.</p>
                <p className="text-xs text-text-muted mt-1">Create a goal in your next session to see stats.</p>
             </div>
          ) : (
             <div className="grid grid-cols-2 gap-4">
                <div className="bg-background p-4 rounded-xl border border-white/5">
                   <p className="text-xs uppercase tracking-wider text-text-muted font-bold mb-1">Total Goals</p>
                   <p className="text-2xl font-bold text-text-main">{metrics.goalStats30.total}</p>
                </div>
                <div className="bg-background p-4 rounded-xl border border-white/5">
                   <p className="text-xs uppercase tracking-wider text-text-muted font-bold mb-1">Completed</p>
                   <div className="flex items-end gap-2">
                      <p className="text-2xl font-bold text-secondary">{metrics.goalStats30.completed}</p>
                      <span className="text-xs text-text-muted mb-1.5">({metrics.goalStats30.percentage}%)</span>
                   </div>
                </div>
                <div className="bg-background p-4 rounded-xl border border-white/5">
                   <p className="text-xs uppercase tracking-wider text-text-muted font-bold mb-1">Active</p>
                   <p className="text-2xl font-bold text-text-main">{metrics.goalStats30.active}</p>
                </div>
                <div className="bg-background p-4 rounded-xl border border-white/5 flex items-center justify-center">
                   <div className="text-center">
                      <CheckCircle size={24} className={`mx-auto mb-1 ${metrics.goalStats30.percentage >= 80 ? 'text-gold' : 'text-text-muted'}`} />
                      <p className="text-xs font-bold text-text-main">
                        {metrics.goalStats30.percentage >= 80 ? 'Crushing it!' : 'Keep pushing'}
                      </p>
                   </div>
                </div>
             </div>
          )}
        </div>

        {/* Right: Kova Pro Insights (Gated) */}
        <div className="bg-surface p-6 rounded-2xl border border-white/5 shadow-lg flex flex-col relative overflow-hidden">
           <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-main flex items-center gap-2">
                 <BarChart3 size={18} className="text-gold" /> Kova Pro Insights
              </h3>
              {!isPro && (
                <span className="text-[10px] bg-gold/10 text-gold px-2 py-0.5 rounded-full border border-gold/20 uppercase tracking-wider">
                  Pro
                </span>
              )}
           </div>

           {!isPro ? (
              <div className="flex flex-col h-full justify-between relative z-10">
                 <div className="space-y-4 text-sm text-text-muted mb-4">
                    <p>Unlock AI-powered weekly breakdowns of your focus, goals, and networking activity.</p>
                    <ul className="space-y-2 text-xs list-disc list-inside text-text-muted/80 pl-2">
                       <li>Smart recap of your focus hours</li>
                       <li>Highlights of your goal streaks</li>
                       <li>Suggestions for your next week</li>
                    </ul>
                 </div>
                 <button
                    onClick={onUpgrade}
                    className="mt-auto w-full py-3 rounded-xl bg-gradient-to-r from-gold to-amber-600 text-surface font-bold text-sm hover:opacity-90 transition-opacity shadow-lg"
                 >
                    Upgrade to Pro – $7.99/month
                 </button>
              </div>
           ) : (
              <div className="flex flex-col h-full">
                 <p className="text-sm text-text-main font-medium mb-4">Here's your latest snapshot:</p>
                 <ul className="space-y-3 text-sm text-text-muted flex-1">
                    <li className="flex items-start gap-2">
                       <span className="text-gold mt-1">•</span>
                       <span>
                          You've logged <span className="text-text-main font-bold">{metrics.insights.focusHours7d.toFixed(1)} hrs</span> of focus time in the last 7 days.
                       </span>
                    </li>
                    <li className="flex items-start gap-2">
                       <span className="text-gold mt-1">•</span>
                       <span>
                          You completed <span className="text-text-main font-bold">{metrics.insights.completedGoals7d}</span> goals this week.
                       </span>
                    </li>
                    <li className="flex items-start gap-2">
                       <span className="text-gold mt-1">•</span>
                       <span>
                          You had sessions on <span className="text-text-main font-bold">{metrics.insights.activeDays7d}</span> different days.
                       </span>
                    </li>
                 </ul>
                 <div className="mt-4 pt-4 border-t border-white/5">
                    <p className="text-xs text-text-muted italic">
                       "Consistency is key. Try to beat your 7-day focus record next week!"
                    </p>
                 </div>
              </div>
           )}
           
           {/* Background effect for locked card */}
           {!isPro && (
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-gold/5 rounded-full blur-3xl pointer-events-none"></div>
           )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
