import { Pressable } from '@/components/feedback/pressable';
import { ProviderKeyCard } from '@/components/profile/provider-key-card';
import { aiProviders } from '@/lib/ai-keys/providers';
import { useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';
import { useAuth } from '@clerk/expo';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function ApiKeysScreen(): React.ReactElement {
  const styles = useThemeStyles(createStyles);
  const router = useRouter();
  const { userId } = useAuth();
  const [showDetails, setShowDetails] = useState(false);
  const [active, setActive] = useState(false);
  useFocusEffect(useCallback(() => {
    setActive(AppState.currentState === 'active');
    const listener = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => { listener.remove(); setActive(false); };
  }, []));
  return <SafeAreaView style={styles.root}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}>
        <Text style={styles.text}>← Back</Text>
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>AI API keys</Text>
    </View>
    <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Your AI, your keys.</Text>
          <Text style={styles.noticeText}>Encrypted on-device. Requests go directly to your provider.</Text>
        </View>
        {Platform.OS === 'web' ? <Text style={styles.text}>API key setup is available in the Android and iOS app. Keys are never saved in browser storage.</Text>
          : active && userId ? aiProviders.map((provider) => <ProviderKeyCard key={`${userId}.${provider.id}`} owner={userId} provider={provider} />)
            : <Text style={styles.text}>Return to this screen to manage your keys.</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel="Run locally" onPress={() => router.push('/profile/local-models')} style={styles.local}>
          <Text accessibilityRole="header" style={styles.title}>Run locally →</Text>
          <Text style={styles.caption}>Download EmbeddingGemma 2 · 165 MB</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showDetails }} onPress={() => setShowDetails(!showDetails)} style={styles.detailsButton}>
          <Text style={styles.caption}>{showDetails ? 'Hide privacy details' : 'Privacy & billing details'}</Text>
        </Pressable>
        {showDetails ? <Text style={styles.caption}>Keys never sync to Acharya. Updates and sign-out keep keys encrypted for this account. Removing a key or deleting the account erases it. Provider usage charges apply. Green means saved locally, not verified access. iOS keys may survive reinstall—remove them before uninstalling. Device encryption cannot protect a compromised device.</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  content: { flex: 1 },
  header: { padding: 20, gap: 16 },
  back: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 12, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 8 },
  title: { fontFamily: fontFamilies.head, fontSize: 24, color: colors.foreground },
  text: { fontFamily: fontFamilies.sans, fontSize: 16, lineHeight: 24, color: colors.foreground },
  scroll: { padding: 20, paddingTop: 0, gap: 20, paddingBottom: 40 },
  notice: { backgroundColor: colors.mint, borderWidth: 2, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 10 },
  noticeTitle: { fontFamily: fontFamilies.head, fontSize: 20, color: colors.onAccent },
  noticeText: { fontFamily: fontFamilies.sans, fontSize: 14, lineHeight: 21, color: colors.onAccent },
  local: { padding: 16, gap: 10, borderWidth: 2, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card },
  detailsButton: { minHeight: 44, justifyContent: 'center' },
  caption: { fontFamily: fontFamilies.sans, fontSize: 13, lineHeight: 20, color: colors.mutedForeground },
});
