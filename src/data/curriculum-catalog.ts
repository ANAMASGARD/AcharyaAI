import { RECORDER_CLASS_LEVELS, RECORDER_SUBJECTS } from "@/data/recorder-options";
import type { CurriculumClass } from "@/types/curriculum";

const SUBJECT_MAP = Object.fromEntries(
  RECORDER_SUBJECTS.map((subject) => [subject.id, subject.label]),
) as Record<string, string>;

/** Static choices retained from the original curriculum selector. */
const CLASS_SUBJECT_PAIRS: Record<string, readonly [string, string]> = {
  "class-2": ["english", "mathematics"],
  "class-3": ["english", "science"],
  "class-4": ["english", "science"],
  "class-5": ["english", "science"],
  "class-6": ["science", "english"],
  "class-7": ["english", "science"],
  "class-8": ["english", "science"],
  "class-9": ["english", "science"],
  "class-10": ["english", "science"],
  "class-11": ["english", "physics"],
  "class-12": ["english", "physics"],
};

const CLASS_IDS = new Set(Object.keys(CLASS_SUBJECT_PAIRS));

function buildClass(classId: string, label: string): CurriculumClass {
  const pair = CLASS_SUBJECT_PAIRS[classId] ?? [];

  return {
    id: classId,
    label,
    subjects: pair.map((subjectId) => ({
      id: subjectId,
      label: SUBJECT_MAP[subjectId] ?? subjectId,
      status: "coming_soon",
    })),
  };
}

export const CURRICULUM_CATALOG: readonly CurriculumClass[] =
  RECORDER_CLASS_LEVELS.filter((level) => CLASS_IDS.has(level.id)).map((level) =>
    buildClass(level.id, level.label),
  );
