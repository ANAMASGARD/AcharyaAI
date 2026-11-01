import { OfflineReportSettings } from './offline-report-settings';
import { Pressable } from '@/components/feedback/pressable';
import { OfflineSttSettings } from './offline-stt-settings';
import { NeoButton } from '@/components/ui/neo-button';
import { cancelModelDownload, checkModelDownload, downloadModel, getModelDownloadState, MODEL_CARD,
  modelDownloadsAvailable, modelInferenceAvailable, removeModelDownload, subscribeModelDownload } from '@/lib/embeddings/download';
import { confirmAction } from '@/lib/confirm-action';
import { useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { AppState, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function LocalModelsScreen(): React.ReactElement {
  const styles = useThemeStyles(createStyles);
  const router = useRouter();
  const state = useSyncExternalStore(subscribeModelDownload, getModelDownloadState, getModelDownloadState);
  const [linkError, setLinkError] = useState(false);
  useFocusEffect(useCallback(() => {
    void checkModelDownload();
    const subscription = AppState.addEventListener('change', (next) => { if (next === 'active') void checkModelDownload(); });
    return () => subscription.remove();
  }, []));
  const working = ['checking', 'downloading', 'verifying'].includes(state.status);
  const downloaded = state.status === 'downloaded';
  const remove = async () => {
    if (await confirmAction('Remove model?', 'Saved class notes and reports stay on this device.', 'Remove')) await removeModelDownload();
  };
  return <SafeAreaView style={styles.root}>
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Text style={styles.text}>← Back</Text></Pressable>
      <Text accessibilityRole="header" style={styles.title}>Run locally</Text>
      <OfflineSttSettings />
      <OfflineReportSettings />
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.heading}>EmbeddingGemma 2</Text>
        <Text style={styles.text}>Text only · INT4 · 165 MB</Text>
        <Text style={styles.caption}>For local class-note embeddings. Model files stay on this device.</Text>
        {modelDownloadsAvailable ? <>
          <Text accessibilityLiveRegion="polite" style={styles.status}>
            {downloaded ? '✓ Downloaded and verified' : state.status === 'downloading' ? `Downloading · ${Math.round(state.progress * 100)}%` : state.status === 'verifying' ? 'Verifying model…' : state.status === 'checking' ? 'Checking device…' : 'Not downloaded'}
          </Text>
          {state.status === 'downloading' ? <NeoButton label="Cancel download" onPress={() => { void cancelModelDownload(); }} />
            : downloaded ? <NeoButton label="Remove download" onPress={() => { void remove(); }} />
              : <NeoButton label={state.status === 'error' ? 'Retry download · 165 MB' : 'Download · 165 MB'} disabled={working} onPress={() => { void downloadModel(); }} />}
          {!modelInferenceAvailable ? <Text style={styles.caption}>Download is available. Automatic embeddings are awaiting native device verification.</Text> : null}
        </> : <Text style={styles.caption}>Install the custom Android APK to download this model. Expo Go and iOS do not include its native runtime.</Text>}
        {state.error ? <Text accessibilityRole="alert" style={styles.text}>{state.error}</Text> : null}
        <Pressable accessibilityRole="link" onPress={() => { setLinkError(false); void Linking.openURL(MODEL_CARD).catch(() => setLinkError(true)); }} style={styles.link}>
          <Text style={styles.linkText}>Model source & license ↗</Text>
        </Pressable>
        {linkError ? <Text style={styles.caption}>Could not open the model page.</Text> : null}
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 20, paddingBottom: 48, gap: 20 },
  back: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 12, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 8 },
  title: { fontFamily: fontFamilies.head, fontSize: 28, color: colors.foreground },
  heading: { fontFamily: fontFamilies.head, fontSize: 22, color: colors.foreground },
  card: { padding: 20, gap: 14, borderWidth: 3, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card, boxShadow: `4px 4px 0 ${colors.border}` },
  text: { fontFamily: fontFamilies.sans, fontSize: 16, lineHeight: 24, color: colors.foreground },
  caption: { fontFamily: fontFamilies.sans, fontSize: 14, lineHeight: 21, color: colors.mutedForeground },
  status: { fontFamily: fontFamilies.sansBold, fontSize: 16, color: colors.foreground },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontFamily: fontFamilies.sansBold, fontSize: 14, color: colors.foreground, textDecorationLine: 'underline' },
});
