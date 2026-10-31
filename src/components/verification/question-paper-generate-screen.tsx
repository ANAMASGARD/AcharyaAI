import { Pressable } from '@/components/feedback/pressable';
import { useColorMode, useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { GeneratedPaperResult } from "@/components/verification/generated-paper-result";
import { usePreviewFeature } from "@/components/preview/preview-provider";
import { AnimatedMenuDots } from "@/components/verification/animated-menu-dots";
import { BookMultiSelect } from "@/components/verification/book-multi-select";
import { CurriculumSelectSheet } from "@/components/verification/curriculum-select-sheet";
import { NeoButton } from "@/components/ui/neo-button";
import { useCurriculumBooks } from "@/hooks/use-curriculum-books";
import { useCurriculumSelection } from "@/hooks/use-curriculum-selection";
import { useQuestionPaperGenerate } from "@/hooks/use-question-paper-generate";
import { getTeachingClassesForCurriculum } from "@/lib/teaching-classes";
import { usePreferencesStore } from "@/store/preferences-store";
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import type { Difficulty, PaperType } from "@/types/question-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PAPER_TYPES: readonly { id: PaperType; label: string }[] = [
  { id: "unit_test", label: "Unit test" },
  { id: "half_yearly", label: "Half yearly" },
  { id: "surprise_quiz", label: "Surprise quiz" },
  { id: "model_paper", label: "Model paper" },
];

const DIFFICULTIES: readonly { id: Difficulty; label: string }[] = [
  { id: "easy", label: "Easy" },
  { id: "moderate", label: "Moderate" },
  { id: "hard", label: "Hard" },
  { id: "mixed", label: "Mixed" },
];

export function QuestionPaperGenerateScreen(): React.ReactElement {
  const colorMode = useColorMode();
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const router = useRouter();
  const teachingClassIds = usePreferencesStore((state) => state.teachingClassIds);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [paperType, setPaperType] = usePreviewFeature<PaperType>("paper-type", "unit_test");
  const [difficulty, setDifficulty] = usePreviewFeature<Difficulty>("paper-difficulty", "moderate");

  const {
    sheetVisible,
    expandedClassId,
    selection,
    uploadedBookName,
    openSheet,
    closeSheet,
    toggleClass,
    selectSubject,
    setUploadedBookName,
  } = useCurriculumSelection();

  const { books, isLoading: booksLoading, error: booksError } = useCurriculumBooks(
    selection?.classId ?? null,
    selection?.subjectId ?? null,
  );

  const { canGenerate, isGenerating, error, result, generate } =
    useQuestionPaperGenerate({
      selection,
      selectedBookIds,
      paperType,
      difficulty,
    });

  const curriculumClasses = useMemo(
    () => getTeachingClassesForCurriculum(teachingClassIds),
    [teachingClassIds],
  );

  const toggleBook = useCallback((bookId: string): void => {
    setSelectedBookIds((current) =>
      current.includes(bookId)
        ? current.filter((id) => id !== bookId)
        : [...current, bookId],
    );
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar style={colorMode === "dark" ? "light" : "dark"} />

      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Go back"
          onPress={() => {
            router.back();
          }}
          style={styles.backButton}
        >
          <MaterialCommunityIcons color={colors.foreground} name="arrow-left" size={22} />
        </Pressable>
        <Text style={styles.title}>Generate Paper</Text>
        <Pressable onPress={openSheet} style={styles.menuButton}>
          <AnimatedMenuDots />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.hint}>Local preview · curriculum and paper generation are not connected yet.</Text>
        {selection ? (
          <Text style={styles.selectionText}>
            {selection.classLabel} · {selection.subjectLabel}
          </Text>
        ) : (
          <Text style={styles.hint}>Select class and subject from the menu.</Text>
        )}

        <BookMultiSelect
          books={books}
          error={booksError}
          isLoading={booksLoading}
          onToggleBook={toggleBook}
          selectedBookIds={selectedBookIds}
        />

        <Text style={styles.sectionLabel}>Paper type</Text>
        <View style={styles.chipRow}>
          {PAPER_TYPES.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => {
                setPaperType(item.id);
              }}
              style={[styles.chip, paperType === item.id ? styles.chipSelected : null]}
            >
              <Text style={[styles.chipText, paperType === item.id && { color: colors.onAccent }]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Difficulty</Text>
        <View style={styles.chipRow}>
          {DIFFICULTIES.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => {
                setDifficulty(item.id);
              }}
              style={[styles.chip, difficulty === item.id ? styles.chipSelected : null]}
            >
              <Text style={[styles.chipText, difficulty === item.id && { color: colors.onAccent }]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <NeoButton
          disabled={!canGenerate}
          iconName="file-document-edit-outline"
          label={isGenerating ? "Generating…" : "Generate Paper"}
          onPress={() => {
            void generate();
          }}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {result ? <GeneratedPaperResult paper={result.paper} /> : null}
      </ScrollView>

      <CurriculumSelectSheet
        classes={curriculumClasses}
        expandedClassId={expandedClassId}
        onClose={closeSheet}
        onOpenTeachingClasses={() => {
          closeSheet();
          router.push("/profile/teaching-classes");
        }}
        onSelectSubject={(next) => {
          setSelectedBookIds([]);
          selectSubject(next);
        }}
        onToggleClass={toggleClass}
        onUploadedBook={setUploadedBookName}
        selection={selection}
        uploadedBookName={uploadedBookName}
        visible={sheetVisible}
      />
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
  chip: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.mint,
  },
  chipText: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 13,
  },
  errorText: {
    color: colors.destructive,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 14,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  hint: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
  },
  menuButton: {
    alignItems: "center",
    backgroundColor: colors.destructive,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thin,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  safeArea: {
    backgroundColor: colors.cream,
    flex: 1,
  },
  scrollContent: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  sectionLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 15,
  },
  selectionText: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 15,
  },
  title: {
    color: colors.foreground,
    flex: 1,
    fontFamily: fontFamilies.head,
    fontSize: 26,
    lineHeight: 30,
  },
});
