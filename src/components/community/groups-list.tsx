import { colors } from "@/theme/colors";
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import type { CommunityGroup } from "@/types/community";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  groups: readonly CommunityGroup[];
  isLoading: boolean;
  error: string | null;
  onGroupPress: (groupId: string) => void;
  onCreatePress: () => void;
  onJoinPress: () => void;
}>;

export function GroupsList({
  groups,
  isLoading,
  error,
  onGroupPress,
  onCreatePress,
  onJoinPress,
}: Props): React.ReactElement {
  if (isLoading && groups.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.foreground} size="small" />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={onCreatePress}
          style={({ pressed }) => [styles.actionChip, pressed && styles.pressed]}
        >
          <Text style={styles.actionLabel}>Create group</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onJoinPress}
          style={({ pressed }) => [styles.actionChip, pressed && styles.pressed]}
        >
          <Text style={styles.actionLabel}>Join with code</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {groups.length === 0 ? (
        <Text style={styles.emptyText}>
          No groups yet. Create one or join with a teacher&apos;s code.
        </Text>
      ) : (
        <View style={styles.list}>
          {groups.map((group) => (
            <Pressable
              key={group.groupId}
              accessibilityRole="button"
              onPress={() => onGroupPress(group.groupId)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.groupName}>{group.name}</Text>
                {group.isMember ? (
                  <MaterialCommunityIcons
                    color={colors.foreground}
                    name="check-circle"
                    size={18}
                  />
                ) : null}
              </View>
              <Text numberOfLines={2} style={styles.description}>
                {group.description || "Teacher discussion group"}
              </Text>
              <View style={styles.metaRow}>
                <View style={styles.codeChip}>
                  <Text style={styles.codeText}>{group.joinCode}</Text>
                </View>
                <Text style={styles.memberCount}>
                  {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actionChip: {
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: borderWidths.thin,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thin,
    padding: spacing.lg,
    ...shadows.sm,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  center: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  codeChip: {
    backgroundColor: colors.lime,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  codeText: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 12,
    letterSpacing: 1,
    lineHeight: 16,
  },
  description: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  emptyText: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  errorText: {
    color: colors.destructive,
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  groupName: {
    color: colors.foreground,
    flex: 1,
    fontFamily: fontFamilies.head,
    fontSize: 16,
    lineHeight: 22,
  },
  list: {
    gap: spacing.md,
  },
  memberCount: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  pressed: {
    opacity: 0.9,
  },
  wrap: {
    gap: spacing.sm,
  },
});
