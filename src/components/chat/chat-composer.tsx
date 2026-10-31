import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { VoiceInputPreview } from '@/components/chat/voice-input-preview';
import { useThemeColors, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { VoiceWaveformIcon } from "@/components/chat/voice-waveform-icon";
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import type { VoiceInputStatus } from "@/types/chat";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Props = Readonly<{
  draftText: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  onVoiceAgent: () => void;
  voiceInputStatus: VoiceInputStatus;
  disabled?: boolean;
}>;

export function ChatComposer({
  draftText,
  onChangeText,
  onSend,
  onVoiceAgent,
  voiceInputStatus,
  disabled = false,
}: Props): React.ReactElement {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const [voicePreview, setVoicePreview] = useState(false);
  const closePreview = useCallback(() => setVoicePreview(false), []);
  useFocusEffect(useCallback(() => () => setVoicePreview(false), []));

  const isRecording = voiceInputStatus === "recording";
  const isTranscribing = voiceInputStatus === "transcribing";
  const voiceDisabled = disabled || isTranscribing;
  const canSend =
    draftText.trim().length > 0 && !disabled && !isTranscribing;

  const inputPlaceholder = isRecording
    ? "Listening… tap mic to stop"
    : isTranscribing
      ? "Transcribing speech…"
      : "Ask anything…";

  if (voicePreview) {
    return <Animated.View entering={FadeIn.duration(150)} style={styles.wrap}><VoiceInputPreview onClose={closePreview} /></Animated.View>;
  }

  return (
    <View style={styles.wrap}>
      <TextInput
        editable={!disabled && !isTranscribing && !isRecording}
        multiline
        onChangeText={onChangeText}
        onSubmitEditing={() => {
          if (draftText.trim()) {
            onSend();
          }
        }}
        placeholder={inputPlaceholder}
        placeholderTextColor={colors.mutedForeground}
        returnKeyType="send"
        style={styles.input}
        value={draftText}
      />

      <View style={styles.toolbar}>
        <Pressable
          accessibilityLabel={
            isRecording ? "Stop voice" : "Start voice"
          }
          disabled={voiceDisabled}
          onPress={onVoiceAgent}
          style={({ pressed }) => [
            styles.voiceButton,
            isRecording && styles.voiceButtonActive,
            pressed && !voiceDisabled ? styles.pressed : null,
          ]}
        >
          <VoiceWaveformIcon color={colors.onAccent} height={16} />
          <Text style={styles.voiceLabel}>
            {isRecording ? "Stop" : "Voice"}
          </Text>
        </Pressable>

        <View style={styles.toolbarSpacer} />

        <View style={styles.rightActions}>
          <Pressable
            accessibilityLabel={
              isRecording ? "Stop voice" : "Voice message"
            }
            disabled={disabled || isTranscribing}
            onPress={() => { Keyboard.dismiss(); setVoicePreview(true); }}
            style={({ pressed }) => [
              styles.micCircle,
              isRecording && styles.micRecording,
              pressed && !disabled ? styles.pressed : null,
            ]}
          >
            {isTranscribing ? (
              <ActivityIndicator color={colors.onAccent} size="small" />
            ) : (
              <MaterialCommunityIcons
                color={colors.onAccent}
                name={isRecording ? "stop" : "microphone"}
                size={24}
              />
            )}
          </Pressable>

          <Pressable
            accessibilityLabel="Send message"
            disabled={!canSend}
            onPress={onSend}
            style={({ pressed }) => [
              styles.sendCircle,
              !canSend && styles.sendDisabled,
              pressed && canSend ? styles.pressed : null,
            ]}
          >
            <MaterialCommunityIcons
              color={colors.onAccent}
              name="arrow-up"
              size={24}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  input: {
    backgroundColor: colors.card,
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 16,
    lineHeight: 22,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    textAlignVertical: "top",
  },
  micCircle: {
    alignItems: "center",
    backgroundColor: colors.sky,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: borderWidths.thin,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  micRecording: {
    backgroundColor: colors.coral,
  },
  pressed: {
    opacity: 0.85,
  },
  rightActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  sendCircle: {
    alignItems: "center",
    backgroundColor: "#FF8EC8",
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: borderWidths.thin,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  sendDisabled: {
    opacity: 0.45,
  },
  toolbar: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  toolbarSpacer: {
    flex: 1,
  },
  voiceButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thin,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  voiceButtonActive: {
    backgroundColor: colors.coral,
  },
  voiceLabel: {
    color: colors.onAccent,
    fontFamily: fontFamilies.sansBold,
    fontSize: 12,
  },
  wrap: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.xl,
    borderWidth: borderWidths.default,
    overflow: "hidden",
  },
});
