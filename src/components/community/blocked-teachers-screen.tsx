import { CommunityScreenHeader } from './community-screen-header';
import { Pressable } from '@/components/feedback/pressable';
import { useCommunity } from '@/hooks/use-community';
import { useThemeColors } from '@/theme/use-theme';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Block = { clerkId: string; displayName: string };
export function BlockedTeachersScreen(): React.ReactElement {
  const { request } = useCommunity();
  const colors = useThemeColors();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { const result = await request<{ blocks: Block[] }>('/blocks'); setBlocks(result.blocks); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load blocked teachers.'); }
    finally { setLoading(false); }
  }, [request]);
  useEffect(() => {
    let active = true;
    void request<{ blocks: Block[] }>('/blocks').then(result => { if (active) setBlocks(result.blocks); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load blocked teachers.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [request]);
  const unblock = async (id: string): Promise<void> => {
    try { await request(`/blocks/${encodeURIComponent(id)}`, { method: 'DELETE' }); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not unblock teacher.'); }
  };
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
    <CommunityScreenHeader title="Blocked teachers" />
    <FlatList data={blocks} keyExtractor={block => block.clerkId} contentContainerStyle={{ padding: 20, gap: 16 }} refreshing={loading} onRefresh={() => void refresh()}
      ListHeaderComponent={error ? <Text selectable style={{ color: colors.destructive }}>{error}</Text> : null}
      ListEmptyComponent={loading ? <ActivityIndicator color={colors.foreground} /> : !error ? <Text style={{ color: colors.foreground }}>You haven’t blocked any teachers.</Text> : null}
      renderItem={({ item }) => <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 16 }}><Text style={{ color: colors.foreground }}>{item.displayName}</Text><Pressable accessibilityRole="button" onPress={() => void unblock(item.clerkId)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.foreground }}>Unblock</Text></Pressable></View>} />
  </SafeAreaView>;
}
