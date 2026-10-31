import { getTabBarOverlayHeight } from "@/components/navigation/tab-bar-constants";
import { CommunitySection } from "@/components/community/community-section";
import { HomeHeader } from "@/components/home/home-header";
import { RecentActivityCard } from "@/components/home/recent-activity-card";
import { useHomeDashboard } from "@/hooks/use-home-dashboard";
import { useHomeGreeting } from "@/hooks/use-home-greeting";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const TAB_BAR_CLEARANCE = 100;

export function HomeScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const dockClearance = Math.max(TAB_BAR_CLEARANCE, getTabBarOverlayHeight(insets.bottom) + spacing.lg);
  const router = useRouter();
  const { greetingText } = useHomeGreeting();
  const { dashboard, recentActivity, isLoading, error, refresh } =
    useHomeDashboard();

  const goToRecorder = (): void => {
    router.push("/(app)/(tabs)/recorder");
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: dockClearance }]}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <HomeHeader
          greetingText={greetingText}
          streakDays={dashboard?.stats.streakDays ?? 0}
        />

        {error ? (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void refresh();
              }}
              style={styles.retryButton}
            >
              <Text style={styles.retryLabel}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.cards}>
          <RecentActivityCard
            isLoading={isLoading}
            items={recentActivity}
            onStartClass={goToRecorder}
            onVerifyNotes={() => router.push("/notes/upload")}
            stats={dashboard?.stats ?? null}
          />
        </View>

        <View style={styles.communityWrap}>
          <CommunitySection />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  cards: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  communityWrap: {
    paddingBottom: spacing.md,
    paddingTop: spacing.md,
  },
  errorText: {
    color: colors.destructive,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  errorWrap: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  retryButton: {
    alignSelf: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 14,
    lineHeight: 18,
  },
  safeArea: {
    backgroundColor: colors.cream,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: TAB_BAR_CLEARANCE,
  },
});
