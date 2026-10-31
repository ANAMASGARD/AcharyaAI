import type { DashboardResponse } from '@/types/community';
import type { RecentActivityItem } from '@/types/home-dashboard';

const emptyDashboard: DashboardResponse = {
  stats: { classesThisWeek: 0, classesThisMonth: 0, notesVerifiedCount: 0, averageScore: null, streakDays: 0 },
  recentActivity: [],
};

export function useHomeDashboard() {
  return { dashboard: emptyDashboard, recentActivity: [] as RecentActivityItem[], isLoading: false, error: null as string | null, refresh: async () => {} };
}
