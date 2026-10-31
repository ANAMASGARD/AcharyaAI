import { useSSO } from '@clerk/expo';
import type { OAuthStrategy, SetActive, SignUpResource } from '@clerk/shared/types';
import * as AuthSession from 'expo-auth-session';
import { isRunningInExpoGo } from 'expo';
import { useRouter } from 'expo-router';

import { SIGNED_IN_HOME } from '@/lib/routes';
import { useCallback, useRef, useState } from 'react';

const isExpoGo = isRunningInExpoGo();
const isGoogleConfigured = process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === 'true';
const isSocialAuthAvailable = !isExpoGo && isGoogleConfigured;
const isFacebookAuthAvailable = !isExpoGo && process.env.EXPO_PUBLIC_FACEBOOK_AUTH_ENABLED === 'true';
const isMicrosoftAuthAvailable = !isExpoGo && process.env.EXPO_PUBLIC_MICROSOFT_AUTH_ENABLED === 'true';
const microsoftAuthUnavailableReason = isExpoGo
  ? 'Microsoft sign-in requires an Acharya development or installed build. Use email in Expo Go.'
  : 'Microsoft sign-in is being configured. Use Google or email for now.';
const facebookAuthUnavailableReason = isExpoGo
  ? 'Facebook sign-in requires an Acharya development or installed build. Use email in Expo Go.'
  : 'Facebook sign-in is being configured. Use Google or email for now.';
const socialAuthUnavailableReason = isExpoGo
  ? 'Google sign-in requires an Acharya development or installed build. Use email in Expo Go.'
  : 'Google sign-in is being configured. Use email for now.';

const REDIRECT_URL = AuthSession.makeRedirectUri({
  scheme: 'acharyaapp',
  path: '/',
});

type SocialProvider = 'google' | 'facebook' | 'microsoft';

const STRATEGY_BY_PROVIDER: Record<SocialProvider, OAuthStrategy> = {
  google: 'oauth_google',
  facebook: 'oauth_facebook',
  microsoft: 'oauth_microsoft',
};

export function useSocialAuth(): Readonly<{
  startGoogleAuth: () => Promise<void>;
  startFacebookAuth: () => Promise<void>;
  startMicrosoftAuth: () => Promise<void>;
  isMicrosoftAuthAvailable: boolean;
  microsoftAuthUnavailableReason: string;
  isMicrosoftLoading: boolean;
  pendingMicrosoftSignUp: SignUpResource | null;
  completeMicrosoftSignUp: (signUp: SignUpResource) => Promise<void>;
  dismissMicrosoftSignUp: () => void;
  isFacebookAuthAvailable: boolean;
  facebookAuthUnavailableReason: string;
  isFacebookLoading: boolean;
  isSocialAuthAvailable: boolean;
  socialAuthUnavailableReason: string;
  isGoogleLoading: boolean;
  oauthError: string | null;
  clearOauthError: () => void;
}> {
  const router = useRouter();
  const { startSSOFlow } = useSSO();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isFacebookLoading, setIsFacebookLoading] = useState(false);
  const [isMicrosoftLoading, setIsMicrosoftLoading] = useState(false);
  const [pendingMicrosoftSignUp, setPendingMicrosoftSignUp] = useState<SignUpResource | null>(null);
  const microsoftSetActive = useRef<SetActive | undefined>(undefined);
  const inFlight = useRef(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const activateSession = useCallback(async (sessionId: string, setActive: SetActive): Promise<void> => {
    await setActive({
      session: sessionId,
      navigate: ({ session }) => {
        if (session?.currentTask) {
          setOauthError('Your account needs an additional verification step. Continue with email.');
          return;
        }
        router.replace(SIGNED_IN_HOME);
      },
    });
  }, [router]);

  const startProviderAuth = useCallback(
    async (provider: SocialProvider): Promise<void> => {
      if (inFlight.current || microsoftSetActive.current) return;
      const available = { google: isSocialAuthAvailable, facebook: isFacebookAuthAvailable, microsoft: isMicrosoftAuthAvailable }[provider];
      if (!available) {
        setOauthError({ google: socialAuthUnavailableReason, facebook: facebookAuthUnavailableReason, microsoft: microsoftAuthUnavailableReason }[provider]);
        return;
      }
      const setLoading = { google: setIsGoogleLoading, facebook: setIsFacebookLoading, microsoft: setIsMicrosoftLoading }[provider];

      inFlight.current = true;
      setOauthError(null);
      setLoading(true);

      try {
        const { createdSessionId, setActive, authSessionResult, signUp } = await startSSOFlow({
          strategy: STRATEGY_BY_PROVIDER[provider],
          redirectUrl: REDIRECT_URL,
        });

        if (authSessionResult?.type === 'cancel' || authSessionResult?.type === 'dismiss') {
          return;
        }

        if (createdSessionId && setActive) {
          await activateSession(createdSessionId, setActive);
          return;
        }

        if (provider === 'microsoft' && signUp?.status === 'missing_requirements' && setActive
          && !signUp.protectCheck
          && [...signUp.missingFields, ...signUp.unverifiedFields].every((field) => field === 'email_address')
          && (signUp.missingFields.includes('email_address') || signUp.unverifiedFields.includes('email_address'))) {
          microsoftSetActive.current = setActive;
          setPendingMicrosoftSignUp(signUp);
          return;
        }

        setOauthError('Sign-in needs more steps. Try email instead.');
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Could not complete social sign-in.';
        setOauthError(message);
      } finally {
        inFlight.current = false;
        setLoading(false);
      }
    },
    [activateSession, startSSOFlow],
  );

  return {
    isMicrosoftAuthAvailable,
    microsoftAuthUnavailableReason,
    isMicrosoftLoading,
    startMicrosoftAuth: () => startProviderAuth('microsoft'),
    pendingMicrosoftSignUp,
    completeMicrosoftSignUp: async (signUp) => {
      const setActive = microsoftSetActive.current;
      if (signUp.status !== 'complete' || !signUp.createdSessionId || !setActive) {
        throw new Error('Microsoft sign-up needs more verification. Please try again.');
      }
      await activateSession(signUp.createdSessionId, setActive);
      setPendingMicrosoftSignUp(null);
      microsoftSetActive.current = undefined;
    },
    dismissMicrosoftSignUp: () => {
      setPendingMicrosoftSignUp(null);
      microsoftSetActive.current = undefined;
    },
    isSocialAuthAvailable,
    socialAuthUnavailableReason,
    isFacebookAuthAvailable,
    facebookAuthUnavailableReason,
    isFacebookLoading,
    startFacebookAuth: () => startProviderAuth('facebook'),
    startGoogleAuth: () => startProviderAuth('google'),
    isGoogleLoading,
    oauthError,
    clearOauthError: () => setOauthError(null),
  };
}
