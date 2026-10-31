import { colors } from "@/theme/colors";
import { spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { StyleSheet, Text, View } from "react-native";

export function ActivityEmptyState(): React.ReactElement {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>No activity yet</Text>
      <Text style={styles.body}>
        Record a class or verify notes to see your teaching activity here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  title: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
  },
  wrap: {
    paddingVertical: spacing.md,
  },
});
