import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingScreen } from '@/components/onboarding/onboarding-screen';
import { useOnboardingGate } from '@/hooks/use-onboarding-gate';
import { colors } from '@/theme/colors';

export default function OnboardingRoute(): React.ReactElement {
  const { isLoaded, isSignedIn } = useAuth();
  const { isReady, hasCompletedOnboarding } = useOnboardingGate();

  if (!isLoaded || !isReady) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color={colors.foreground} size="large" />
      </SafeAreaView>
    );
  }

  if (isSignedIn) {
    return <Redirect href="/" />;
  }

  if (hasCompletedOnboarding) {
    return <Redirect href="/sign-in" />;
  }

  return <OnboardingScreen />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
});
