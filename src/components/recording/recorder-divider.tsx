import { useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { spacing } from "@/theme/tokens";
import { StyleSheet, View } from "react-native";

export function RecorderDivider(): React.ReactElement {
  const styles = useThemeStyles(createStyles);

  return (
    <View style={styles.wrap}>
      <View style={styles.line} />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  line: {
    borderColor: colors.muted,
    borderStyle: "dashed",
    borderTopWidth: 1,
    width: "100%",
  },
  wrap: {
    marginVertical: spacing.lg,
  },
});
