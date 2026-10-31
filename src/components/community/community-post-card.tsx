import { CommunityPostAvatar } from "@/components/community/community-post-avatar";
import { CommunityPostBody } from "@/components/community/community-post-body";
import { CommunityPostImages } from "@/components/community/community-post-images";
import { PostTopActions } from "@/components/community/post-top-actions";
import { VoteBar } from "@/components/community/vote-bar";
import { formatTimeAgo } from "@/lib/community/time-ago";
import { colors } from "@/theme/colors";
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import type { CommunityPost } from "@/types/community";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  post: CommunityPost;
  onPress?: () => void;
  onUpvote: () => void;
  onDownvote: () => void;
  onToggleSave: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
  compact?: boolean;
}>;

export function CommunityPostCard({
  post,
  onPress,
  onUpvote,
  onDownvote,
  onToggleSave,
  onDelete,
  canDelete = false,
  compact = true,
}: Props): React.ReactElement {
  const handleShare = async (): Promise<void> => {
    await Clipboard.setStringAsync(
      `acharyaapp://community/post/${post.postId}`,
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.topBar}>
        <PostTopActions
          onToggleSave={onToggleSave}
          viewerSaved={post.viewerSaved}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityHint="Opens the full post"
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [
          styles.contentPressable,
          pressed && onPress ? styles.contentPressed : null,
        ]}
      >
        <View style={styles.headerRow}>
          <CommunityPostAvatar
            authorAvatarLetter={post.authorAvatarLetter}
            authorClerkId={post.authorClerkId}
            authorDisplayName={post.authorDisplayName}
            authorImageUrl={post.authorImageUrl}
            demoWelcome={post.demoWelcome}
            size={post.demoWelcome ? 48 : 36}
          />
          <View style={styles.meta}>
            <View style={styles.tagRow}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{post.subjectTag}</Text>
              </View>
              <Text style={styles.time}>{formatTimeAgo(post.createdAt)}</Text>
            </View>
            <View style={styles.authorRow}>
              <Text style={styles.author}>{post.authorDisplayName}</Text>
              {post.demoWelcome ? (
                <View style={styles.acharyaBadge}>
                  <Text style={styles.acharyaBadgeText}>Official</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <Text style={styles.title}>{post.title}</Text>

        {compact ? (
          <CommunityPostBody body={post.body} maxPreviewLines={4} variant="preview" />
        ) : (
          <CommunityPostBody body={post.body} variant="full" />
        )}

        <CommunityPostImages images={post.images} variant="card" />
      </Pressable>

      <View style={styles.footer}>
        <VoteBar
          onDownvote={onDownvote}
          onUpvote={onUpvote}
          score={post.score}
          viewerVote={post.viewerVote}
        />
        <Pressable
          accessibilityLabel="Share post"
          accessibilityRole="button"
          onPress={() => {
            void handleShare();
          }}
          style={styles.actionButton}
        >
          <MaterialCommunityIcons
            color={colors.foreground}
            name="share-outline"
            size={18}
          />
          <Text style={styles.actionLabel}>Share</Text>
        </Pressable>
        <View style={styles.footerSpacer} />
        {canDelete && onDelete ? (
          <Pressable
            accessibilityLabel="Delete post"
            accessibilityRole="button"
            onPress={onDelete}
            style={styles.deleteFooterButton}
          >
            <MaterialCommunityIcons
              color={colors.destructive}
              name="trash-can-outline"
              size={22}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  acharyaBadge: {
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  acharyaBadgeText: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 10,
    lineHeight: 12,
  },
  actionButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  actionLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  author: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  authorRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thin,
    overflow: "hidden",
    ...shadows.sm,
  },
  contentPressed: {
    opacity: 0.94,
  },
  contentPressable: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  deleteFooterButton: {
    alignItems: "center",
    backgroundColor: colors.coralLight,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  footer: {
    alignItems: "center",
    borderColor: colors.border,
    borderTopWidth: borderWidths.thin,
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  footerSpacer: {
    flex: 1,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  meta: {
    flex: 1,
  },
  tag: {
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  tagRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  tagText: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 11,
    lineHeight: 14,
  },
  time: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  title: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 17,
    lineHeight: 23,
    marginTop: spacing.md,
  },
  topBar: {
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
});
