import { useColorMode, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { CommunityScreenHeader } from "@/components/community/community-screen-header";
import { GroupsList } from "@/components/community/groups-list";
import { useCommunityGroups } from "@/hooks/use-community-groups";
import { spacing } from "@/theme/tokens";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function GroupsIndexScreen(): React.ReactElement {
  const colorMode = useColorMode();
  const styles = useThemeStyles(createStyles);

  const router = useRouter();
  const groups = useCommunityGroups();

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <StatusBar style={colorMode === "dark" ? "light" : "dark"} />
      <CommunityScreenHeader title="Teacher Groups" />
      <ScrollView contentContainerStyle={styles.content}>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  content: {
    padding: spacing.lg,
  },
  safeArea: {
    backgroundColor: colors.cream,
    flex: 1,
  },
});
