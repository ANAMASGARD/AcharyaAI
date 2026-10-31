import { TabBarIcon } from "@/components/navigation/tab-bar-icon";
import {
  TAB_BAR_ICON_ANCHOR_SIZE,
  TAB_BAR_ICON_TOP,
  TAB_BAR_PILL_HEIGHT,
} from "@/components/navigation/tab-bar-constants";
import { tabBarGlass } from "@/components/navigation/tab-bar-glass";
import { fontFamilies, typography } from "@/theme/typography";
import { Ionicons } from "@expo/vector-icons";
import type { LottieViewProps } from "lottie-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  useReducedMotion,
  withSequence,
  withSpring,
} from "react-native-reanimated";

type TabIconName = keyof typeof Ionicons.glyphMap;

type IconVariant = "ionicons" | "lottie-recorder" | "lottie-profile";

type Props = Readonly<{
  label: string;
  icon: TabIconName;
  iconFocused: TabIconName;
  iconVariant?: IconVariant;
  lottieSource?: LottieViewProps["source"];
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}>;

const PRESS_SPRING = { damping: 14, stiffness: 400, mass: 0.6 } as const;
const RELEASE_SPRING = { damping: 12, stiffness: 280, mass: 0.7 } as const;

export function TabBarItem({
  label,
  icon,
  iconFocused,
  iconVariant = "ionicons",
  lottieSource,
  focused,
  onPress,
  onLongPress,
}: Props): React.ReactElement {
  const scale = useSharedValue(1);
  const reducedMotion = useReducedMotion();
  const [playSignal, setPlaySignal] = useState(0);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const handlePressIn = (): void => {
    scale.set(reducedMotion ? 1 : withSpring(0.88, PRESS_SPRING));
  };

  const handlePressOut = (): void => {
    scale.set(reducedMotion ? 1 : withSequence(
      withSpring(1.06, RELEASE_SPRING),
      withSpring(1, RELEASE_SPRING),
    ));
  };

  const handlePress = (): void => {
    setPlaySignal((current) => current + 1);
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={handlePress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.pressable}
    >
      <Animated.View style={[styles.item, animatedContainerStyle]}>
        <View style={styles.iconAnchor}>
          <TabBarIcon
            focused={focused}
            icon={icon}
            iconFocused={iconFocused}
            lottieSource={lottieSource}
            playSignal={playSignal}
            variant={iconVariant}
          />
        </View>
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={1.2}
          style={[styles.label, focused ? styles.labelFocused : null]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },
  iconAnchor: {
    alignItems: "center",
    height: TAB_BAR_ICON_ANCHOR_SIZE,
    justifyContent: "center",
    width: TAB_BAR_ICON_ANCHOR_SIZE,
  },
  item: {
    alignItems: "center",
    height: TAB_BAR_PILL_HEIGHT,
    justifyContent: "flex-start",
    paddingTop: TAB_BAR_ICON_TOP,
  },
  label: {
    color: tabBarGlass.inactiveLabel,
    fontFamily: fontFamilies.sansMedium,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    marginTop: 1,
    textAlign: "center",
  },
  labelFocused: {
    color: tabBarGlass.activeLabel,
    fontFamily: fontFamilies.sansBold,
  },
});
