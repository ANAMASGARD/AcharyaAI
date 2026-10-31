/**
 * Clerk key validation for Expo. Publishable keys are safe in the client bundle.
 * Secret keys must stay server-side (CLERK_SECRET_KEY without EXPO_PUBLIC_).
 */

export type ClerkKeyKind = 'development' | 'production' | 'unknown';

const PUBLISHABLE_KEY_PATTERN = /^pk_(test|live)_[a-zA-Z0-9]+$/;

export function classifyClerkPublishableKey(key: string | undefined): ClerkKeyKind {
  if (!key) {
    return 'unknown';
  }
  if (key.startsWith('pk_test_')) {
    return 'development';
  }
  if (key.startsWith('pk_live_')) {
    return 'production';
  }
  return 'unknown';
}

export function isValidClerkPublishableKey(key: string): boolean {
  return PUBLISHABLE_KEY_PATTERN.test(key);
}

export function getClerkPublishableKey(): string {
  const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

  if (!key) {
    throw new Error(
      'Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Add it to .env and restart Metro with npx expo start --clear.',
    );
  }

  if (!isValidClerkPublishableKey(key)) {
    throw new Error(
      'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY must start with pk_test_ or pk_live_ from the Clerk Dashboard.',
    );
  }

  return key;
}

/**
 * Store-bound production builds must not ship with pk_test_. Internal APKs may use the test instance.
 */
export function assertClerkKeyAllowedForRelease(isReleaseBuild: boolean, key: string): void {
  if (!isReleaseBuild) {
    return;
  }

  if (classifyClerkPublishableKey(key) === 'development') {
    throw new Error(
      'This build uses a Clerk development key (pk_test_). For Play Store / production, set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to pk_live_ via EAS Secrets on the production profile, then rebuild.',
    );
  }
}

/** Metro inlines EXPO_PUBLIC_* values; EAS_BUILD_PROFILE is not available in the APK.
 * Optimization (__DEV__ === false) does not mean the app targets the Play Store.
 */
export function isClerkReleaseBuild(): boolean {
  return process.env.EXPO_PUBLIC_APP_VARIANT === 'production';
}
