import { colors } from "@/theme/colors";
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  label: string;
  onPress: () => void;
  iconName?: keyof typeof MaterialCommunityIcons.glyphMap;
  disabled?: boolean;
}>;

export function NeoButton({
  label,
  onPress,
  iconName,
  disabled = false,
}: Props): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      {iconName ? (
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons
            color={colors.foreground}
            name={iconName}
            size={16}
          />
        </View>
      ) : null}
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.default,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: spacing.touch,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadows.md,
  },
  disabled: {
    opacity: 0.5,
  },
  iconWrap: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: borderWidths.thin,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  label: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 15,
    lineHeight: 20,
  },
  pressed: {
    shadowOffset: { width: 1, height: 1 },
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
});
