import { useAuth } from '@clerk/expo';
import { useEffect, useState, useRef } from 'react';
import { Text, View } from 'react-native';
import { NeoButton } from '@/components/ui/neo-button';
import { allowReportSharing, reportSharingAllowed } from '@/lib/reports/history';
import { reportSyncStatus } from '@/lib/reports/cloud';
import { confirmAction } from '@/lib/confirm-action';
import { useThemeColors } from '@/theme/use-theme';
export function ReportSharing({ sessionId }: { sessionId: string }) {
  const { userId } = useAuth();
  const colors = useThemeColors();
  const current = useRef<AbortController | null>(null);
  const [identity, setIdentity] = useState(`${userId}:${sessionId}`);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (identity !== `${userId}:${sessionId}`) { setIdentity(`${userId}:${sessionId}`); setAllowed(null); setMessage(null); }
  useEffect(() => {
    const controller = new AbortController(); current.current = controller;
    if (userId) void reportSharingAllowed(userId, sessionId).then(value => { if (!controller.signal.aborted) setAllowed(value); }).catch(() => { if (!controller.signal.aborted) setMessage('Could not read sharing status.'); });
    return () => { controller.abort(); };
  }, [userId, sessionId]);
  if (allowed === true) return message ? <Text style={{ color: colors.foreground }}>{message}</Text> : null;
  return <View style={{ gap: 8 }}>
    <Text style={{ color: colors.foreground }}>Report and embeddings stay on this phone.</Text>
    <NeoButton label="Allow cloud sync for this report" disabled={allowed === null} onPress={() => { void (async () => {
      const controller = current.current;
      if (!controller || !userId || !await confirmAction('Share saved report?', 'Allow this report, class notes and their embeddings to upload when account cloud sync is enabled. The raw transcript is not included.', 'Allow sync')) return;
      try {
        if (controller.signal.aborted) return;
        await allowReportSharing(userId, sessionId, controller.signal);
        if (controller.signal.aborted) return;
        setAllowed(true);
        const enabled = (await reportSyncStatus(userId))?.enabled;
        if (!controller.signal.aborted) setMessage(enabled ? 'Sharing allowed. Sync will run when connected.' : 'Sharing allowed. Enable account cloud sync in Settings to upload.');
      } catch { setMessage('Could not update sharing. Your saved report is safe.'); }
    })(); }} />
    {message ? <Text style={{ color: colors.foreground }}>{message}</Text> : null}
  </View>;
}
