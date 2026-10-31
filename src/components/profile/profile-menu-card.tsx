import { AccentContent, useThemeColors, useThemeStyles } from "@/theme/use-theme";
import type { ThemeColors } from '@/theme/colors';
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  title?: string;
  backgroundColor?: string;
  children: React.ReactNode;
}>;

export function ProfileMenuCard({
  title,
  backgroundColor,
  children,
}: Props): React.ReactElement {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const isAccent = backgroundColor !== undefined && [colors.mint, colors.lavender, colors.sky, colors.primary].includes(backgroundColor);
  return (
    <View style={[styles.card, { backgroundColor: backgroundColor ?? colors.card }]}>
      {title ? <Text style={[styles.title, isAccent && { color: colors.onAccent }]}>{title}</Text> : null}
      <AccentContent active={isAccent}>{children}</AccentContent>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thin,
    overflow: "hidden",
    paddingVertical: spacing.xs,
    ...shadows.md,
  },
  title: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 18,
    lineHeight: 24,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
