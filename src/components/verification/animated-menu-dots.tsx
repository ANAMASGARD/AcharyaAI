import { colors } from "@/theme/colors";
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

const DOT_SIZE = 5;
const DOT_GAP = 4;

function AnimatedDot({ delayMs }: Readonly<{ delayMs: number }>): React.ReactElement {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    scale.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1.25, { duration: 360, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 360, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
    opacity.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 360, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.55, { duration: 360, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, [delayMs, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

export function AnimatedMenuDots(): React.ReactElement {
  return (
    <View style={styles.row}>
      <AnimatedDot delayMs={0} />
      <AnimatedDot delayMs={120} />
      <AnimatedDot delayMs={240} />
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    backgroundColor: colors.destructiveForeground,
    borderRadius: 999,
    height: DOT_SIZE,
    width: DOT_SIZE,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: DOT_GAP,
  },
});
