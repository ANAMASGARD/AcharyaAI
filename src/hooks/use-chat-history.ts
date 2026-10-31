import { useLocalChat } from '@/hooks/use-local-chat';
import { useState } from 'react';

export function useChatHistory() {
  const [state, setState] = useLocalChat();
  const [isOpen, setIsOpen] = useState(false);
  return {
    conversations: state.conversations.map((item) => ({ ...item, preview: item.messages.at(-1)?.content ?? '', messageCount: item.messages.length })),
    isOpen, isLoading: false, error: null as string | null,
    openDrawer: async () => setIsOpen(true), closeDrawer: () => setIsOpen(false),
    deleteConversation: async (id: string) => setState((current) => ({ ...current, activeId: current.activeId === id ? null : current.activeId, conversations: current.conversations.filter((item) => item.conversationId !== id) })),
    renameConversation: async (id: string, title: string) => setState((current) => ({ ...current, conversations: current.conversations.map((item) => item.conversationId === id ? { ...item, title: title.trim() || 'New chat' } : item) })),
  };
}
