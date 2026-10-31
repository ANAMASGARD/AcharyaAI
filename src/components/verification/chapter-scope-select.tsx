import { colors } from "@/theme/colors";
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import type { CurriculumBookSummary } from "@/types/question-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  books: readonly CurriculumBookSummary[];
  selectedBookIds: readonly string[];
  selectedChapterIds: readonly string[];
  onToggleChapter: (chapterId: string) => void;
}>;

/**
 * Optional exam-scope selector: narrow the weightage check to specific chapters
 * (e.g. the chapters in a half-yearly). Collapsed by default; leaving it empty
 * weighs all chapters of the selected books.
 */
export function ChapterScopeSelect({
  books,
  selectedBookIds,
  selectedChapterIds,
  onToggleChapter,
}: Props): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  const scopedBooks = books.filter(
    (book) => selectedBookIds.includes(book.bookId) && (book.chapters?.length ?? 0) > 0,
  );

  const selectedCount = selectedChapterIds.length;
  const summary = selectedCount > 0 ? `${selectedCount} selected` : "All chapters";

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => {
          setExpanded((current) => !current);
        }}
        style={({ pressed }) => [styles.header, pressed ? styles.headerPressed : null]}
      >
        <Text style={styles.headerLabel}>Exam scope (optional)</Text>
        <View style={styles.headerRight}>
          <Text style={styles.summaryText}>{summary}</Text>
          <MaterialCommunityIcons
            color={colors.foreground}
            name={expanded ? "chevron-up" : "chevron-down"}
            size={20}
          />
        </View>
      </Pressable>

      {expanded ? (
        scopedBooks.length === 0 ? (
          <Text style={styles.hint}>
            Select a book above to limit the check to specific chapters.
          </Text>
        ) : (
          <View style={styles.body}>
            <Text style={styles.hint}>
              Pick the chapters in this exam, or leave empty to check all of them.
            </Text>
            {scopedBooks.map((book) => (
              <View key={book.bookId} style={styles.bookGroup}>
                <Text style={styles.bookTitle}>{book.title}</Text>
                <View style={styles.chipRow}>
                  {(book.chapters ?? []).map((chapter) => {
                    const selected = selectedChapterIds.includes(chapter.chapterId);

                    return (
                      <Pressable
                        key={chapter.chapterId}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => {
                          onToggleChapter(chapter.chapterId);
                        }}
                        style={({ pressed }) => [
                          styles.chip,
                          selected ? styles.chipSelected : null,
                          pressed ? styles.chipPressed : null,
                        ]}
                      >
                        <MaterialCommunityIcons
                          color={colors.foreground}
                          name={selected ? "checkbox-marked" : "checkbox-blank-outline"}
                          size={16}
                        />
                        <Text numberOfLines={1} style={styles.chipText}>
                          {chapter.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.md,
  },
  bookGroup: {
    gap: spacing.sm,
  },
  bookTitle: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 14,
    lineHeight: 18,
  },
  chip: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    flexDirection: "row",
    gap: spacing.xs,
    maxWidth: "100%",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  chipPressed: {
    opacity: 0.9,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.sky,
  },
  chipText: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 13,
    lineHeight: 18,
  },
  container: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    gap: spacing.sm,
    padding: spacing.md,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerLabel: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 15,
    lineHeight: 20,
  },
  headerPressed: {
    opacity: 0.85,
  },
  headerRight: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  hint: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  summaryText: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 13,
  },
});
