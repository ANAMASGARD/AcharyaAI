import { colors } from "@/theme/colors";
import { borderWidths, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  showDivider?: boolean;
  trailing?: React.ReactNode;
  destructive?: boolean;
}>;

export function ProfileMenuRow({
  icon,
  label,
  subtitle,
  onPress,
  showDivider = true,
  trailing,
  destructive = false,
}: Props): React.ReactElement {
  const content = (
    <View style={[styles.row, showDivider ? styles.rowDivider : null]}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons
          color={destructive ? colors.destructive : colors.foreground}
          name={icon}
          size={22}
        />
      </View>
      <View style={styles.textWrap}>
        <Text
          style={[styles.label, destructive ? styles.labelDestructive : null]}
        >
          {label}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {trailing ?? (
        onPress ? (
          <MaterialCommunityIcons
            color={colors.mutedForeground}
            name="chevron-right"
            size={24}
          />
        ) : null
      )}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [pressed ? styles.pressed : null]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 36,
  },
  label: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 16,
    lineHeight: 22,
  },
  labelDestructive: {
    color: colors.destructive,
  },
  pressed: {
    opacity: 0.88,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: borderWidths.thin,
  },
  subtitle: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  textWrap: {
    flex: 1,
    paddingRight: spacing.sm,
  },
});
