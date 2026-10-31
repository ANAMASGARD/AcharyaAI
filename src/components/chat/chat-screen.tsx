import { useThemeColors, useColorMode, useThemeStyles } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatHistoryDrawer } from "@/components/chat/chat-history-drawer";
import { ChatMessageList } from "@/components/chat/chat-message-list";
import { getTabBarOverlayHeight } from "@/components/navigation/acharya-tab-bar";
import { useChat } from "@/hooks/use-chat";
import { useChatHistory } from "@/hooks/use-chat-history";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

export function ChatScreen(): React.ReactElement {
  const colors = useThemeColors();
  const colorMode = useColorMode();
  const styles = useThemeStyles(createStyles);

  const [composerHeight, setComposerHeight] = useState(96);
  const insets = useSafeAreaInsets();
  const tabBarOverlayHeight = getTabBarOverlayHeight(insets.bottom);

  const {
    messages,
    draftText,
    isLoadingHistory,
    isStreaming,
    replyPhase,
    error,
    setDraftText,
    sendMessage,
    retryLast,
    startNewChat,
    openConversation,
  } = useChat();

  const history = useChatHistory();
  const voiceInput = useVoiceInput();
  const streamingMessageId = useMemo(() => {
    if (!isStreaming) {
      return null;
    }

    const lastAssistant = [...messages]
      .reverse()
      .find((message) => message.role === "assistant");

    return lastAssistant?.messageId ?? null;
  }, [isStreaming, messages]);

  const handleSend = useCallback((): void => {
    if (!draftText.trim() || isStreaming) {
      return;
    }

    void sendMessage(draftText);
  }, [draftText, isStreaming, sendMessage]);

  const handleToggleMic = useCallback((): void => {
    if (voiceInput.status === "recording") {
      void (async () => {
        const transcript = await voiceInput.stopRecording();

        if (!transcript) {
          return;
        }

        const trimmedDraft = draftText.trim();
        setDraftText(
          trimmedDraft ? `${trimmedDraft} ${transcript}` : transcript,
        );
      })();
      return;
    }

    void voiceInput.startRecording();
  }, [draftText, setDraftText, voiceInput]);

  const composerInset = composerHeight + spacing.lg + tabBarOverlayHeight;

  return (
    <>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar style={colorMode === "dark" ? "light" : "dark"} />

        <ChatHeader
          onOpenHistory={() => {
            void history.openDrawer();
          }}
        />

        <Text style={styles.previewHint}>Local preview · messages stay on this device. AI and voice are not connected.</Text>
        <View style={styles.flex}>
          <View style={styles.body}>
            {error || voiceInput.error ? (
              <View style={styles.errorBanner}>
                <Text style={[styles.errorText, { color: colors.onAccent }]}>
                  {error ?? voiceInput.error}
                </Text>
                {error ? (
                  <Text
                    onPress={() => void retryLast()}
                    style={[styles.retryText, { color: colors.onAccent }]}
                  >
                    Retry
                  </Text>
                ) : null}
              </View>
            ) : null}

            <ChatMessageList
              composerInset={composerInset}
              isLoadingHistory={isLoadingHistory}
              isStreaming={isStreaming}
              messages={messages}
              replyPhase={replyPhase}
              streamingMessageId={streamingMessageId}
            />
          </View>

          <KeyboardStickyView
            offset={{ closed: 0, opened: tabBarOverlayHeight }}
            style={[styles.composerSticky, { bottom: tabBarOverlayHeight }]}
          >
            <View
              onLayout={(event) => {
                setComposerHeight(event.nativeEvent.layout.height);
              }}
              style={styles.composerDock}
            >
              <ChatComposer
                disabled={isStreaming}
                draftText={draftText}
                onChangeText={setDraftText}
                onSend={handleSend}
                onVoiceAgent={handleToggleMic}
                voiceInputStatus={voiceInput.status}
              />
            </View>
          </KeyboardStickyView>
        </View>
      </SafeAreaView>

      <ChatHistoryDrawer
        conversations={history.conversations}
        error={history.error}
        isLoading={history.isLoading}
        onClose={history.closeDrawer}
        onDeleteConversation={history.deleteConversation}
        onRenameConversation={history.renameConversation}
        onNewChat={() => {
          void startNewChat();
        }}
        onSelectConversation={(conversationId) => {
          void openConversation(conversationId);
        }}
        visible={history.isOpen}
      />
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  previewHint: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, fontFamily: fontFamilies.sans, fontSize: 12, color: colors.mutedForeground },
  body: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  composerDock: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  composerSticky: {
    backgroundColor: "transparent",
    left: 0,
    position: "absolute",
    right: 0,
  },
  errorBanner: {
    backgroundColor: colors.coral,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borderWidths.thin,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm,
  },
  errorText: {
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  flex: {
    backgroundColor: colors.cream,
    flex: 1,
  },
  retryText: {
    color: colors.foreground,
    fontFamily: fontFamilies.sansBold,
    fontSize: 14,
    marginTop: spacing.xs,
    textDecorationLine: "underline",
  },
  safeArea: {
    backgroundColor: colors.cream,
    flex: 1,
  },
});
