import { useColorMode, useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { usePreviewFeature } from "@/components/preview/preview-provider";
import { CommunityScreenHeader } from "@/components/community/community-screen-header";
import { useCommunityGroups } from "@/hooks/use-community-groups";
import { useTeacherDisplayName } from "@/hooks/use-teacher-display-name";
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function JoinGroupScreen(): React.ReactElement {
  const colorMode = useColorMode();
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const router = useRouter();
  const displayName = useTeacherDisplayName();
  const { joinGroup } = useCommunityGroups();
  const [joinCode, setJoinCode] = usePreviewFeature("community-join-code", "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async (): Promise<void> => {
    if (!joinCode.trim()) {
      setError("Enter a join code.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const group = await joinGroup(joinCode, displayName);
      router.replace(`/community/groups/${group.groupId}`);
    } catch (joinError) {
      setError(
        joinError instanceof Error ? joinError.message : "Failed to join group",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <StatusBar style={colorMode === "dark" ? "light" : "dark"} />
      <CommunityScreenHeader title="Join Group" />
      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Enter join code</Text>
        <TextInput
          autoCapitalize="characters"
          onChangeText={setJoinCode}
          placeholder="ABC123"
          placeholderTextColor={colors.mutedForeground}
          style={styles.input}
          value={joinCode}
        />
        <Text style={styles.hint}>Local preview · enter a code from a group saved on this device. Online groups are not connected.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={() => {
            void handleJoin();
          }}
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.onAccent} size="small" />
          ) : (
            <Text style={[styles.buttonLabel, { color: colors.onAccent }]}>Join group</Text>
          )}
        </Pressable>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thin,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 16,
    lineHeight: 22,
  },
  content: {
    padding: spacing.lg,
  },
  error: {
    color: colors.destructive,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  hint: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 20,
    letterSpacing: 2,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    textAlign: "center",
  },
  label: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 14,
    lineHeight: 18,
  },
  safeArea: {
    backgroundColor: colors.cream,
    flex: 1,
  },
});
