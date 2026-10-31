import { subscribeModelDownload, getModelDownloadState } from '@/lib/embeddings/download';
import { startReportIndexing, stopReportIndexing, scheduleReportIndexing, reportIndexStatus } from '@/lib/embeddings/indexing';
import { useAuth } from '@clerk/expo';
import { useCallback, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { AppState, Text } from 'react-native';
import { cloudConfigured, onReportSyncChange, reportSyncStatus, setReportSyncConsent, stopReportSync, syncReports } from '@/lib/reports/cloud';
import { confirmAction } from '@/lib/confirm-action';
import { ProfileToggleRow } from './profile-toggle-row';
import { ProfileMenuRow } from './profile-menu-row';
import { useThemeColors } from '@/theme/use-theme';

export function ReportSyncLifecycle() {
  const { userId, getToken } = useAuth();
  useEffect(() => {
    if (!userId) return;
    void startReportIndexing(userId).catch(() => {});
    const run = () => { void syncReports(userId, getToken); };
    const model = subscribeModelDownload(() => { if (getModelDownloadState().status === 'downloaded') void scheduleReportIndexing(userId).catch(() => {}); });
    run();
    const timer = setInterval(run, 30_000);
    const network = NetInfo.addEventListener(state => { if (state.isConnected && state.isInternetReachable !== false) run(); });
    const app = AppState.addEventListener('change', state => { if (state === 'active') { run(); void scheduleReportIndexing(userId).catch(() => {}); } });
    return () => { void stopReportIndexing(userId).catch(() => {}); clearInterval(timer); model(); network(); app.remove(); stopReportSync(userId); };
  }, [userId, getToken]);
  return null;
}
export function CloudSyncSettings() {
  const { userId, getToken } = useAuth();
  const colors = useThemeColors();
  const [state, setState] = useState<{ owner: string; enabled: boolean; error: string | null; index?: Awaited<ReturnType<typeof reportIndexStatus>> } | null>(null);
  const refresh = useCallback(async () => {
    if (!userId) return;
    const status = await reportSyncStatus(userId);
    const index = await reportIndexStatus(userId);
    setState({ owner: userId, enabled: status?.enabled ?? false, error: status?.lastError ?? null, index });
  }, [userId]);
  useEffect(() => { const timer = setTimeout(() => { void refresh(); }, 0); const unsubscribe = onReportSyncChange(() => { void refresh(); }); return () => { clearTimeout(timer); unsubscribe(); }; }, [refresh]);
  const current = state?.owner === userId ? state : null;
  if (!userId) return null;
  const toggle = async (enabled: boolean) => {
    try {
      if (enabled && !await confirmAction('Sync reports', 'Upload saved notes, teaching feedback, locally generated embeddings and class details to your Acharya account? Audio, raw transcripts and API keys stay out of cloud sync. Turning this off stops future sync; account deletion removes cloud copies.', 'Enable')) return;
      await setReportSyncConsent(userId, enabled);
      await refresh();
      if (enabled) void syncReports(userId, getToken);
    } catch (error) { setState({ owner: userId, enabled: current?.enabled ?? false, error: error instanceof Error ? error.message : 'Could not change sync.' }); }
  };
  return <>
    <ProfileToggleRow icon="cloud-sync-outline" label="Sync reports" value={current?.enabled ?? cloudConfigured()} onValueChange={enabled => { void toggle(enabled); }}
      subtitle={cloudConfigured() ? 'Notes, reports and embeddings · automatic sync' : 'Cloud setup pending · reports stay on this device'} />
    {current?.enabled ? <ProfileMenuRow icon="sync" label="Sync now" onPress={() => { void syncReports(userId, getToken); }} /> : null}
    {current?.index && current.index.state !== 'unavailable' ? <Text style={{ color: colors.mutedForeground, padding: 16 }}>
      Local embeddings: {current.index.ready} ready · {current.index.pending} pending{current.index.error ? ` · ${current.index.error}` : ''}
    </Text> : null}
    {current?.error ? <Text accessibilityRole="alert" style={{ color: colors.destructive, padding: 16 }}>{current.error}</Text> : null}
  </>;
}
