import { Pressable } from '@/components/feedback/pressable';
import { useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { RecorderStartingLabel } from "@/components/recording/recorder-starting-label";
import { fontFamilies } from "@/theme/typography";
import { StyleSheet, Text } from "react-native";

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
  const styles = useThemeStyles(createStyles);

  return (
    <>
      {isStarting ? (
        <RecorderStartingLabel />
      ) : (
        message ? <Text style={styles.label}>{message}</Text> : null
      )}

      {analysisError ? (
        <Text style={styles.error}>{analysisError}</Text>
      ) : null}

      {onRetryAnalysis ? (
        <Pressable accessibilityRole="button" onPress={onRetryAnalysis}>
          <Text style={styles.retry}>Retry transcription</Text>
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
