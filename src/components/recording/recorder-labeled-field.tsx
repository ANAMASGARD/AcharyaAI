import { useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  label: string;
  required?: boolean;
  children: React.ReactNode;
}>;

export function RecorderLabeledField({
  label,
  required = false,
  children,
}: Props): React.ReactElement {
  const styles = useThemeStyles(createStyles);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.requiredMark}> *</Text> : null}
      </Text>
      {children}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  label: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 12,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
  },
  requiredMark: {
    color: colors.destructive,
  },
  wrap: {
    marginBottom: spacing.md,
  },
});
