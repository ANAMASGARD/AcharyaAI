import { newConversation, useLocalChat } from '@/hooks/use-local-chat';
import { createId } from '@/lib/id';
import type { ChatMessage, ChatReplyPhase } from '@/types/chat';

export function useChat() {
  const [state, setState] = useLocalChat();
  const messages = state.conversations.find((item) => item.conversationId === state.activeId)?.messages ?? [];
  const sendMessage = async (text: string): Promise<void> => {
    if (!text.trim()) return;
    setState((current) => {
      const active = current.conversations.find((item) => item.conversationId === current.activeId) ?? newConversation();
      const message: ChatMessage = { messageId: createId(), role: 'user', content: text.trim(), attachments: current.attachments ?? [], createdAt: new Date().toISOString() };
      const updated = { ...active, title: active.messages.length ? active.title : text.trim().slice(0, 60), messages: [...active.messages, message] };
      return { draftText: '', attachments: [], activeId: active.conversationId, conversations: [updated, ...current.conversations.filter((item) => item.conversationId !== active.conversationId)] };
    });
  };
  return {
    messages, draftText: state.draftText, isLoadingHistory: false, isStreaming: false,
    replyPhase: 'idle' as ChatReplyPhase, error: null as string | null,
    setDraftText: (draftText: string) => setState((current) => ({ ...current, draftText })), sendMessage,
    retryLast: async () => {}, startNewChat: async () => {
      const conversation = newConversation();
      setState((current) => ({ ...current, activeId: conversation.conversationId, draftText: '', conversations: [conversation, ...current.conversations] }));
    },
    openConversation: async (activeId: string) => setState((current) => ({ ...current, activeId, draftText: '' })),
  };
}
