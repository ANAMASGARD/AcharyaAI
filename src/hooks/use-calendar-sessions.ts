import { useState } from 'react';
import type { CalendarSession, SessionDetail } from '@/types/calendar';

/** Timer previews never become recorded classes or fabricated reports. */
export function useCalendarSessions() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [detailSessionId, setDetailSessionId] = useState<string | null>(null);
  return {
    sessions: [] as CalendarSession[], selectedDate, setSelectedDate,
    sessionsForSelectedDate: [] as CalendarSession[], markedDateKeys: new Set<string>(),
    hasFetched: true, error: null as string | null, refresh: async () => {},
    detailSessionId, sessionDetail: null as SessionDetail | null, isDetailLoading: false,
    detailError: null as string | null, openSessionDetail: async (id: string) => setDetailSessionId(id),
    closeSessionDetail: () => setDetailSessionId(null),
  };
}
