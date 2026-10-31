import micAnimation from "@/assets/lottie/mic.json";
import profileSettingsAnimation from "@/assets/lottie/profile.json";

export const lottieAnimations = {
  recorderMic: micAnimation,
  profileSettings: profileSettingsAnimation,
} as const;

export type TabLottieKey = keyof typeof lottieAnimations;
