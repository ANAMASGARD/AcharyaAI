import { colors } from "@/theme/colors";
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { Pressable, StyleSheet, Text, View } from "react-native";

export type SessionDetailView = "reflection" | "notes";

type Props = Readonly<{
  value: SessionDetailView;
  onChange: (view: SessionDetailView) => void;
  inline?: boolean;
}>;

type ToggleOption = Readonly<{
  id: SessionDetailView;
  label: string;
  activeBg: string;
}>;

const OPTIONS: readonly ToggleOption[] = [
  { id: "reflection", label: "Reflection", activeBg: colors.card },
  { id: "notes", label: "Notes", activeBg: colors.sky },
];

export function SessionDetailViewToggle({
  value,
  onChange,
  inline = false,
}: Props): React.ReactElement {
  return (
    <View style={[styles.row, inline ? styles.rowInline : null]}>
      {OPTIONS.map((option) => {
        const isActive = value === option.id;

        const button = (
          <Pressable
            accessibilityLabel={option.label}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(option.id)}
            style={({ pressed }) => [
              styles.pill,
              isActive
                ? [styles.pillActive, { backgroundColor: option.activeBg }]
                : styles.pillInactive,
              pressed ? styles.pillPressed : null,
            ]}
          >
            <Text style={[styles.pillText, !isActive ? styles.pillTextMuted : null]}>
              {option.label}
            </Text>
          </Pressable>
        );

        if (!isActive) {
          return <View key={option.id}>{button}</View>;
        }

        return (
          <View key={option.id} style={styles.selectedWrap}>
            {button}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: borderWidths.thin,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  pillActive: {
    borderWidth: borderWidths.thin,
  },
  pillInactive: {
    backgroundColor: "rgba(255, 255, 255, 0.45)",
  },
  pillPressed: {
    opacity: 0.85,
  },
  pillText: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 12,
  },
  pillTextMuted: {
    opacity: 0.75,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  rowInline: {
    marginTop: 0,
  },
  selectedWrap: {
    borderColor: colors.border,
    borderRadius: radii.sm + 2,
    borderWidth: borderWidths.thin,
    padding: 2,
  },
});
