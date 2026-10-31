import { Pressable } from '@/components/feedback/pressable';
import { useCommunity } from '@/hooks/use-community';
import { useThemeColors } from '@/theme/use-theme';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

export function CommunityTools(): React.ReactElement {
  const colors = useThemeColors();
  const { request } = useCommunity();
  const router = useRouter();
  const [moderator, setModerator] = useState(false);
  useEffect(() => {
    let active = true;
    void request<{ moderator: boolean }>('/capabilities').then(value => { if (active) setModerator(value.moderator === true); }).catch(() => { if (active) setModerator(false); });
    return () => { active = false; };
  }, [request]);
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
    <Pressable accessibilityRole="button" onPress={() => router.push('/community/drafts')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.mutedForeground }}>Local drafts</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => router.push('/community/blocked')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.mutedForeground }}>Blocked teachers</Text></Pressable>
    {moderator ? <Pressable accessibilityRole="button" onPress={() => router.push('/community/moderation')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.foreground }}>Moderation queue</Text></Pressable> : null}
  </View>;
}
