import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/typography";
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, TextInput, View } from "react-native";

type LanguageSearchBarProps = Readonly<{
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}>;

export function LanguageSearchBar({
  value,
  onChangeText,
  placeholder = "Search languages",
}: LanguageSearchBarProps): React.ReactElement {
  return (
    <View style={styles.wrap}>
      <MaterialCommunityIcons
        color={colors.mutedForeground}
        name="magnify"
        size={22}
        style={styles.icon}
      />
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: borderWidths.default,
    borderColor: colors.border,
    backgroundColor: colors.input,
    minHeight: spacing.touch,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    ...shadows.sm,
  },
  icon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontFamily: fontFamilies.sans,
    fontSize: 16,
    color: colors.foreground,
    paddingVertical: spacing.sm,
  },
});
