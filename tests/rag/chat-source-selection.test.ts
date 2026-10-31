import { afterEach, expect, it, vi } from 'vitest';
import { useChat } from '@/hooks/use-chat';
import { useChatStore } from '@/store/chat-store';
import { apiFetch } from '@/lib/api-client';
import { streamChatMessage } from '@/lib/chat-stream';
const lifecycle = vi.hoisted(() => ({ effects: [] as (() => unknown)[], focus: [] as (() => unknown)[] }));
vi.mock('react', async () => ({
  ...await vi.importActual('react'),
  useRef: (value: unknown) => ({ current: value }),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => unknown) => { lifecycle.effects.push(effect); },
  useLayoutEffect: (effect: () => unknown) => { lifecycle.effects.push(effect); },
}));
vi.mock('expo-router', () => ({ useFocusEffect: (effect: () => unknown) => lifecycle.focus.push(effect) }));
vi.mock('@clerk/expo', () => ({ useAuth: () => ({ userId: 'user_a', getToken: async () => 'token_a' }) }));
vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/chat-stream', () => ({ streamChatMessage: vi.fn() }));
vi.mock('@/store/chat-store', async () => {
  const actual = await vi.importActual<typeof import('@/store/chat-store')>('@/store/chat-store');
  return { useChatStore: Object.assign((selector: (state: ReturnType<typeof actual.useChatStore.getState>) => unknown) => selector(actual.useChatStore.getState()), actual.useChatStore) };
});
const selections = [{ documentId: 'selected-book', role: 'syllabus' as const }];
afterEach(() => { lifecycle.effects = []; lifecycle.focus = []; useChatStore.getState().resetTabData(); vi.clearAllMocks(); });
it('first Chat mount preserves books prepared in Upload instead of loading the latest unrelated chat', async () => {
  useChatStore.getState().setSelections(selections);
  useChat();
  for (const effect of lifecycle.effects) effect();
  for (const effect of lifecycle.focus) effect();
  await Promise.resolve();
  expect(useChatStore.getState().selections).toEqual(selections);
  expect(apiFetch).not.toHaveBeenCalled();
});
it('a delayed latest-chat response cannot overwrite newly prepared source selections', async () => {
  let resolve!: (value: unknown) => void;
  vi.mocked(apiFetch).mockImplementation(() => new Promise(r => { resolve = r; }));
  const pending = useChatStore.getState().fetchActiveConversation(async () => 'token_a', { force: true });
  await Promise.resolve();
  useChatStore.getState().setSelections(selections);
  resolve({ conversation: { conversationId: 'unrelated', selections: [] }, messages: [] });
  await pending;
  expect(useChatStore.getState().selections).toEqual(selections);
  expect(useChatStore.getState().conversationId).toBeNull();
});
it('reopening a cached chat fetches its scope and blocks sending until metadata is restored', async () => {
  const chat = useChat();
  for (const effect of lifecycle.effects) effect();
  useChatStore.setState({ lastFetchedAt: Date.now(), messageCache: { cached: [{ messageId: 'a', content: 'Previous grounded answer', role: 'assistant', createdAt: 'now' }] } });
  let resolve!: (value: unknown) => void;
  vi.mocked(apiFetch).mockImplementation(() => new Promise(r => { resolve = r; }));
  const opening = chat.openConversation('cached');
  await Promise.resolve();
  await chat.sendMessage('Which questions are outside scope?');
  expect(streamChatMessage).not.toHaveBeenCalled();
  expect(apiFetch).toHaveBeenCalled();
  resolve({ conversation: { conversationId: 'cached', selections, verificationId: 'review-a' }, messages: [] });
  await opening;
  expect(useChatStore.getState().selections).toEqual(selections);
  expect(useChatStore.getState().verificationId).toBe('review-a');
  await chat.sendMessage('Which questions are outside scope?');
  expect(streamChatMessage).toHaveBeenCalledWith(expect.objectContaining({ selections, verificationId: 'review-a' }));
});
it('a completed response cannot restore a conversation after its private source is deleted', async () => {
  const chat = useChat();
  for (const effect of lifecycle.effects) effect();
  let finish!: () => void;
  let options!: Parameters<typeof streamChatMessage>[0];
  vi.mocked(streamChatMessage).mockImplementation(input => { options = input; return new Promise<void>(resolve => { finish = resolve; }); });
  const sending = chat.sendMessage('Private question');
  await Promise.resolve();
  useChatStore.getState().resetTabData();
  options.onDone({ type: 'done', conversationId: 'deleted', userMessageId: 'user-message', messageId: 'assistant-message', citations: [] });
  finish();
  await sending;
  expect(useChatStore.getState().conversationId).toBeNull();
});
it('starting a new chat during history loading releases the send guard and ignores the old load', async () => {
  const chat = useChat();
  for (const effect of lifecycle.effects) effect();
  let resolveOld!: (value: unknown) => void;
  vi.mocked(apiFetch).mockImplementation((_path, options) => options.method === 'POST'
    ? Promise.resolve({ conversation: { conversationId: 'new-chat' }, messages: [] })
    : new Promise(resolve => { resolveOld = resolve; }));
  vi.mocked(streamChatMessage).mockResolvedValue(undefined);
  const old = useChatStore.getState().fetchActiveConversation(async () => 'token_a', { force: true });
  await Promise.resolve();
  await chat.startNewChat();
  await chat.sendMessage('Start here');
  expect(streamChatMessage).toHaveBeenCalled();
  resolveOld({ conversation: { conversationId: 'old-chat' }, messages: [] });
  await old;
  expect(useChatStore.getState().conversationId).toBe('new-chat');
});
