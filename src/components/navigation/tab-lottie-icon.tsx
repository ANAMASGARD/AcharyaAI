import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import LottieView, { type LottieViewProps } from "lottie-react-native";
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  useReducedMotion,
  withSequence,
  withSpring,
} from "react-native-reanimated";

type Props = Readonly<{
  source: LottieViewProps["source"];
  focused: boolean;
  playSignal: number;
  loopWhenFocused?: boolean;
  /** Recorder tab: mint badge when idle so the mic reads on the black bar */
  recorderStyle?: boolean;
}>;

const POP_SPRING = { damping: 12, stiffness: 320, mass: 0.65 } as const;

export function TabLottieIcon({
  source,
  focused,
  playSignal,
  loopWhenFocused = false,
  recorderStyle = false,
}: Props): React.ReactElement {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const animationRef = useRef<LottieView>(null);
  const iconScale = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  const micTint = colors.primaryForeground;
  const profileTint = focused ? colors.primaryForeground : colors.mint;
  const iconColor = recorderStyle ? micTint : profileTint;

  const playAnimation = (): void => {
    animationRef.current?.reset();
    animationRef.current?.play();
  };

  useEffect(() => {
    if (reducedMotion) {
      animationRef.current?.reset();
      animationRef.current?.pause();
      return;
    }
    if (recorderStyle) {
      playAnimation();
      return;
    }

    if (focused) {
      playAnimation();
      return;
    }

    animationRef.current?.reset();
    animationRef.current?.pause();
  }, [focused, recorderStyle, reducedMotion]);

  useEffect(() => {
    if (!reducedMotion && playSignal > 0) {
      playAnimation();
    }
  }, [playSignal, reducedMotion]);

  useEffect(() => {
    if (!reducedMotion && (focused || playSignal > 0)) {
      iconScale.set(withSequence(
        withSpring(1.14, POP_SPRING),
        withSpring(1, POP_SPRING),
      ));
    }
  }, [focused, playSignal, iconScale, reducedMotion]);

  const animatedWrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.get() }],
  }));

  const shouldLoop = !reducedMotion && (recorderStyle || (loopWhenFocused && focused));

  const lottie = (
    <LottieView
      ref={animationRef}
      autoPlay={recorderStyle && !reducedMotion}
      colorFilters={[{ keypath: "**", color: iconColor }]}
      loop={shouldLoop}
      source={source}
      speed={recorderStyle ? 0.85 : 1}
      style={recorderStyle ? styles.recorderLottie : styles.lottie}
    />
  );

  if (recorderStyle && !focused) {
    return (
      <Animated.View style={[styles.wrap, animatedWrapStyle]}>
        <View style={styles.recorderBadge}>{lottie}</View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.wrap, animatedWrapStyle]}>
      {lottie}
    </Animated.View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  wrap: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  lottie: {
    width: 32,
    height: 32,
  },
  recorderBadge: {
    alignItems: "center",
    backgroundColor: "rgba(184, 229, 225, 0.35)",
    borderRadius: 15,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  recorderLottie: {
    width: 28,
    height: 28,
  },
});
