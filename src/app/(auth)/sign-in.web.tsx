import { useAuth } from '@clerk/expo';
import { SignIn } from '@clerk/expo/web';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { SIGNED_IN_HOME } from '@/lib/routes';
import { colors } from '@/theme/colors';

export default function SignInWebScreen(): React.ReactElement {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isSignedIn) {
    return <Redirect href={SIGNED_IN_HOME} />;
  }

  return (
    <View style={styles.centered}>
      <SignIn
        appearance={{
          options: { socialButtonsVariant: 'blockButton', socialButtonsPlacement: 'top' },
          elements: { socialButtons: { gridTemplateColumns: '1fr' } },
        }}
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    flex: 1,
    justifyContent: 'center',
  },
});
