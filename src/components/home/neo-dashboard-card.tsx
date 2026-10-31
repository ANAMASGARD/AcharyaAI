import { colors } from "@/theme/colors";
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
  return (
    <View style={[styles.card, { backgroundColor }]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thin,
    padding: spacing.lg,
    ...shadows.md,
  },
});
