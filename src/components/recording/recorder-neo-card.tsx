import { useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { StyleSheet, View } from "react-native";

type Props = Readonly<{
  children: React.ReactNode;
  style?: object;
}>;

export function RecorderNeoCard({ children, style }: Props): React.ReactElement {
  const styles = useThemeStyles(createStyles);

  return <View style={[styles.card, style]}>{children}</View>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.default,
    overflow: "hidden",
    padding: spacing.lg,
    ...shadows.lg,
  },
});
