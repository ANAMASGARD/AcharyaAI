import type { CurriculumSelection } from '@/types/curriculum';
import type { Difficulty, PaperType, QuestionPaperGenerateResult } from '@/types/question-paper';

export function useQuestionPaperGenerate(_input: { selection: CurriculumSelection | null; selectedBookIds: string[]; paperType: PaperType; difficulty: Difficulty }) {
  return { canGenerate: false, isGenerating: false, error: null as string | null,
    result: null as QuestionPaperGenerateResult | null, generate: async () => {} };
}
