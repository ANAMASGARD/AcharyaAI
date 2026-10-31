import { CommunityFeedList } from "@/components/community/community-feed-list";
import { CreatePostBanner } from "@/components/community/create-post-banner";
import { GroupsList } from "@/components/community/groups-list";
import { useCommunityFeed } from "@/hooks/use-community-feed";
import { useCommunityGroups } from "@/hooks/use-community-groups";
import { colors } from "@/theme/colors";
import { borderWidths, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { communityPostPath } from "@/lib/community/post-route";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Segment = "feed" | "groups";

export function CommunitySection(): React.ReactElement {
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>("feed");
  const [groupsLoaded, setGroupsLoaded] = useState(false);

  const feed = useCommunityFeed({ limit: 2, autoFetch: true });
  const groups = useCommunityGroups();

  const handleGroupsSegment = useCallback((): void => {
    setSegment("groups");

    if (!groupsLoaded) {
      setGroupsLoaded(true);
      void groups.refresh();
    }
  }, [groups, groupsLoaded]);

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Community Feed</Text>
      <CreatePostBanner
        onPress={() => router.push("/community/create-post")}
      />

      <View style={styles.segmentRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setSegment("feed")}
          style={[
            styles.segment,
            segment === "feed" ? styles.segmentActive : null,
          ]}
        >
          <Text
            style={[
              styles.segmentLabel,
              segment === "feed" ? styles.segmentLabelActive : null,
            ]}
          >
            Feed
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={handleGroupsSegment}
          style={[
            styles.segment,
            segment === "groups" ? styles.segmentActive : null,
          ]}
        >
          <Text
            style={[
              styles.segmentLabel,
              segment === "groups" ? styles.segmentLabelActive : null,
            ]}
          >
            Groups
          </Text>
        </Pressable>
      </View>

      {segment === "feed" ? (
        <>
          <CommunityFeedList
            error={feed.error}
            isLoading={feed.isLoading}
            onDeletePost={feed.deletePost}
            onPostPress={(postId) => {
              router.push(communityPostPath(postId));
            }}
            onRemoveVote={feed.removeVote}
            onToggleSave={feed.toggleSave}
            onVote={feed.votePost}
            posts={feed.posts}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/community/feed")}
            style={styles.viewAll}
          >
            <Text style={styles.viewAllLabel}>View all posts</Text>
          </Pressable>
        </>
      ) : (
        <GroupsList
          error={groups.error}
          groups={groups.groups}
          isLoading={groups.isLoading}
          onCreatePress={() => router.push("/community/groups/create")}
          onGroupPress={(groupId) =>
            router.push(`/community/groups/${groupId}`)
          }
          onJoinPress={() => router.push("/community/join")}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 20,
    lineHeight: 26,
    marginBottom: spacing.sm,
  },
  section: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  segment: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: borderWidths.thin,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  segmentLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 14,
    lineHeight: 18,
    textAlign: "center",
  },
  segmentLabelActive: {
    fontFamily: fontFamilies.head,
  },
  segmentRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  viewAll: {
    alignSelf: "center",
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  viewAllLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 14,
    lineHeight: 18,
    textDecorationLine: "underline",
  },
});
