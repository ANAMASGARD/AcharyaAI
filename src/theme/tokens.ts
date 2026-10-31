import { colors } from '@/theme/colors';
import { fontFamilies, typography } from '@/theme/typography';

/** Neo-brutalism: hard offset shadows, thick borders */
export const radii = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
} as const;

export const borderWidths = {
  thin: 2,
  default: 3,
  thick: 4,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  touch: 44,
} as const;

export const shadows = {
  xs: {
    shadowColor: colors.border,
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 1,
  },
  sm: {
    shadowColor: colors.border,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  md: {
    shadowColor: colors.border,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  lg: {
    shadowColor: colors.border,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
} as const;

export const acharyaTheme = {
  colors,
  fontFamilies,
  typography,
  borderWidths,
  radii,
  spacing,
  shadows,
} as const;
