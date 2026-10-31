import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { UiPreviewProvider } from '@/components/preview/preview-provider';
import { AcharyaBlurProvider, AcharyaBlurTarget } from '@/components/ui/acharya-blur';
import { SIGN_IN_ROUTE } from '@/lib/routes';

export default function AppLayout(): React.ReactElement {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const { isLoaded, isSignedIn, userId } = useAuth();
  if (!isLoaded || (isSignedIn && !userId)) {
    return <View style={styles.loading}><ActivityIndicator color={colors.foreground} /></View>;
  }
  if (!isSignedIn || !userId) return <Redirect href={SIGN_IN_ROUTE} />;
  return <GestureHandlerRootView style={styles.root}>
    <KeyboardProvider>
      <UiPreviewProvider key={userId} owner={userId}>
        <ProductStack />
      </UiPreviewProvider>
    </KeyboardProvider>
  </GestureHandlerRootView>;
}

function ProductStack(): React.ReactElement {
  const colors = useThemeColors();
  return (
        <AcharyaBlurProvider>
          <Stack
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }}
            screenLayout={({ children, route }) => route.name === '(tabs)' ? children : <AcharyaBlurTarget>{children}</AcharyaBlurTarget>}
          />
        </AcharyaBlurProvider>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
});
