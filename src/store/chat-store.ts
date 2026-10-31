import type { SourceSelection } from "@/types/rag";
import { apiFetch } from "@/lib/api-client";
import type {
  ChatConversation,
  ChatMessage,
  ChatReplyPhase,
} from "@/types/chat";
import type { FetchOptions, GetToken } from "@/types/async-resource";
import { isStale } from "@/types/async-resource";
import { create } from "zustand";

export const CHAT_CONVERSATION_PERSIST_KEY = "acharya-chat-conversation-id";

type MessageCache = Readonly<Record<string, ChatMessage[]>>;

type ConversationResponse = Readonly<{
  conversation: ChatConversation | null;
  messages: ChatMessage[];
}>;

type FetchConversationOptions = FetchOptions &
  Readonly<{
    conversationId?: string | null;
  }>;

type ChatState = Readonly<{
  verificationId: string | null;
  selections: SourceSelection[];
  setSelections: (selections: SourceSelection[]) => void;
  conversationId: string | null;
  messages: ChatMessage[];
  messageCache: MessageCache;
  draftText: string;
  isLoadingHistory: boolean;
  isStreaming: boolean;
  replyPhase: ChatReplyPhase;
  error: string | null;
  lastFetchedAt: number | null;
  fetchPromise: Promise<void> | null;
  setConversationId: (conversationId: string | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  appendMessage: (message: ChatMessage) => void;
  updateMessageContent: (messageId: string, content: string) => void;
  setDraftText: (value: string) => void;
  setIsLoadingHistory: (value: boolean) => void;
  setIsStreaming: (value: boolean) => void;
  setReplyPhase: (phase: ChatReplyPhase) => void;
  setError: (value: string | null) => void;
  resetConversation: () => void;
  resetTabData: () => void;
  hydrateConversationFromCache: (conversationId: string) => boolean;
  fetchActiveConversation: (
    getToken: GetToken,
    options?: FetchConversationOptions,
  ) => Promise<void>;
}>;

function withMessageCache(
  state: ChatState,
  conversationId: string | null,
  messages: ChatMessage[],
): Pick<ChatState, "messages" | "messageCache"> {
  if (!conversationId) {
    return { messages, messageCache: state.messageCache };
  }

  return {
    messages,
    messageCache: {
      ...state.messageCache,
      [conversationId]: messages,
    },
  };
}

function hasDisplayableMessages(
  targetConversationId: string | null,
  messages: ChatMessage[],
  activeConversationId: string | null,
): boolean {
  if (messages.length === 0) {
    return false;
  }

  return !targetConversationId || activeConversationId === targetConversationId;
}

let requestGeneration = 0;
export const useChatStore = create<ChatState>()(
    (set, get) => ({
      verificationId: null,
      selections: [],
      setSelections: (selections) => {
        if (get().verificationId) get().resetConversation();
        // A source choice takes precedence over an outstanding latest-chat load.
        requestGeneration++;
        set({ selections, fetchPromise: null, isLoadingHistory: false, lastFetchedAt: Date.now() });
      },
      conversationId: null,
      messages: [],
      messageCache: {},
      draftText: "",
      isLoadingHistory: false,
      isStreaming: false,
      replyPhase: "idle",
      error: null,
      lastFetchedAt: null,
      fetchPromise: null,
      setConversationId: (conversationId) => set({ conversationId }),
      setMessages: (messages) =>
        set((state) => withMessageCache(state, state.conversationId, messages)),
      appendMessage: (message) =>
        set((state) => {
          const messages = [...state.messages, message];
          return withMessageCache(state, state.conversationId, messages);
        }),
      updateMessageContent: (messageId, content) =>
        set((state) => {
          const messages = state.messages.map((message) =>
            message.messageId === messageId ? { ...message, content } : message,
          );
          return withMessageCache(state, state.conversationId, messages);
        }),
      setDraftText: (draftText) => set({ draftText }),
      setIsLoadingHistory: (isLoadingHistory) => set({ isLoadingHistory }),
      setIsStreaming: (isStreaming) => set({ isStreaming }),
      setReplyPhase: (replyPhase) => set({ replyPhase }),
      setError: (error) => set({ error }),
      resetConversation: () => {
        requestGeneration++;
        set({
          isLoadingHistory: false,
          verificationId: null,
          conversationId: null,
          selections: [],
          messages: [],
          draftText: "",
          error: null,
          isStreaming: false,
          replyPhase: "idle",
          lastFetchedAt: null,
          fetchPromise: null,
        });
      },
      resetTabData: () => {
        requestGeneration++;
        set({
          verificationId: null,
          conversationId: null,
          selections: [],
          messages: [],
          messageCache: {},
          draftText: "",
          error: null,
          isLoadingHistory: false,
          isStreaming: false,
          replyPhase: "idle",
          lastFetchedAt: null,
          fetchPromise: null,
        });
      },
      hydrateConversationFromCache: (conversationId) => {
        const cached = get().messageCache[conversationId];

        if (!cached || cached.length === 0) {
          return false;
        }

        set({
          conversationId,
          messages: cached,
        });
        return true;
      },
      fetchActiveConversation: async (getToken, options = {}) => {
        const { silent = false, force = false, conversationId } = options;
        const state = get();
        const generation = requestGeneration;

        if (state.isStreaming) {
          return;
        }

        const targetConversationId =
          conversationId !== undefined ? conversationId : state.conversationId;

        if (
          !force &&
          state.lastFetchedAt &&
          !isStale(state.lastFetchedAt) &&
          hasDisplayableMessages(
            targetConversationId,
            state.messages,
            state.conversationId,
          )
        ) {
          return;
        }

        if (state.fetchPromise) {
          return state.fetchPromise;
        }

        let canShowCached = false;

        if (targetConversationId && state.messages.length === 0) {
          canShowCached =
            get().hydrateConversationFromCache(targetConversationId);
        }

        const hasData =
          hasDisplayableMessages(
            targetConversationId,
            get().messages,
            get().conversationId,
          ) || canShowCached;

        const promise = (async (): Promise<void> => {
          if (!silent && !canShowCached && !hasData) {
            set({ isLoadingHistory: true });
          }

          set({ error: null });

          try {
            const token = await getToken();
            const query = targetConversationId
              ? `?conversationId=${encodeURIComponent(targetConversationId)}`
              : "";
            const response = await apiFetch<ConversationResponse>(
              `/api/chat/conversations${query}`,
              { token },
            );

            if (generation !== requestGeneration || get().isStreaming) {
              return;
            }

            if (!response.conversation)
              set({
                conversationId: null,
                selections: [],
                verificationId: null,
              });
            if (response.conversation) {
              set({
                conversationId: response.conversation.conversationId,
                selections: response.conversation.selections ?? [],
                verificationId: response.conversation.verificationId ?? null,
              });
            }

            set((current) => ({
              ...withMessageCache(
                current,
                response.conversation?.conversationId ?? current.conversationId,
                response.messages,
              ),
              lastFetchedAt: Date.now(),
            }));
          } catch (loadError) {
            if (generation !== requestGeneration) return;
            const hasCached = get().messages.length > 0;

            if (!hasCached) {
              const message =
                loadError instanceof Error
                  ? loadError.message
                  : "Failed to load chat history";
              set({ error: message });
            }
          } finally {
            if (generation === requestGeneration)
              set({ isLoadingHistory: false, fetchPromise: null });
          }
        })();

        set({ fetchPromise: promise });
        return promise;
      },
    })
);
