import type { ExpoConfig } from 'expo/config';

// Catch misconfigured store artifacts at build time, before an APK reaches a teacher.
if (process.env.EAS_BUILD_PROFILE === 'production' || process.env.EXPO_PUBLIC_APP_VARIANT === 'production') {
  if (process.env.EXPO_PUBLIC_APP_VARIANT !== 'production') {
    throw new Error('Production builds require EXPO_PUBLIC_APP_VARIANT=production.');
  }
  if (!/^pk_live_[a-zA-Z0-9]+$/.test(process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? '')) {
    throw new Error('Production builds require a live Clerk publishable key. Use the preview profile for internal test APKs.');
  }
}

/**
 * Same branding as /home/linux/Downloads/acharya-app (production-hardening).
 * Icon paths are explicit so Expo Go picks up Acharya art, not the Expo template.
 */
const config: ExpoConfig = {
  name: 'Acharya AI',
  slug: 'acharya-app',
  version: '1.0.2',
  orientation: 'portrait',
  icon: './assets/images/acharya-app-icon.png',
  scheme: 'acharyaapp',
  userInterfaceStyle: 'automatic',
  owner: 'animint2',
  ios: {
    bundleIdentifier: 'com.acharya.app',
  },
  android: {
    package: 'com.acharya.app',
    versionCode: 3,
    adaptiveIcon: {
      backgroundColor: '#FFF8E7',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    // Required for src/app/api/* routes (sync, Neon, Clerk server auth).
    output: 'server',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-asset',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#FFF8E7',
        image: './assets/images/acharya-splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        dark: {
          backgroundColor: '#1A1A1A',
        },
      },
    ],
    ['expo-audio', { microphonePermission: 'Allow Acharya to record and transcribe your class while the recorder is open.', recordAudioAndroid: true, enableBackgroundPlayback: false, enableBackgroundRecording: false }],
    'expo-secure-store',
    '@clerk/expo',
    'expo-web-browser',
    'expo-status-bar',
    'expo-sqlite',
    './plugins/with-android-build-compatibility.cjs',
    './plugins/with-native-embedding-gate.cjs',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: 'b9e06999-942a-4f0a-8429-633865958f1b',
    },
  },
};

export default config;
