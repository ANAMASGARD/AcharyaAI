import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { TabLottieIcon } from "@/components/navigation/tab-lottie-icon";
import { tabBarGlass } from "@/components/navigation/tab-bar-glass";
import { Ionicons } from "@expo/vector-icons";
import type { LottieViewProps } from "lottie-react-native";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  useReducedMotion,
  withSequence,
  withSpring,
} from "react-native-reanimated";

type TabIconName = keyof typeof Ionicons.glyphMap;

type Props = Readonly<{
  icon: TabIconName;
  iconFocused: TabIconName;
  focused: boolean;
  playSignal: number;
  variant?: "ionicons" | "lottie-recorder" | "lottie-profile";
  lottieSource?: LottieViewProps["source"];
}>;

const ICON_SIZE = 26;
const POP_SPRING = { damping: 12, stiffness: 320, mass: 0.65 } as const;

export function TabBarIcon({
  icon,
  iconFocused,
  focused,
  playSignal,
  variant = "ionicons",
  lottieSource,
}: Props): React.ReactElement {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const iconScale = useSharedValue(1);
  const reducedMotion = useReducedMotion();
  const iconColor = focused
    ? colors.primaryForeground
    : tabBarGlass.inactiveIcon;

  useEffect(() => {
    if (!reducedMotion && variant === "ionicons" && (focused || playSignal > 0)) {
      iconScale.set(withSequence(
        withSpring(1.18, POP_SPRING),
        withSpring(1, POP_SPRING),
      ));
    }
  }, [focused, playSignal, iconScale, variant, reducedMotion]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.get() }],
  }));

  if (variant === "lottie-recorder" && lottieSource) {
    return (
      <TabLottieIcon
        focused={focused}
        playSignal={playSignal}
        recorderStyle
        source={lottieSource}
      />
    );
  }

  if (variant === "lottie-profile" && lottieSource) {
    return (
      <TabLottieIcon
        focused={focused}
        loopWhenFocused
        playSignal={playSignal}
        source={lottieSource}
      />
    );
  }

  return (
    <Animated.View style={[styles.iconWrap, animatedIconStyle]}>
      <Ionicons
        color={iconColor}
        name={focused ? iconFocused : icon}
        size={ICON_SIZE}
      />
    </Animated.View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  iconWrap: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
});
