import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { ClassNotesSection } from "@/components/calendar/class-notes-section";
import { ClassReflectionSections } from "@/components/calendar/class-reflection-sections";
import {
  SessionDetailViewToggle,
  type SessionDetailView,
} from "@/components/calendar/session-detail-view-toggle";
import { NeoButton } from "@/components/ui/neo-button";
import {
  formatDuration,
  formatSessionDate,
  formatSessionTime,
} from "@/lib/calendar/date-utils";
import {
  getClassBadgeColors,
  getClassDisplayLabel,
  getSubjectBadgeColors,
  getSubjectDisplayLabel,
} from "@/lib/calendar/session-display";
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import type { SessionDetail } from "@/types/calendar";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AcharyaBlurView as BlurView } from "@/components/ui/acharya-blur";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  useWindowDimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const BLUR_INTENSITY = Platform.OS === "android" ? 42 : 36;

const SPRING_CONFIG = {
  damping: 26,
  mass: 0.9,
  stiffness: 300,
};

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

type Props = Readonly<{
  visible: boolean;
  detail: SessionDetail | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}>;

export function SessionDetailModal({
  visible,
  detail,
  isLoading,
  error,
  onClose,
}: Props): React.ReactElement | null {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const [activeView, setActiveView] = useState<SessionDetailView>("reflection");
  const [mounted, setMounted] = useState(visible);
  const session = detail?.session;

  const { height } = useWindowDimensions();
  const slideDistance = Math.min(height * 0.92, 720);
  const translateY = useSharedValue(slideDistance);
  const backdropProgress = useSharedValue(0);

  const finishClose = (): void => {
    setMounted(false);
    setActiveView("reflection");
  };

  if (visible && !mounted) {
    setMounted(true);
  }

  useEffect(() => {
    if (visible) {
      backdropProgress.value = withTiming(1, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      });
      translateY.value = withSpring(0, SPRING_CONFIG);
      return;
    }

    if (!mounted) {
      return;
    }

    backdropProgress.value = withTiming(0, {
      duration: 220,
      easing: Easing.in(Easing.cubic),
    });
    translateY.value = withTiming(
      slideDistance,
      {
        duration: 280,
        easing: Easing.in(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(finishClose)();
        }
      },
    );
  }, [backdropProgress, mounted, slideDistance, translateY, visible]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropProgress.value,
  }));

  const blurAnimatedProps = useAnimatedProps(() => ({
    intensity: backdropProgress.value * BLUR_INTENSITY,
  }));

  if (!mounted) {
    return null;
  }

  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={mounted}
    >
      <View style={styles.overlay}>
        <Animated.View
          pointerEvents="box-none"
          style={[styles.backdropWrap, backdropAnimatedStyle]}
        >
          <AnimatedBlurView
            animatedProps={blurAnimatedProps}
            intensity={BLUR_INTENSITY}
            style={StyleSheet.absoluteFill}
            tint="dark"
          />
          <View style={styles.backdropTint} />
          <Pressable
            accessibilityLabel="Close session details"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.backdropPressable}
          />
        </Animated.View>

        <Animated.View style={[styles.sheet, sheetAnimatedStyle]}>
          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.foreground} size="large" />
            </View>
          ) : error ? (
            <View style={styles.centered}>
              <Text style={styles.errorText}>{error}</Text>
              <NeoButton label="Close" onPress={onClose} />
            </View>
          ) : session ? (
            <>
              <View style={styles.yellowHeader}>
                <View style={styles.headerTopRow}>
                  <Text numberOfLines={2} style={[styles.title, { color: colors.onAccent }]}>
                    {session.topic}
                  </Text>
                  <Pressable
                    accessibilityLabel="Close"
                    accessibilityRole="button"
                    onPress={onClose}
                    style={styles.closeButton}
                  >
                    <MaterialCommunityIcons
                      color={colors.foreground}
                      name="close"
                      size={22}
                    />
                  </Pressable>
                </View>

                <View style={styles.chipRow}>
                  <View
                    style={[
                      styles.tagBadge,
                      {
                        backgroundColor: getSubjectBadgeColors(session.subject)
                          .backgroundColor,
                      },
                    ]}
                  >
                    <Text style={[styles.tagText, { color: colors.onAccent }]}>
                      {getSubjectDisplayLabel(session.subject)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.tagBadge,
                      {
                        backgroundColor: getClassBadgeColors().backgroundColor,
                      },
                    ]}
                  >
                    <Text style={[styles.tagText, { color: colors.onAccent }]}>
                      {getClassDisplayLabel(session.classLevel)}
                    </Text>
                  </View>
                  <View style={styles.metaChip}>
                    <MaterialCommunityIcons
                      color={colors.foreground}
                      name="clock-outline"
                      size={14}
                    />
                    <Text style={styles.metaChipText}>
                      {formatSessionTime(session.recordedAt)}
                    </Text>
                  </View>
                  <View style={styles.metaChip}>
                    <MaterialCommunityIcons
                      color={colors.foreground}
                      name="book-open-page-variant-outline"
                      size={14}
                    />
                    <Text style={styles.metaChipText}>
                      {formatDuration(session.durationSeconds)}
                    </Text>
                  </View>

                  <SessionDetailViewToggle
                    inline
                    onChange={setActiveView}
                    value={activeView}
                  />
                </View>
              </View>

              <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.dateLabel}>
                  {formatSessionDate(session.recordedAt)}
                </Text>

                {activeView === "reflection" ? (
                  <>
                    {detail.transcriptPreview ? (
                      <View style={styles.transcriptBox}>
                        <Text style={styles.transcriptTitle}>
                          Transcript Preview
                        </Text>
                        <Text style={styles.transcriptBody}>
                          {detail.transcriptPreview}
                          {detail.transcriptPreview.length >= 280 ? "…" : ""}
                        </Text>
                      </View>
                    ) : null}

                    {detail.report ? (
                      <ClassReflectionSections report={detail.report} />
                    ) : (
                      <View style={styles.emptyReport}>
                        <Text style={styles.emptyReportTitle}>Report</Text>
                        <Text style={styles.emptyReportBody}>
                          No teaching report yet. Finish recording and analysis
                          to see feedback here.
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <ClassNotesSection notes={detail.classNotes} />
                )}
              </ScrollView>

              <View style={styles.footer}>
                <NeoButton label="Close" onPress={onClose} />
              </View>
            </>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdropPressable: {
    ...StyleSheet.absoluteFill,
  },
  backdropTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(26, 26, 26, 0.22)",
  },
  backdropWrap: {
    ...StyleSheet.absoluteFill,
  },
  chipRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  centered: {
    alignItems: "center",
    gap: spacing.lg,
    justifyContent: "center",
    minHeight: 200,
    padding: spacing.lg,
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: borderWidths.thin,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  dateLabel: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  emptyReport: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  emptyReportBody: {
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 21,
  },
  emptyReportTitle: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 14,
  },
  errorText: {
    color: colors.destructive,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: borderWidths.thin,
    padding: spacing.lg,
  },
  headerTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  metaChip: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: borderWidths.thin,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  metaChipText: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 12,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  scrollContent: {
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: borderWidths.default,
    maxHeight: "92%",
  },
  tagBadge: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: borderWidths.thin,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  tagText: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 12,
  },
  title: {
    color: colors.foreground,
    flex: 1,
    fontFamily: fontFamilies.head,
    fontSize: 24,
    lineHeight: 30,
  },
  transcriptBody: {
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 21,
  },
  transcriptBox: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    gap: spacing.xs,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  transcriptTitle: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 14,
  },
  yellowHeader: {
    backgroundColor: colors.primary,
    borderBottomColor: colors.border,
    borderBottomWidth: borderWidths.thin,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
});
