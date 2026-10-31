import { Pressable } from '@/components/feedback/pressable';
import { useCommunityImage } from '@/hooks/use-community';
import { useThemeColors } from '@/theme/use-theme';
import type { CommunityPostImage } from '@/types/community';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View, type ImageStyle, type StyleProp } from 'react-native';

type Props = { image: CommunityPostImage; style?: StyleProp<ImageStyle>; contentFit?: 'cover' | 'contain' };
export function CommunityPostImageView(props: Props): React.ReactElement {
  // Old previews retain their local attachments and never upload just by viewing.
  if (props.image.uri) return <Image source={{ uri: props.image.uri }} accessibilityLabel={props.image.fileName} style={props.style} contentFit={props.contentFit ?? 'cover'} />;
  return <RemoteImage {...props} />;
}
function RemoteImage({ image, style, contentFit = 'cover' }: Props): React.ReactElement {
  const photo = useCommunityImage(image.imageId, contentFit === 'contain' ? 1600 : 900);
  const colors = useThemeColors();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  if (!photo.uri || failed) return <View style={[{ backgroundColor: colors.muted, justifyContent: 'center', alignItems: 'center' }, style]}>
    {photo.isLoading && !failed ? <ActivityIndicator color={colors.foreground} /> : <Pressable accessibilityRole="button" onPress={event => { event.stopPropagation(); setFailed(false); void photo.refresh(); }} style={{ minHeight: 44, padding: 8 }}>
      <Text style={{ color: colors.foreground }}>Photo unavailable · retry</Text>
      {photo.error ? <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{photo.error}</Text> : null}
    </Pressable>}
  </View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${image.fileName}`} onPress={event => { event.stopPropagation(); router.push({ pathname: '/community/image/[imageId]', params: { imageId: image.imageId } }); }}>
    <Image accessibilityLabel={image.fileName} source={{ uri: photo.uri }} contentFit={contentFit} style={style} cachePolicy="memory" onError={() => setFailed(true)} />
  </Pressable>;
}
