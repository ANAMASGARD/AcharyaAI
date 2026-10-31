import type { ExpoConfig } from 'expo/config';

/**
 * Same branding as /home/linux/Downloads/acharya-app (production-hardening).
 * Icon paths are explicit so Expo Go picks up Acharya art, not the Expo template.
 */
const config: ExpoConfig = {
  name: 'Acharya',
  slug: 'acharya-app',
  version: '1.0.0',
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
    versionCode: 1,
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
    ['expo-audio', { microphonePermission: 'Allow Acharya to display voice levels while the microphone is open.', recordAudioAndroid: true, enableBackgroundPlayback: false, enableBackgroundRecording: false }],
    'expo-secure-store',
    '@clerk/expo',
    'expo-web-browser',
    'expo-status-bar',
    'expo-sqlite',
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
