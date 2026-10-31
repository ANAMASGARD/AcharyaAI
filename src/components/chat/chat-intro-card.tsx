import { colors } from "@/theme/colors";
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { StyleSheet, Text, View } from "react-native";

export function ChatIntroCard(): React.ReactElement {
  return (
    <View style={styles.card}>
      <Text style={styles.text}>
        Ask anything about Math, Science, English, or Hindi. You can type,
        speak, or upload notes/PDFs.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.mint,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.default,
    padding: spacing.lg,
    ...shadows.md,
  },
  text: {
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 15,
    lineHeight: 22,
  },
});
