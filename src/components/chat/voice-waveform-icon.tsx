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

type Props = Readonly<{
  color?: string;
  barCount?: number;
  barWidth?: number;
  gap?: number;
  height?: number;
}>;

const BAR_HEIGHTS = [0.4, 0.75, 1, 0.6, 0.85] as const;
const CYCLE_MS = 520;

function WaveBar({
  color,
  maxHeight,
  minHeight,
  width,
  delayMs,
}: Readonly<{
  color: string;
  maxHeight: number;
  minHeight: number;
  width: number;
  delayMs: number;
}>): React.ReactElement {
  const barHeight = useSharedValue(minHeight);

  useEffect(() => {
    barHeight.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(maxHeight, {
            duration: CYCLE_MS,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(minHeight, {
            duration: CYCLE_MS,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        false,
      ),
    );
  }, [barHeight, delayMs, maxHeight, minHeight]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: barHeight.value,
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          backgroundColor: color,
          width,
        },
        animatedStyle,
      ]}
    />
  );
}

export function VoiceWaveformIcon({
  color = colors.foreground,
  barCount = 5,
  barWidth = 2.5,
  gap = 2,
  height = 16,
}: Props): React.ReactElement {
  return (
    <View style={[styles.row, { gap, height }]}>
      {Array.from({ length: barCount }, (_, index) => {
        const heightFactor = BAR_HEIGHTS[index % BAR_HEIGHTS.length];
        const maxBarHeight = height * heightFactor;
        const minBarHeight = maxBarHeight * (0.28 + (index % 3) * 0.08);

        return (
          <WaveBar
            color={color}
            delayMs={index * 85}
            key={index}
            maxHeight={maxBarHeight}
            minHeight={minBarHeight}
            width={barWidth}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderRadius: 99,
  },
  row: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "center",
  },
});
