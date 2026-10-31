import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { useProfileAccount } from "@/hooks/use-profile-account";
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

type Props = Readonly<{
  style?: StyleProp<ViewStyle>;
}>;

export function ProfileAccountFallback({
  style,
}: Props): React.ReactElement {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const { openAccountPortal, hasAccountPortal, isOpeningPortal, actionError } = useProfileAccount();

  return (
    <View style={[styles.fallback, style]}>
      <View style={styles.fallbackCard}>
        <Text style={styles.fallbackTitle}>Manage account & security</Text>
        <Text style={styles.fallbackBody}>
          {hasAccountPortal
            ? 'Manage your email, security, connected accounts, and active devices in your secure account page. You may be asked to sign in again.'
            : 'Account settings are unavailable right now. You can still edit your name and photo from Profile.'}
        </Text>
        {hasAccountPortal ? (
          <Pressable
            accessibilityRole="button"
            disabled={isOpeningPortal}
            accessibilityState={{ disabled: isOpeningPortal, busy: isOpeningPortal }}
            onPress={() => {
              void openAccountPortal();
            }}
            style={({ pressed }) => [
              styles.portalButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={[styles.portalButtonText, { color: colors.onAccent }]}>
              {isOpeningPortal ? 'Opening account settings…' : 'Open account settings in browser'}
            </Text>
          </Pressable>
        ) : null}
        {actionError ? <Text accessibilityRole="alert" style={styles.error}>{actionError}</Text> : null}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  fallback: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  fallbackBody: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  error: { color: colors.destructive, fontFamily: fontFamilies.sans, marginTop: spacing.md },
  fallbackCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thin,
    padding: spacing.lg,
  },
  fallbackTitle: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 20,
    lineHeight: 26,
  },
  portalButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thin,
    justifyContent: "center",
    marginTop: spacing.lg,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  portalButtonText: {
    color: colors.primaryForeground,
    fontFamily: fontFamilies.head,
    fontSize: 16,
  },
  pressed: {
    opacity: 0.9,
  },
});
