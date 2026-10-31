/** RetroUI: Archivo Black = headings, Space Grotesk = body */
export const fontFamilies = {
  head: 'ArchivoBlack-Regular',
  sans: 'SpaceGrotesk-Regular',
  sansMedium: 'SpaceGrotesk-Medium',
  sansBold: 'SpaceGrotesk-Bold',
} as const;

export const typography = {
  h1: {
    fontFamily: fontFamilies.head,
    fontSize: 40,
    lineHeight: 48,
  },
  h2: {
    fontFamily: fontFamilies.head,
    fontSize: 24,
    lineHeight: 32,
  },
  body: {
    fontFamily: fontFamilies.sans,
    fontSize: 16,
    lineHeight: 24,
  },
  caption: {
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    lineHeight: 16,
  },
} as const;
