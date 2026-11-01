import { useAuth } from '@clerk/expo';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useUiPreferences } from '@/components/preview/preview-provider';
import { NeoButton } from '@/components/ui/neo-button';
import { offlineSttAvailable } from '@/lib/offline-stt/bridge';
import { STT_MODELS, STT_REVISION } from '@/lib/offline-stt/models';
import { cancelSttDownload, checkSttDownloads, downloadSttModel, getSttDownloads, pauseSttDownload,
  removeSttModel, subscribeSttDownloads } from '@/lib/offline-stt/download';
import { recordingRepository } from '@/lib/recording/repository';
import { confirmAction } from '@/lib/confirm-action';
import { useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';

export function OfflineSttSettings(): React.ReactElement {
  const { userId } = useAuth();
  const prefs = useUiPreferences();
  const downloads = useSyncExternalStore(subscribeSttDownloads, getSttDownloads, getSttDownloads);
  const [locked, setLocked] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const styles = useThemeStyles(createStyles);
  const refreshLock = useCallback(async () => {
    if (!userId) return true;
    const saved = await recordingRepository.loadLatest(userId);
    const blocked = Boolean(saved && (['starting', 'recording', 'stopping', 'finishing'].includes(saved.session.status) ||
      saved.chunks.some(c => c.status !== 'done' && c.status !== 'empty') || (saved.chunks.length && !saved.session.serverFinalized)));
    setLocked(blocked); return blocked;
  }, [userId]);
  useFocusEffect(useCallback(() => {
    void checkSttDownloads(); void refreshLock().catch(() => setError('Could not check saved recordings. Reopen this page.'));
  }, [refreshLock]));
  const select = async (enabled: boolean, id = prefs.offlineSttModelId) => {
    try {
      if (await refreshLock()) { setError('Finish or retry the current transcription before changing models.'); return; }
      if (enabled && (!id || downloads[id].status !== 'downloaded')) { setError('Download and select a verified speech model below first.'); return; }
      prefs.setOfflineStt(enabled, id); setError(null);
    } catch { setError('Could not change transcription settings. Try again.'); }
  };
  const transferring = Object.values(downloads).some(s => ['checking', 'downloading', 'pausing', 'verifying'].includes(s.status));
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.heading}>Recorder transcription</Text>
    <Text style={styles.body}>Choose Gnani online or a downloaded speech model on this phone. Offline AI reports will be added later.</Text>
    <NeoButton label={`${!prefs.offlineSttEnabled ? '✓ ' : ''}Online — Gnani`} disabled={locked} onPress={() => { void select(false); }} />
    <NeoButton label={`${prefs.offlineSttEnabled ? '✓ ' : ''}Offline — on device`} disabled={locked || !offlineSttAvailable} onPress={() => { void select(true); }} />
    {locked ? <Text style={styles.caption}>Engine and model stay fixed until the current transcription finishes.</Text> : null}
    {!offlineSttAvailable ? <Text style={styles.body}>Offline speech requires the updated custom Android APK. It is unavailable in Expo Go, iOS, and web.</Text> : null}
    {error ? <Text accessibilityRole="alert" style={styles.body}>{error}</Text> : null}
    {STT_MODELS.map((model, index) => {
      const state = downloads[model.id];
      const downloaded = state.status === 'downloaded';
      return <View key={model.id} style={styles.card}>
        <Text accessibilityRole="header" style={styles.heading}>{model.label}</Text>
        <Text style={styles.body}>{Math.round(model.bytes / 1000000)} MB · Multilingual</Text>
        <Text style={styles.caption}>Keep at least {Math.ceil(model.bytes * 1.5 / 1000000)} MB free for downloading, plus space for recording audio.</Text>
        <Text style={styles.caption}>For English, Hindi and mixed Hinglish speech. Recognition accuracy varies with pronunciation and background noise.</Text>
        <Text style={styles.caption}>{index === 0 ? 'Recommended starting choice.' : 'Uses more memory and may process more slowly.'} Speed depends on your phone. Model files stay on this device.</Text>
        <Text accessibilityLiveRegion="polite" style={styles.body}>{downloaded ? '✓ Downloaded and verified' :
          state.status === 'downloading' ? `Downloading · ${Math.round(state.progress * 100)}%` :
          state.status === 'paused' ? `Paused · ${Math.round(state.progress * 100)}%` :
          state.status === 'verifying' ? 'Verifying model…' : state.status === 'pausing' ? 'Saving pause point…' : state.status === 'checking' ? 'Checking download…' : 'Not downloaded'}</Text>
        {downloaded ? <>
          <NeoButton label={prefs.offlineSttModelId === model.id && prefs.offlineSttEnabled ? '✓ Selected for offline STT' : 'Use for offline STT'} disabled={locked} onPress={() => { void select(true, model.id); }} />
          <NeoButton label="Remove download" disabled={transferring} onPress={() => { void (async () => {
            if (!await confirmAction('Remove speech model?', 'Saved transcripts stay on this device. Select another downloaded model before using offline recording again.', 'Remove')) return;
            if (await removeSttModel(model.id) && prefs.offlineSttModelId === model.id) prefs.setOfflineStt(prefs.offlineSttEnabled, null);
          })(); }} />
        </> : state.status === 'downloading' ? <>
          <NeoButton label="Pause" onPress={() => { void pauseSttDownload(model.id); }} />
          <NeoButton label="Cancel download" onPress={() => { void cancelSttDownload(model.id); }} />
        </> : <>
          <NeoButton label={state.status === 'paused' ? 'Resume download' : state.error ? 'Retry download' : 'Download model'} disabled={!offlineSttAvailable || transferring} onPress={() => { void downloadSttModel(model.id); }} />
          {state.status === 'paused' ? <NeoButton label="Cancel download" onPress={() => { void cancelSttDownload(model.id); }} /> : null}
        </>}
        {state.error ? <Text accessibilityRole="alert" style={styles.body}>{state.error}</Text> : null}
        <NeoButton label="Model source & license ↗" onPress={() => { void Linking.openURL(`https://huggingface.co/ggerganov/whisper.cpp/tree/${STT_REVISION}`).catch(() => setError('Could not open model source.')); }} />
      </View>;
    })}
  </View>;
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  section: { gap: 14 },
  card: { padding: 20, gap: 14, borderWidth: 3, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card, boxShadow: `4px 4px 0 ${colors.border}` },
  heading: { fontFamily: fontFamilies.head, fontSize: 22, color: colors.foreground },
  body: { fontFamily: fontFamilies.sans, fontSize: 16, lineHeight: 24, color: colors.foreground },
  caption: { fontFamily: fontFamilies.sans, fontSize: 14, lineHeight: 21, color: colors.mutedForeground },
});
