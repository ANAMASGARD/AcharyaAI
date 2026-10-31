import { Pressable } from '@/components/feedback/pressable';
import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { NeoDashboardCard } from "@/components/home/neo-dashboard-card";
import { borderWidths, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  onVerifyNotes: () => void;
  onStartClass: () => void;
}>;

export function QuickActionsRow({
  onVerifyNotes,
  onStartClass,
}: Props): React.ReactElement {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        onPress={onVerifyNotes}
        style={({ pressed }) => [styles.cardPressable, pressed && styles.pressed]}
      >
        <NeoDashboardCard backgroundColor={colors.mint}>
          <MaterialCommunityIcons color={colors.onAccent} name="file-check-outline" size={22} />
          <Text style={styles.label}>Verify Notes</Text>
        </NeoDashboardCard>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onStartClass}
        style={({ pressed }) => [styles.cardPressable, pressed && styles.pressed]}
      >
        <NeoDashboardCard backgroundColor={colors.coral}>
          <MaterialCommunityIcons color={colors.onAccent} name="microphone" size={22} />
          <Text style={styles.label}>Start Class</Text>
        </NeoDashboardCard>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  cardPressable: {
    flex: 1,
  },
  label: {
    color: colors.onAccent,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 14,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ translateY: borderWidths.thin }],
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
