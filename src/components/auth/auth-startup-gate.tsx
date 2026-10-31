import { useAuth } from '@clerk/expo';
import { reloadAppAsync } from 'expo';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NeoButton } from '@/components/ui/neo-button';
import { useThemeColors } from '@/theme/use-theme';

/** A blocked DNS/network request must not leave every route behind an endless spinner. */
export function AuthStartupGate({ children }: { children: ReactNode }) {
  const { isLoaded } = useAuth();
  return isLoaded ? children : <PendingSignIn />;
}

function PendingSignIn() {
  const colors = useThemeColors();
  const [timedOut, setTimedOut] = useState(false);
  const [restartFailed, setRestartFailed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 12_000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.cream }]}>
      {timedOut ? (
        <>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground }]}>Unable to connect to sign-in</Text>
          <Text style={[styles.message, { color: colors.foreground }]}>Check your connection. If you use Private DNS or an ad blocker, allow superacharya.com and its subdomains, then retry.</Text>
          <NeoButton label="Retry" onPress={() => { void reloadAppAsync().catch(() => setRestartFailed(true)); }} />
          {restartFailed ? <Text style={{ color: colors.foreground }}>Close and reopen Acharya to retry.</Text> : null}
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={colors.foreground} />
          <Text style={[styles.message, { color: colors.foreground }]}>Connecting to sign-in…</Text>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 28, gap: 20 },
  title: { fontSize: 24, fontWeight: '700' },
  message: { fontSize: 16, lineHeight: 24 },
});
