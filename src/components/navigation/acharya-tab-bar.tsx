import { useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { TabBarItem } from "@/components/navigation/tab-bar-item";
import {
  TAB_BAR_FLOAT_GAP,
  TAB_BAR_INDICATOR_SIZE,
  TAB_BAR_INDICATOR_TOP,
  TAB_BAR_PILL_HEIGHT,
  getTabBarOverlayHeight,
} from "@/components/navigation/tab-bar-constants";
import { tabBarGlass } from "@/components/navigation/tab-bar-glass";
import { lottieAnimations } from "@/constants/lottie";
import { spacing } from "@/theme/tokens";
import type { MaterialTopTabBarProps } from "expo-router/js-top-tabs";
import { Ionicons } from "@expo/vector-icons";
import { AcharyaBlurView as BlurView } from "@/components/ui/acharya-blur";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef } from "react";
import { LayoutChangeEvent, Platform, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  useReducedMotion,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export { TAB_BAR_PILL_HEIGHT, getTabBarOverlayHeight };

const PILL_MAX_WIDTH = 480;
const INDICATOR_SPRING = { damping: 20, stiffness: 220, mass: 0.8 } as const;

type TabIconName = keyof typeof Ionicons.glyphMap;

export const TAB_ITEMS = [
  {
    name: "home",
    label: "Home",
    icon: "home-outline" as TabIconName,
    iconFocused: "home" as TabIconName,
    iconVariant: "ionicons" as const,
  },
  {
    name: "calendar",
    label: "Calendar",
    icon: "calendar-outline" as TabIconName,
    iconFocused: "calendar" as TabIconName,
    iconVariant: "ionicons" as const,
  },
  {
    name: "recorder",
    label: "Recorder",
    icon: "mic-outline" as TabIconName,
    iconFocused: "mic" as TabIconName,
    iconVariant: "lottie-recorder" as const,
    lottie: lottieAnimations.recorderMic,
  },
  {
    name: "chat",
    label: "Chat",
    icon: "chatbubble-ellipses-outline" as TabIconName,
    iconFocused: "chatbubble-ellipses" as TabIconName,
    iconVariant: "ionicons" as const,
  },
  {
    name: "profile",
    label: "Profile",
    icon: "settings-outline" as TabIconName,
    iconFocused: "settings" as TabIconName,
    iconVariant: "lottie-profile" as const,
    lottie: lottieAnimations.profileSettings,
  },
] as const;

export type AcharyaTabBarProps = Pick<MaterialTopTabBarProps, "state" | "emitter" | "navigateToTab"> & {
  descriptors: Record<string, { options: { title?: string } }>;
};

export function AcharyaTabBar(props: AcharyaTabBarProps): React.ReactElement {
  const styles = useThemeStyles(createStyles);

  const { state, descriptors } = props;
  const insets = useSafeAreaInsets();
  const indicatorX = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const tabSlotLayouts = useRef<({ x: number; width: number } | undefined)[]>(
    [],
  );
  const previousIndex = useRef(state.index);

  const repositionIndicator = useCallback(
    (index: number): void => {
      const slot = tabSlotLayouts.current[index];
      if (!slot || slot.width <= 0) {
        return;
      }

      const nextX = slot.x + slot.width / 2 - TAB_BAR_INDICATOR_SIZE / 2;
      indicatorX.set(reducedMotion ? nextX : withSpring(nextX, INDICATOR_SPRING));
    },
    [indicatorX, reducedMotion],
  );

  useEffect(() => {
    if (previousIndex.current !== state.index) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      previousIndex.current = state.index;
    }

    repositionIndicator(state.index);
  }, [state.index, repositionIndicator]);

  const handleTabSlotLayout =
    (index: number) =>
    (event: LayoutChangeEvent): void => {
      const { x, width } = event.nativeEvent.layout;
      tabSlotLayouts.current[index] = { x, width };

      if (index === state.index) {
        repositionIndicator(index);
      }
    };

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.get() }],
  }));

  const bottomPadding = insets.bottom + TAB_BAR_FLOAT_GAP;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.floatWrapper, { paddingBottom: bottomPadding }]}
    >
      <View style={styles.pillOuter}>
        <View style={styles.pillShell}>
          {Platform.OS === "web" ? (
            <View style={styles.webFallback} />
          ) : (
            <BlurView
              intensity={tabBarGlass.blurIntensity}
              style={StyleSheet.absoluteFill}
              tint={tabBarGlass.blurTint}
            />
          )}
          <View style={styles.glassVeil} pointerEvents="none" />
          <View style={styles.glassRimTop} pointerEvents="none" />
          <View style={styles.glassRimBottom} pointerEvents="none" />

          <View style={styles.pillContent}>
            <Animated.View
              pointerEvents="none"
              style={[styles.indicator, animatedIndicatorStyle]}
            />

            <View style={styles.tabsRow} pointerEvents="box-none">
              {state.routes.map((route, index) => {
                const tabConfig = TAB_ITEMS.find(
                  (item) => item.name === route.name,
                );

                if (!tabConfig) {
                  return null;
                }

                const focused = state.index === index;
                const { options } = descriptors[route.key];

                const onPress = (): void => {
                  const event = props.emitter.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) {
                    props.navigateToTab(route.key);
                  }
                };

                const onLongPress = (): void => {
                  props.emitter.emit({ type: "tabLongPress", target: route.key });
                };

                return (
                  <View
                    key={route.key}
                    onLayout={handleTabSlotLayout(index)}
                    style={styles.tabSlot}
                  >
                    <TabBarItem
                      focused={focused}
                      icon={tabConfig.icon}
                      iconFocused={tabConfig.iconFocused}
                      iconVariant={tabConfig.iconVariant}
                      lottieSource={
                        "lottie" in tabConfig ? tabConfig.lottie : undefined
                      }
                      label={options.title ?? tabConfig.label}
                      onLongPress={onLongPress}
                      onPress={onPress}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  floatWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  pillOuter: {
    width: "100%",
    maxWidth: PILL_MAX_WIDTH,
    paddingHorizontal: spacing.lg,
  },
  pillShell: {
    borderRadius: 999,
    overflow: "hidden",
    minHeight: TAB_BAR_PILL_HEIGHT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tabBarGlass.border,
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 18,
      },
      android: {
        elevation: 5,
      },
      default: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 14,
      },
    }),
  },
  webFallback: {
    ...StyleSheet.absoluteFill,
    backgroundColor: tabBarGlass.webBackground,
    ...Platform.select({
      web: {
        backdropFilter: tabBarGlass.webBackdropBlur,
        WebkitBackdropFilter: tabBarGlass.webBackdropBlur,
      },
      default: {},
    }),
  },
  glassVeil: {
    ...StyleSheet.absoluteFill,
    backgroundColor: tabBarGlass.veil,
  },
  glassRimBottom: {
    backgroundColor: tabBarGlass.specularBottom,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 1,
  },
  glassRimTop: {
    backgroundColor: tabBarGlass.specularTop,
    height: StyleSheet.hairlineWidth,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1,
  },
  pillContent: {
    justifyContent: "center",
    minHeight: TAB_BAR_PILL_HEIGHT,
    paddingHorizontal: spacing.sm,
    position: "relative",
  },
  tabSlot: {
    flex: 1,
  },
  tabsRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    height: TAB_BAR_PILL_HEIGHT,
    zIndex: 2,
  },
  indicator: {
    backgroundColor: colors.primary,
    borderRadius: TAB_BAR_INDICATOR_SIZE / 2,
    height: TAB_BAR_INDICATOR_SIZE,
    position: "absolute",
    top: TAB_BAR_INDICATOR_TOP,
    width: TAB_BAR_INDICATOR_SIZE,
    zIndex: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      default: {},
    }),
  },
});
