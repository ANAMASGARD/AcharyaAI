import { NeoDashboardCard } from "@/components/home/neo-dashboard-card";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import type { NotesGapsContent } from "@/types/home-dashboard";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  content: NotesGapsContent;
  onPressCta?: () => void;
}>;

export function NotesGapsCard({
  content,
  onPressCta,
}: Props): React.ReactElement {
  return (
    <NeoDashboardCard backgroundColor={colors.mint}>
      <Text style={styles.title}>{content.title}</Text>
      <Text style={styles.body}>{content.body}</Text>
      <View style={styles.ctaWrap}>
        <Pressable
          accessibilityRole="button"
          onPress={onPressCta}
          style={({ pressed }) => [
            styles.cta,
            pressed ? styles.ctaPressed : null,
          ]}
        >
          <Text style={styles.ctaLabel}>{content.ctaLabel}</Text>
        </Pressable>
      </View>
    </NeoDashboardCard>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.md,
  },
  cta: {
    alignSelf: "flex-start",
    backgroundColor: colors.secondary,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  ctaLabel: {
    color: colors.secondaryForeground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 13,
    lineHeight: 18,
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaWrap: {
    marginTop: spacing.lg,
  },
  title: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 20,
    lineHeight: 26,
  },
});
