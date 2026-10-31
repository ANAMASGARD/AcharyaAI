import { CURRICULUM_CATALOG } from "@/data/curriculum-catalog";
import {
  RECORDER_CLASS_LEVELS,
  getRecorderOptionLabel,
} from "@/data/recorder-options";
import type { CurriculumClass } from "@/types/curriculum";

export function getTeachingClassesForCurriculum(
  teachingClassIds: readonly string[],
): readonly CurriculumClass[] {
  if (teachingClassIds.length === 0) {
    return [];
  }

  const allowed = new Set(teachingClassIds);

  return CURRICULUM_CATALOG.filter((classItem) => allowed.has(classItem.id));
}

export function formatTeachingClassesSummary(
  teachingClassIds: readonly string[],
): string {
  if (teachingClassIds.length === 0) {
    return "Not set — tap to choose";
  }

  const labels = teachingClassIds
    .map((id) => getRecorderOptionLabel(RECORDER_CLASS_LEVELS, id))
    .filter((label): label is string => Boolean(label));

  if (labels.length === 0) {
    return "Not set — tap to choose";
  }

  if (labels.length <= 3) {
    return labels.join(", ");
  }

  return `${labels.slice(0, 3).join(", ")} +${labels.length - 3} more`;
}
