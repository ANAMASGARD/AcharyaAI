export type RecorderOption = Readonly<{
  id: string;
  label: string;
}>;

export const RECORDER_SUBJECTS: readonly RecorderOption[] = [
  { id: "mathematics", label: "Mathematics" },
  { id: "science", label: "Science" },
  { id: "english", label: "English" },
  { id: "hindi", label: "Hindi" },
  { id: "social-science", label: "Social Science" },
  { id: "physics", label: "Physics" },
  { id: "chemistry", label: "Chemistry" },
  { id: "biology", label: "Biology" },
] as const;

export const RECORDER_CLASS_LEVELS: readonly RecorderOption[] = [
  { id: "class-2", label: "Class 2" },
  { id: "class-3", label: "Class 3" },
  { id: "class-4", label: "Class 4" },
  { id: "class-5", label: "Class 5" },
  { id: "class-6", label: "Class 6" },
  { id: "class-7", label: "Class 7" },
  { id: "class-8", label: "Class 8" },
  { id: "class-9", label: "Class 9" },
  { id: "class-10", label: "Class 10" },
  { id: "class-11", label: "Class 11" },
  { id: "class-12", label: "Class 12" },
] as const;

export function getRecorderOptionLabel(
  options: readonly RecorderOption[],
  id: string,
): string | undefined {
  return options.find((option) => option.id === id)?.label;
}
