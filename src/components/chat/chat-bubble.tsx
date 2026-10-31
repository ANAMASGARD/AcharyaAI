import { ChatLoadingIndicator } from "@/components/chat/chat-loading-indicator";
import { colors } from "@/theme/colors";
import { borderWidths, radii, spacing } from "@/theme/tokens";
import { fontFamilies } from "@/theme/typography";
import { StyleSheet, Text, View } from "react-native";
import type { ChatMessage, ChatReplyPhase } from "@/types/chat";

type Props = Readonly<{
  message: ChatMessage;
  isStreaming?: boolean;
  replyPhase?: ChatReplyPhase;
}>;

export function ChatBubble({
  message,
  isStreaming = false,
  replyPhase = "sent",
}: Props): React.ReactElement {
  const isUser = message.role === "user";
  const showStreamingLoader =
    !isUser && isStreaming && message.content.trim().length === 0;

  if (showStreamingLoader) {
    return (
      <View style={[styles.row, styles.rowAssistant, styles.loaderRow]}>
        <ChatLoadingIndicator layout="inline" phase={replyPhase} />
      </View>
    );
  }

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        <Text style={styles.content}>
          {message.content}
          {!isUser && isStreaming ? " ▍" : ""}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  assistantBubble: {
    backgroundColor: colors.card,
  },
  bubble: {
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borderWidths.thin,
    maxWidth: "85%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  content: {
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
    fontSize: 15,
    lineHeight: 22,
  },
  row: {
    marginBottom: spacing.sm,
  },
  loaderRow: {
    overflow: "visible",
  },
  rowAssistant: {
    alignItems: "flex-start",
  },
  rowUser: {
    alignItems: "flex-end",
  },
  userBubble: {
    backgroundColor: colors.primary,
  },
});
