import { Pressable } from '@/components/feedback/pressable';
import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { RecorderNeoCard } from "@/components/recording/recorder-neo-card";
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  transcript?: string;
  isTranscribing?: boolean;
  disabled?: boolean;
  isAnalyzing?: boolean;
  progress?: string | null;
  error?: string | null;
  reportReady?: boolean;
  onCancel?: () => void;
  onSend?: () => void;
  onNewClassroom?: () => void;
}>;

export function RecorderTranscriptPanel({
  transcript,
  isTranscribing = false,
  disabled = false,
  onSend,
  isAnalyzing = false, progress, error, reportReady = false, onCancel, onNewClassroom,
}: Props): React.ReactElement {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const hasTranscript = Boolean(transcript?.trim());
  const sendDisabled = disabled || !hasTranscript || isTranscribing || isAnalyzing;

  let bodyContent: React.ReactNode;

  if (hasTranscript) {
    bodyContent = <Text style={styles.body}>{transcript}</Text>;
  } else if (isTranscribing) {
    bodyContent = (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={colors.foreground} size="small" />
        <Text style={styles.loadingText}>Transcribing your class…</Text>
      </View>
    );
  } else {
    bodyContent = (
      <Text style={[styles.body, styles.placeholder]}>
        Your class transcript appears here.
      </Text>
    );
  }

  return (
    <RecorderNeoCard style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.onAccent }]}>Class Transcribe</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.panelContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator={hasTranscript}
        style={styles.panel}
      >
        {bodyContent}
      </ScrollView>

      {isAnalyzing ? <View accessibilityLiveRegion="polite" style={styles.progress}>
        <ActivityIndicator color={colors.foreground} />
        <Text style={styles.loadingText}>{progress}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel report generation" onPress={onCancel} style={styles.cancelButton}>
          <Text style={styles.body}>Cancel</Text>
        </Pressable>
      </View> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
      <Pressable
        accessibilityLabel={reportReady ? "Report ready" : "Send transcript"}
        accessibilityRole="button"
        accessibilityState={{ disabled: sendDisabled, busy: isAnalyzing }}
        disabled={sendDisabled}
        onPress={onSend}
        style={({ pressed }) => [
          styles.sendButton,
          sendDisabled && styles.sendButtonDisabled,
          pressed && !sendDisabled && styles.sendButtonPressed,
        ]}
      >
        <MaterialCommunityIcons
          color={colors.primaryForeground}
          name={reportReady ? "check" : "send"}
          size={20}
        />
        <Text style={[styles.sendLabel, { color: colors.onAccent }]}>{isAnalyzing ? 'Generating…' : reportReady ? 'Report ready' : 'Send'}</Text>
      </Pressable>
      {reportReady ? <Pressable
        accessibilityRole="button"
        accessibilityLabel="Start a new classroom"
        accessibilityHint="Clears the recorder form so you can record another class"
        onPress={onNewClassroom}
        style={({ pressed }) => [styles.newButton, pressed && styles.sendButtonPressed]}
      >
        <MaterialCommunityIcons name="plus" size={26} color={colors.onAccent} />
      </Pressable> : null}
      </View>
    </RecorderNeoCard>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  progress: { alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  cancelButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg },
  error: { color: colors.destructive, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, fontFamily: fontFamilies.sans, fontSize: 14 },
  body: {
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 15,
    fontStyle: "normal",
    lineHeight: 22,
  },
  card: {
    overflow: "hidden",
    padding: 0,
  },
  header: {
    backgroundColor: colors.primary,
    borderBottomColor: colors.border,
    borderBottomWidth: borderWidths.thin,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  loadingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.sans,
    fontSize: 15,
    fontStyle: "italic",
  },
  panel: {
    backgroundColor: colors.background,
    maxHeight: 220,
  },
  panelContent: {
    minHeight: 100,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  placeholder: {
    color: colors.mutedForeground,
    fontStyle: "italic",
  },
  actions: { flexDirection: 'row', gap: spacing.sm, margin: spacing.lg, marginTop: spacing.sm },
  newButton: {
    alignItems: 'center', justifyContent: 'center', minWidth: spacing.touch, minHeight: spacing.touch,
    backgroundColor: colors.primary, borderColor: colors.border, borderRadius: radii.md,
    borderWidth: borderWidths.default, ...shadows.sm,
  },
  sendButton: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.default,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: spacing.touch,
    ...shadows.sm,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  sendButtonPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    ...shadows.xs,
  },
  sendLabel: {
    color: colors.primaryForeground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 15,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
