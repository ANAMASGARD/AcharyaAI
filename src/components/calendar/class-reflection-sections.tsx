import { colors } from "@/theme/colors";
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import type { TeachingReport } from "@/types/recorder";
import { StyleSheet, Text, View } from "react-native";

type ReflectionField = Exclude<keyof TeachingReport, "overallScore">;

type ReflectionSection = Readonly<{
  key: ReflectionField;
  title: string;
  backgroundColor: string;
  titleColor: string;
  bodyColor: string;
  dotColor: string;
}>;

const REFLECTION_SECTIONS: readonly ReflectionSection[] = [
  {
    key: "classroomEnvironment",
    title: "Classroom Environment",
    backgroundColor: colors.lime,
    titleColor: "#2E6B2E",
    bodyColor: "#1A4A1A",
    dotColor: "#22C55E",
  },
  {
    key: "whatWentWrong",
    title: "What Went Wrong",
    backgroundColor: colors.coral,
    titleColor: "#9B3D30",
    bodyColor: "#5C2E26",
    dotColor: "#EF4444",
  },
  {
    key: "areasToImprove",
    title: "Areas to Improve",
    backgroundColor: colors.accent,
    titleColor: "#8B6914",
    bodyColor: colors.foreground,
    dotColor: "#F59E0B",
  },
  {
    key: "topicSpecificFeedback",
    title: "Topic-Specific Feedback",
    backgroundColor: colors.sky,
    titleColor: "#1A4A5E",
    bodyColor: "#1A3A4A",
    dotColor: "#3B82F6",
  },
];

type Props = Readonly<{
  report: TeachingReport;
  showHeader?: boolean;
}>;

export function ClassReflectionSections({
  report,
  showHeader = true,
}: Props): React.ReactElement {
  return (
    <View style={styles.container}>
      {showHeader ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.header}>Class Reflection</Text>
        </>
      ) : null}

      {REFLECTION_SECTIONS.map((section) => (
        <View
          key={section.key}
          style={[
            styles.sectionCard,
            { backgroundColor: section.backgroundColor },
          ]}
        >
          <View style={styles.sectionTitleRow}>
            <View style={[styles.dot, { backgroundColor: section.dotColor }]} />
            <Text style={[styles.sectionTitle, { color: section.titleColor }]}>
              {section.title.toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.sectionBody, { color: section.bodyColor }]}>
            {report[section.key]}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  divider: {
    borderBottomColor: colors.muted,
    borderBottomWidth: 2,
    borderStyle: "dashed",
    marginBottom: spacing.sm,
  },
  dot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  header: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 12,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  sectionBody: {
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 21,
  },
  sectionCard: {
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    gap: spacing.sm,
    padding: spacing.lg,
    ...shadows.sm,
  },
  sectionTitle: {
    fontFamily: fontFamilies.sansBold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  sectionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
});

export function getScoreBadgeColors(score: number): Readonly<{
  backgroundColor: string;
  textColor: string;
}> {
  if (score >= 80) {
    return { backgroundColor: "#86EFAC", textColor: colors.foreground };
  }

  if (score >= 60) {
    return { backgroundColor: colors.primary, textColor: colors.foreground };
  }

  if (score >= 40) {
    return { backgroundColor: "#FDBA74", textColor: colors.foreground };
  }

  return { backgroundColor: colors.coral, textColor: colors.foreground };
}
