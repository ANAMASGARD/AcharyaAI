import { colors } from "@/theme/colors";
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import type { VoteValue } from "@/types/community";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  score: number;
  viewerVote: VoteValue | null;
  onUpvote: () => void;
  onDownvote: () => void;
}>;

export function VoteBar({
  score,
  viewerVote,
  onUpvote,
  onDownvote,
}: Props): React.ReactElement {
  const upActive = viewerVote === 1;
  const downActive = viewerVote === -1;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel="Upvote"
        accessibilityRole="button"
        accessibilityState={{ selected: upActive }}
        onPress={onUpvote}
        style={({ pressed }) => [
          styles.voteChip,
          styles.upChip,
          upActive && styles.upChipActive,
          pressed && styles.pressed,
        ]}
      >
        <MaterialCommunityIcons
          color={colors.foreground}
          name={upActive ? "arrow-up-bold" : "arrow-up-bold-outline"}
          size={22}
        />
      </Pressable>

      <View style={styles.scoreChip}>
        <Text
          style={[
            styles.score,
            upActive && styles.scoreUp,
            downActive && styles.scoreDown,
          ]}
        >
          {score}
        </Text>
      </View>

      <Pressable
        accessibilityLabel="Downvote"
        accessibilityRole="button"
        accessibilityState={{ selected: downActive }}
        onPress={onDownvote}
        style={({ pressed }) => [
          styles.voteChip,
          styles.downChip,
          downActive && styles.downChipActive,
          pressed && styles.pressed,
        ]}
      >
        <MaterialCommunityIcons
          color={colors.foreground}
          name={downActive ? "arrow-down-bold" : "arrow-down-bold-outline"}
          size={22}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  downChip: {
    backgroundColor: colors.card,
  },
  downChipActive: {
    backgroundColor: colors.coral,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ translateY: 1 }],
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  score: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 16,
    lineHeight: 20,
    textAlign: "center",
  },
  scoreChip: {
    alignItems: "center",
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    justifyContent: "center",
    minWidth: 40,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    ...shadows.sm,
  },
  scoreDown: {
    color: colors.destructive,
  },
  scoreUp: {
    color: colors.foreground,
  },
  upChip: {
    backgroundColor: colors.card,
  },
  upChipActive: {
    backgroundColor: colors.lime,
  },
  voteChip: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    height: 40,
    justifyContent: "center",
    width: 40,
    ...shadows.sm,
  },
});
