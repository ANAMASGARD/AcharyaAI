import { colors } from "@/theme/colors";
import { spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = Readonly<{
  title: string;
  rightActions?: React.ReactNode;
}>;

export function CommunityScreenHeader({
  title,
  rightActions,
}: Props): React.ReactElement {
  const router = useRouter();

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={styles.row}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <MaterialCommunityIcons color={colors.foreground} name="arrow-left" size={22} />
        </Pressable>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {rightActions ? <View style={styles.rightActions}>{rightActions}</View> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  rightActions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  safeArea: {
    backgroundColor: colors.cream,
  },
  title: {
    color: colors.foreground,
    flex: 1,
    fontFamily: fontFamilies.head,
    fontSize: 22,
    lineHeight: 28,
  },
});
