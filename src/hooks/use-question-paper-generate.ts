import { apiFetch } from "@/lib/api-client";
import type { CurriculumSelection } from "@/types/curriculum";
import type {
  Difficulty,
  PaperType,
  QuestionPaperGenerateResult,
} from "@/types/question-paper";
import { useAuth } from "@clerk/expo";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type UseQuestionPaperGenerateResult = Readonly<{
  canGenerate: boolean;
  isGenerating: boolean;
  error: string | null;
  result: QuestionPaperGenerateResult | null;
  generate: () => Promise<void>;
  clearResult: () => void;
}>;

export function useQuestionPaperGenerate(input: {
  selection: CurriculumSelection | null;
  selectedBookIds: readonly string[];
  paperType: PaperType;
  difficulty: Difficulty;
  chapterIds?: readonly string[];
}): UseQuestionPaperGenerateResult {
  const { getToken,userId } = useAuth();
  const owner=useRef(userId);
  useLayoutEffect(() => { owner.current = userId; }, [userId]);
  const generation=useRef(0);const controller=useRef<AbortController|null>(null);
  const getTokenRef = useRef(getToken);
  useLayoutEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuestionPaperGenerateResult | null>(null);

  // Clear private drafts on account changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{generation.current++;controller.current?.abort();setResult(null);setError(null);setIsGenerating(false);return ()=>{controller.current?.abort();};},[userId]);
  const canGenerate = useMemo(
    () =>
      Boolean(
        input.selection &&
          input.selectedBookIds.length > 0 &&
          !isGenerating,
      ),
    [input.selectedBookIds.length, input.selection, isGenerating],
  );

  const generate = useCallback(async (): Promise<void> => {
    if (!input.selection || input.selectedBookIds.length === 0) {
      return;
    }

    controller.current?.abort();const active=new AbortController();controller.current=active;const gen=++generation.current;const account=owner.current;const current=()=>gen===generation.current&&account===owner.current&&!active.signal.aborted;
    setIsGenerating(true);
    setError(null);

    try {
      const token = await getTokenRef.current();
      if(!current())return;
      const response = await apiFetch<QuestionPaperGenerateResult>(
        "/api/notes/generate",
        {
          token,signal:active.signal,
          method: "POST",
          body: {
            classLevel: input.selection.classId,
            subject: input.selection.subjectId,
            bookIds: [...input.selectedBookIds],
            paperType: input.paperType,
            difficulty: input.difficulty,
            chapterIds: input.chapterIds?.length ? [...input.chapterIds] : undefined,
          },
        },
      );

      if(current())setResult(response);
    } catch (err) {
      if(current())setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      if(current())setIsGenerating(false);
    }
  }, [
    input.chapterIds,
    input.difficulty,
    input.paperType,
    input.selectedBookIds,
    input.selection,
  ]);

  const clearResult = useCallback((): void => {
    generation.current++;controller.current?.abort();setIsGenerating(false);
    setResult(null);
    setError(null);
  }, []);

  return {
    canGenerate,
    isGenerating,
    error,
    result,
    generate,
    clearResult,
  };
}
