import { useAuth } from '@clerk/expo';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isSameDay, toDateKey } from '@/lib/calendar/date-utils';
import { listReportHistory, readReportHistory } from '@/lib/reports/history';
import type { CalendarSession, SessionDetail } from '@/types/calendar';

export function useCalendarSessions() {
  const { userId } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [history, setHistory] = useState<{ owner: string; sessions: CalendarSession[] } | null>(null);
  const [detail, setDetail] = useState<{ owner: string; value: SessionDetail } | null>(null);
  const [detailSessionId, setDetailSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isDetailLoading, setDetailLoading] = useState(false);
  const generation = useRef(0);
  const detailRequest = useRef(0);
  useEffect(() => () => { generation.current++; detailRequest.current++; }, [userId]);
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    if (!userId) return;
    try {
      const sessions = await listReportHistory(userId);
      if (version !== generation.current) return;
      setHistory({ owner: userId, sessions }); setError(null);
    } catch { if (version === generation.current) setError('Could not load saved classes. Pull down to retry.'); }
  }, [userId]);
  useFocusEffect(useCallback(() => { void refresh(); return () => { generation.current++; detailRequest.current++; }; }, [refresh]));
  const sessions = useMemo(() => history && history.owner === userId ? history.sessions : [], [history, userId]);
  const sessionsForSelectedDate = useMemo(() => sessions.filter((item) => isSameDay(new Date(item.recordedAt), selectedDate))
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)), [sessions, selectedDate]);
  const markedDateKeys = useMemo(() => new Set(sessions.map((item) => toDateKey(new Date(item.recordedAt)))), [sessions]);
  const openSessionDetail = async (id: string) => {
    if (!userId) return;
    const version = ++detailRequest.current;
    setDetailSessionId(id); setDetail(null); setDetailError(null); setDetailLoading(true);
    try {
      const value = await readReportHistory(userId, id);
      if (version !== detailRequest.current) return;
      if (!value) throw new Error('Missing report');
      setDetail({ owner: userId, value });
    } catch { if (version === detailRequest.current) setDetailError('Could not open this class. Close and try again.'); }
    finally { if (version === detailRequest.current) setDetailLoading(false); }
  };
  return { sessions, selectedDate, setSelectedDate, sessionsForSelectedDate, markedDateKeys,
    hasFetched: history?.owner === userId, error, refresh, detailSessionId,
    sessionDetail: detail && detail.owner === userId ? detail.value : null, isDetailLoading, detailError,
    openSessionDetail, closeSessionDetail: () => { detailRequest.current++; setDetailSessionId(null); setDetail(null); setDetailLoading(false); } };
}
