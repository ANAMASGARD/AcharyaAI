import { useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { StyleSheet, Text, View } from 'react-native';

import { borderWidths, radii, shadows, spacing } from '@/theme/tokens';
import { fontFamilies } from '@/theme/typography';
import type { GeneratedPaper } from '@/types/question-paper';

export function GeneratedPaperResult({ paper }: { paper: GeneratedPaper }): React.ReactElement {
  const styles = useThemeStyles(createStyles);

  return (
          <View style={styles.paperCard}>
            <Text style={styles.paperTitle}>{paper.title}</Text>
            <Text style={styles.paperMeta}>
              Draft · {paper.totalMarks} proposed marks · {paper.difficulty}
            </Text>
            {paper.sections.map((section) => (
              <View key={section.title} style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>
                  {section.title} ({section.marks} marks)
                </Text>
                {section.questions.map((question) => (
                  <Text key={question.number} style={styles.questionText}>
                    {question.number}. {question.text} ({question.marks}m)
                  </Text>
                ))}
              </View>
            ))}
          </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  paperCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thin,
    gap: spacing.sm,
    padding: spacing.md,
    ...shadows.sm,
  },
  paperMeta: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
  },
  paperTitle: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 20,
    lineHeight: 26,
  },
  questionText: {
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  sectionBlock: {
    marginTop: spacing.sm,
  },
  sectionTitle: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 15,
    lineHeight: 20,
  },
});
