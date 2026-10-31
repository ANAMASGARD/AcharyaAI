import { images } from "@/constants/images";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import type { ChatReplyPhase } from "@/types/chat";
import { Image } from "expo-image";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const REPLY_PHASE_LABELS: Readonly<Record<ChatReplyPhase, string>> = {
  idle: "",
  sent: "Your question was sent…",
  analyzing: "Acharya is analyzing…",
  preparing: "Preparing your response…",
  almost_ready: "Almost ready…",
};

const HISTORY_LOADING_LABEL = "Loading your chat…";

const INLINE_GLOW_INSET = spacing.sm;

const DOT_SIZE = 7;
const DOT_GAP = 6;
const WAVE_DOT_COUNT = 3;

type Props = Readonly<{
  /** Centered for first chat load; inline sits in the message list with no bubble chrome */
  layout?: "centered" | "inline";
  phase?: ChatReplyPhase;
}>;

function WaveDot({
  index,
  tone,
}: Readonly<{ index: number; tone: string }>): React.ReactElement {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      index * 160,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
          withTiming(0, { duration: 420, easing: Easing.in(Easing.cubic) }),
        ),
        -1,
        false,
      ),
    );
  }, [index, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [0.72, 1.28]);
    const opacity = interpolate(progress.value, [0, 1], [0.35, 1]);
    const translateY = interpolate(progress.value, [0, 1], [2, -3]);

    return {
      opacity,
      transform: [{ scale }, { translateY }],
    };
  });

  return (
    <Animated.View
      style={[styles.dot, { backgroundColor: tone }, animatedStyle]}
    />
  );
}

function ThinkingDots(): React.ReactElement {
  const tones = [colors.primary, colors.mint, colors.coral] as const;

  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: WAVE_DOT_COUNT }, (_, index) => (
        <WaveDot index={index} key={`wave-dot-${index}`} tone={tones[index] ?? colors.primary} />
      ))}
    </View>
  );
}

function MascotPulse({ size }: Readonly<{ size: number }>): React.ReactElement {
  const mascotScale = useSharedValue(1);
  const mascotFloat = useSharedValue(0);
  const glowScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.3);
  const outerGlowScale = useSharedValue(1);
  const outerGlowOpacity = useSharedValue(0.15);

  useEffect(() => {
    mascotScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 650, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 650, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    mascotFloat.value = withRepeat(
      withSequence(
        withTiming(-2, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(2, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 850, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 850, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      false,
    );
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.75, { duration: 850, easing: Easing.out(Easing.ease) }),
        withTiming(0.28, { duration: 850, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      false,
    );
    outerGlowScale.value = withRepeat(
      withSequence(
        withTiming(1.65, { duration: 1100, easing: Easing.out(Easing.ease) }),
        withTiming(1.05, { duration: 1100, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      false,
    );
    outerGlowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.42, { duration: 1100, easing: Easing.out(Easing.ease) }),
        withTiming(0.08, { duration: 1100, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [
    glowOpacity,
    glowScale,
    mascotFloat,
    mascotScale,
    outerGlowOpacity,
    outerGlowScale,
  ]);

  const mascotStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: mascotScale.value },
      { translateY: mascotFloat.value },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const outerGlowStyle = useAnimatedStyle(() => ({
    opacity: outerGlowOpacity.value,
    transform: [{ scale: outerGlowScale.value }],
  }));

  const ringSize = size + 18;
  const outerRingSize = size + 30;

  return (
    <View style={[styles.mascotWrap, { height: outerRingSize, width: outerRingSize }]}>
      <Animated.View
        style={[
          styles.outerGlowRing,
          {
            borderRadius: outerRingSize / 2,
            height: outerRingSize,
            width: outerRingSize,
          },
          outerGlowStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.glowRing,
          {
            borderRadius: ringSize / 2,
            height: ringSize,
            width: ringSize,
          },
          glowStyle,
        ]}
      />
      <Animated.View style={mascotStyle}>
        <Image
          accessibilityLabel="Acharya is thinking"
          contentFit="contain"
          source={images.mascotLogo}
          style={{ height: size, width: size }}
        />
      </Animated.View>
    </View>
  );
}

function StatusText({
  inline = false,
  label,
}: Readonly<{ inline?: boolean; label: string }>): React.ReactElement | null {
  if (!label) {
    return null;
  }

  return (
    <Text
      numberOfLines={2}
      style={[styles.statusText, inline && styles.statusTextInline]}
    >
      {label}
    </Text>
  );
}

function resolveStatusLabel(
  layout: "centered" | "inline",
  phase: ChatReplyPhase,
): string {
  if (layout === "centered") {
    return HISTORY_LOADING_LABEL;
  }

  return REPLY_PHASE_LABELS[phase] || REPLY_PHASE_LABELS.sent;
}

export function ChatLoadingIndicator({
  layout = "centered",
  phase = "sent",
}: Props): React.ReactElement {
  const isInline = layout === "inline";
  const mascotSize = isInline ? 40 : 56;
  const statusLabel = resolveStatusLabel(layout, phase);

  if (isInline) {
    return (
      <View style={styles.inlineRow}>
        <View style={styles.mascotInset}>
          <MascotPulse size={mascotSize} />
        </View>
        <ThinkingDots />
        <StatusText inline label={statusLabel} />
      </View>
    );
  }

  return (
    <View style={styles.centeredWrap}>
      <View style={styles.centeredContent}>
        <View style={styles.centeredRow}>
          <MascotPulse size={mascotSize} />
          <ThinkingDots />
        </View>
        <StatusText label={statusLabel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centeredContent: {
    alignItems: "center",
    gap: spacing.md,
  },
  centeredRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.lg,
  },
  centeredWrap: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  dot: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: DOT_SIZE,
    width: DOT_SIZE,
  },
  dotsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: DOT_GAP,
    minHeight: 28,
  },
  glowRing: {
    backgroundColor: colors.primary,
    position: "absolute",
  },
  inlineRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
    overflow: "visible",
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    width: "100%",
  },
  mascotInset: {
    marginLeft: INLINE_GLOW_INSET,
    overflow: "visible",
    paddingHorizontal: spacing.xs,
  },
  mascotWrap: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  outerGlowRing: {
    backgroundColor: colors.mint,
    position: "absolute",
  },
  statusText: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    textAlign: "center",
  },
  statusTextInline: {
    flex: 1,
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "left",
  },
});
