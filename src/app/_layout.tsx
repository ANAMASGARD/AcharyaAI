import '@/lib/entry-polyfills';

import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { DarkTheme, DefaultTheme, Slot, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PreviewAuthCleanup } from '@/components/preview/preview-auth-cleanup';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  assertClerkKeyAllowedForRelease,
  getClerkPublishableKey,
  isClerkReleaseBuild,
} from '@/lib/clerk-config';
import { configureClerkDevLogBox } from '@/lib/clerk-logbox';
import { fontAssets } from '@/theme/fonts';
import { colors } from '@/theme/colors';

type ClerkBootstrap =
  | { status: 'ready'; publishableKey: string }
  | { status: 'error'; message: string };

function bootstrapClerk(): ClerkBootstrap {
  try {
    const publishableKey = getClerkPublishableKey();
    assertClerkKeyAllowedForRelease(isClerkReleaseBuild(), publishableKey);
    configureClerkDevLogBox(publishableKey);
    return { status: 'ready', publishableKey };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Clerk configuration failed. Check your .env file.';
    return { status: 'error', message };
  }
}

const clerkBootstrap = bootstrapClerk();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const navigationTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  if (clerkBootstrap.status === 'error') {
    return (
      <ThemeProvider value={navigationTheme}>
        <ClerkConfigError message={clerkBootstrap.message} />
      </ThemeProvider>
    );
  }

  return (
    <ClerkProvider publishableKey={clerkBootstrap.publishableKey} tokenCache={tokenCache}>
      <ThemeProvider value={navigationTheme}>
        <PreviewAuthCleanup />
        <AnimatedSplashOverlay />
        <Slot />
      </ThemeProvider>
    </ClerkProvider>
  );
}

function ClerkConfigError({ message }: { message: string }) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">Clerk setup</ThemedText>
        <ThemedText>{message}</ThemedText>
        <ThemedText type="small">
          Local dev: use pk_test_ in .env. Play Store builds: set pk_live_ with EAS Secrets on the
          production profile. CLERK_SECRET_KEY stays server-only (no EXPO_PUBLIC_ prefix).
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
});
