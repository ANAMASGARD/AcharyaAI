/** RetroUI semantic palette + Acharya accent swatches */
export const retroColors = {
  background: '#FFFFFF',
  foreground: '#000000',
  card: '#FFFFFF',
  cardForeground: '#000000',
  primary: '#FFDB33',
  primaryHover: '#FFCC00',
  primaryForeground: '#000000',
  secondary: '#000000',
  secondaryForeground: '#FFFFFF',
  muted: '#AEAEAE',
  mutedForeground: '#5A5A5A',
  accent: '#FAE583',
  accentForeground: '#000000',
  destructive: '#E63946',
  destructiveForeground: '#FFFFFF',
  border: '#000000',
  input: '#FFFFFF',
} as const;

export const accentColors = {
  apricot: '#FFBE85',
  mint: '#B8E5E1',
  sky: '#A8D5E5',
  coral: '#FFB5A7',
  coralLight: '#FFD4CC',
  lime: '#C5E99B',
  lavender: '#E0D4F7',
  cream: '#FFF8E7',
} as const;

export const colors = {
  ...retroColors,
  ...accentColors,
  onAccent: '#000000',
  mutedOnAccent: '#454545',
} as const;

export type ThemeColor = keyof typeof colors;

/** Accent fills stay identical in both modes; use onAccent for their content. */
export type ThemeColors = { [Key in keyof typeof colors]: string };
export const darkColors: ThemeColors = {
  ...colors,
  background: '#121212',
  cream: '#121212',
  card: '#202020',
  input: '#202020',
  foreground: '#F5F5F5',
  cardForeground: '#F5F5F5',
  mutedForeground: '#BEBEBE',
  muted: '#777777',
  border: '#707070',
};
