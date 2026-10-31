import { colors } from "@/theme/colors";
import { borderWidths, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Switch, Text, View } from "react-native";

type Props = Readonly<{
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  showDivider?: boolean;
}>;

export function ProfileToggleRow({
  icon,
  label,
  subtitle,
  value,
  onValueChange,
  showDivider = true,
}: Props): React.ReactElement {
  return (
    <View style={[styles.row, showDivider ? styles.rowDivider : null]}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons color={colors.foreground} name={icon} size={22} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.label}>{label}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        onValueChange={onValueChange}
        thumbColor={colors.card}
        trackColor={{ false: colors.muted, true: colors.foreground }}
        value={value}
      />
    </View>
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
