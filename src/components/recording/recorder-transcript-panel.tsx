import { RecorderNeoCard } from "@/components/recording/recorder-neo-card";
import { colors } from "@/theme/colors";
import { borderWidths, radii, shadows, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type Props = Readonly<{
  transcript?: string;
  isTranscribing?: boolean;
  disabled?: boolean;
  onSend?: () => void;
}>;

export function RecorderTranscriptPanel({
  transcript,
  isTranscribing = false,
  disabled = false,
  onSend,
}: Props): React.ReactElement {
  const hasTranscript = Boolean(transcript?.trim());
  const sendDisabled = disabled || !hasTranscript || isTranscribing;

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
        Transcript will appear here after you stop recording.
      </Text>
    );
  }

  return (
    <RecorderNeoCard style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Class Transcribe</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.panelContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator={hasTranscript}
        style={styles.panel}
      >
        {bodyContent}
      </ScrollView>

      <Pressable
        accessibilityLabel="Send transcript"
        accessibilityRole="button"
        accessibilityState={{ disabled: sendDisabled }}
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
          name="send"
          size={20}
        />
        <Text style={styles.sendLabel}>Send</Text>
      </Pressable>
    </RecorderNeoCard>
  );
}

const styles = StyleSheet.create({
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
  sendButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.default,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    margin: spacing.lg,
    marginTop: spacing.sm,
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
