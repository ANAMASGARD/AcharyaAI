import { Pressable } from '@/components/feedback/pressable';
import { CommunityPostCard } from './community-post-card';
import { confirmDeletePost } from '@/lib/community/delete-post-alert';
import { useThemeColors } from '@/theme/use-theme';
import type { CommunityPost, VoteValue } from '@/types/community';
import { useAuth } from '@clerk/expo';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';

type Props = Readonly<{
  posts: readonly CommunityPost[];
  isLoading: boolean;
  error: string | null;
  onPostPress: (postId: string) => void;
  onVote: (postId: string, value: VoteValue) => void | Promise<void>;
  onRemoveVote: (postId: string) => void | Promise<void>;
  onToggleSave: (postId: string, save: boolean) => void | Promise<void>;
  onDeletePost?: (postId: string) => Promise<void>;
  virtualized?: boolean;
  onRefresh?: () => Promise<void>;
  onLoadMore?: () => Promise<void>;
  hasMore?: boolean;
}>;

/** Home renders two cards; the full feed owns a virtualized scroll container. */
export function CommunityFeedList({ posts, isLoading, error, onPostPress, onVote, onRemoveVote, onToggleSave, onDeletePost, virtualized, onRefresh, onLoadMore, hasMore }: Props): React.ReactElement {
  const colors = useThemeColors();
  const { userId } = useAuth();
  const [actionError, setActionError] = useState<string | null>(null);
  const run = (action: () => void | Promise<void>): void => {
    setActionError(null);
    void Promise.resolve().then(action).catch(cause => setActionError(cause instanceof Error ? cause.message : 'Please try again.'));
  };
  const renderPost = (post: CommunityPost) => {
    const canDelete = post.authorClerkId === userId;
    return <CommunityPostCard key={post.postId} post={post} canDelete={canDelete}
      onPress={() => onPostPress(post.postId)}
      onUpvote={() => run(() => post.viewerVote === 1 ? onRemoveVote(post.postId) : onVote(post.postId, 1))}
      onDownvote={() => run(() => post.viewerVote === -1 ? onRemoveVote(post.postId) : onVote(post.postId, -1))}
      onToggleSave={() => run(() => onToggleSave(post.postId, !post.viewerSaved))}
      onDelete={canDelete && onDeletePost ? () => confirmDeletePost({ isWelcomePost: false, onConfirm: () => run(() => onDeletePost(post.postId)) }) : undefined} />;
  };
  const errors = error || actionError ? <View style={{ gap: 8, paddingVertical: 12 }}>
    <Text selectable accessibilityRole="alert" style={{ color: colors.destructive }}>{actionError ?? error}</Text>
    {onRefresh ? <Pressable accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => run(onRefresh)}><Text style={{ color: colors.foreground }}>Retry</Text></Pressable> : null}
  </View> : null;
  const empty = <View style={{ padding: 24, gap: 8, alignItems: 'center' }}>
    {isLoading ? <ActivityIndicator color={colors.foreground} /> : !error ? <>
      <Text style={{ color: colors.foreground, fontWeight: '700' }}>No posts yet</Text>
      <Text style={{ color: colors.mutedForeground }}>Share a teaching idea, question, link, or photo.</Text>
    </> : null}
  </View>;
  if (virtualized) return <FlatList data={posts} keyExtractor={post => post.postId} renderItem={({ item }) => renderPost(item)}
    contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, gap: 16, flexGrow: 1 }} keyboardShouldPersistTaps="handled"
    ListHeaderComponent={errors ?? undefined} ListEmptyComponent={empty} refreshing={isLoading && posts.length > 0}
    onRefresh={onRefresh ? () => run(onRefresh) : undefined}
    ListFooterComponent={hasMore && onLoadMore ? <Pressable accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => run(onLoadMore)}><Text style={{ color: colors.foreground }}>Load more posts</Text></Pressable> : undefined} />;
  return <View style={{ gap: 16 }}>{errors}{posts.length ? posts.map(renderPost) : empty}</View>;
}
