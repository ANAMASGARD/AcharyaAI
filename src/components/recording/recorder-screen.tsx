import { useRouter } from 'expo-router';
import { useColorMode, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { getTabBarOverlayHeight } from "@/components/navigation/tab-bar-constants";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { RecorderReportPanel } from "@/components/recording/recorder-report-panel";
import { RecorderSessionCard } from "@/components/recording/recorder-session-card";
import { RecorderTranscriptPanel } from "@/components/recording/recorder-transcript-panel";
import { useRecorder } from "@/hooks/use-recorder";
import { spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { useRef } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const TAB_BAR_CLEARANCE = 100;

export function RecorderScreen(): React.ReactElement {
  const router = useRouter();
  const scrollRef = useRef<React.ElementRef<typeof KeyboardAwareScrollView>>(null);
  const colorMode = useColorMode();
  const styles = useThemeStyles(createStyles);

  const insets = useSafeAreaInsets();
  const dockClearance = Math.max(TAB_BAR_CLEARANCE, getTabBarOverlayHeight(insets.bottom) + spacing.lg);
  const {
    topic,
    subject,
    classLevel,
    isRecording,
    isStarting,
    isTranscribing,
    isAnalyzing,
    reportProgress,
    reportError,
    cancelAnalysis,
    timerLabel,
    canStartRecording,
    canSend,
    canNewClassroom,
    engineLabel,
    canRetry,
    statusMessage,
    mergedTranscript,
    report,
    classNotes,
    analysisError,
    setTopic,
    setSubject,
    setClassLevel,
    toggleRecording,
    sendForAnalysis,
    newClassroom,
    confirmPartialSend,
    retryAnalysis,
  } = useRecorder();

  const showPartialPrompt = false;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar style={colorMode === "dark" ? "light" : "dark"} />
      <KeyboardAwareScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: dockClearance }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <Text style={styles.title}>Record Class Session</Text>
        <Text style={styles.engine}>{engineLabel}</Text>
        <Text style={styles.engine} onPress={() => router.push("/(app)/profile/local-models")}>Change transcription in Run locally →</Text>

        <View style={styles.sessionGap}>
          <RecorderSessionCard
            analysisError={analysisError}
            canStartRecording={canStartRecording}
            classLevel={classLevel}
            isRecording={isRecording}
            isStarting={isStarting}
            showPartialPrompt={showPartialPrompt}
            statusMessage={statusMessage}
            subject={subject}
            timerLabel={timerLabel}
            topic={topic}
            onClassLevelChange={setClassLevel}
            onConfirmPartial={confirmPartialSend}
            onRetryAnalysis={canRetry ? () => {
              void retryAnalysis();
            } : undefined}
            onSubjectChange={setSubject}
            onToggleRecording={toggleRecording}
            onTopicChange={setTopic}
          />
        </View>

        <View style={styles.transcriptGap}>
          <RecorderTranscriptPanel
            disabled={!canSend}
            isTranscribing={isTranscribing}
            isAnalyzing={isAnalyzing}
            progress={reportProgress}
            error={reportError}
            reportReady={Boolean(report)}
            canNewClassroom={canNewClassroom}
            onCancel={cancelAnalysis}
            onNewClassroom={() => {
              if (newClassroom()) scrollRef.current?.scrollTo({ y: 0, animated: true });
            }}
            transcript={mergedTranscript}
            onSend={() => {
              void sendForAnalysis();
            }}
          />
        </View>

        {report ? (
          <View style={styles.reportGap}>
            <RecorderReportPanel classNotes={classNotes} report={report} />
          </View>
        ) : null}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  engine: { color: colors.foreground, fontFamily: fontFamilies.sans, paddingTop: 8, minHeight: 44 },
  safeArea: {
    backgroundColor: colors.cream,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: TAB_BAR_CLEARANCE,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  sessionGap: {
    marginTop: spacing.lg,
  },
  title: {
    color: colors.foreground,
    fontFamily: fontFamilies.head,
    fontSize: 24,
    lineHeight: 30,
  },
  transcriptGap: {
    marginTop: spacing.lg,
  },
  reportGap: {
    marginTop: spacing.lg,
  },
});
