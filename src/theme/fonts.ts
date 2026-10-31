import ArchivoBlackRegular from '@/assets/fonts/ArchivoBlack-Regular.ttf';
import SpaceGroteskBold from '@/assets/fonts/SpaceGrotesk-Bold.ttf';
import SpaceGroteskMedium from '@/assets/fonts/SpaceGrotesk-Medium.ttf';
import SpaceGroteskRegular from '@/assets/fonts/SpaceGrotesk-Regular.ttf';

import { fontFamilies } from '@/theme/typography';

export const fontAssets = {
  [fontFamilies.head]: ArchivoBlackRegular,
  [fontFamilies.sans]: SpaceGroteskRegular,
  [fontFamilies.sansMedium]: SpaceGroteskMedium,
  [fontFamilies.sansBold]: SpaceGroteskBold,
} as const;
