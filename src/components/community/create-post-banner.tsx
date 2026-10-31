import { Pressable } from '@/components/feedback/pressable';
import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { images } from "@/constants/images";
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  onPress: () => void;
}>;

export function CreatePostBanner({ onPress }: Props): React.ReactElement {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={[styles.buttonLabel, { color: colors.onAccent }]}>+ Create Post</Text>
      </Pressable>
      <Image
        accessibilityLabel="Teacher with pencil"
        contentFit="contain"
        source={images.mascotPencil}
        style={styles.mascot}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderRadius: radii.xl,
    borderWidth: borderWidths.thin,
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    ...shadows.sm,
  },
  buttonLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ translateY: 2 }],
  },
  mascot: {
    height: 48,
    width: 48,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
});
