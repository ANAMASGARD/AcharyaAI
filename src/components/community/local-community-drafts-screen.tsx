import { CommunityScreenHeader } from './community-screen-header';
import { CommunityPostImages } from './community-post-images';
import { Pressable } from '@/components/feedback/pressable';
import { usePreviewFeature } from '@/components/preview/preview-provider';
import { useCommunityStore } from '@/store/community-store';
import { useThemeColors } from '@/theme/use-theme';
import type { CommunityComment, CommunityGroupDetail, CommunityPost, CommunityPostImageDraft, GroupMessage } from '@/types/community';
import { useRouter } from 'expo-router';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Legacy = { posts: CommunityPost[]; groups: CommunityGroupDetail[]; messages: Record<string, GroupMessage[]>; comments?: Record<string, CommunityComment[]> };
const EMPTY: Legacy = { posts: [], groups: [], messages: {} };
export function LocalCommunityDraftsScreen(): React.ReactElement {
  const [legacy] = usePreviewFeature<Legacy>('community', EMPTY);
  const [, setImages] = usePreviewFeature<CommunityPostImageDraft[]>('community-images', []);
  const { setDraftPost } = useCommunityStore();
  const colors = useThemeColors();
  const router = useRouter();
  const copyPost = (post: CommunityPost) => {
    setDraftPost({ postId: '', title: post.title, body: post.body, subjectTag: post.subjectTag, linkUrl: post.linkUrl ?? '', groupId: '' });
    setImages(post.images.filter(image => image.uri).map(image => ({ id: image.id, uri: image.uri!, name: image.fileName, mimeType: image.mimeType, sizeBytes: null })));
    router.push('/community/create-post');
  };
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
    <CommunityScreenHeader title="Local community drafts" />
    <FlatList data={legacy.posts} keyExtractor={post => post.postId} contentContainerStyle={{ padding: 20, gap: 16 }}
      ListHeaderComponent={<Text style={{ color: colors.mutedForeground }}>Earlier device-only content is kept here. Nothing here has been published to other teachers.</Text>}
      ListEmptyComponent={<Text style={{ color: colors.foreground }}>No earlier local posts.</Text>}
      renderItem={({ item }) => <View style={{ padding: 16, gap: 8, borderColor: colors.border, borderWidth: 2, borderRadius: 12 }}>
        <Text selectable style={{ color: colors.foreground, fontWeight: '700' }}>{item.title}</Text>
        <Text selectable style={{ color: colors.foreground }}>{item.body}</Text>
        <CommunityPostImages images={item.images} />
        {(legacy.comments?.[item.postId] ?? []).map(comment => <Text selectable key={comment.commentId} style={{ color: colors.mutedForeground }}>{comment.authorDisplayName}: {comment.body}</Text>)}
        <Pressable accessibilityRole="button" onPress={() => copyPost(item)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.foreground }}>Copy to a new post draft</Text></Pressable>
      </View>}
      ListFooterComponent={<View style={{ gap: 12 }}>{legacy.groups.map(group => <View key={group.groupId} style={{ padding: 12, borderColor: colors.border, borderWidth: 1 }}>
        <Text selectable style={{ color: colors.foreground }}>{group.name} · local group</Text>
        <Text selectable style={{ color: colors.mutedForeground }}>{group.description}</Text>
        {(legacy.messages[group.groupId] ?? []).map(message => <Text selectable key={message.messageId} style={{ color: colors.foreground }}>{message.authorDisplayName}: {message.body}</Text>)}
      </View>)}</View>} />
  </SafeAreaView>;
}
