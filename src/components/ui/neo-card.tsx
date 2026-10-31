import { colors } from "@/theme/colors";
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { StyleSheet, View } from "react-native";

type Props = Readonly<{
  children: React.ReactNode;
  backgroundColor?: string;
  stacked?: boolean;
  padding?: number;
  style?: object;
}>;

export function NeoCard({
  children,
  backgroundColor = colors.card,
  stacked = false,
  padding = spacing.lg,
  style,
}: Props): React.ReactElement {
  if (stacked) {
    return (
      <View style={styles.stackWrap}>
        <View style={styles.stackUnderlay} />
        <View
          style={[
            styles.card,
            { backgroundColor, padding },
            styles.stackedCard,
            style,
          ]}
        >
          {children}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor, padding }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.default,
    ...shadows.lg,
  },
  stackUnderlay: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.default,
    bottom: -6,
    left: 6,
    position: "absolute",
    right: -6,
    top: 6,
    ...shadows.sm,
  },
  stackWrap: {
    position: "relative",
  },
  stackedCard: {
    position: "relative",
    zIndex: 1,
  },
});
