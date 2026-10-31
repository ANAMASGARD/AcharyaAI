import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { SIGNED_IN_HOME } from '@/lib/routes';
import { colors } from '@/theme/colors';

WebBrowser.maybeCompleteAuthSession();

export default function AuthLayout(): React.ReactElement | null {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return null;
  }

  if (isSignedIn) {
    return <Redirect href={SIGNED_IN_HOME} />;
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
