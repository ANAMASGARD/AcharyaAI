import type { CurriculumBookSummary } from '@/types/question-paper';

export function useCurriculumBooks(_classId: string | null, _subjectId: string | null, _includeChapters = false) {
  return { books: [] as CurriculumBookSummary[], isLoading: false, error: null as string | null };
}
