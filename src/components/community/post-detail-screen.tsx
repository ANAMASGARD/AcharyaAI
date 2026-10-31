import { Pressable } from '@/components/feedback/pressable';
import { useColorMode, useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { usePreviewFeature } from "@/components/preview/preview-provider";
import { CommunityPostBody } from "@/components/community/community-post-body";
import { CommunityPostDetailHeader } from "@/components/community/community-post-detail-header";
import { CommunityPostImages } from "@/components/community/community-post-images";
import { CommunityScreenHeader } from "@/components/community/community-screen-header";
import { PostTopActions } from "@/components/community/post-top-actions";
import { VoteBar } from "@/components/community/vote-bar";
import { useCommunityPreview } from "@/hooks/use-community-preview";
import { confirmDeletePost } from "@/lib/community/delete-post-alert";
import { formatTimeAgo } from "@/lib/community/time-ago";
import { resolvePostIdParam } from "@/lib/community/post-route";
import { useTeacherDisplayName } from "@/hooks/use-teacher-display-name";
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import type {
  VoteValue,
} from "@/types/community";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function PostDetailScreen(): React.ReactElement {
  const colorMode = useColorMode();
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const params = useLocalSearchParams<{ postId?: string | string[] }>();
  const postId = useMemo(() => resolvePostIdParam(params.postId), [params.postId]);
  const router = useRouter();
  const community = useCommunityPreview();
  const displayName = useTeacherDisplayName();
  const post = community.state.posts.find((item) => item.postId === postId) ?? null;
  const comments = community.state.comments[postId ?? ''] ?? [];
  const isLoading = false;
  const isLoaded = true;
  const error = post ? null : 'Local post not found.';
  const [commentBody, setCommentBody] = usePreviewFeature(`post-comment:${postId ?? "missing"}`, "");
  const isSubmitting = false;
  const isDeleting = false;
  const canDeletePost = Boolean(post);
  const handleVote = async (value: VoteValue) => { if (post) await community.votePost(post.postId, value); };
  const handleRemoveVote = async () => { if (post) await community.removeVote(post.postId); };
  const handleToggleSave = async () => { if (post) await community.toggleSave(post.postId, !post.viewerSaved); };
  const handleDelete = () => {
    if (!post) return;
    confirmDeletePost({ isWelcomePost: false, onConfirm: () => { void community.deletePost(post.postId).then(() => router.back()); } });
  };
  const handleComment = async () => {
    if (!post || !commentBody.trim()) return;
    await community.addComment(post.postId, commentBody, displayName); setCommentBody('');
  };

  const headerActions =
    post && !isLoading ? (
      <PostTopActions
        onToggleSave={() => {
          void handleToggleSave();
        }}
        viewerSaved={post.viewerSaved}
      />
    ) : null;

  if (!isLoaded || isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <CommunityScreenHeader rightActions={headerActions} title="Post" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.foreground} size="large" />
          <Text style={styles.loadingText}>Loading post…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !post) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <CommunityScreenHeader title="Post" />
        <View style={styles.center}>
          <Text style={styles.error}>{error ?? "Post not found"}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              router.back();
            }}
            style={styles.retryButton}
          >
            <Text style={[styles.retryLabel, { color: colors.onAccent }]}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <StatusBar style={colorMode === "dark" ? "light" : "dark"} />
      <CommunityScreenHeader rightActions={headerActions} title="Post" />
      <KeyboardAwareScrollView keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <CommunityPostDetailHeader post={post} />

        <CommunityPostBody body={post.body} variant="full" />
        <CommunityPostImages images={post.images} variant="detail" />

        {post.linkUrl ? (
          <Text style={styles.link}>{post.linkUrl}</Text>
        ) : null}

        <View style={styles.actionsRow}>
          <VoteBar
            onDownvote={() => {
              void (post.viewerVote === -1 ? handleRemoveVote() : handleVote(-1));
            }}
            onUpvote={() => {
              void (post.viewerVote === 1 ? handleRemoveVote() : handleVote(1));
            }}
            score={post.score}
            viewerVote={post.viewerVote}
          />
          <View style={styles.actionsSpacer} />
          {canDeletePost ? (
            <Pressable
              accessibilityLabel="Delete post"
              accessibilityRole="button"
              disabled={isDeleting}
              onPress={handleDelete}
              style={[styles.deleteButton, isDeleting && styles.disabled]}
            >
              <MaterialCommunityIcons
                color={colors.destructive}
                name="trash-can-outline"
                size={22}
              />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.commentsHeader}>
          <Text style={styles.commentsTitle}>
            Comments ({post.commentCount}) · local preview
          </Text>
        </View>

        {comments.map((comment) => (
          <View key={comment.commentId} style={styles.commentCard}>
            <Text style={styles.commentAuthor}>
              {comment.authorDisplayName}
            </Text>
            <Text style={styles.commentBody}>{comment.body}</Text>
            <Text style={styles.commentTime}>
              {formatTimeAgo(comment.createdAt)}
            </Text>
          </View>
        ))}

        <TextInput
          multiline
          onChangeText={setCommentBody}
          placeholder="Add a comment..."
          placeholderTextColor={colors.mutedForeground}
          style={styles.commentInput}
          value={commentBody}
        />
        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={() => {
            void handleComment();
          }}
          style={[styles.commentButton, isSubmitting && styles.disabled]}
        >
          <Text style={[styles.commentButtonLabel, { color: colors.onAccent }]}>Comment</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  actionsRow: {
    alignItems: "center",
    flexDirection: "row",
    marginTop: spacing.lg,
  },
  actionsSpacer: {
    flex: 1,
  },
  deleteButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: borderWidths.thin,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  commentAuthor: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 13,
    lineHeight: 18,
  },
  commentBody: {
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  commentButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  commentButtonLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 14,
    lineHeight: 18,
  },
  commentCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  commentInput: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 15,
    marginTop: spacing.md,
    minHeight: 80,
    padding: spacing.md,
    textAlignVertical: "top",
  },
  commentTime: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 11,
    lineHeight: 14,
    marginTop: spacing.xs,
  },
  commentsHeader: {
    marginTop: spacing.xl,
  },
  commentsTitle: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 18,
    lineHeight: 24,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing["2xl"],
  },
  disabled: {
    opacity: 0.7,
  },
  error: {
    color: colors.destructive,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  link: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
    textDecorationLine: "underline",
  },
  loadingText: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 14,
    lineHeight: 18,
  },
  safeArea: {
    backgroundColor: colors.cream,
    flex: 1,
  },
});
