import { ChatBubble } from "@/components/chat/chat-bubble";
import { ChatLoadingIndicator } from "@/components/chat/chat-loading-indicator";
import { spacing } from "@/theme/tokens";
import type { ChatMessage, ChatReplyPhase } from "@/types/chat";
import { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import { KeyboardAwareScrollView, type KeyboardAwareScrollViewRef } from "react-native-keyboard-controller";

type Props = Readonly<{
  messages: ChatMessage[];
  isLoadingHistory: boolean;
  isStreaming: boolean;
  streamingMessageId?: string | null;
  /** Space reserved above the floating composer (content padding + keyboard scroll) */
  composerInset?: number;
  replyPhase?: ChatReplyPhase;
}>;

export function ChatMessageList({
  messages,
  isLoadingHistory,
  isStreaming,
  streamingMessageId,
  composerInset = 0,
  replyPhase = "sent",
}: Props): React.ReactElement {
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
    // composerInset is intentionally excluded: KeyboardAwareScrollView's
    // bottomOffset already keeps the latest message visible when the keyboard
    // opens, so scrolling on inset changes only causes a double-scroll jump.
  }, [messages, isLoadingHistory, isStreaming]);

  if (isLoadingHistory) {
    return <ChatLoadingIndicator layout="centered" />;
  }

  const hasMessages = messages.length > 0;

  return (
    <KeyboardAwareScrollView
      bottomOffset={composerInset}
      contentContainerStyle={[
        styles.content,
        hasMessages ? styles.contentWithMessages : styles.contentEmpty,
        hasMessages && composerInset > 0
          ? { paddingBottom: composerInset }
          : null,
      ]}
      keyboardShouldPersistTaps="handled"
      ref={scrollRef}
      showsVerticalScrollIndicator={false}
      style={styles.scroll}
    >
      {messages.map((message) => (
        <ChatBubble
          isStreaming={isStreaming && message.messageId === streamingMessageId}
          key={message.messageId}
          message={message}
          replyPhase={replyPhase}
        />
      ))}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.sm,
  },
  contentEmpty: {
    flexGrow: 1,
  },
  contentWithMessages: {
    flexGrow: 0,
  },
  scroll: {
    flex: 1,
  },
});
