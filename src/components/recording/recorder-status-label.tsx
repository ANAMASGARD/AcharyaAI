import { RecorderStartingLabel } from "@/components/recording/recorder-starting-label";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/typography";
import { Pressable, StyleSheet, Text } from "react-native";

type Props = Readonly<{
  message: string;
  isStarting?: boolean;
  analysisError?: string | null;
  showPartialPrompt?: boolean;
  onConfirmPartial?: () => void;
  onRetryAnalysis?: () => void;
}>;

export function RecorderStatusLabel({
  message,
  isStarting = false,
  analysisError,
  showPartialPrompt,
  onConfirmPartial,
  onRetryAnalysis,
}: Props): React.ReactElement {
  return (
    <>
      {isStarting ? (
        <RecorderStartingLabel />
      ) : (
        <Text style={styles.label}>{message}</Text>
      )}

      {analysisError ? (
        <Text style={styles.error}>{analysisError}</Text>
      ) : null}

      {analysisError && onRetryAnalysis ? (
        <Pressable accessibilityRole="button" onPress={onRetryAnalysis}>
          <Text style={styles.retry}>Tap to retry analysis</Text>
        </Pressable>
      ) : null}

      {showPartialPrompt && onConfirmPartial ? (
        <Pressable accessibilityRole="button" onPress={onConfirmPartial}>
          <Text style={styles.partial}>Send partial transcript anyway</Text>
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  error: {
    color: colors.destructive,
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    textAlign: "center",
  },
  label: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  partial: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
    textDecorationLine: "underline",
  },
  retry: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
    textDecorationLine: "underline",
  },
});
