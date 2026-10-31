import { images } from "@/constants/images";
import { colors } from "@/theme/colors";
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import type { VerificationGap, VerificationGapVariant } from "@/types/notes-verification";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

const VARIANT_BACKGROUNDS: Record<VerificationGapVariant, string> = {
  coral: colors.coral,
  coralLight: "#FFD4CC",
  neutral: colors.card,
};

type Props = Readonly<{
  gap: VerificationGap;
}>;

export function VerificationGapCard({ gap }: Props): React.ReactElement {
  return (
    <View
      accessibilityLabel={`${gap.title}. ${gap.body}`}
      style={[
        styles.card,
        { backgroundColor: VARIANT_BACKGROUNDS[gap.variant] },
      ]}
    >
      <Image
        accessibilityIgnoresInvertColors
        contentFit="contain"
        source={images.mascotChecklist}
        style={styles.mascot}
      />
      <View style={styles.content}>
        <Text style={styles.title}>{gap.title}</Text>
        <Text style={styles.body}>{gap.body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
  card: {
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.default,
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    ...shadows.md,
  },
  content: {
    flex: 1,
  },
  mascot: {
    height: 40,
    width: 40,
  },
  title: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 16,
    lineHeight: 22,
  },
});
