import {
  getRecorderOptionLabel,
  RECORDER_CLASS_LEVELS,
  RECORDER_SUBJECTS,
} from "@/data/recorder-options";
import { colors } from "@/theme/colors";

type BadgeColors = Readonly<{
  backgroundColor: string;
  textColor: string;
}>;

const SUBJECT_BADGE_COLORS: Record<string, BadgeColors> = {
  mathematics: { backgroundColor: colors.accent, textColor: colors.foreground },
  science: { backgroundColor: colors.sky, textColor: "#1A4A5E" },
  english: { backgroundColor: colors.coral, textColor: "#5C2E26" },
  hindi: { backgroundColor: colors.lime, textColor: "#2E4A1A" },
  "social-science": {
    backgroundColor: colors.mint,
    textColor: "#1A4A45",
  },
  physics: { backgroundColor: colors.sky, textColor: "#1A4A5E" },
  chemistry: { backgroundColor: colors.lavender, textColor: "#3D2E5C" },
  biology: { backgroundColor: colors.lime, textColor: "#2E4A1A" },
};

const DEFAULT_SUBJECT_BADGE: BadgeColors = {
  backgroundColor: colors.sky,
  textColor: colors.foreground,
};

const CLASS_BADGE_COLORS: BadgeColors = {
  backgroundColor: colors.lavender,
  textColor: "#3D2E5C",
};

function normalizeSubjectKey(subject: string): string {
  return subject.trim().toLowerCase().replace(/\s+/g, "-");
}

export function getSubjectDisplayLabel(subject: string): string {
  const fromOptions = getRecorderOptionLabel(RECORDER_SUBJECTS, subject);
  if (fromOptions) {
    return fromOptions;
  }

  const normalized = subject.trim();
  if (!normalized) {
    return "Subject";
  }

  return normalized
    .split(/[\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function getClassDisplayLabel(classLevel: string): string {
  const fromOptions = getRecorderOptionLabel(RECORDER_CLASS_LEVELS, classLevel);
  if (fromOptions) {
    return fromOptions;
  }

  const trimmed = classLevel.trim();
  if (/^class\s*\d+$/i.test(trimmed)) {
    return trimmed.replace(/\s+/g, " ");
  }

  if (/^\d+$/.test(trimmed)) {
    return `Class ${trimmed}`;
  }

  return trimmed || "Class";
}

export function getSubjectBadgeColors(subject: string): BadgeColors {
  const key = normalizeSubjectKey(subject);
  const byId = SUBJECT_BADGE_COLORS[key];

  if (byId) {
    return byId;
  }

  const matchedOption = RECORDER_SUBJECTS.find(
    (option) =>
      option.label.toLowerCase() === subject.trim().toLowerCase() ||
      option.id === key,
  );

  if (matchedOption) {
    return SUBJECT_BADGE_COLORS[matchedOption.id] ?? DEFAULT_SUBJECT_BADGE;
  }

  return DEFAULT_SUBJECT_BADGE;
}

export function getClassBadgeColors(): BadgeColors {
  return CLASS_BADGE_COLORS;
}

export function formatPeriodLabel(periodNumber: number): string {
  return `Period ${periodNumber}`;
}
