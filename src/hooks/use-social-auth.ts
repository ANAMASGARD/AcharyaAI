import { useSSO } from '@clerk/expo';
import type { OAuthStrategy } from '@clerk/shared/types';
import * as AuthSession from 'expo-auth-session';
import { isRunningInExpoGo } from 'expo';
import { useRouter } from 'expo-router';

import { SIGNED_IN_HOME } from '@/lib/routes';
import { useCallback, useState } from 'react';

const isExpoGo = isRunningInExpoGo();
const isGoogleConfigured = process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === 'true';
const isSocialAuthAvailable = !isExpoGo && isGoogleConfigured;
const isFacebookAuthAvailable = !isExpoGo && process.env.EXPO_PUBLIC_FACEBOOK_AUTH_ENABLED === 'true';
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

type SocialProvider = 'google' | 'facebook';

const STRATEGY_BY_PROVIDER: Record<SocialProvider, OAuthStrategy> = {
  google: 'oauth_google',
  facebook: 'oauth_facebook',
};

export function useSocialAuth(): Readonly<{
  startGoogleAuth: () => Promise<void>;
  startFacebookAuth: () => Promise<void>;
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
  const [oauthError, setOauthError] = useState<string | null>(null);

  const startProviderAuth = useCallback(
    async (provider: SocialProvider): Promise<void> => {
      const available = provider === 'google' ? isSocialAuthAvailable : isFacebookAuthAvailable;
      if (!available) {
        setOauthError(provider === 'google' ? socialAuthUnavailableReason : facebookAuthUnavailableReason);
        return;
      }
      const setLoading = provider === 'google' ? setIsGoogleLoading : setIsFacebookLoading;

      setOauthError(null);
      setLoading(true);

      try {
        const { createdSessionId, setActive, authSessionResult } = await startSSOFlow({
          strategy: STRATEGY_BY_PROVIDER[provider],
          redirectUrl: REDIRECT_URL,
        });

        if (authSessionResult?.type === 'cancel' || authSessionResult?.type === 'dismiss') {
          return;
        }

        if (createdSessionId && setActive) {
          await setActive({
            session: createdSessionId,
            navigate: ({ session }) => {
              if (session?.currentTask) {
                setOauthError('Your account needs an additional verification step. Continue with email.');
                return;
              }

              router.replace(SIGNED_IN_HOME);
            },
          });
          return;
        }

        setOauthError('Sign-in needs more steps. Try email instead.');
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Could not complete social sign-in.';
        setOauthError(message);
      } finally {
        setLoading(false);
      }
    },
    [router, startSSOFlow],
  );

  return {
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
