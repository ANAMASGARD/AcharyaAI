import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { getLocalDb } from '@/db/client';
import { ThemedText } from '@/components/themed-text';
import migrations from '../../../drizzle/expo/migrations';

const db = getLocalDb();

type DatabaseProviderProps = {
  children: ReactNode;
};

export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const { success, error } = useMigrations(db, migrations);

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
