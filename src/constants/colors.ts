import { accentColors, retroColors } from '@/theme/colors';

/** Acharya Neo-Brutalism palette (AGENTS.md) */
export const AcharyaColors = {
  yellow: retroColors.primary,
  mint: accentColors.mint,
  sky: accentColors.sky,
  coral: accentColors.coral,
  lime: accentColors.lime,
  lavender: accentColors.lavender,
  black: retroColors.foreground,
  white: retroColors.background,
  cream: accentColors.cream,
} as const;

export { accentColors, retroColors, colors } from '@/theme/colors';
