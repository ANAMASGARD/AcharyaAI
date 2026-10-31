import { getTabBarOverlayHeight } from "@/components/navigation/tab-bar-constants";
import { SessionCard } from "@/components/calendar/session-card";
import { SessionDetailModal } from "@/components/calendar/session-detail-modal";
import { TeachingCalendar } from "@/components/calendar/teaching-calendar";
import { NeoButton } from "@/components/ui/neo-button";
import { useCalendarSessions } from "@/hooks/use-calendar-sessions";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const TAB_BAR_CLEARANCE = 100;

export function CalendarScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const dockClearance = Math.max(TAB_BAR_CLEARANCE, getTabBarOverlayHeight(insets.bottom) + spacing.lg);
  const router = useRouter();
  const {
    sessions,
    selectedDate,
    setSelectedDate,
    sessionsForSelectedDate,
    markedDateKeys,
    hasFetched,
    error,
    refresh,
    detailSessionId,
    sessionDetail,
    isDetailLoading,
    detailError,
    openSessionDetail,
    closeSessionDetail,
  } = useCalendarSessions();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async (): Promise<void> => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [refresh]);

  const goToRecorder = (): void => {
    router.push("/(app)/(tabs)/recorder");
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: dockClearance }]}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              void handleRefresh();
            }}
            refreshing={isRefreshing}
            tintColor={colors.foreground}
          />
        }
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TeachingCalendar
          markedDateKeys={markedDateKeys}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />

        {!hasFetched ? null : sessionsForSelectedDate.length > 0 ? (
          <View style={styles.sessionList}>
            {sessionsForSelectedDate.map((session, index) => (
              <SessionCard
                key={session.sessionId}
                periodNumber={index + 1}
                session={session}
                onViewDetails={(sessionId) => {
                  void openSessionDetail(sessionId);
                }}
              />
            ))}
          </View>
        ) : sessions.length === 0 ? (
          <View style={[styles.emptyCard, styles.contentBelowCalendar]}>
            <Text style={styles.emptyTitle}>
              No sessions have been conducted yet
            </Text>
            <Text style={styles.emptyBody}>
              Start your first class recording and your sessions will show up
              here by date.
            </Text>
            <View style={styles.emptyAction}>
              <NeoButton
                iconName="microphone"
                label="Go to Recorder"
                onPress={goToRecorder}
              />
            </View>
          </View>
        ) : (
          <View style={[styles.emptyCard, styles.contentBelowCalendar]}>
            <Text style={styles.emptyTitle}>No sessions on this day</Text>
            <Text style={styles.emptyBody}>
              No recording has been done on this date. Go to the Recorder tab to
              start a class session.
            </Text>
            <View style={styles.emptyAction}>
              <NeoButton
                iconName="microphone"
                label="Go to Recorder"
                onPress={goToRecorder}
              />
            </View>
          </View>
        )}
      </ScrollView>

      <SessionDetailModal
        detail={sessionDetail}
        error={detailError}
        isLoading={isDetailLoading}
        visible={detailSessionId !== null}
        onClose={closeSessionDetail}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contentBelowCalendar: {
    marginTop: spacing.sm,
  },
  emptyBody: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  emptyAction: {
    alignSelf: "stretch",
    marginTop: spacing.lg,
    width: "100%",
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 3,
    padding: spacing.xl,
  },
  emptyTitle: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center",
  },
  errorBanner: {
    backgroundColor: colors.coral,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 3,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  errorText: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  sessionList: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
});
