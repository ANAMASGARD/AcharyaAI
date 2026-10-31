import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { StyleSheet, View } from "react-native";

type Props = Readonly<{
  backgroundColor: string;
  children: React.ReactNode;
}>;

export function NeoDashboardCard({
  backgroundColor,
  children,
}: Props): React.ReactElement {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  return (
    <View style={[styles.card, { backgroundColor: backgroundColor ?? colors.card }]}>{children}</View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thin,
    padding: spacing.lg,
    ...shadows.md,
  },
});
