import { NeoDashboardCard } from "@/components/home/neo-dashboard-card";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import type { StartSessionContent } from "@/types/home-dashboard";
import { Pressable, StyleSheet, Text } from "react-native";

type Props = Readonly<{
  content: StartSessionContent;
  onPress: () => void;
}>;

export function StartSessionCard({
  content,
  onPress,
}: Props): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [pressed ? styles.pressed : null]}
    >
      <NeoDashboardCard backgroundColor={colors.cream}>
        <Text style={styles.title}>{content.title}</Text>
        <Text style={styles.body}>{content.body}</Text>
      </NeoDashboardCard>
    </Pressable>
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
  pressed: {
    opacity: 0.92,
  },
  title: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 20,
    lineHeight: 26,
  },
});
