import { usePreviewFeature } from '@/components/preview/preview-provider';
import { createId } from '@/lib/id';
import type { ChatMessage } from '@/types/chat';

export type LocalConversation = { conversationId: string; title: string; createdAt: string; messages: ChatMessage[] };
type ChatDraft = { conversations: LocalConversation[]; activeId: string | null; draftText: string };
const INITIAL: ChatDraft = { conversations: [], activeId: null, draftText: '' };
export function useLocalChat() { return usePreviewFeature('chat', INITIAL); }
export function newConversation(): LocalConversation {
  return { conversationId: createId(), title: 'New chat', createdAt: new Date().toISOString(), messages: [] };
}
