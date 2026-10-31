import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { readyLocalDb } from '@/db/ready';
import { ThemedText } from '@/components/themed-text';

type DatabaseProviderProps = {
  children: ReactNode;
};

export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let active = true;
    void readyLocalDb().then(() => { if (active) setSuccess(true); }, () => { if (active) setError(new Error('Could not prepare local storage. Restart the app to retry.')); });
    return () => { active = false; };
  }, []);

  if (error) {
    return (
      <View style={styles.centered}>
        <ThemedText type="title">Database setup</ThemedText>
        <ThemedText>{error.message}</ThemedText>
      </View>
    );
  }

  if (!success) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.foreground} />
        <ThemedText>Preparing local database…</ThemedText>
      </View>
    );
  }

  return children;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: colors.cream,
  },
});
