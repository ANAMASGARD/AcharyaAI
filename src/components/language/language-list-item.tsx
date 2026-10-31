import { Pressable } from '@/components/feedback/pressable';
import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import type { TeachingLanguage } from "@/types/language";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/typography";
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

const SELECTED_GREEN = "#16A34A";

const BADGE_ACCENTS = [
  colors.mint,
  colors.sky,
  colors.coral,
  colors.lime,
  colors.lavender,
] as const;

type LanguageListItemProps = Readonly<{
  language: TeachingLanguage;
  isSelected: boolean;
  badgeIndex: number;
  onPress: () => void;
}>;

function getBadgeLabel(language: TeachingLanguage): string {
  const native = language.nameNative.trim();
  if (native.length <= 3) {
    return native;
  }
  return native.slice(0, 2);
}

export function LanguageListItem({
  language,
  isSelected,
  badgeIndex,
  onPress,
}: LanguageListItemProps): React.ReactElement {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const accent = BADGE_ACCENTS[badgeIndex % BADGE_ACCENTS.length];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${language.nameEnglish}, ${language.nameNative}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        isSelected ? styles.rowSelected : null,
        pressed ? styles.rowPressed : null,
      ]}
    >
      <View style={[styles.badge, { backgroundColor: accent }]}>
        <Text style={[styles.badgeText, { color: colors.onAccent }]}>{getBadgeLabel(language)}</Text>
      </View>

      <View style={styles.textWrap}>
        <Text style={[styles.nameEnglish, isSelected && { color: colors.onAccent }]}>{language.nameEnglish}</Text>
        <Text style={[styles.nameNative, isSelected && { color: colors.onAccent }]}>{language.nameNative}</Text>
        <Text style={[styles.code, isSelected && { color: colors.onAccent }]}>{language.languageCode}</Text>
      </View>

      {isSelected ? (
        <MaterialCommunityIcons
          color={SELECTED_GREEN}
          name="check-circle"
          size={30}
        />
      ) : (
        <MaterialCommunityIcons
          color={colors.foreground}
          name="chevron-right"
          size={26}
        />
      )}
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: borderWidths.default,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    marginBottom: spacing.sm,
    borderRadius: radii.lg,
    minHeight: 72,
    ...shadows.sm,
  },
  rowSelected: {
    borderWidth: borderWidths.thick,
    backgroundColor: colors.primary,
    ...shadows.md,
  },
  rowPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOpacity: 0,
    elevation: 0,
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: borderWidths.default,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  badgeText: {
    fontFamily: fontFamilies.sansBold,
    fontSize: 15,
    color: colors.foreground,
  },
  textWrap: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  nameEnglish: {
    fontFamily: fontFamilies.sansBold,
    fontSize: 18,
    color: colors.foreground,
  },
  nameNative: {
    fontFamily: fontFamilies.sans,
    fontSize: 15,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  code: {
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
});
