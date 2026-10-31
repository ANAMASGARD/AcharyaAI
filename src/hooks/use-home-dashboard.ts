import { useAuth } from '@clerk/expo';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { listReportHistory } from '@/lib/reports/history';
import { toDateKey } from '@/lib/calendar/date-utils';
import { formatTimeAgo } from '@/lib/community/time-ago';
import type { CalendarSession } from '@/types/calendar';
import type { DashboardResponse } from '@/types/community';
import type { RecentActivityItem } from '@/types/home-dashboard';

export function dashboardFromReports(sessions: readonly CalendarSession[], now = new Date()): DashboardResponse {
  const startOfWeek = new Date(now.getFullYear(),now.getMonth(),now.getDate());
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
  const startOfMonth = new Date(now.getFullYear(),now.getMonth(),1);
  const dates = new Set(sessions.map(session => toDateKey(new Date(session.recordedAt))));
  const day = new Date(now.getFullYear(),now.getMonth(),now.getDate());
  if (!dates.has(toDateKey(day))) day.setDate(day.getDate()-1);
  let streakDays = 0;
  while (dates.has(toDateKey(day))) { streakDays++; day.setDate(day.getDate()-1); }
  const scores = sessions.map(session => session.score).filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
  return { stats: { classesThisWeek: sessions.filter(session => new Date(session.recordedAt) >= startOfWeek && new Date(session.recordedAt) <= now).length,
    classesThisMonth: sessions.filter(session => new Date(session.recordedAt) >= startOfMonth && new Date(session.recordedAt) <= now).length,
    notesVerifiedCount: null, averageScore: scores.length ? Math.round(scores.reduce((sum,score) => sum+score,0)/scores.length) : null, streakDays },
    recentActivity: [...sessions].sort((a,b) => b.recordedAt.localeCompare(a.recordedAt)).slice(0,5).map(session => ({ id: session.sessionId, kind: 'session', title: session.topic,
      subtitle: `${session.subject} · ${session.classLevel}`, occurredAt: session.recordedAt, deepLink: '/(app)/(tabs)/calendar' })) };
}
export function useHomeDashboard() {
  const { userId } = useAuth();
  const generation = useRef(0);
  const [result, setResult] = useState<{ owner: string; dashboard: DashboardResponse } | null>(null);
  const [status, setStatus] = useState({ owner: '', isLoading: false, error: null as string | null });
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    if (!userId) return;
    setStatus({ owner: userId, isLoading: true, error: null });
    try {
      const sessions = await listReportHistory(userId);
      if (version !== generation.current) return;
      setResult({ owner: userId, dashboard: dashboardFromReports(sessions) }); setStatus({ owner: userId, isLoading: false, error: null });
    } catch { if (version === generation.current) setStatus({ owner: userId, isLoading: false, error: 'Could not load your saved teaching reports. Pull down to retry.' }); }
  }, [userId]);
  useFocusEffect(useCallback(() => { void refresh(); return () => { generation.current++; }; }, [refresh]));
  const dashboard = result && result.owner === userId ? result.dashboard : null;
  const recentActivity = useMemo<RecentActivityItem[]>(() => dashboard?.recentActivity.map(activity => ({ id: activity.id, title: activity.title, subtitle: activity.subtitle,
    timeAgo: formatTimeAgo(activity.occurredAt), avatarKind: 'letter', avatarLetter: activity.title.charAt(0).toUpperCase(), deepLink: activity.deepLink })) ?? [], [dashboard]);
  return { dashboard, recentActivity, isLoading: status.owner === userId && status.isLoading, error: status.owner === userId ? status.error : null, refresh };
}
