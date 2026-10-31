import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { Ionicons } from "@expo/vector-icons";
import type { LottieViewProps } from "lottie-react-native";
import { images } from "@/constants/images";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  useReducedMotion,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { useEffect } from "react";

type Props = Readonly<{
  source: LottieViewProps["source"];
  focused: boolean;
  playSignal: number;
  loopWhenFocused?: boolean;
  recorderStyle?: boolean;
}>;

const POP_SPRING = { damping: 12, stiffness: 320, mass: 0.65 } as const;

/** Web fallback — static icon instead of lottie-react-native (no dotlottie peer dep). */
export function TabLottieIcon({
  focused,
  playSignal,
  recorderStyle = false,
}: Props): React.ReactElement {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const iconScale = useSharedValue(1);
  const reducedMotion = useReducedMotion();

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

  const icon = recorderStyle ? (
    <Image
      contentFit="contain"
      source={images.recorderMic}
      style={recorderStyle ? styles.recorderIcon : styles.icon}
      tintColor={
        recorderStyle
          ? colors.primaryForeground
          : focused
            ? colors.primaryForeground
            : colors.mint
      }
    />
  ) : <Ionicons name={focused ? "settings" : "settings-outline"} size={30} color={focused ? colors.primaryForeground : colors.mint} />;

  if (recorderStyle && !focused) {
    return (
      <Animated.View style={[styles.wrap, animatedWrapStyle]}>
        <View style={styles.recorderBadge}>{icon}</View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.wrap, animatedWrapStyle]}>
      {icon}
    </Animated.View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  icon: {
    height: 32,
    width: 32,
  },
  recorderBadge: {
    alignItems: "center",
    backgroundColor: "rgba(184, 229, 225, 0.35)",
    borderRadius: 15,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  recorderIcon: {
    height: 28,
    width: 28,
  },
  wrap: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32,
  },
});
