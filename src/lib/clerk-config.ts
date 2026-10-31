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
 * Release builds (EAS production/preview or non-dev native) must not ship with pk_test_.
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

/** True for store-bound EAS profiles and release native builds (not Metro dev). */
export function isClerkReleaseBuild(): boolean {
  if (__DEV__) {
    return false;
  }

  const easProfile = process.env.EAS_BUILD_PROFILE;
  if (easProfile === 'production' || easProfile === 'preview' || easProfile === 'standalone') {
    return true;
  }

  // Local release binary (expo run:android --variant release) without EAS profile
  return easProfile !== 'development';
}
