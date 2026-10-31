import { useColorMode, useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { CommunityScreenHeader } from "@/components/community/community-screen-header";
import { useCommunityPreview } from "@/hooks/use-community-preview";
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function GroupDetailScreen(): React.ReactElement {
  const colorMode = useColorMode();
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const community = useCommunityPreview();
  const group = community.state.groups.find((item) => item.groupId === groupId) ?? null;
  const isLoading = false;
  const error = group ? null : 'Local group not found.';

  const copyJoinCode = async (): Promise<void> => {
    if (!group) {
      return;
    }

    await Clipboard.setStringAsync(group.joinCode);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator color={colors.foreground} size="large" />
      </SafeAreaView>
    );
  }

  if (error || !group) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <CommunityScreenHeader title="Group" />
        <Text style={styles.error}>{error ?? "Group not found"}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <StatusBar style={colorMode === "dark" ? "light" : "dark"} />
      <CommunityScreenHeader title={group.name} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.description}>
          {group.description || "Teacher discussion group"}
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void copyJoinCode();
          }}
          style={styles.codeCard}
        >
          <Text style={[styles.codeLabel, { color: colors.onAccent }]}>Join code</Text>
          <Text style={[styles.codeValue, { color: colors.onAccent }]}>{group.joinCode}</Text>
          <Text style={[styles.codeHint, { color: colors.onAccent }]}>Tap to copy</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>
          Members ({group.memberCount}) · local preview
        </Text>
        {group.members.map((member) => (
          <View key={member.clerkId} style={styles.memberRow}>
            <View style={styles.memberAvatar}>
              <Text style={[styles.memberAvatarText, { color: colors.onAccent }]}>{member.avatarLetter}</Text>
            </View>
            <View>
              <Text style={styles.memberName}>{member.displayName}</Text>
              <Text style={styles.memberRole}>{member.role}</Text>
            </View>
          </View>
        ))}

        {group.isMember ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push(`/community/groups/${group.groupId}/chat`)
            }
            style={styles.chatButton}
          >
            <Text style={[styles.chatButtonLabel, { color: colors.onAccent }]}>Open group chat</Text>
          </Pressable>
        ) : (
          <Text style={styles.notMember}>
            Join this group to participate in chat.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  chatButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thin,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  chatButtonLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 16,
    lineHeight: 22,
  },
  codeCard: {
    backgroundColor: colors.lime,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thin,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  codeHint: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  codeLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 13,
    lineHeight: 18,
  },
  codeValue: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 28,
    letterSpacing: 4,
    lineHeight: 34,
    marginTop: spacing.xs,
  },
  content: {
    padding: spacing.lg,
  },
  description: {
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    color: colors.destructive,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
    padding: spacing.lg,
    textAlign: "center",
  },
  memberAvatar: {
    alignItems: "center",
    backgroundColor: colors.sky,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: borderWidths.thin,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  memberAvatarText: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 14,
    lineHeight: 18,
  },
  memberName: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 14,
    lineHeight: 18,
  },
  memberRole: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  memberRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  notMember: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.lg,
    textAlign: "center",
  },
  safeArea: {
    backgroundColor: colors.cream,
    flex: 1,
  },
  sectionTitle: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 18,
    lineHeight: 24,
    marginTop: spacing.lg,
  },
});
