import { useCalendarStore } from "@/store/calendar-store";
import { colors } from "@/theme/colors";
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet } from "react-native";

type Props = Readonly<{
  sessionId: string;
}>;

export function SessionBookmarkButton({
  sessionId,
}: Props): React.ReactElement {
  const isBookmarked = useCalendarStore((state) =>
    state.bookmarkedSessionIds.includes(sessionId),
  );
  const toggleBookmark = useCalendarStore((state) => state.toggleBookmark);

  const handlePress = (): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleBookmark(sessionId);
  };

  return (
    <Pressable
      accessibilityLabel={
        isBookmarked ? "Remove bookmark" : "Bookmark session"
      }
      accessibilityRole="button"
      accessibilityState={{ selected: isBookmarked }}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        isBookmarked ? styles.buttonActive : styles.buttonIdle,
        pressed ? styles.buttonPressed : null,
      ]}
    >
      <MaterialCommunityIcons
        color={isBookmarked ? colors.foreground : colors.mutedForeground}
        name={isBookmarked ? "bookmark" : "bookmark-outline"}
        size={18}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: borderWidths.thin,
    height: spacing.touch - 12,
    justifyContent: "center",
    width: spacing.touch - 12,
  },
  buttonActive: {
    backgroundColor: colors.primary,
    ...shadows.sm,
  },
  buttonIdle: {
    backgroundColor: colors.card,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ translateX: 1 }, { translateY: 1 }],
  },
});
