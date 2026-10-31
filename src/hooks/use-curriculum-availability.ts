/** Curriculum availability is not claimed until the online catalog is connected. */
export function useCurriculumAvailability(_visible: boolean) {
  return { isReady: (_classId: string, _subjectId: string) => false, isLoading: false };
}
