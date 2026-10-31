import { apiFetch } from "@/lib/api-client";
import type { ChatConversationSummary } from "@/types/chat";
import type { AsyncStatus, FetchOptions, GetToken } from "@/types/async-resource";
import { isStale } from "@/types/async-resource";
import { create } from "zustand";

type ConversationListResponse = Readonly<{
  conversations: ChatConversationSummary[];
}>;

type ChatHistoryState = Readonly<{
  conversations: ChatConversationSummary[];
  status: AsyncStatus;
  error: string | null;
  lastFetchedAt: number | null;
  fetchPromise: Promise<void> | null;
  setConversations: (conversations: ChatConversationSummary[]) => void;
  removeConversation: (conversationId: string) => void;
  renameConversation: (conversationId: string, title: string) => void;
  touchConversation: (
    conversationId: string,
    preview: string,
    messageCountDelta?: number,
  ) => void;
  fetchConversations: (getToken: GetToken, options?: FetchOptions) => Promise<void>;
  reset: () => void;
}>;

const INITIAL_STATE = {
  conversations: [] as ChatConversationSummary[],
  status: "idle" as AsyncStatus,
  error: null,
  lastFetchedAt: null,
  fetchPromise: null,
};

let requestGeneration=0;
export const useChatHistoryStore = create<ChatHistoryState>()((set, get) => ({
  ...INITIAL_STATE,
  setConversations: (conversations) => set({ conversations }),
  removeConversation: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.filter(
        (item) => item.conversationId !== conversationId,
      ),
    })),
  renameConversation: (conversationId, title) =>
    set((state) => ({
      conversations: state.conversations.map((item) =>
        item.conversationId === conversationId ? { ...item, title } : item,
      ),
    })),
  touchConversation: (conversationId, preview, messageCountDelta = 2) =>
    set((state) => {
      const existing = state.conversations.find(
        (item) => item.conversationId === conversationId,
      );

      if (!existing) {
        return state;
      }

      return {
        conversations: state.conversations.map((item) =>
          item.conversationId === conversationId
            ? {
                ...item,
                preview,
                messageCount: item.messageCount + messageCountDelta,
              }
            : item,
        ),
      };
    }),
  fetchConversations: async (getToken, options = {}) => {
    const { silent = false, force = false } = options;
    const state = get();
    const generation=requestGeneration;

    if (
      !force &&
      state.status === "success" &&
      state.lastFetchedAt &&
      !isStale(state.lastFetchedAt)
    ) {
      return;
    }

    if (state.fetchPromise) {
      return state.fetchPromise;
    }

    const hasData = state.conversations.length > 0;

    const promise = (async (): Promise<void> => {
      if (!silent && !hasData) {
        set({ status: "loading" });
      }

      set({ error: null });

      try {
        const token = await getToken();
        const response = await apiFetch<ConversationListResponse>(
          "/api/chat/conversations?list=1",
          { token },
        );

        if(generation!==requestGeneration)return;
        set({
          conversations: response.conversations,
          status: "success",
          lastFetchedAt: Date.now(),
        });
      } catch (fetchError) {
        if(generation!==requestGeneration)return;
        if (!hasData) {
          const message =
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load chat history";
          set({ error: message, status: "error" });
        }
      } finally {
        if(generation===requestGeneration)set({ fetchPromise: null });
      }
    })();

    set({ fetchPromise: promise });
    return promise;
  },
  reset: () => {requestGeneration++;set({ ...INITIAL_STATE });},
}));
