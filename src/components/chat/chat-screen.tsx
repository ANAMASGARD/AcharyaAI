import { Pressable } from '@/components/feedback/pressable';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { PaperScoreCard } from "@/components/rag/paper-score-card";
import { RagWorkspace } from '@/components/rag/rag-workspace';
import { useChatStore } from '@/store/chat-store';
import { apiFetch } from '@/lib/api-client';
import type { Verification } from '@/types/rag';
import { useVoiceOutput } from '@/hooks/use-voice-output';
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
import { useCallback, useMemo, useState, useEffect } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
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

  const [paperReport, setPaperReport] = useState<{owner:string;report:Verification} | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const selections = useChatStore(s => s.selections);
  const setSelections = useChatStore(s => s.setSelections);
  const verificationId = useChatStore(s => s.verificationId);
  const { review } = useLocalSearchParams<{ review?: string }>();
  const { getToken, userId } = useAuth();
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

  const router = useRouter();
  useEffect(() => {
    if (!review || !userId) return;
    const controller = new AbortController();
    useChatStore.getState().resetTabData();
    void (async () => {
      try {
        const token = await getToken();
        const result = await apiFetch<{ verification: Verification }>(
          `/api/rag/verify?id=${encodeURIComponent(review)}`,
          { token, signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        if (
          result.verification.status !== "completed" ||
          result.verification.historical
        )
          throw new Error(
            "Complete a current paper review before discussing it.",
          );
        setPaperReport({owner:userId,report:result.verification});
        useChatStore.setState({
          verificationId: review,
          selections: result.verification.selections,
          draftText:
            "Which questions are outside the book's scope or need review?",
          lastFetchedAt: Date.now(),
        });
        router.setParams({ review: undefined });
      } catch (error) {
        if (!controller.signal.aborted)
          useChatStore
            .getState()
            .setError(
              error instanceof Error
                ? error.message
                : "Could not open the paper review.",
            );
      }
    })();
    return () => controller.abort();
  }, [review, userId, getToken, router]);

  const history = useChatHistory();
  const voiceOutput = useVoiceOutput();
  const voiceInput = useVoiceInput((text) => setDraftText(draftText.trim() ? `${draftText.trim()} ${text}` : text));
  const lastReply = [...messages].reverse().find((message) => message.role === 'assistant');
  const streamingMessageId = useMemo(() => {
    if (!isStreaming) {
      return null;
    }

    const lastAssistant = [...messages]
      .reverse()
      .find((message) => message.role === "assistant");

    return messages.at(-1)?.role === 'assistant' ? lastAssistant?.messageId ?? null : null;
  }, [isStreaming, messages]);

  const handleSend = useCallback((): void => {
    if (!draftText.trim() || isStreaming) {
      return;
    }

    void sendMessage(draftText);
  }, [draftText, isStreaming, sendMessage]);

  const handleToggleMic = useCallback((): void => {
    voiceOutput.stop();
    if (voiceInput.status === 'recording') void voiceInput.stopRecording();
    else void voiceInput.startRecording();
  }, [voiceInput, voiceOutput]);

  const composerInset = composerHeight + spacing.lg + tabBarOverlayHeight;

  return (
    <>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar style={colorMode === "dark" ? "light" : "dark"} />

        <ChatHeader
          onOpenHistory={() => {
            voiceInput.cancel();
            voiceOutput.stop();
            void history.openDrawer();
          }}
        />

        <Pressable accessibilityRole="button" onPress={() => setLibraryOpen(true)}>
          <Text style={styles.previewHint}>OpenAI cloud chat · {selections.length} book/notes sources selected · Manage library</Text>
        </Pressable>
        {paperReport && paperReport.owner === userId && paperReport.report.id === verificationId ? <Pressable accessibilityRole="button" onPress={() => setReportOpen(true)} style={{minHeight:44,justifyContent:'center'}}><Text style={styles.previewHint}>View curriculum fit & question summary</Text></Pressable> : null}
        {verificationId ? <Pressable accessibilityRole="button" onPress={() => void startNewChat()}><Text style={styles.previewHint}>Discussing a saved paper review · Start a new book chat</Text></Pressable> : null}
        <Pressable accessibilityRole="button" onPress={() => router.push('/profile/api-keys')}><Text style={styles.previewHint}>Voice uses your Gnani key · Configure voice keys</Text></Pressable>
        {lastReply ? <Pressable accessibilityRole="button" onPress={() => {
          if (voiceOutput.status !== 'idle') voiceOutput.stop();
          else void voiceOutput.speak(lastReply.content);
        }} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={styles.previewHint}>{voiceOutput.status === 'idle' ? 'Read latest reply aloud · Gnani' : 'Stop read aloud'}</Text>
        </Pressable> : null}
        <View style={styles.flex}>
          <View style={styles.body}>
            {error || voiceInput.error || voiceOutput.error ? (
              <View style={styles.errorBanner}>
                <Text style={[styles.errorText, { color: colors.onAccent }]}>
                  {error ?? voiceInput.error ?? voiceOutput.error}
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
                onAttach={() => setLibraryOpen(true)}
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

      <Modal visible={libraryOpen} animationType="slide" onRequestClose={() => setLibraryOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
          <Pressable accessibilityRole="button" onPress={() => setLibraryOpen(false)} style={{ minHeight: 44, padding: 16 }}><Text style={{ color: colors.foreground }}>Done · Return to Chat</Text></Pressable>
          {libraryOpen ? <RagWorkspace selections={selections} onSelections={setSelections} onDiscuss={() => setLibraryOpen(false)} /> : null}
        </SafeAreaView>
      </Modal>
      <Modal visible={reportOpen && paperReport?.owner === userId && paperReport?.report.id === verificationId} animationType="slide" onRequestClose={() => setReportOpen(false)}>
        <SafeAreaView style={{flex:1,backgroundColor:colors.cream}}>
          <Pressable accessibilityRole="button" onPress={() => setReportOpen(false)} style={{minHeight:44,padding:16}}><Text style={{color:colors.foreground}}>Return to Chat</Text></Pressable>
          <ScrollView contentContainerStyle={{padding:16,gap:16}}>
            {paperReport && paperReport.owner === userId ? <><PaperScoreCard report={paperReport.report} />{paperReport.report.questions.map((q,i)=><View key={i} style={{padding:16,borderWidth:2,borderColor:colors.border,borderRadius:12,gap:8}}><Text style={{color:colors.foreground,fontWeight:'800'}}>Question {q.number} · {q.status.replaceAll('_',' ')}</Text><Text style={{color:colors.foreground}}>{q.explanation}</Text>{q.suggestion?<Text style={{color:colors.foreground}}>{q.suggestion}</Text>:null}</View>)}</>:null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
