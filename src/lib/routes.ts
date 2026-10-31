import type { Href } from 'expo-router';

/** Every completed auth flow opens Recorder directly, without replaying onboarding. */
export const SIGNED_IN_HOME: Href = '/(app)/(tabs)/recorder';

export const SIGNED_OUT_ENTRY: Href = '/onboarding';

export const SIGN_IN_ROUTE: Href = '/sign-in';
