import { colors } from "@/theme/colors";
import { borderWidths } from "@/theme/tokens";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

type Props = Readonly<{
  active: boolean;
  size: number;
}>;

const RING_COUNT = 2;

function PulseRing({
  active,
  size,
  delayMs,
}: Readonly<{
  active: boolean;
  size: number;
  delayMs: number;
}>): React.ReactElement {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      scale.value = 1;
      opacity.value = 0;
      return;
    }

    opacity.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(0.55, { duration: 0 }),
          withTiming(0, {
            duration: 1400,
            easing: Easing.out(Easing.quad),
          }),
        ),
        -1,
        false,
      ),
    );

    scale.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 0 }),
          withTiming(1.45, {
            duration: 1400,
            easing: Easing.out(Easing.quad),
          }),
        ),
        -1,
        false,
      ),
    );
  }, [active, delayMs, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          borderRadius: size / 2,
          height: size,
          width: size,
        },
        animatedStyle,
      ]}
    />
  );
}

export function RecorderPulseRing({ active, size }: Props): React.ReactElement | null {
  if (!active) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { height: size, width: size }]}
    >
      {Array.from({ length: RING_COUNT }, (_, index) => (
        <PulseRing
          active={active}
          delayMs={index * 700}
          key={index}
          size={size}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderColor: colors.destructive,
    borderWidth: borderWidths.thin,
    left: 0,
    position: "absolute",
    top: 0,
  },
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
  },
});
