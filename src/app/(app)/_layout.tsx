import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { UiPreviewProvider } from '@/components/preview/preview-provider';
import { AcharyaBlurProvider, AcharyaBlurTarget } from '@/components/ui/acharya-blur';
import { SIGN_IN_ROUTE } from '@/lib/routes';
import { colors } from '@/theme/colors';

export default function AppLayout(): React.ReactElement {
  const { isLoaded, isSignedIn, userId } = useAuth();
  if (!isLoaded || (isSignedIn && !userId)) {
    return <View style={styles.loading}><ActivityIndicator color={colors.foreground} /></View>;
  }
  if (!isSignedIn || !userId) return <Redirect href={SIGN_IN_ROUTE} />;
  return <GestureHandlerRootView style={styles.root}>
    <KeyboardProvider>
      <UiPreviewProvider key={userId} owner={userId}>
        <AcharyaBlurProvider>
          <Stack
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }}
            screenLayout={({ children, route }) => route.name === '(tabs)' ? children : <AcharyaBlurTarget>{children}</AcharyaBlurTarget>}
          />
        </AcharyaBlurProvider>
      </UiPreviewProvider>
    </KeyboardProvider>
  </GestureHandlerRootView>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
});
