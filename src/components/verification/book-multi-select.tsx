import { colors } from "@/theme/colors";
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import type { CurriculumBookSummary } from "@/types/question-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  books: readonly CurriculumBookSummary[];
  selectedBookIds: readonly string[];
  isLoading: boolean;
  error: string | null;
  onToggleBook: (bookId: string) => void;
}>;

export function BookMultiSelect({
  books,
  selectedBookIds,
  isLoading,
  error,
  onToggleBook,
}: Props): React.ReactElement {
  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={colors.foreground} size="small" />
        <Text style={styles.hint}>Loading NCERT books…</Text>
      </View>
    );
  }

  if (error) {
    return <Text style={styles.errorText}>{error}</Text>;
  }

  if (books.length === 0) {
    return (
      <Text style={styles.hint}>
        No preloaded books for this class yet. Run curriculum ingest on the server.
      </Text>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Select NCERT books</Text>
      <View style={styles.chipRow}>
        {books.map((book) => {
          const selected = selectedBookIds.includes(book.bookId);

          return (
            <Pressable
              key={book.bookId}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                onToggleBook(book.bookId);
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
                size={18}
              />
              <Text style={styles.chipText}>
                {book.title}
                {book.isPreloaded ? " · Ready" : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    flexDirection: "row",
    gap: spacing.xs,
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
    backgroundColor: colors.mint,
  },
  chipText: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 13,
    lineHeight: 18,
  },
  container: {
    gap: spacing.sm,
  },
  errorText: {
    color: colors.destructive,
    fontFamily: fontFamilies.sansMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  hint: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 15,
    lineHeight: 20,
  },
  loadingWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
});
