import { apiFetch } from "@/lib/api-client";
import { useChatHistoryStore } from "@/store/chat-history-store";
import { isStale } from "@/types/async-resource";
import { useAuth } from "@clerk/expo";
import { useFocusEffect } from "expo-router";
import { useLayoutEffect, useCallback, useRef, useState } from "react";

type UseChatHistoryResult = Readonly<{
  isOpen: boolean;
  conversations: ReturnType<typeof useChatHistoryStore.getState>["conversations"];
  isLoading: boolean;
  error: string | null;
  openDrawer: () => Promise<void>;
  closeDrawer: () => void;
  deleteConversation: (conversationId: string) => Promise<void>;
  renameConversation: (conversationId: string, title: string) => Promise<void>;
}>;

export function useChatHistory(): UseChatHistoryResult {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  useLayoutEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  const [isOpen, setIsOpen] = useState(false);

  const conversations = useChatHistoryStore((state) => state.conversations);
  const status = useChatHistoryStore((state) => state.status);
  const error = useChatHistoryStore((state) => state.error);
  const lastFetchedAt = useChatHistoryStore((state) => state.lastFetchedAt);
  const fetchConversations = useChatHistoryStore(
    (state) => state.fetchConversations,
  );
  const removeConversation = useChatHistoryStore(
    (state) => state.removeConversation,
  );
  const renameConversationInStore = useChatHistoryStore(
    (state) => state.renameConversation,
  );
  const setError = useCallback((message: string | null) => {
    useChatHistoryStore.setState({ error: message });
  }, []);

  const loadConversations = useCallback(
    async (options?: Readonly<{ silent?: boolean; force?: boolean }>): Promise<void> => {
      await fetchConversations(() => getTokenRef.current(), options);
    },
    [fetchConversations],
  );

  useFocusEffect(
    useCallback(() => {
      if (isStale(lastFetchedAt)) {
        void loadConversations({ silent: true });
      }
    }, [lastFetchedAt, loadConversations]),
  );

  const openDrawer = useCallback(async (): Promise<void> => {
    setIsOpen(true);
    await loadConversations({ silent: true });
  }, [loadConversations]);

  const closeDrawer = useCallback((): void => {
    setIsOpen(false);
  }, []);

  const deleteConversation = useCallback(
    async (conversationId: string): Promise<void> => {
      try {
        const token = await getTokenRef.current();
        await apiFetch<{ ok: boolean }>(
          `/api/chat/conversations?conversationId=${encodeURIComponent(conversationId)}`,
          {
            method: "DELETE",
            token,
          },
        );
        removeConversation(conversationId);
      } catch (deleteError) {
        const message =
          deleteError instanceof Error
            ? deleteError.message
            : "Failed to delete chat";
        setError(message);
      }
    },
    [removeConversation, setError],
  );

  const renameConversation = useCallback(
    async (conversationId: string, title: string): Promise<void> => {
      const token = await getTokenRef.current();
      const response = await apiFetch<{ ok: boolean; title: string }>(
        "/api/chat/conversations",
        {
          method: "PATCH",
          token,
          body: { conversationId, title },
        },
      );
      renameConversationInStore(conversationId, response.title);
    },
    [renameConversationInStore],
  );

  return {
    isOpen,
    conversations,
    isLoading: status === "loading" && conversations.length === 0,
    error,
    openDrawer,
    closeDrawer,
    deleteConversation,
    renameConversation,
  };
}
