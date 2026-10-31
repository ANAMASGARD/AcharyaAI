import { Pressable } from '@/components/feedback/pressable';
import { ChatAttachmentMenu } from '@/components/chat/chat-attachment-menu';
import { ChatAttachments } from '@/components/chat/chat-attachments';
import { useChatAttachments } from '@/hooks/use-chat-attachments';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
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
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Props = Readonly<{
  draftText: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  onAttach?: () => void;
  onVoiceAgent: () => void;
  onDictate: () => void;
  voiceInputStatus: VoiceInputStatus;
  disabled?: boolean;
}>;

export function ChatComposer({
  draftText,
  onChangeText,
  onSend,
  onAttach,
  onVoiceAgent,
  onDictate,
  voiceInputStatus,
  disabled = false,
}: Props): React.ReactElement {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);


  const uploads = useChatAttachments();
  const [menuOpen, setMenuOpen] = useState(false);
  useFocusEffect(useCallback(() => () => setMenuOpen(false), []));
  const hasText = draftText.trim().length > 0;

  const isRecording = voiceInputStatus === "recording";
  const isTranscribing = voiceInputStatus === "transcribing";
  const canSend =
    draftText.trim().length > 0 && !disabled && !isTranscribing && !isRecording;

  const inputPlaceholder = isRecording
    ? "Listening… tap mic to stop"
    : isTranscribing
      ? "Transcribing speech…"
      : "Ask Acharya AI";


  return (
    <View style={styles.wrap}>
      {!onAttach && uploads.attachments.length > 0 && <ChatAttachments files={uploads.attachments} onRemove={(id) => { void uploads.remove(id); }} />}
      {uploads.error && <Text accessibilityRole="alert" style={{ color: colors.destructive, padding: 8 }}>{uploads.error}</Text>}
      <ChatAttachmentMenu visible={menuOpen} onClose={() => setMenuOpen(false)} onSelect={(source) => { setMenuOpen(false); void uploads.pick(source); }} />
      <TextInput
        editable={!disabled && !isTranscribing && !isRecording}
        multiline
        onChangeText={onChangeText}
        onSubmitEditing={() => {
          if (canSend && !uploads.busy) {
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
        <Pressable accessibilityRole="button" accessibilityLabel="Add attachment" disabled={disabled || uploads.busy} onPress={() => { Keyboard.dismiss(); if (onAttach) onAttach(); else setMenuOpen(true); }} style={[styles.attachmentCircle, uploads.busy && styles.sendDisabled]}>
          {uploads.busy ? <ActivityIndicator color={colors.onAccent} /> : <MaterialCommunityIcons name="plus" size={26} color={colors.onAccent} />}
        </Pressable>

        <View style={styles.toolbarSpacer} />

        <View style={styles.rightActions}>
          <Pressable
            accessibilityLabel={
              isRecording ? "Stop voice" : "Voice message"
            }
            disabled={disabled || isTranscribing}
            onPress={() => { Keyboard.dismiss(); onDictate(); }}
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

          <Pressable accessibilityRole="button" accessibilityLabel="Start live voice conversation"
            disabled={disabled || isTranscribing || isRecording}
            onPress={() => { Keyboard.dismiss(); onVoiceAgent(); }}
            style={[styles.sendCircle,(disabled || isTranscribing || isRecording) && styles.sendDisabled]}>
            <VoiceWaveformIcon color={colors.onAccent} height={22} />
          </Pressable>
          {hasText ? <Pressable accessibilityRole="button" accessibilityLabel="Send message"
            disabled={!canSend || uploads.busy} onPress={onSend}
            style={[styles.micCircle,(!canSend || uploads.busy) && styles.sendDisabled]}>
            <MaterialCommunityIcons color={colors.onAccent} name="arrow-up" size={24} />
          </Pressable> : null}
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
  attachmentCircle: {
    width: 44, height: 44, borderRadius: 22, justifyContent: "center",
    backgroundColor: colors.lavender, borderColor: colors.border, borderWidth: borderWidths.thin,
    alignItems: "center",
  },
  wrap: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.xl,
    borderWidth: borderWidths.default,
    overflow: "hidden",
  },
});
