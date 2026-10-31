import { it, expect, vi } from "vitest";
import { useChatStore } from "@/store/chat-store";
import { useChatHistoryStore } from "@/store/chat-history-store";
import { apiFetch } from "@/lib/api-client";
vi.mock("@/lib/api-client", () => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/preferences-persist-storage", () => ({
  preferencesPersistStorage: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  },
}));
it("discards a previous account conversation response after caches are reset", async () => {
  let resolve!: (value: unknown) => void;
  vi.mocked(apiFetch).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  useChatStore.getState().resetTabData();
  const pending = useChatStore
    .getState()
    .fetchActiveConversation(async () => "account-a", { force: true });
  await Promise.resolve();
  useChatStore.getState().resetTabData();
  resolve({
    conversation: { conversationId: "private-a", selections: [] },
    messages: [
      {
        messageId: "secret",
        content: "Private account A",
        role: "assistant",
        createdAt: "now",
      },
    ],
  });
  await pending;
  expect(useChatStore.getState().messages).toEqual([]);
  expect(useChatStore.getState().conversationId).toBeNull();
});
it("discards previous account history after reset", async () => {
  let resolve!: (value: unknown) => void;
  vi.mocked(apiFetch).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  useChatHistoryStore.getState().reset();
  const pending = useChatHistoryStore
    .getState()
    .fetchConversations(async () => "account-a", { force: true });
  await Promise.resolve();
  useChatHistoryStore.getState().reset();
  resolve({
    conversations: [{ conversationId: "private-a", title: "Private" }],
  });
  await pending;
  expect(useChatHistoryStore.getState().conversations).toEqual([]);
});
