import { images } from "@/constants/images";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

const LOGO_SIZE = 64;

type Props = Readonly<{
  greetingText: string;
  streakDays: number;
}>;

export function HomeHeader({
  greetingText,
  streakDays,
}: Props): React.ReactElement {
  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <View style={styles.textBlock}>
          <Text style={styles.greeting}>{greetingText}</Text>
          <View style={styles.streakRow}>
            <Text style={styles.streakLabel}>
              Streak indicator: {streakDays} day{streakDays === 1 ? "" : "s"}
            </Text>
            <Image
              accessibilityLabel="Teaching streak"
              contentFit="contain"
              source={images.streakFire}
              style={styles.streakIcon}
            />
          </View>
        </View>
        <Image
          accessibilityLabel="Acharya logo"
          contentFit="contain"
          source={images.mascotLogo}
          style={styles.logo}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  greeting: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 22,
    lineHeight: 28,
    minHeight: 28,
  },
  header: {
    backgroundColor: colors.primary,
    overflow: "hidden",
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  logo: {
    height: LOGO_SIZE,
    width: LOGO_SIZE,
  },
  streakIcon: {
    height: 20,
    width: 20,
  },
  streakLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  streakRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  textBlock: {
    flex: 1,
    paddingRight: spacing.md,
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: LOGO_SIZE,
  },
});
