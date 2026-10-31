import { useSSO } from '@clerk/expo';
import type { OAuthStrategy } from '@clerk/shared/types';
import * as AuthSession from 'expo-auth-session';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

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
  isGoogleLoading: boolean;
  isFacebookLoading: boolean;
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
      const setLoading = provider === 'google' ? setIsGoogleLoading : setIsFacebookLoading;

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

              router.replace(decorateUrl('/') as Href);
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
    startGoogleAuth: () => startProviderAuth('google'),
    startFacebookAuth: () => startProviderAuth('facebook'),
    isGoogleLoading,
    isFacebookLoading,
    oauthError,
    clearOauthError: () => setOauthError(null),
  };
}
