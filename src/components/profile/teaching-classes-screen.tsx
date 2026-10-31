import { useColorMode, useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { NeoButton } from "@/components/ui/neo-button";
import { RECORDER_CLASS_LEVELS } from "@/data/recorder-options";
import { formatTeachingClassesSummary } from "@/lib/teaching-classes";
import { usePreferencesStore } from "@/store/preferences-store";
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function TeachingClassesScreen(): React.ReactElement {
  const colorMode = useColorMode();
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const router = useRouter();
  const storedClassIds = usePreferencesStore((state) => state.teachingClassIds);
  const setTeachingClassIds = usePreferencesStore(
    (state) => state.setTeachingClassIds,
  );

  const [draftClassIds, setDraftClassIds] = useState<string[]>(storedClassIds);

  const toggleDraftClass = (classId: string): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDraftClassIds((current) =>
      current.includes(classId)
        ? current.filter((id) => id !== classId)
        : [...current, classId],
    );
  };

  const handleSave = (): void => {
    setTeachingClassIds(draftClassIds);
    router.back();
  };

  const draftSummary = formatTeachingClassesSummary(draftClassIds);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style={colorMode === "dark" ? "light" : "dark"} />

      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => {
            router.back();
          }}
          style={({ pressed }) => [
            styles.backButton,
            pressed ? styles.backButtonPressed : null,
          ]}
        >
          <MaterialCommunityIcons color={colors.foreground} name="arrow-left" size={22} />
        </Pressable>
        <Text style={styles.title}>Select classes</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lead}>
          Choose every class you teach right now. Notes verification and curriculum
          pickers will only show these grades.
        </Text>

        <View style={styles.summaryCard}>
          <Text style={[styles.summaryLabel, { color: colors.onAccent }]}>Selected</Text>
          <Text style={[styles.summaryValue, { color: colors.onAccent }]}>{draftSummary}</Text>
        </View>

        <View style={styles.list}>
          {RECORDER_CLASS_LEVELS.map((classOption) => {
            const isSelected = draftClassIds.includes(classOption.id);

            return (
              <Pressable
                key={classOption.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                onPress={() => {
                  toggleDraftClass(classOption.id);
                }}
                style={({ pressed }) => [
                  styles.classRow,
                  isSelected ? styles.classRowSelected : null,
                  pressed ? styles.rowPressed : null,
                ]}
              >
                <Text style={[styles.classLabel, isSelected && { color: colors.onAccent }]}>{classOption.label}</Text>
                <View
                  style={[
                    styles.checkBox,
                    isSelected ? styles.checkBoxSelected : null,
                  ]}
                >
                  {isSelected ? (
                    <MaterialCommunityIcons
                      color={colors.onAccent}
                      name="check"
                      size={18}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <NeoButton
          disabled={draftClassIds.length === 0}
          label="Save classes"
          onPress={handleSave}
        />
        {draftClassIds.length === 0 ? (
          <Text style={styles.footerHint}>Pick at least one class to continue.</Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.default,
    height: 40,
    justifyContent: "center",
    width: 40,
    ...shadows.sm,
  },
  backButtonPressed: {
    opacity: 0.9,
    shadowOffset: { width: 1, height: 1 },
    transform: [{ translateX: 1 }, { translateY: 1 }],
  },
  checkBox: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: borderWidths.thin,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  checkBoxSelected: {
    backgroundColor: colors.primary,
  },
  classLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 17,
    lineHeight: 22,
  },
  classRow: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.default,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: spacing.touch,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadows.sm,
  },
  classRowSelected: {
    backgroundColor: colors.mint,
  },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: borderWidths.thin,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  footerHint: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  lead: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 15,
    lineHeight: 22,
  },
  list: {
    gap: spacing.sm,
  },
  rowPressed: {
    opacity: 0.9,
  },
  safeArea: {
    backgroundColor: colors.cream,
    flex: 1,
  },
  scrollContent: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  summaryCard: {
    backgroundColor: colors.lavender,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thin,
    gap: spacing.xs,
    padding: spacing.lg,
    ...shadows.sm,
  },
  summaryLabel: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  summaryValue: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 16,
    lineHeight: 22,
  },
  title: {
    color: colors.foreground,
    flex: 1,
    fontFamily: fontFamilies.head,
    fontSize: 24,
    lineHeight: 30,
  },
});
