import { useAuth } from '@clerk/expo';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { reportIndexStatus } from '@/lib/embeddings/indexing';
import { useThemeColors } from '@/theme/use-theme';
export function ReportIndexProgress() {
  const { userId } = useAuth();
  const colors = useThemeColors();
  const [value, setValue] = useState<{ owner: string; message: string } | null>(null);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    const refresh = async () => {
      try {
        const status = await reportIndexStatus(userId);
        const message = status.pending === 0 ? 'Local class indexing is up to date.'
          : status.state === 'model_missing' ? 'Report saved. Download EmbeddingGemma in Run locally to finish indexing.'
          : status.error ? 'Report saved. Local indexing will retry; see Run locally for model status.'
          : `Report saved. Local class indexing: ${status.pending} sections pending.`;
        if (active) setValue({ owner: userId, message });
      } catch { if (active) setValue({ owner: userId, message: 'Report saved. Indexing status is temporarily unavailable.' }); }
    };
    void refresh(); const timer = setInterval(() => { void refresh(); }, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [userId]);
  return value && value.owner === userId ? <Text accessibilityLiveRegion="polite" style={{ color: colors.foreground }}>{value.message}</Text> : null;
}
