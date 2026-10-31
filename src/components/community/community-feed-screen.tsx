import { useColorMode, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { CommunityFeedList } from "@/components/community/community-feed-list";
import { CommunityScreenHeader } from "@/components/community/community-screen-header";
import { useCommunityFeed } from "@/hooks/use-community-feed";
import { spacing } from "@/theme/tokens";
import { communityPostPath } from "@/lib/community/post-route";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function CommunityFeedScreen(): React.ReactElement {
  const colorMode = useColorMode();
  const styles = useThemeStyles(createStyles);

  const router = useRouter();
  const feed = useCommunityFeed({ limit: 20, autoFetch: true });

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <StatusBar style={colorMode === "dark" ? "light" : "dark"} />
      <CommunityScreenHeader title="Community Feed" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  content: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  safeArea: {
    backgroundColor: colors.cream,
    flex: 1,
  },
});
