import { apiFetch } from "@/lib/api-client";
import type { CurriculumBooksResponse, CurriculumBookSummary } from "@/types/question-paper";
import { useAuth } from "@clerk/expo";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type UseCurriculumBooksResult = Readonly<{
  books: readonly CurriculumBookSummary[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}>;

export function useCurriculumBooks(
  classLevel: string | null,
  subject: string | null,
  includeChapters = false,
): UseCurriculumBooksResult {
  const { getToken,userId } = useAuth();
  const owner=useRef(userId);
  useLayoutEffect(() => { owner.current = userId; }, [userId]);
  const generation=useRef(0);const controller=useRef<AbortController|null>(null);
  const getTokenRef = useRef(getToken);
  useLayoutEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  const [books, setBooks] = useState<readonly CurriculumBookSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!classLevel || !subject) {
      setBooks([]);
      return;
    }

    controller.current?.abort();const active=new AbortController();controller.current=active;const gen=++generation.current;const account=owner.current;const current=()=>gen===generation.current&&account===owner.current&&!active.signal.aborted;
    setIsLoading(true);
    setError(null);

    try {
      const token = await getTokenRef.current();
      if(!current())return;
      const params = new URLSearchParams({
        classLevel,
        subject,
      });
      if (includeChapters) {
        params.set("includeChapters", "true");
      }
      const response = await apiFetch<CurriculumBooksResponse>(
        `/api/curriculum/books?${params.toString()}`,
        { token,signal:active.signal },
      );
      if(current())setBooks(response.books);
    } catch (err) {
      if(!current())return;
      setError(err instanceof Error ? err.message : "Could not load books");
      setBooks([]);
    } finally {
      if(current())setIsLoading(false);
    }
  }, [classLevel, subject, includeChapters]);

  useEffect(() => {
    // Reset account/filter state before loading the replacement selection.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    generation.current++;controller.current?.abort();setBooks([]);setError(null);setIsLoading(false);
    if(userId)void refresh();
    return ()=>{controller.current?.abort();};
  }, [refresh,userId]);

  return { books, isLoading, error, refresh };
}
