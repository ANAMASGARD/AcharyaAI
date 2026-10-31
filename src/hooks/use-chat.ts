import { apiFetch } from "@/lib/api-client";
import { streamChatMessage } from "@/lib/chat-stream";
import { useChatHistoryStore } from "@/store/chat-history-store";
import { useChatStore } from "@/store/chat-store";
import type {
  ChatConversation,
  ChatMessage,
  ChatReplyPhase,
} from "@/types/chat";
import { isStale } from "@/types/async-resource";
import { useAuth } from "@clerk/expo";
import { useFocusEffect } from "expo-router";
import { useLayoutEffect, useCallback, useRef, useEffect } from "react";

type ConversationResponse = Readonly<{
  conversation: ChatConversation | null;
  messages: ChatMessage[];
}>;

type UseChatResult = Readonly<{
  messages: ChatMessage[];
  draftText: string;
  isLoadingHistory: boolean;
  isStreaming: boolean;
  replyPhase: ChatReplyPhase;
  error: string | null;
  hasMessages: boolean;
  setDraftText: (value: string) => void;
  sendMessage: (text: string) => Promise<void>;
  retryLast: () => Promise<void>;
  startNewChat: () => Promise<void>;
  openConversation: (conversationId: string) => Promise<void>;
}>;

export function useChat(): UseChatResult {
  const { getToken, userId } = useAuth();
  const lastUserMessageRef = useRef<string | null>(null);
  const account = useRef(userId);
  useLayoutEffect(() => { account.current = userId; }, [userId]);
  const generation = useRef(0);
  const requestIdRef = useRef<string | null>(null);
  const getTokenRef = useRef(getToken);
  useLayoutEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    const invalidateRequests = () => {
      generation.current++;
    };
    invalidateRequests();
    abortRef.current?.abort();
    abortRef.current = null;
    lastUserMessageRef.current = null;
    requestIdRef.current = null;
    // The account-keyed RagSessionLifecycle owns shared-store resets.
    return () => {
      invalidateRequests();
      abortRef.current?.abort();
    };
  }, [userId]);
  const conversationIdRef = useRef<string | null>(null);

  const messages = useChatStore((state) => state.messages);
  const draftText = useChatStore((state) => state.draftText);
  const isLoadingHistory = useChatStore((state) => state.isLoadingHistory);
  const isStreaming = useChatStore((state) => state.isStreaming);
  const replyPhase = useChatStore((state) => state.replyPhase);
  const error = useChatStore((state) => state.error);
  const conversationId = useChatStore((state) => state.conversationId);
  const setDraftText = useChatStore((state) => state.setDraftText);
  const fetchActiveConversation = useChatStore(
    (state) => state.fetchActiveConversation,
  );

  useLayoutEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);

  const loadConversation = useCallback(
    async (
      options?: Readonly<{ silent?: boolean; force?: boolean }>,
    ): Promise<void> => {
      await fetchActiveConversation(() => getTokenRef.current(), {
        conversationId: conversationIdRef.current,
        ...options,
      });
    },
    [fetchActiveConversation],
  );

  useFocusEffect(
    useCallback(() => {
      const state = useChatStore.getState();
      if (!state.conversationId && (state.verificationId || state.selections.length)) return;
      const hasCachedMessages = state.messages.length > 0;

      if (hasCachedMessages) {
        if (isStale(state.lastFetchedAt)) {
          void loadConversation({ silent: true });
        }
        return;
      }

      if (
        state.conversationId &&
        state.hydrateConversationFromCache(state.conversationId)
      ) {
        void loadConversation({ silent: true });
        return;
      }

      if (isStale(state.lastFetchedAt)) {
        void loadConversation({ silent: false });
      }
    }, [loadConversation]),
  );

  useFocusEffect(
    useCallback(() => {
      return () => {
        abortRef.current?.abort();
        abortRef.current = null;
        useChatStore.getState().setIsStreaming(false);
        useChatStore.getState().setReplyPhase("idle");
      };
    }, []),
  );

  const sendMessage = useCallback(
    async (rawText: string, reuseRequest = false): Promise<void> => {
      const text = rawText.trim();

      const state = useChatStore.getState();
      if (!text || state.isStreaming || state.isLoadingHistory ||
          (state.conversationId && !state.lastFetchedAt)) {
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const currentGeneration = ++generation.current;
      const owner = account.current;
      const current = () =>
        currentGeneration === generation.current &&
        owner === account.current &&
        useChatStore.getState().isStreaming &&
        !controller.signal.aborted;
      if (
        !reuseRequest ||
        lastUserMessageRef.current !== text ||
        !requestIdRef.current
      )
        requestIdRef.current = `request-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      lastUserMessageRef.current = text;

      const optimisticUserId = `local-user-${Date.now()}`;
      const optimisticAssistantId = `local-assistant-${Date.now()}`;
      const createdAt = new Date().toISOString();

      useChatStore.getState().setError(null);
      useChatStore.getState().setDraftText("");
      useChatStore.getState().setIsStreaming(true);
      useChatStore.getState().setReplyPhase("sent");
      useChatStore.getState().appendMessage({
        messageId: optimisticUserId,
        role: "user",
        content: text,
        createdAt,
      });
      useChatStore.getState().appendMessage({
        messageId: optimisticAssistantId,
        role: "assistant",
        content: "",
        createdAt,
      });

      try {
        const token = await getTokenRef.current();

        if (!current()) return;
        if (!token) {
          throw new Error("Not authenticated");
        }

        let assistantContent = "";
        let hasFirstDelta = false;

        await streamChatMessage({
          token,
          conversationId: useChatStore.getState().conversationId,
          message: text,
          requestId: requestIdRef.current!,
          verificationId: useChatStore.getState().verificationId,
          selections: useChatStore.getState().selections,
          signal: controller.signal,
          onStreamOpen: () => {
            if (!current()) return;
            useChatStore.getState().setReplyPhase("analyzing");
          },
          onStreamActivity: () => {
            if (!current()) return;
            const phase = useChatStore.getState().replyPhase;

            if (phase === "analyzing") {
              useChatStore.getState().setReplyPhase("preparing");
            }
          },
          onDelta: (chunk) => {
            if (!current()) return;
            if (!hasFirstDelta) {
              hasFirstDelta = true;
              useChatStore.getState().setReplyPhase("almost_ready");
            }

            assistantContent += chunk;
            useChatStore
              .getState()
              .updateMessageContent(optimisticAssistantId, assistantContent);
          },
          onDone: (event) => {
            if (!current()) return;
            requestIdRef.current = null;
            useChatStore.getState().setConversationId(event.conversationId);
            conversationIdRef.current = event.conversationId;

            const currentMessages = useChatStore
              .getState()
              .messages.map((message) => {
                if (message.messageId === optimisticUserId) {
                  return { ...message, messageId: event.userMessageId };
                }

                if (message.messageId === optimisticAssistantId) {
                  return {
                    ...message,
                    messageId: event.messageId,
                    content: assistantContent,
                    citations: event.citations,
                  };
                }

                return message;
              });

            useChatStore.getState().setMessages(currentMessages);
            useChatHistoryStore
              .getState()
              .touchConversation(event.conversationId, text.slice(0, 120));
          },
          onError: (message) => {
            if (!current()) return;
            if (controller.signal.aborted) {
              return;
            }

            useChatStore.getState().setError(message);
            useChatStore.setState((state) => ({
              messages: state.messages.filter(
                (message) =>
                  message.messageId !== optimisticUserId &&
                  message.messageId !== optimisticAssistantId,
              ),
            }));
          },
        });
      } catch (sendError) {
        if (current()) {
          const message =
            sendError instanceof Error
              ? sendError.message
              : "Failed to send message";
          useChatStore.getState().setError(message);
          useChatStore.setState((state) => ({
            messages: state.messages.filter(
              (message) =>
                message.messageId !== optimisticUserId &&
                message.messageId !== optimisticAssistantId,
            ),
          }));
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }

        if (current()) {
          useChatStore.getState().setIsStreaming(false);
          useChatStore.getState().setReplyPhase("idle");
        }
      }
    },
    [],
  );

  const retryLast = useCallback(async (): Promise<void> => {
    const lastMessage = lastUserMessageRef.current;

    if (!lastMessage) {
      return;
    }

    await sendMessage(lastMessage, true);
  }, [sendMessage]);

  const openConversation = useCallback(
    async (id: string): Promise<void> => {
      if (useChatStore.getState().isStreaming) {
        return;
      }

      abortRef.current?.abort();
      abortRef.current = null;

      // Cached messages alone do not establish this conversation's source scope.
      // Invalidate earlier loads and reload messages and metadata together.
      generation.current++;
      useChatStore.getState().resetTabData();
      useChatStore.getState().setConversationId(id);
      conversationIdRef.current = id;
      await fetchActiveConversation(() => getTokenRef.current(), {
        conversationId: id,
        force: true,
      });
    },
    [fetchActiveConversation],
  );

  const startNewChat = useCallback(async (): Promise<void> => {
    const gen = ++generation.current;
    const owner = account.current;
    requestIdRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    useChatStore.getState().resetConversation();

    try {
      const token = await getTokenRef.current();
      const response = await apiFetch<ConversationResponse>(
        "/api/chat/conversations",
        {
          method: "POST",
          token,
          body: {},
        },
      );

      if (gen !== generation.current || owner !== account.current) return;
      if (response.conversation) {
        useChatStore
          .getState()
          .setConversationId(response.conversation.conversationId);
        conversationIdRef.current = response.conversation.conversationId;
        useChatStore.setState({ lastFetchedAt: Date.now() });
      }
    } catch (createError) {
      if (gen !== generation.current || owner !== account.current) return;
      const message =
        createError instanceof Error
          ? createError.message
          : "Failed to start a new chat";
      useChatStore.getState().setError(message);
    }
  }, []);

  const showLoadingHistory = isLoadingHistory && messages.length === 0;

  return {
    messages,
    draftText,
    isLoadingHistory: showLoadingHistory,
    isStreaming,
    replyPhase,
    error,
    hasMessages: messages.length > 0,
    setDraftText,
    sendMessage,
    retryLast,
    startNewChat,
    openConversation,
  };
}
