import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SIGNED_IN_HOME, SIGNED_OUT_ENTRY } from '@/lib/routes';

export default function IndexGate(): React.ReactElement {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

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

  return <Redirect href={SIGNED_OUT_ENTRY} />;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
});
