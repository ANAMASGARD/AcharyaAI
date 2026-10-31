import { ActivityEmptyState } from "@/components/home/activity-empty-state";
import { NeoDashboardCard } from "@/components/home/neo-dashboard-card";
import { colors } from "@/theme/colors";
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import type { DashboardStats } from "@/types/community";
import type { RecentActivityItem } from "@/types/home-dashboard";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  items: readonly RecentActivityItem[];
  stats: DashboardStats | null;
  isLoading?: boolean;
  onVerifyNotes?: () => void;
  onStartClass?: () => void;
}>;

type StatChipProps = Readonly<{
  label: string;
  value: string;
  backgroundColor: string;
}>;

function StatChip({
  label,
  value,
  backgroundColor,
}: StatChipProps): React.ReactElement {
  return (
    <View style={[styles.statChip, { backgroundColor }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActivityAvatar({
  item,
}: Readonly<{ item: RecentActivityItem }>): React.ReactElement {
  if (item.avatarKind === "letter") {
    return (
      <View style={[styles.avatar, styles.avatarLetter]}>
        <Text style={styles.avatarLetterText}>
          {item.avatarLetter ?? item.title.charAt(0)}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.avatar, styles.avatarIcon]}>
      <MaterialCommunityIcons
        color={colors.foreground}
        name="file-document-outline"
        size={16}
      />
    </View>
  );
}

export function RecentActivityCard({
  items,
  stats,
  isLoading = false,
  onVerifyNotes,
  onStartClass,
}: Props): React.ReactElement {
  const router = useRouter();

  const classesValue = String(stats?.classesThisMonth ?? 0);
  const notesValue = String(stats?.notesVerifiedCount ?? 0);
  const scoreValue =
    stats?.averageScore !== null && stats?.averageScore !== undefined
      ? String(stats.averageScore)
      : "—";

  return (
    <NeoDashboardCard backgroundColor={colors.card}>
      <Text style={styles.title}>Recent Activity</Text>

      {isLoading && !stats ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.foreground} size="small" />
        </View>
      ) : (
        <View style={styles.statsRow}>
          <StatChip
            backgroundColor={colors.sky}
            label="Classes"
            value={classesValue}
          />
          <StatChip
            backgroundColor={colors.mint}
            label="Notes"
            value={notesValue}
          />
          <StatChip
            backgroundColor={colors.lavender}
            label="Avg score"
            value={scoreValue}
          />
        </View>
      )}

      <View style={styles.divider} />

      <View style={styles.list}>
        {!isLoading && items.length === 0 ? <ActivityEmptyState /> : null}
        {items.map((item) => {
          const content = (
            <>
              <ActivityAvatar item={item} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                {item.subtitle ? (
                  <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
                ) : null}
                <Text style={styles.rowTime}>{item.timeAgo}</Text>
              </View>
            </>
          );

          if (item.deepLink) {
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => router.push(item.deepLink as never)}
                style={styles.row}
              >
                {content}
              </Pressable>
            );
          }

          return (
            <View key={item.id} style={styles.row}>
              {content}
            </View>
          );
        })}
      </View>

      {onVerifyNotes || onStartClass ? (
        <View style={styles.quickLinks}>
          {onVerifyNotes ? (
            <Pressable accessibilityRole="button" onPress={onVerifyNotes}>
              <Text style={styles.quickLink}>Verify Notes</Text>
            </Pressable>
          ) : null}
          {onStartClass ? (
            <Pressable accessibilityRole="button" onPress={onStartClass}>
              <Text style={styles.quickLink}>Start Class</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </NeoDashboardCard>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 2,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  avatarIcon: {
    backgroundColor: colors.mint,
  },
  avatarLetter: {
    backgroundColor: colors.primary,
  },
  avatarLetterText: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 16,
    lineHeight: 20,
  },
  divider: {
    backgroundColor: colors.border,
    height: 1,
    marginVertical: spacing.md,
  },
  list: {
    gap: spacing.sm,
  },
  loadingWrap: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  quickLink: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 13,
    lineHeight: 18,
    textDecorationLine: "underline",
  },
  quickLinks: {
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  rowText: {
    flex: 1,
  },
  rowSubtitle: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 1,
  },
  rowTime: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1,
  },
  rowTitle: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 14,
    lineHeight: 18,
  },
  statChip: {
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  statLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 10,
    lineHeight: 13,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statValue: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 18,
    lineHeight: 22,
  },
  title: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 18,
    lineHeight: 24,
  },
});
