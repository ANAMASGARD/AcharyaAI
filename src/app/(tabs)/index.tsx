import { useUser } from '@clerk/expo';
import * as Device from 'expo-device';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedIcon } from '@/components/animated-icon';
import { HintRow } from '@/components/hint-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { colors } from '@/theme/colors';
import { borderWidths, radii, spacing as themeSpacing } from '@/theme/tokens';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAccountActions } from '@/hooks/use-account-actions';

function getDevMenuHint() {
  if (Platform.OS === 'web') {
    return <ThemedText type="small">use browser devtools</ThemedText>;
  }
  if (Device.isDevice) {
    return (
      <ThemedText type="small">
        shake device or press <ThemedText type="code">m</ThemedText> in terminal
      </ThemedText>
    );
  }
  const shortcut = Platform.OS === 'android' ? 'cmd+m (or ctrl+m)' : 'cmd+d';
  return (
    <ThemedText type="small">
      press <ThemedText type="code">{shortcut}</ThemedText>
    </ThemedText>
  );
}

export default function HomeScreen() {
  const { user } = useUser();
  const { signOut, deleteAccount, isSigningOut, isDeletingAccount, actionError } =
    useAccountActions();

  const accountBusy = isSigningOut || isDeletingAccount;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <AnimatedIcon />
          <ThemedText type="title" style={styles.title}>
            Welcome{user?.firstName ? `, ${user.firstName}` : ''}
          </ThemedText>
        </ThemedView>

        <ThemedText type="code" style={styles.code}>
          Acharya
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.stepContainer}>
          <HintRow
            title="Try editing"
            hint={<ThemedText type="code">src/app/(tabs)/index.tsx</ThemedText>}
          />
          <HintRow title="Dev tools" hint={getDevMenuHint()} />
          <HintRow
            title="Fresh start"
            hint={<ThemedText type="code">npm run reset-project</ThemedText>}
          />
        </ThemedView>

        {Platform.OS === 'web' && <WebBadge />}

        <Pressable
          accessibilityRole="button"
          disabled={accountBusy}
          onPress={signOut}
          style={({ pressed }) => [styles.accountButton, pressed && styles.pressed]}>
          <ThemedText type="smallBold">{isSigningOut ? 'Signing out…' : 'Sign out'}</ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={accountBusy}
          onPress={deleteAccount}
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={styles.deleteLabel}>
            {isDeletingAccount ? 'Deleting account…' : 'Delete account'}
          </ThemedText>
        </Pressable>
        {actionError ? <ThemedText type="small">{actionError}</ThemedText> : null}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  code: {
    textTransform: 'uppercase',
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
  accountButton: {
    minHeight: themeSpacing.touch,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  deleteButton: {
    minHeight: themeSpacing.touch,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    borderColor: colors.destructive,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thin,
    paddingHorizontal: themeSpacing.md,
  },
  deleteLabel: {
    color: colors.destructive,
  },
  pressed: {
    opacity: 0.7,
  },
});
