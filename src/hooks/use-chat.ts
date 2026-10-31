import { newConversation, useLocalChat } from '@/hooks/use-local-chat';
import { createId } from '@/lib/id';
import { generateChatReply } from '@/lib/ai/chat';
import type { ChatMessage, ChatReplyPhase } from '@/types/chat';
import { useAuth } from '@clerk/expo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';

export function useChat() {
  const [state, setState] = useLocalChat();
  const { userId } = useAuth();
  const request = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messages = state.conversations.find((item) => item.conversationId === state.activeId)?.messages ?? [];
  const cancel = useCallback(() => { request.current?.abort(); request.current = null; setBusy(false); }, []);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (next) => { if (next !== 'active') cancel(); });
    return () => { listener.remove(); cancel(); };
  }, [cancel, userId]);
  useFocusEffect(useCallback(() => cancel, [cancel]));

  const reply = async (conversationId: string, history: ChatMessage[]): Promise<void> => {
    if (!userId || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError(null);
    try {
      const content = await generateChatReply(userId, history, controller.signal);
      if (controller.signal.aborted || request.current !== controller) return;
      const assistant: ChatMessage = { messageId: createId(), role: 'assistant', content, createdAt: new Date().toISOString() };
      setState((current) => ({ ...current, conversations: current.conversations.map((conversation) =>
        conversation.conversationId === conversationId ? { ...conversation, messages: [...conversation.messages, assistant] } : conversation) }));
    } catch (cause) {
      if (!controller.signal.aborted && request.current === controller) setError(cause instanceof Error ? cause.message : 'Could not get an AI reply. Try again.');
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  };
  const sendMessage = async (text: string): Promise<void> => {
    if (!text.trim() || request.current || !userId) return;
    if (state.attachments?.length) { setError('Direct AI chat supports text only for now. Remove attachments before sending.'); return; }
    const active = state.conversations.find((item) => item.conversationId === state.activeId) ?? newConversation();
    const message: ChatMessage = { messageId: createId(), role: 'user', content: text.trim(), createdAt: new Date().toISOString() };
    const updated = { ...active, title: active.messages.length ? active.title : text.trim().slice(0, 60), messages: [...active.messages, message] };
    setState((current) => ({ ...current, draftText: '', attachments: [], activeId: active.conversationId,
      conversations: [updated, ...current.conversations.filter((item) => item.conversationId !== active.conversationId)] }));
    await reply(active.conversationId, updated.messages);
  };
  return {
    messages, draftText: state.draftText, isLoadingHistory: false, isStreaming: busy,
    replyPhase: (busy ? 'analyzing' : 'idle') as ChatReplyPhase, error,
    setDraftText: (draftText: string) => setState((current) => ({ ...current, draftText })), sendMessage,
    retryLast: async () => {
      if (state.activeId && messages.at(-1)?.role === 'user') await reply(state.activeId, messages);
    },
    startNewChat: async () => {
      cancel(); setError(null);
      const conversation = newConversation();
      setState((current) => ({ ...current, activeId: conversation.conversationId, draftText: '', conversations: [conversation, ...current.conversations] }));
    },
    openConversation: async (activeId: string) => { cancel(); setError(null); setState((current) => ({ ...current, activeId, draftText: '' })); },
  };
}
