import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';

import { setOnboardingCompleted } from '@/lib/onboarding-persistence';
import { colors } from '@/theme/colors';

WebBrowser.maybeCompleteAuthSession();

export default function AuthLayout(): React.ReactElement | null {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn) {
      void setOnboardingCompleted();
    }
  }, [isSignedIn]);

  if (!isLoaded) {
    return null;
  }

  if (isSignedIn) {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.cream },
        headerShown: false,
      }}
    />
  );
}
