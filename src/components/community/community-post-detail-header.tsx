import { CommunityPostAvatar } from "@/components/community/community-post-avatar";
import { formatTimeAgo } from "@/lib/community/time-ago";
import { colors } from "@/theme/colors";
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import type { CommunityPost } from "@/types/community";
import { StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  post: CommunityPost;
}>;

export function CommunityPostDetailHeader({ post }: Props): React.ReactElement {
  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <CommunityPostAvatar
          authorAvatarLetter={post.authorAvatarLetter}
          authorClerkId={post.authorClerkId}
          authorDisplayName={post.authorDisplayName}
          authorImageUrl={post.authorImageUrl}
          demoWelcome={post.demoWelcome}
          size={post.demoWelcome ? 52 : 40}
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
  author: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 14,
    lineHeight: 18,
  },
  authorRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: 4,
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
    fontSize: 22,
    lineHeight: 28,
    marginTop: spacing.lg,
  },
  wrap: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thin,
    padding: spacing.lg,
  },
});
