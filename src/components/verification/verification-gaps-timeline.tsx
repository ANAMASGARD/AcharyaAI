import { VerificationGapCard } from "@/components/verification/verification-gap-card";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import type { VerificationGap } from "@/types/notes-verification";
import { StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  gaps: readonly VerificationGap[];
}>;

export function VerificationGapsTimeline({ gaps }: Props): React.ReactElement {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Verification Gaps & Suggestions</Text>

      <View style={styles.timeline}>
        <View style={styles.rail}>
          {gaps.map((gap, index) => (
            <View key={`rail-${gap.id}`} style={styles.railSegment}>
              <View style={styles.node} />
              {index < gaps.length - 1 ? <View style={styles.railLine} /> : null}
            </View>
          ))}
        </View>

        <View style={styles.cards}>
          {gaps.map((gap) => (
            <VerificationGapCard key={gap.id} gap={gap} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cards: {
    flex: 1,
    gap: spacing.md,
  },
  container: {
    gap: spacing.md,
  },
  heading: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 20,
    lineHeight: 26,
  },
  node: {
    backgroundColor: "#F59E0B",
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 2,
    height: 12,
    width: 12,
  },
  rail: {
    alignItems: "center",
    paddingTop: spacing.sm,
    width: 24,
  },
  railLine: {
    borderColor: colors.muted,
    borderLeftWidth: 2,
    borderStyle: "dashed",
    flex: 1,
    marginVertical: spacing.xs,
    minHeight: spacing.xl,
    width: 0,
  },
  railSegment: {
    alignItems: "center",
    flex: 1,
    width: "100%",
  },
  timeline: {
    flexDirection: "row",
    gap: spacing.md,
  },
});
