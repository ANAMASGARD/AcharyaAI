import license from '../../../assets/models/gemma-license.json';
import { useCallback, useSyncExternalStore, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { NeoButton } from '@/components/ui/neo-button';
import { useUiPreferences } from '@/components/preview/preview-provider';
import { reportDownloads } from '@/lib/offline-reports/download';
import { REPORT_MODELS, reportDownloadPublished } from '@/lib/offline-reports/model';
import { reportRuntimeAvailable } from '@/lib/offline-reports/bridge';
import { localReportBusy, subscribeLocalReport } from '@/lib/offline-reports/engine';
import { useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';
export function OfflineReportSettings() {
  useFocusEffect(useCallback(() => { void reportDownloads.check(); }, []));
  const styles = useThemeStyles(createStyles);
  return <View style={{ gap: 20 }}>
    <Text style={styles.heading}>Offline reports · Experimental</Text>
    <Text style={styles.body}>Choose one model for Send. Downloading never changes your selection. Review generated feedback; these small models can make mistakes.</Text>
    {REPORT_MODELS.map(model => <ReportModelCard key={model.id} model={model} />)}
  </View>;
}
function ReportModelCard({ model }: { model: typeof REPORT_MODELS[number] }) {
  const styles = useThemeStyles(createStyles);
  const prefs = useUiPreferences();
  const [showLicense, setShowLicense] = useState(false);
  const busy = useSyncExternalStore(subscribeLocalReport, localReportBusy, () => false);
  const downloads = useSyncExternalStore(reportDownloads.subscribe, reportDownloads.getState, reportDownloads.getState);
  const state = downloads[model.id];
  const otherTransfer = Object.entries(downloads).some(([id, item]) => id !== model.id && ['checking', 'downloading', 'pausing', 'verifying'].includes(item.status));
  const ready = state.status === 'downloaded';
  const transferring = ['checking', 'downloading', 'pausing', 'verifying'].includes(state.status);
  return <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.heading}>{model.label}</Text>
    <Text style={styles.body}>Offline feedback & class notes · Experimental</Text>
    <Text style={styles.body}>{Math.ceil(model.bytes / 1e6)} MB · Keep at least {Math.ceil(model.bytes * 1.5 / 1e6)} MB free to download.</Text>
    <Text style={styles.body}>Download once, then use Send to create reports on this phone. Quality and speed vary, especially for Hindi and mixed speech.</Text>
    <Text accessibilityLiveRegion="polite" style={styles.body}>{ready ? '✓ Downloaded and verified' : transferring ? `${state.status === 'downloading' ? 'Downloading' : state.status} · ${Math.round(state.progress * 100)}%` : state.status === 'paused' ? `Paused · ${Math.round(state.progress * 100)}%` : 'Not downloaded'}</Text>
    {!reportRuntimeAvailable ? <Text style={styles.body}>Requires the updated custom Android app.</Text> : !reportDownloadPublished ? <Text style={styles.body}>Download is not published yet. Your saved transcripts remain available.</Text> : null}
    {ready ? <>
      <NeoButton label={prefs.offlineReportModelId === model.id ? '✓ Selected model' : 'Select this model'} disabled={busy || prefs.offlineReportModelId === model.id} onPress={() => prefs.setOfflineReportModelId(model.id)} />
      <NeoButton label={prefs.offlineReportsEnabled ? '✓ Offline reports enabled' : 'Enable offline reports'} disabled={busy || prefs.offlineReportsEnabled || prefs.offlineReportModelId !== model.id} onPress={() => prefs.setOfflineReportsEnabled(true)} />
      {prefs.offlineReportsEnabled ? <NeoButton label="Disable offline reports" disabled={busy} onPress={() => prefs.setOfflineReportsEnabled(false)} /> : null}
      <NeoButton label="Remove download" disabled={busy} onPress={() => { void reportDownloads.remove(model.id); }} />
    </> : state.status === 'downloading' ? <>
      <NeoButton label="Pause" onPress={() => { void reportDownloads.pause(model.id); }} />
      <NeoButton label="Cancel download" onPress={() => { void reportDownloads.cancel(model.id); }} />
    </> : <>
      <NeoButton label={state.status === 'paused' ? 'Resume download' : state.error ? 'Retry download' : `Download · ${Math.ceil(model.bytes / 1e6)} MB`} disabled={!reportRuntimeAvailable || !reportDownloadPublished || transferring || otherTransfer} onPress={() => { void reportDownloads.download(model.id); }} />
      {state.status === 'paused' ? <NeoButton label="Cancel download" onPress={() => { void reportDownloads.cancel(model.id); }} /> : null}
    </>}
    {state.error ? <Text accessibilityRole="alert" style={styles.body}>{state.error}</Text> : null}
    <Text style={styles.body}>Generated reports stay local until you choose to share them.</Text>
    <Text style={styles.body}>Downloading or using this model is subject to the Gemma Terms of Use, including the use restrictions in section 3.2 and the Gemma Prohibited Use Policy.</Text>
    <NeoButton label={showLicense ? 'Hide model license' : 'Model license'} onPress={() => setShowLicense(!showLicense)} />
    {showLicense ? <Text selectable style={styles.body}>{license.notice}{'\n\n'}{license.terms}</Text> : null}
  </View>;
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: { padding: 20, gap: 14, borderWidth: 3, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card, boxShadow: `4px 4px 0 ${colors.border}` },
  heading: { fontFamily: fontFamilies.head, fontSize: 22, color: colors.foreground },
  body: { fontFamily: fontFamilies.sans, fontSize: 14, lineHeight: 21, color: colors.foreground },
});
