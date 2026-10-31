import { colors } from "@/theme/colors";
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
  backgroundColor = colors.card,
  children,
}: Props): React.ReactElement {
  return (
    <View style={[styles.card, { backgroundColor }]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
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
