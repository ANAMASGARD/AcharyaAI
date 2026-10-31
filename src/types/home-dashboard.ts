import type { DashboardActivityItem, DashboardStats } from "@/types/community";

export type ActivityAvatarKind = "letter" | "icon";

export type RecentActivityItem = Readonly<{
  id: string;
  title: string;
  subtitle: string;
  timeAgo: string;
  avatarKind: ActivityAvatarKind;
  avatarLetter?: string;
  deepLink?: string | null;
}>;

export type NotesGapsContent = Readonly<{
  title: string;
  body: string;
  ctaLabel: string;
}>;

export type StartSessionContent = Readonly<{
  title: string;
  body: string;
}>;

export type HomeDashboardContent = Readonly<{
  stats: DashboardStats | null;
  recentActivity: readonly RecentActivityItem[];
  notesGaps: NotesGapsContent;
  startSession: StartSessionContent;
}>;

export type { DashboardActivityItem, DashboardStats };
