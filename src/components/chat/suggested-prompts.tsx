import { SUGGESTED_CHAT_PROMPTS } from "@/constants/chat-prompts";
import { colors } from "@/theme/colors";
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  onSelect: (message: string) => void;
  disabled?: boolean;
}>;

export function SuggestedPrompts({
  onSelect,
  disabled = false,
}: Props): React.ReactElement {
  return (
    <View style={styles.wrap}>
      {SUGGESTED_CHAT_PROMPTS.map((prompt) => (
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          key={prompt.id}
          onPress={() => {
            onSelect(prompt.message);
          }}
          style={({ pressed }) => [
            styles.card,
            disabled && styles.disabled,
            pressed && !disabled ? styles.pressed : null,
          ]}
        >
          <Text style={styles.label}>{prompt.label}</Text>
          <Text style={styles.message}>{prompt.message}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.default,
    padding: spacing.lg,
    ...shadows.md,
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 12,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  message: {
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 15,
    lineHeight: 22,
  },
  pressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  wrap: {
    gap: spacing.md,
  },
});
