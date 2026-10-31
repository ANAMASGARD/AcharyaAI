import type { CurriculumSelection } from '@/types/curriculum';
import type { NotesUploadFile } from '@/types/notes-verification';
import type { QuestionPaperVerifyResult } from '@/types/question-paper';
import { useCallback } from 'react';

export function useQuestionPaperVerify(_input: { selectedFile: NotesUploadFile | null; selection: CurriculumSelection | null; selectedBookIds: string[]; selectedChapterIds: string[] }) {
  const clearResult = useCallback(() => {}, []);
  return { canVerify: false, isVerifying: false, error: null as string | null,
    result: null as QuestionPaperVerifyResult | null, verify: async () => {}, clearResult };
}
