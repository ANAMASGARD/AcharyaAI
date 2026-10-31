import { colors } from "@/theme/colors";
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import type { WeightageReport, WeightageStatus } from "@/types/question-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  weightage?: WeightageReport;
}>;

type StatusStyle = Readonly<{ label: string; color: string }>;

const STATUS_STYLES: Record<WeightageStatus, StatusStyle> = {
  aligned: { label: "OK", color: colors.mint },
  over: { label: "OVER", color: colors.coral },
  under: { label: "UNDER", color: colors.primary },
  missing: { label: "MISSING", color: colors.coralLight },
};

function scoreColor(score: number): string {
  if (score >= 80) {
    return colors.lime;
  }
  if (score >= 60) {
    return colors.primary;
  }
  return colors.coral;
}

/**
 * Neo-Brutal per-chapter weightage breakdown for a verified question paper.
 * Each chapter bar shows the actual marks share with a target marker at the
 * even-split %, so a teacher can instantly see over/under/missing chapters.
 * Renders nothing when no weightage was computed (graceful fallback).
 */
export function WeightageBreakdown({ weightage }: Props): React.ReactElement | null {
  if (!weightage || weightage.chapters.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Weightage balance</Text>
          <Text style={styles.subtitle}>
            Marks per chapter vs an even split ({weightage.totalMarks} marks total)
          </Text>
        </View>
        <View style={[styles.scoreBadge, { backgroundColor: scoreColor(weightage.balanceScore) }]}>
          <Text style={styles.scoreValue}>{weightage.balanceScore}</Text>
          <Text style={styles.scoreLabel}>balance</Text>
        </View>
      </View>

      <View style={styles.chapterList}>
        {weightage.chapters.map((chapter) => {
          const status = STATUS_STYLES[chapter.status];
          const fillWidth = Math.max(0, Math.min(100, chapter.actualPct));
          const markerLeft = Math.max(0, Math.min(100, chapter.expectedPct));

          return (
            <View key={chapter.chapterTitle} style={styles.chapterRow}>
              <View style={styles.chapterTopRow}>
                <Text numberOfLines={1} style={styles.chapterTitle}>
                  {chapter.chapterTitle}
                </Text>
                <View style={[styles.statusChip, { backgroundColor: status.color }]}>
                  <Text style={styles.statusText}>{status.label}</Text>
                </View>
              </View>

              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    { width: `${fillWidth}%`, backgroundColor: status.color },
                  ]}
                />
                <View style={[styles.targetMarker, { left: `${markerLeft}%` }]} />
              </View>

              <Text style={styles.chapterMeta}>
                {chapter.marks} {chapter.marks === 1 ? "mark" : "marks"} · {chapter.actualPct}% of paper
                {"  ·  "}target {chapter.expectedPct}%
              </Text>
            </View>
          );
        })}
      </View>

      {weightage.outOfSyllabusMarks > 0 ? (
        <View style={styles.warningCallout}>
          <MaterialCommunityIcons color={colors.foreground} name="alert-octagon-outline" size={18} />
          <Text style={styles.warningText}>
            {weightage.outOfSyllabusMarks}{" "}
            {weightage.outOfSyllabusMarks === 1 ? "mark" : "marks"} (
            {weightage.outOfSyllabusPct}%) fall outside the selected chapters.
          </Text>
        </View>
      ) : null}

      {weightage.contentInsight ? (
        <View style={styles.insightCallout}>
          <Text style={styles.insightEmoji}>💡</Text>
          <Text style={styles.insightText}>{weightage.contentInsight}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.default,
    gap: spacing.md,
    padding: spacing.lg,
    ...shadows.md,
  },
  chapterList: {
    gap: spacing.md,
  },
  chapterMeta: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 12,
    lineHeight: 16,
  },
  chapterRow: {
    gap: spacing.xs,
  },
  chapterTitle: {
    color: colors.foreground,
    flex: 1,
    fontFamily: fontFamilies.sansBold,
    fontSize: 14,
    lineHeight: 18,
  },
  chapterTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  fill: {
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  insightCallout: {
    alignItems: "flex-start",
    backgroundColor: colors.lavender,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  insightEmoji: {
    fontSize: 16,
    lineHeight: 20,
  },
  insightText: {
    color: colors.foreground,
    flex: 1,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 13,
    lineHeight: 18,
  },
  scoreBadge: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.default,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.sm,
  },
  scoreLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  scoreValue: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 28,
    lineHeight: 32,
  },
  statusChip: {
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: borderWidths.thin,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusText: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  subtitle: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    lineHeight: 17,
  },
  targetMarker: {
    backgroundColor: colors.foreground,
    bottom: -2,
    position: "absolute",
    top: -2,
    width: 2,
  },
  title: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 18,
    lineHeight: 22,
  },
  track: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: borderWidths.thin,
    height: 14,
    overflow: "visible",
    position: "relative",
  },
  warningCallout: {
    alignItems: "center",
    backgroundColor: colors.coralLight,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  warningText: {
    color: colors.foreground,
    flex: 1,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 13,
    lineHeight: 18,
  },
});
