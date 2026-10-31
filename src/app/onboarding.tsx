import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingScreen } from '@/components/onboarding/onboarding-screen';
import { SIGNED_IN_HOME } from '@/lib/routes';
import { colors } from '@/theme/colors';

export default function OnboardingRoute(): React.ReactElement {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color={colors.foreground} size="large" />
      </SafeAreaView>
    );
  }

  if (isSignedIn) {
    return <Redirect href={SIGNED_IN_HOME} />;
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
