import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/typography";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

type Props = Readonly<{
  label: string;
  isRecording: boolean;
}>;

function RecDot(): React.ReactElement {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: 500 }),
        withTiming(1, { duration: 500 }),
      ),
      -1,
      false,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.recDot, animatedStyle]} />;
}

export function RecorderTimerDisplay({
  label,
  isRecording,
}: Props): React.ReactElement {
  return (
    <View style={styles.wrap}>
      {isRecording ? (
        <View style={styles.recRow}>
          <View style={styles.recBadge}>
            <RecDot />
            <Text style={styles.recText}>REC</Text>
          </View>
        </View>
      ) : null}
      <Text style={styles.timer}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  recBadge: {
    alignItems: "center",
    backgroundColor: colors.destructive,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 2,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  recDot: {
    backgroundColor: colors.destructiveForeground,
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  recRow: {
    marginBottom: 4,
  },
  recText: {
    color: colors.destructiveForeground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  timer: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 26,
    letterSpacing: 1,
    lineHeight: 30,
    textAlign: "center",
  },
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
});
