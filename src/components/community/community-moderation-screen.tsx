import { CommunityScreenHeader } from './community-screen-header';
import { CommunityPostImages } from './community-post-images';
import { Pressable } from '@/components/feedback/pressable';
import { useCommunity } from '@/hooks/use-community';
import { useThemeColors } from '@/theme/use-theme';
import type { CommunityModerationReport } from '@/types/community';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function CommunityModerationScreen(): React.ReactElement {
  const { getModeration, resolveReport } = useCommunity();
  const colors = useThemeColors();
  const [reports, setReports] = useState<readonly CommunityModerationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { const result = await getModeration(); setReports(result.reports); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open the moderation queue.'); }
    finally { setLoading(false); }
  }, [getModeration]);
  useEffect(() => {
    let active = true;
    void getModeration().then(result => { if (active) setReports(result.reports); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not open moderation.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [getModeration]);
  const resolve = async (id: string, action: 'dismiss' | 'remove') => {
    if (pending) return;
    setPending(id);
    try { await resolveReport(id, action); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not resolve report.'); }
    finally { setPending(null); }
  };
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
    <CommunityScreenHeader title="Moderation queue" />
    <FlatList data={reports} keyExtractor={report => report.reportId} contentContainerStyle={{ padding: 20, gap: 16 }} onRefresh={() => void refresh()} refreshing={loading}
      ListHeaderComponent={error ? <Text selectable accessibilityRole="alert" style={{ color: colors.destructive }}>{error}</Text> : undefined}
      ListEmptyComponent={loading ? <ActivityIndicator color={colors.foreground} /> : !error ? <Text style={{ color: colors.foreground }}>No reports awaiting review.</Text> : undefined}
      renderItem={({ item }) => <View style={{ padding: 16, gap: 12, borderColor: colors.border, borderWidth: 2, borderRadius: 12 }}>
        <Text selectable style={{ color: colors.foreground, fontWeight: '700' }}>{item.targetType} · {item.reason}</Text>
        {item.body ? <Text selectable style={{ color: colors.foreground }}>{item.body}</Text> : null}
        <CommunityPostImages images={item.images ?? []} variant="detail" />
        <Text selectable style={{ color: colors.mutedForeground }}>{item.targetId}</Text>
        {(['dismiss', 'remove'] as const).map(action => <Pressable key={action} accessibilityRole="button" disabled={pending !== null} onPress={() => void resolve(item.reportId, action)} style={{ minHeight: 44, justifyContent: 'center', opacity: pending ? 0.5 : 1 }}><Text style={{ color: action === 'remove' ? colors.destructive : colors.foreground }}>{action === 'remove' ? 'Remove content' : 'Dismiss report'}</Text></Pressable>)}
      </View>} />
  </SafeAreaView>;
}
