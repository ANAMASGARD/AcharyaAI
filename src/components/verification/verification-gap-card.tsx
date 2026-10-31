import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
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
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  return (
    <View
      accessibilityLabel={`${gap.title}. ${gap.body}`}
      style={[
        styles.card,
        { backgroundColor: gap.variant === "neutral" ? colors.card : VARIANT_BACKGROUNDS[gap.variant] },
      ]}
    >
      <Image
        accessibilityIgnoresInvertColors
        contentFit="contain"
        source={images.mascotChecklist}
        style={styles.mascot}
      />
      <View style={styles.content}>
        <Text style={[styles.title, gap.variant === "neutral" && { color: colors.foreground }]}>{gap.title}</Text>
        <Text style={[styles.body, gap.variant === "neutral" && { color: colors.foreground }]}>{gap.body}</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  body: {
    color: colors.onAccent,
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
    color: colors.onAccent,
    fontFamily: fontFamilies.sansBold,
    fontSize: 16,
    lineHeight: 22,
  },
});
