import { Pressable } from '@/components/feedback/pressable';
import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { borderWidths, radii, shadows, spacing } from '@/theme/tokens';

type NeoBrutalCardProps = PressableProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  onPress?: () => void;
};

export function NeoBrutalCard({
  children,
  style,
  backgroundColor,
  onPress,
  ...pressableProps
}: NeoBrutalCardProps): React.ReactElement {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const content = (
    <View style={[styles.card, { backgroundColor: backgroundColor ?? colors.card }, style]}>{children}</View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
      {...pressableProps}>
      {content}
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.default,
    padding: spacing.lg,
    ...shadows.md,
  },
  pressed: {
    transform: [{ translateX: shadows.md.shadowOffset.width }, { translateY: shadows.md.shadowOffset.height }],
  },
});
