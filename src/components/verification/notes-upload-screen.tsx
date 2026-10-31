import { AnimatedMenuDots } from "@/components/verification/animated-menu-dots";
import { BookMultiSelect } from "@/components/verification/book-multi-select";
import { ChapterScopeSelect } from "@/components/verification/chapter-scope-select";
import { CurriculumSelectSheet } from "@/components/verification/curriculum-select-sheet";
import { UploadDropZone } from "@/components/verification/upload-drop-zone";
import { VerificationGapsTimeline } from "@/components/verification/verification-gaps-timeline";
import { WeightageBreakdown } from "@/components/verification/weightage-breakdown";
import { useCurriculumBooks } from "@/hooks/use-curriculum-books";
import { useCurriculumSelection } from "@/hooks/use-curriculum-selection";
import { useQuestionPaperUpload } from "@/hooks/use-question-paper-upload";
import { useQuestionPaperVerify } from "@/hooks/use-question-paper-verify";
import { getTeachingClassesForCurriculum } from "@/lib/teaching-classes";
import { usePreferencesStore } from "@/store/preferences-store";
import { colors } from "@/theme/colors";
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function NotesUploadScreen(): React.ReactElement {
  const router = useRouter();
  const teachingClassIds = usePreferencesStore((state) => state.teachingClassIds);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);

  const {
    selectedFile,
    isPicking,
    error,
    pickDocument,
    pickImage,
    takePhoto,
    clearFile,
  } = useQuestionPaperUpload();

  const {
    sheetVisible,
    expandedClassId,
    selection,
    uploadedBookName,
    openSheet,
    closeSheet,
    toggleClass,
    selectSubject,
    clearSelection,
    setUploadedBookName,
  } = useCurriculumSelection();

  const { books, isLoading: booksLoading, error: booksError } = useCurriculumBooks(
    selection?.classId ?? null,
    selection?.subjectId ?? null,
    true,
  );

  const {
    canVerify,
    isVerifying,
    error: verifyError,
    result,
    verify,
  } = useQuestionPaperVerify({
    selectedFile,
    selection,
    selectedBookIds,
    selectedChapterIds,
  });

  const curriculumClasses = useMemo(
    () => getTeachingClassesForCurriculum(teachingClassIds),
    [teachingClassIds],
  );

  const gaps = result?.gaps ?? [];

  const toggleBook = useCallback((bookId: string): void => {
    setSelectedChapterIds([]);
    setSelectedBookIds((current) =>
      current.includes(bookId)
        ? current.filter((id) => id !== bookId)
        : [...current, bookId],
    );
  }, []);

  const toggleChapter = useCallback((chapterId: string): void => {
    setSelectedChapterIds((current) =>
      current.includes(chapterId)
        ? current.filter((id) => id !== chapterId)
        : [...current, chapterId],
    );
  }, []);

  const openTeachingClasses = (): void => {
    closeSheet();
    router.push("/profile/teaching-classes");
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar style="dark" />

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

        <Text numberOfLines={2} style={styles.title}>
          Verify Question Paper
        </Text>

        <Pressable
          accessibilityLabel="Select curriculum"
          accessibilityRole="button"
          onPress={openSheet}
          style={({ pressed }) => [
            styles.menuButton,
            pressed ? styles.menuButtonPressed : null,
          ]}
        >
          <AnimatedMenuDots />
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          router.push("/notes/generate");
        }}
        style={styles.generateLink}
      >
        <Text style={styles.generateLinkText}>Generate a new paper instead →</Text>
      </Pressable>

      {selection ? (
        <View style={styles.selectionBanner}>
          <MaterialCommunityIcons
            color={colors.foreground}
            name="book-open-page-variant"
            size={18}
          />
          <Text numberOfLines={1} style={styles.selectionText}>
            {selection.classLabel} · {selection.subjectLabel}
          </Text>
          <Pressable
            accessibilityLabel="Clear curriculum selection"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => {
              clearSelection();
              setSelectedBookIds([]);
            }}
            style={styles.clearSelectionButton}
          >
            <MaterialCommunityIcons color={colors.foreground} name="close" size={18} />
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.explainerCard}>
          <Text style={styles.explainerTitle}>Check a paper against the syllabus</Text>
          <Text style={styles.hint}>Local preview · files stay on this device. Verification is not connected yet.</Text>
          <Text style={styles.explainerBody}>
            Upload a question paper (PDF, Word, or a photo) and Acharya checks it against the NCERT
            curriculum — chapter coverage, difficulty mix, and per-chapter weightage balance. Pick the
            class, subject, and books, then verify.
          </Text>
        </View>

        <Text style={styles.stepLabel}>1 · Upload your question paper</Text>

        <UploadDropZone
          canVerify={canVerify}
          error={error}
          isPicking={isPicking}
          isVerifying={isVerifying}
          onClearFile={() => {
            clearFile();
          }}
          onPickDocument={() => {
            void pickDocument();
          }}
          onPickImage={() => {
            void pickImage();
          }}
          onTakePhoto={() => {
            void takePhoto();
          }}
          onVerify={() => {
            void verify();
          }}
          selectedFile={selectedFile}
        />

        {selection ? (
          <View style={styles.stepSection}>
            <Text style={styles.stepLabel}>2 · Choose NCERT books</Text>
            <BookMultiSelect
              books={books}
              error={booksError}
              isLoading={booksLoading}
              onToggleBook={toggleBook}
              selectedBookIds={selectedBookIds}
            />
          </View>
        ) : (
          <Text style={styles.hint}>
            Tap the red menu to select class and subject before verifying.
          </Text>
        )}

        {selection && selectedBookIds.length > 0 ? (
          <View style={styles.stepSection}>
            <Text style={styles.stepLabel}>3 · Exam scope</Text>
            <ChapterScopeSelect
              books={books}
              onToggleChapter={toggleChapter}
              selectedBookIds={selectedBookIds}
              selectedChapterIds={selectedChapterIds}
            />
          </View>
        ) : null}

        {result?.extractionWarning === "image_unclear" ? (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              Image unclear — retake in better lighting for a more reliable check.
            </Text>
          </View>
        ) : null}

        {verifyError ? <Text style={styles.verifyError}>{verifyError}</Text> : null}

        {result ? (
          <View style={styles.stepSection}>
            <Text style={styles.stepLabel}>4 · Results</Text>
            {result.alignmentScore !== undefined ? (
              <Text style={styles.scoreText}>
                Alignment score: {Math.round(result.alignmentScore)}%
              </Text>
            ) : null}
            {result.difficultySummary ? (
              <Text style={styles.difficultyText}>{result.difficultySummary}</Text>
            ) : null}
            <WeightageBreakdown weightage={result.weightage} />
            <VerificationGapsTimeline gaps={gaps} />
          </View>
        ) : null}
      </ScrollView>

      <CurriculumSelectSheet
        classes={curriculumClasses}
        expandedClassId={expandedClassId}
        onClose={closeSheet}
        onOpenTeachingClasses={openTeachingClasses}
        onSelectSubject={(next) => {
          setSelectedBookIds([]);
          setSelectedChapterIds([]);
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

const styles = StyleSheet.create({
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
  clearSelectionButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: borderWidths.thin,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  difficultyText: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  explainerBody: {
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  explainerCard: {
    backgroundColor: colors.accent,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.default,
    gap: spacing.xs,
    padding: spacing.lg,
    ...shadows.sm,
  },
  explainerTitle: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 17,
    lineHeight: 22,
  },
  generateLink: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  generateLinkText: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 14,
    textDecorationLine: "underline",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  hint: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
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
    ...shadows.sm,
  },
  menuButtonPressed: {
    opacity: 0.88,
  },
  safeArea: {
    backgroundColor: colors.cream,
    flex: 1,
  },
  scoreText: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 16,
    lineHeight: 22,
  },
  scrollContent: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  selectionBanner: {
    alignItems: "center",
    backgroundColor: colors.mint,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xs,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectionText: {
    color: colors.foreground,
    flex: 1,
    fontFamily: fontFamilies.sansBold,
    fontSize: 14,
    lineHeight: 18,
  },
  stepLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 16,
    lineHeight: 22,
  },
  stepSection: {
    gap: spacing.sm,
  },
  title: {
    color: colors.foreground,
    flex: 1,
    fontFamily: fontFamilies.head,
    fontSize: 26,
    lineHeight: 30,
  },
  verifyError: {
    color: colors.destructive,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  warningBanner: {
    backgroundColor: colors.coralLight,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    padding: spacing.md,
  },
  warningText: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 14,
    lineHeight: 20,
  },
});
