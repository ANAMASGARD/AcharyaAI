import type { TeachingReport } from '@/types/recorder';
export type CalendarSession = Readonly<{
  sessionId: string; topic: string; subject: string; classLevel: string;
  recordedAt: string; durationSeconds: number; score?: number; teacherClerkId: string;
  stateLabel?: string;
}>;
export type SessionDetail = Readonly<{
  session: CalendarSession; report: TeachingReport | null;
  transcriptPreview: string | null; classNotes: string | null;
  transcript?: string;
  recording?: import('@/lib/recording/types').RecordingSnapshot;
}>;
