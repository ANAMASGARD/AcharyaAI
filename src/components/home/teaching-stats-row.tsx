import { NeoDashboardCard } from "@/components/home/neo-dashboard-card";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import type { DashboardStats } from "@/types/community";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  stats: DashboardStats | null;
  isLoading: boolean;
}>;

type StatCardProps = Readonly<{
  label: string;
  value: string;
  backgroundColor: string;
}>;

function StatCard({
  label,
  value,
  backgroundColor,
}: StatCardProps): React.ReactElement {
  return (
    <NeoDashboardCard backgroundColor={backgroundColor}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </NeoDashboardCard>
  );
}

export function TeachingStatsRow({
  stats,
  isLoading,
}: Props): React.ReactElement {
  if (isLoading && !stats) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={colors.foreground} size="small" />
      </View>
    );
  }

  const classesValue = String(stats?.classesThisMonth ?? 0);
  const notesValue = String(stats?.notesVerifiedCount ?? 0);
  const scoreValue =
    stats?.averageScore !== null && stats?.averageScore !== undefined
      ? String(stats.averageScore)
      : "—";

  return (
    <View style={styles.row}>
      <View style={styles.cardWrap}>
        <StatCard
          backgroundColor={colors.sky}
          label="Classes this month"
          value={classesValue}
        />
      </View>
      <View style={styles.cardWrap}>
        <StatCard
          backgroundColor={colors.mint}
          label="Notes verified"
          value={notesValue}
        />
      </View>
      <View style={styles.cardWrap}>
        <StatCard
          backgroundColor={colors.lavender}
          label="Avg score"
          value={scoreValue}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    flex: 1,
  },
  loadingWrap: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  statLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  statValue: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 24,
    lineHeight: 30,
  },
});
