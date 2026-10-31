import { RecorderDivider } from "@/components/recording/recorder-divider";
import { RecorderForm } from "@/components/recording/recorder-form";
import { RecorderNeoCard } from "@/components/recording/recorder-neo-card";
import { RecorderStatusLabel } from "@/components/recording/recorder-status-label";
import { RecorderTimerDisplay } from "@/components/recording/recorder-timer-display";
import {
  RECORDING_BUTTON_SIZE,
  RecordingButton,
} from "@/components/recording/recording-button";
import { spacing } from "@/theme/tokens";
import { StyleSheet, View } from "react-native";

/** Minimal space below the button for pulse rings when recording. */
const PULSE_CLEARANCE = 16;

type Props = Readonly<{
  topic: string;
  subject: string;
  classLevel: string;
  isRecording: boolean;
  isStarting?: boolean;
  timerLabel: string;
  canStartRecording: boolean;
  statusMessage: string;
  analysisError?: string | null;
  showPartialPrompt?: boolean;
  onConfirmPartial?: () => void;
  onRetryAnalysis?: () => void;
  onTopicChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onClassLevelChange: (value: string) => void;
  onToggleRecording: () => void;
}>;

export function RecorderSessionCard({
  topic,
  subject,
  classLevel,
  isRecording,
  isStarting = false,
  timerLabel,
  canStartRecording,
  statusMessage,
  analysisError,
  showPartialPrompt,
  onConfirmPartial,
  onRetryAnalysis,
  onTopicChange,
  onSubjectChange,
  onClassLevelChange,
  onToggleRecording,
}: Props): React.ReactElement {
  return (
    <RecorderNeoCard>
      <RecorderForm
        classLevel={classLevel}
        isRecording={isRecording}
        subject={subject}
        topic={topic}
        onClassLevelChange={onClassLevelChange}
        onSubjectChange={onSubjectChange}
        onTopicChange={onTopicChange}
      />

      <RecorderDivider />

      <View style={styles.controls}>
        <View style={styles.recordingBlock}>
          <RecorderTimerDisplay isRecording={isRecording} label={timerLabel} />
          <View style={styles.buttonStage}>
            <RecordingButton
              disabled={!canStartRecording || isStarting}
              isRecording={isRecording}
              onPress={onToggleRecording}
            />
          </View>
        </View>

        <View style={styles.statusWrap}>
          <RecorderStatusLabel
            analysisError={analysisError}
            isStarting={isStarting}
            message={statusMessage}
            showPartialPrompt={showPartialPrompt}
            onConfirmPartial={onConfirmPartial}
            onRetryAnalysis={onRetryAnalysis}
          />
        </View>
      </View>
    </RecorderNeoCard>
  );
}

const styles = StyleSheet.create({
  buttonStage: {
    alignItems: "center",
    height: RECORDING_BUTTON_SIZE + PULSE_CLEARANCE,
    justifyContent: "flex-start",
    overflow: "visible",
    width: "100%",
  },
  controls: {
    alignItems: "center",
    overflow: "visible",
    paddingTop: spacing.xs,
  },
  recordingBlock: {
    alignItems: "center",
    gap: 4,
    width: "100%",
  },
  statusWrap: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    width: "100%",
  },
});
