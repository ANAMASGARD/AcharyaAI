/**
 * App shell theme (tabs, starter screens). Auth and product UI use `@/theme/*` tokens.
 */

import '@/global.css';

import { Platform } from 'react-native';

import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';

export const Colors = {
  light: {
    text: colors.foreground,
    background: colors.cream,
    backgroundElement: colors.mint,
    backgroundSelected: colors.sky,
    textSecondary: colors.mutedForeground,
    primary: colors.primary,
    border: colors.border,
    card: colors.card,
    destructive: colors.destructive,
  },
  dark: {
    text: colors.secondaryForeground,
    background: colors.secondary,
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: colors.muted,
    primary: colors.primary,
    border: colors.border,
    card: '#212225',
    destructive: colors.destructive,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: fontFamilies.sans,
    serif: 'ui-serif',
    rounded: fontFamilies.sansMedium,
    mono: 'ui-monospace',
    head: fontFamilies.head,
    sansBold: fontFamilies.sansBold,
  },
  default: {
    sans: fontFamilies.sans,
    serif: 'serif',
    rounded: fontFamilies.sansMedium,
    mono: 'monospace',
    head: fontFamilies.head,
    sansBold: fontFamilies.sansBold,
  },
  web: {
    sans: 'var(--font-sans)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-sans-medium)',
    mono: 'var(--font-mono)',
    head: 'var(--font-head)',
    sansBold: 'var(--font-sans-bold)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
