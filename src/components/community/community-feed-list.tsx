import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { CommunityPostCard } from "@/components/community/community-post-card";
import { confirmDeletePost } from "@/lib/community/delete-post-alert";
import { spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import type { CommunityPost, VoteValue } from "@/types/community";
import { useAuth } from "@clerk/expo";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  posts: readonly CommunityPost[];
  isLoading: boolean;
  error: string | null;
  onPostPress: (postId: string) => void;
  onVote: (postId: string, value: VoteValue) => void;
  onRemoveVote: (postId: string) => void;
  onToggleSave: (postId: string, save: boolean) => void;
  onDeletePost?: (postId: string) => Promise<void>;
}>;

function canDeletePost(
  post: CommunityPost,
  userId: string | null | undefined,
): boolean {
  return (
    post.demoSeed ||
    (userId !== null && userId !== undefined && post.authorClerkId === userId)
  );
}

export function CommunityFeedList({
  posts,
  isLoading,
  error,
  onPostPress,
  onVote,
  onRemoveVote,
  onToggleSave,
  onDeletePost,
}: Props): React.ReactElement {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const { userId } = useAuth();

  if (isLoading && posts.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.foreground} size="small" />
      </View>
    );
  }

  if (error && posts.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No posts yet</Text>
        <Text style={styles.emptyBody}>
          Save a local post to preview your community feed.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      <Text style={styles.emptyBody}>Local preview · these posts are saved only on this device.</Text>
      {posts.map((post) => {
        const deletable = canDeletePost(post, userId);

        return (
          <CommunityPostCard
            key={post.postId}
            canDelete={deletable}
            onDelete={
              deletable && onDeletePost
                ? () => {
                    confirmDeletePost({
                      isWelcomePost: post.demoWelcome,
                      onConfirm: () => {
                        void onDeletePost(post.postId);
                      },
                    });
                  }
                : undefined
            }
            onDownvote={() => {
              if (post.viewerVote === -1) {
                void onRemoveVote(post.postId);
              } else {
                void onVote(post.postId, -1);
              }
            }}
            onPress={() => onPostPress(post.postId)}
            onToggleSave={() => {
              void onToggleSave(post.postId, !post.viewerSaved);
            }}
            onUpvote={() => {
              if (post.viewerVote === 1) {
                void onRemoveVote(post.postId);
              } else {
                void onVote(post.postId, 1);
              }
            }}
            post={post}
          />
        );
      })}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  center: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  emptyBody: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  emptyTitle: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
  },
  errorText: {
    color: colors.destructive,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  list: {
    gap: spacing.md,
  },
});
