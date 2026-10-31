import { Appearance, Platform } from 'react-native';
import { createContext, use, useEffect, useMemo, type PropsWithChildren } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors, darkColors, type ThemeColors } from '@/theme/colors';

export type ColorMode = 'light' | 'dark';
const ThemeContext = createContext<ColorMode>('light');
const AccentContext = createContext(false);
const darkAccentColors: ThemeColors = { ...darkColors, foreground: colors.onAccent, mutedForeground: colors.mutedOnAccent };

export function AccentContent({ active, children }: PropsWithChildren<{ active: boolean }>): React.ReactElement {
  return <AccentContext value={active}>{children}</AccentContext>;
}

export function AppThemeProvider({ mode, children }: PropsWithChildren<{ mode: ColorMode }>): React.ReactElement {
  const palette = mode === 'dark' ? darkColors : colors;
  useEffect(() => {
    if (Platform.OS === 'web') {
      const previous = document.documentElement.style.colorScheme;
      document.documentElement.style.colorScheme = mode;
      return () => { document.documentElement.style.colorScheme = previous; };
    }
    Appearance.setColorScheme(mode);
    return () => Appearance.setColorScheme('unspecified');
  }, [mode]);
  const navigationTheme = useMemo(() => ({
    ...(mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(mode === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: palette.cream, card: palette.card, text: palette.foreground,
      border: palette.border, primary: palette.primary,
    },
  }), [mode, palette]);
  return <ThemeContext value={mode}>
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {children}
    </ThemeProvider>
  </ThemeContext>;
}

export function useColorMode(): ColorMode { return use(ThemeContext); }
export function useThemeColors(): ThemeColors {
  const mode = useColorMode();
  const onAccent = use(AccentContext);
  return mode === 'dark' ? (onAccent ? darkAccentColors : darkColors) : colors;
}

/** Cache StyleSheets by palette without remounting screens or losing input focus. */
export function useThemeStyles<T>(factory: (palette: ThemeColors) => T): T {
  const palette = useThemeColors();
  return useMemo(() => factory(palette), [factory, palette]);
}
