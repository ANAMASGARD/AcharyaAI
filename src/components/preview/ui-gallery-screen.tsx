import { Pressable } from '@/components/feedback/pressable';
import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecorderReportPanel } from '@/components/recording/recorder-report-panel';
import { GeneratedPaperResult } from '@/components/verification/generated-paper-result';
import { VerificationGapsTimeline } from '@/components/verification/verification-gaps-timeline';
import { WeightageBreakdown } from '@/components/verification/weightage-breakdown';
import { borderWidths, radii, spacing } from '@/theme/tokens';
import { fontFamilies } from '@/theme/typography';
import type { TeachingReport } from '@/types/recorder';
import type { VerificationGap } from '@/types/notes-verification';
import type { GeneratedPaper, WeightageReport } from '@/types/question-paper';

const report: TeachingReport = {
  classroomEnvironment: 'Sample reflection: pupils discuss the example in pairs.',
  whatWentWrong: 'Sample reflection: allow more time for the final question.',
  areasToImprove: 'Sample suggestion: add a short check for understanding.',
  topicSpecificFeedback: 'Sample suggestion: illustrate equivalent fractions with a number line.',
  overallScore: 78,
};

const gaps: readonly VerificationGap[] = [
  { id: 'sample-coverage', title: 'Coverage example', body: 'This sample card shows a chapter that needs another question.', variant: 'coral' },
  { id: 'sample-difficulty', title: 'Difficulty example', body: 'This sample card shows a suggestion to add a reasoning question.', variant: 'coralLight' },
  { id: 'sample-balanced', title: 'Balanced section example', body: 'This sample card shows a section with balanced coverage.', variant: 'neutral' },
];

const weightage: WeightageReport = {
  totalMarks: 20,
  balanceScore: 75,
  outOfSyllabusMarks: 1,
  outOfSyllabusPct: 5,
  contentInsight: 'Sample insight for checking the layout of a longer curriculum suggestion.',
  chapters: [
    { chapterTitle: 'Integers', expectedPct: 25, actualPct: 25, marks: 5, delta: 0, status: 'aligned' },
    { chapterTitle: 'Fractions and decimals', expectedPct: 25, actualPct: 50, marks: 10, delta: 25, status: 'over' },
    { chapterTitle: 'Data handling', expectedPct: 25, actualPct: 20, marks: 4, delta: -5, status: 'under' },
    { chapterTitle: 'Simple equations', expectedPct: 25, actualPct: 0, marks: 0, delta: -25, status: 'missing' },
  ],
};

const paper: GeneratedPaper = {
  title: 'Sample mathematics paper',
  paperType: 'unit_test',
  difficulty: 'mixed',
  totalMarks: 5,
  sections: [
    { title: 'Section A', marks: 2, questions: [{ number: 1, text: 'Write one fraction equivalent to 1/2.', marks: 2, difficulty: 'easy' }] },
    { title: 'Section B', marks: 3, questions: [{ number: 2, text: 'Explain how a number line can compare two fractions.', marks: 3, difficulty: 'moderate' }] },
  ],
};

type GallerySection = 'report' | 'verification' | 'paper';
const sections: readonly GallerySection[] = ['report', 'verification', 'paper'];

/** Explicit developer fixtures: never returned from feature hooks or stored as teacher data. */
export function UiGalleryScreen(): React.ReactElement {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const router = useRouter();
  const [section, setSection] = useState<GallerySection>('report');
  return <SafeAreaView style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Text style={styles.body}>← Back</Text></Pressable>
      <Text style={styles.title}>UI fixture gallery</Text>
      <Text style={styles.body}>Development preview · all reports, scores, and questions here are sample fixtures. They are not AI output or saved teaching records.</Text>
      <View style={styles.tabs}>
        {sections.map((item) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: section === item }} onPress={() => setSection(item)} style={[styles.tab, section === item && styles.selected]}><Text style={[styles.body, section === item && { color: colors.onAccent }]}>{item}</Text></Pressable>)}
      </View>
      {section === 'report' ? <RecorderReportPanel report={report} classNotes={'Sample class notes\n\nEquivalent fractions represent the same quantity.\nExample: 1/2 = 2/4.\n\nDiscuss an example using a number line.'} /> : null}
      {section === 'verification' ? <><WeightageBreakdown weightage={weightage} /><VerificationGapsTimeline gaps={gaps} /></> : null}
      {section === 'paper' ? <GeneratedPaperResult paper={paper} /> : null}
    </ScrollView>
  </SafeAreaView>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: spacing.lg, paddingBottom: spacing['2xl'], gap: spacing.lg },
  title: { fontFamily: fontFamilies.head, fontSize: 26, color: colors.foreground },
  body: { fontFamily: fontFamilies.sans, fontSize: 15, lineHeight: 22, color: colors.foreground },
  back: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tab: { minHeight: 44, paddingHorizontal: spacing.md, justifyContent: 'center', borderWidth: borderWidths.thin, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.card },
  selected: { backgroundColor: colors.primary },
});
