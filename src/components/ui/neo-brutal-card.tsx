import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme/colors';
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
  backgroundColor = colors.card,
  onPress,
  ...pressableProps
}: NeoBrutalCardProps): React.ReactElement {
  const content = (
    <View style={[styles.card, { backgroundColor }, style]}>{children}</View>
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

const styles = StyleSheet.create({
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
