import { colors } from "@/theme/colors";
import { Platform } from "react-native";

/** Dark frosted-glass tokens — translucent black dock with background blur. */
export const tabBarGlass = {
  blurIntensity: Platform.select({
    ios: 90,
    android: 72,
    default: 82,
  }) as number,
  blurTint: "dark" as const,
  veil: Platform.select({
    ios: "rgba(0, 0, 0, 0.18)",
    android: "rgba(0, 0, 0, 0.26)",
    default: "rgba(0, 0, 0, 0.22)",
  }) as string,
  border: "rgba(255, 255, 255, 0.14)",
  specularTop: "rgba(255, 255, 255, 0.16)",
  specularBottom: "rgba(255, 255, 255, 0.05)",
  webBackground: "rgba(8, 8, 8, 0.42)",
  webBackdropBlur: "blur(32px) saturate(1.4)",
  inactiveIcon: colors.mint,
  inactiveLabel: colors.mint,
  activeLabel: colors.secondaryForeground,
} as const;
