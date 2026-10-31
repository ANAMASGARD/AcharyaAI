import { NeoDashboardCard } from "@/components/home/neo-dashboard-card";
import { colors } from "@/theme/colors";
import { borderWidths, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  onVerifyNotes: () => void;
  onStartClass: () => void;
}>;

export function QuickActionsRow({
  onVerifyNotes,
  onStartClass,
}: Props): React.ReactElement {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        onPress={onVerifyNotes}
        style={({ pressed }) => [styles.cardPressable, pressed && styles.pressed]}
      >
        <NeoDashboardCard backgroundColor={colors.mint}>
          <MaterialCommunityIcons color={colors.foreground} name="file-check-outline" size={22} />
          <Text style={styles.label}>Verify Notes</Text>
        </NeoDashboardCard>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onStartClass}
        style={({ pressed }) => [styles.cardPressable, pressed && styles.pressed]}
      >
        <NeoDashboardCard backgroundColor={colors.coral}>
          <MaterialCommunityIcons color={colors.foreground} name="microphone" size={22} />
          <Text style={styles.label}>Start Class</Text>
        </NeoDashboardCard>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cardPressable: {
    flex: 1,
  },
  label: {
    color: colors.foreground,
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
