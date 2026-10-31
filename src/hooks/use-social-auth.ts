import { useSSO } from '@clerk/expo';
import type { OAuthStrategy } from '@clerk/shared/types';
import * as AuthSession from 'expo-auth-session';
import { isRunningInExpoGo } from 'expo';
import { useRouter } from 'expo-router';

import { SIGNED_IN_HOME } from '@/lib/routes';
import { useCallback, useState } from 'react';

const isSocialAuthAvailable = !isRunningInExpoGo() && process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === 'true';

const REDIRECT_URL = AuthSession.makeRedirectUri({
  scheme: 'acharyaapp',
  path: '/',
});

type SocialProvider = 'google';

const STRATEGY_BY_PROVIDER: Record<SocialProvider, OAuthStrategy> = {
  google: 'oauth_google',
};

export function useSocialAuth(): Readonly<{
  startGoogleAuth: () => Promise<void>;
  isSocialAuthAvailable: boolean;
  isGoogleLoading: boolean;
  oauthError: string | null;
  clearOauthError: () => void;
}> {
  const router = useRouter();
  const { startSSOFlow } = useSSO();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const startProviderAuth = useCallback(
    async (provider: SocialProvider): Promise<void> => {
      if (!isSocialAuthAvailable) {
        setOauthError('Use email to sign in with Expo Go.');
        return;
      }
      const setLoading = setIsGoogleLoading;

      setOauthError(null);
      setLoading(true);

      try {
        const { createdSessionId, setActive } = await startSSOFlow({
          strategy: STRATEGY_BY_PROVIDER[provider],
          redirectUrl: REDIRECT_URL,
        });

        if (createdSessionId && setActive) {
          await setActive({
            session: createdSessionId,
            navigate: ({ session, decorateUrl }) => {
              if (session?.currentTask) {
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
    startGoogleAuth: () => startProviderAuth('google'),
    isGoogleLoading,
    oauthError,
    clearOauthError: () => setOauthError(null),
  };
}
