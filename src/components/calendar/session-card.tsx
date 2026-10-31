import { SessionBookmarkButton } from "@/components/calendar/session-bookmark-button";
import { getScoreBadgeColors } from "@/components/calendar/class-reflection-sections";
import { NeoButton } from "@/components/ui/neo-button";
import { NeoCard } from "@/components/ui/neo-card";
import { formatDuration, formatSessionTime } from "@/lib/calendar/date-utils";
import {
  formatPeriodLabel,
  getClassBadgeColors,
  getClassDisplayLabel,
  getSubjectBadgeColors,
  getSubjectDisplayLabel,
} from "@/lib/calendar/session-display";
import { colors } from "@/theme/colors";
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import type { CalendarSession } from "@/types/calendar";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  session: CalendarSession;
  periodNumber: number;
  onViewDetails: (sessionId: string) => void;
}>;

export function SessionCard({
  session,
  periodNumber,
  onViewDetails,
}: Props): React.ReactElement {
  const subjectColors = getSubjectBadgeColors(session.subject);
  const classColors = getClassBadgeColors();
  const score =
    typeof session.score === "number" ? session.score : undefined;
  const scoreColors = score !== undefined ? getScoreBadgeColors(score) : null;

  return (
    <NeoCard padding={spacing.lg}>
      <View style={styles.topRow}>
        <View style={styles.periodBadge}>
          <Text style={styles.periodText}>{formatPeriodLabel(periodNumber)}</Text>
        </View>
        <View style={styles.topRight}>
          {score !== undefined && scoreColors ? (
            <View
              style={[
                styles.scoreBadge,
                { backgroundColor: scoreColors.backgroundColor },
              ]}
            >
              <Text style={styles.scoreText}>{score}</Text>
            </View>
          ) : null}
          <SessionBookmarkButton sessionId={session.sessionId} />
        </View>
      </View>

      <Text style={styles.topic}>{session.topic}</Text>

      <View style={styles.tagRow}>
        <View
          style={[
            styles.tagBadge,
            { backgroundColor: subjectColors.backgroundColor },
          ]}
        >
          <Text style={[styles.tagText, { color: subjectColors.textColor }]}>
            {getSubjectDisplayLabel(session.subject)}
          </Text>
        </View>
        <View
          style={[
            styles.tagBadge,
            { backgroundColor: classColors.backgroundColor },
          ]}
        >
          <Text style={[styles.tagText, { color: classColors.textColor }]}>
            {getClassDisplayLabel(session.classLevel)}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <MaterialCommunityIcons
            color={colors.mutedForeground}
            name="clock-outline"
            size={16}
          />
          <Text style={styles.metaText}>
            {formatSessionTime(session.recordedAt)}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <MaterialCommunityIcons
            color={colors.mutedForeground}
            name="book-open-page-variant-outline"
            size={16}
          />
          <Text style={styles.metaText}>
            {formatDuration(session.durationSeconds)}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <NeoButton
        iconName="eye-outline"
        label="View Details"
        onPress={() => onViewDetails(session.sessionId)}
      />
    </NeoCard>
  );
}

const styles = StyleSheet.create({
  divider: {
    borderBottomColor: colors.muted,
    borderBottomWidth: 2,
    borderStyle: "dashed",
    marginBottom: spacing.lg,
    marginTop: spacing.md,
  },
  metaItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  metaRow: {
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  metaText: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  periodBadge: {
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: borderWidths.thin,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  periodText: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 11,
    letterSpacing: 0.3,
    lineHeight: 14,
  },
  scoreBadge: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: borderWidths.thin,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  scoreText: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 13,
  },
  topRight: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  tagBadge: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: borderWidths.thin,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tagText: {
    fontFamily: fontFamilies.sansBold,
    fontSize: 13,
    lineHeight: 18,
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  topic: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 24,
    lineHeight: 30,
    marginTop: spacing.md,
  },
});
