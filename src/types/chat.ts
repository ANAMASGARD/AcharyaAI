export type ChatReplyPhase =
  | "idle"
  | "sent"
  | "analyzing"
  | "preparing"
  | "almost_ready";

export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = Readonly<{
  messageId: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}>;

export type ChatConversation = Readonly<{
  conversationId: string;
  createdAt: string;
  contextSnapshot: string;
}>;

export type ChatConversationSummary = Readonly<{
  conversationId: string;
  createdAt: string;
  preview: string;
  title: string;
  messageCount: number;
}>;

export type VoiceInputStatus = "idle" | "recording" | "transcribing";

export type VoiceOutputStatus = "idle" | "loading" | "speaking";

export type ChatErrorCode =
  | "auth"
  | "empty_message"
  | "stream_failed"
  | "voice_input"
  | "voice_output"
  | "load_failed"
  | "unknown";

export type NdjsonStreamEvent =
  | Readonly<{ type: "delta"; content: string }>
  | Readonly<{
      type: "done";
      conversationId: string;
      messageId: string;
      userMessageId: string;
    }>
  | Readonly<{ type: "error"; error: string; code?: string }>;
