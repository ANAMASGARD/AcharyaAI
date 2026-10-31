import { Pressable } from '@/components/feedback/pressable';
import { CommunityScreenHeader } from '@/components/community/community-screen-header';
import { useCommunityImage } from '@/hooks/use-community';
import { useThemeColors } from '@/theme/use-theme';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CommunityImageScreen(): React.ReactElement {
  const { imageId } = useLocalSearchParams<{ imageId: string }>();
  const colors = useThemeColors();
  const image = useCommunityImage(imageId ?? '', 1600);
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
    <CommunityScreenHeader title="Photo" />
    <View style={{ flex: 1, justifyContent: 'center' }}>
      {image.uri ? <Image source={{ uri: image.uri }} contentFit="contain" style={{ flex: 1 }} cachePolicy="memory" accessibilityLabel="Shared community photo" /> : image.isLoading ? <ActivityIndicator color={colors.foreground} /> : <Pressable accessibilityRole="button" onPress={() => void image.refresh()} style={{ padding: 24, minHeight: 44 }}><Text style={{ color: colors.foreground }}>{image.error ?? 'Photo unavailable'} · Retry</Text></Pressable>}
    </View>
  </SafeAreaView>;
}
