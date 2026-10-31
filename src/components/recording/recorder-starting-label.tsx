import { useReducedMotion } from "react-native-reanimated";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/typography";
import { useEffect, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

const DOT_COUNT = 3;
const PULSE_MS = 280;
const STAGGER_MS = 180;

function createDotPulse(opacity: Animated.Value, delayMs: number): Animated.CompositeAnimation {
  return Animated.loop(
    Animated.sequence([
      Animated.delay(delayMs),
      Animated.timing(opacity, {
        toValue: 1,
        duration: PULSE_MS,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0.25,
        duration: PULSE_MS,
        useNativeDriver: true,
      }),
      Animated.delay(STAGGER_MS * (DOT_COUNT - 1)),
    ]),
  );
}

export function RecorderStartingLabel(): React.ReactElement {
  const reducedMotion = useReducedMotion();
  const [opacities] = useState(() =>
    Array.from({ length: DOT_COUNT }, () => new Animated.Value(0.25)),
  );

  useEffect(() => {
    if (reducedMotion) {
      opacities.forEach((opacity) => opacity.setValue(1));
      return;
    }
    const loops = opacities.map((opacity, index) =>
      createDotPulse(opacity, index * STAGGER_MS),
    );

    for (const loop of loops) {
      loop.start();
    }

    return () => {
      for (const loop of loops) {
        loop.stop();
      }
    };
  }, [opacities, reducedMotion]);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>Starting</Text>
      {opacities.map((opacity, index) => (
        <Animated.Text
          key={`starting-dot-${index}`}
          style={[styles.dot, { opacity }]}
        >
          .
        </Animated.Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 16,
    lineHeight: 18,
    marginLeft: 1,
  },
  label: {
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    letterSpacing: 0.2,
    lineHeight: 18,
  },
  row: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "center",
  },
});
