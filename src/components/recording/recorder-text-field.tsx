import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { StyleSheet, TextInput } from "react-native";

type Props = Readonly<{
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  editable?: boolean;
}>;

export function RecorderTextField({
  value,
  onChangeText,
  placeholder,
  editable = true,
}: Props): React.ReactElement {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  return (
    <TextInput
      autoCapitalize="sentences"
      autoCorrect={false}
      editable={editable}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      style={[styles.input, !editable && styles.inputDisabled]}
      value={value}
      onChangeText={onChangeText}
    />
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  input: {
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.default,
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 16,
    minHeight: spacing.touch,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputDisabled: {
    opacity: 0.7,
  },
});
