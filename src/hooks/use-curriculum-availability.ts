import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/expo';
import { apiFetch } from '@/lib/api-client';
import type { CurriculumAvailabilityResponse } from '@/types/curriculum';

export function useCurriculumAvailability(enabled: boolean) {
  const { getToken, userId } = useAuth();
  const auth = useRef({ getToken, userId });
  useLayoutEffect(() => { auth.current = { getToken, userId }; }, [getToken, userId]);
  const controller = useRef<AbortController | null>(null);
  const [catalog, setCatalog] = useState<{ owner: string | null | undefined; keys: ReadonlySet<string> }>({ owner: null, keys: new Set() });
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    controller.current?.abort();
    if (!enabled || !auth.current.userId) return;
    const active = new AbortController();
    controller.current = active;
    const owner = auth.current.userId;
    const current = () => !active.signal.aborted && owner === auth.current.userId;
    setLoading(true);
    setError(null);
    try {
      const token = await auth.current.getToken();
      if (!current()) return;
      const response = await apiFetch<CurriculumAvailabilityResponse>('/api/curriculum/availability', { token, signal: active.signal });
      if (current()) setCatalog({ owner, keys: new Set(response.slots.map(slot => `${slot.classLevel}:${slot.subject.toLowerCase()}`)) });
    } catch (failure) {
      if (current()) {
        setCatalog({ owner, keys: new Set() });
        setError(failure instanceof Error ? failure.message : 'Could not load book availability.');
      }
    } finally {
      if (current()) setLoading(false);
    }
  }, [enabled]);
  useEffect(() => {
    // Fetch state reflects the visible selector and is invalidated on account changes.
    void refresh();
    return () => controller.current?.abort();
  }, [refresh, userId]);
  return {
    isReady: (classId: string, subjectId: string) => catalog.owner === userId && catalog.keys.has(`${classId}:${subjectId.toLowerCase()}`),
    isLoading, error, refresh,
  };
}
