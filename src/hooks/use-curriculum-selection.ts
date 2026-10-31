import { usePreviewFeature } from "@/components/preview/preview-provider";
import type { CurriculumSelection } from "@/types/curriculum";
import { useCallback, useState } from "react";

type UseCurriculumSelectionResult = Readonly<{
  sheetVisible: boolean;
  expandedClassId: string | null;
  selection: CurriculumSelection | null;
  uploadedBookName: string | null;
  openSheet: () => void;
  closeSheet: () => void;
  toggleClass: (classId: string) => void;
  selectSubject: (selection: CurriculumSelection) => void;
  clearSelection: () => void;
  setUploadedBookName: (name: string | null) => void;
}>;

export function useCurriculumSelection(): UseCurriculumSelectionResult {
  const [sheetVisible, setSheetVisible] = useState(false);
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [selection, setSelection] = usePreviewFeature<CurriculumSelection | null>("curriculum-selection", null);
  const [uploadedBookName, setUploadedBookName] = usePreviewFeature<string | null>("curriculum-book-name", null);

  const openSheet = useCallback((): void => {
    setSheetVisible(true);
  }, []);

  const closeSheet = useCallback((): void => {
    setSheetVisible(false);
  }, []);

  const toggleClass = useCallback((classId: string): void => {
    setExpandedClassId((current) => (current === classId ? null : classId));
  }, []);

  const selectSubject = useCallback((next: CurriculumSelection): void => {
    setSelection(next);
    setSheetVisible(false);
  }, [setSelection]);

  const clearSelection = useCallback((): void => {
    setSelection(null);
  }, [setSelection]);

  return {
    sheetVisible,
    expandedClassId,
    selection,
    uploadedBookName,
    openSheet,
    closeSheet,
    toggleClass,
    selectSubject,
    clearSelection,
    setUploadedBookName,
  };
}
