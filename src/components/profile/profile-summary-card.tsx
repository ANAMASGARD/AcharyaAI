import { ProfileMenuCard } from "@/components/profile/profile-menu-card";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  teachingLanguageLabel: string;
  twoFactorEnabled: boolean;
  connectedProviders: string[];
  memberSince: string;
}>;

function SummaryLine({
  label,
  value,
}: Readonly<{ label: string; value: string }>): React.ReactElement {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  );
}

export function ProfileSummaryCard({
  teachingLanguageLabel,
  twoFactorEnabled,
  connectedProviders,
  memberSince,
}: Props): React.ReactElement {
  const providersText =
    connectedProviders.length > 0
      ? connectedProviders.join(", ")
      : "None linked";

  return (
    <ProfileMenuCard backgroundColor={colors.mint} title="At a glance">
      <View style={styles.body}>
        <SummaryLine label="Teaching language" value={teachingLanguageLabel} />
        <SummaryLine
          label="Two-step verification"
          value={twoFactorEnabled ? "On" : "Off"}
        />
        <SummaryLine label="Connected accounts" value={providersText} />
        <SummaryLine label="Member since" value={memberSince} />
      </View>
    </ProfileMenuCard>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  line: {
    gap: 2,
  },
  lineLabel: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  lineValue: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 15,
    lineHeight: 22,
  },
});
