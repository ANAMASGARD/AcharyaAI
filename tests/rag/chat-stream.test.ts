import { it, expect, vi, afterEach } from "vitest";
import { streamChatMessage } from "@/lib/chat-stream";
vi.mock("expo/fetch", () => ({ fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) }));
vi.mock("@/lib/api-client", () => ({
  getApiBaseUrl: () => "https://test.invalid",
}));
afterEach(() => vi.unstubAllGlobals());
it("reports a truncated stream instead of accepting a partial answer", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response('{"type":"delta","content":"Partial"}\n')),
  );
  const onError = vi.fn(),
    onDone = vi.fn();
  await streamChatMessage({
    token: "test",
    message: "Question",
    requestId: "request-test-1",
    onDelta: vi.fn(),
    onDone,
    onError,
  });
  expect(onDone).not.toHaveBeenCalled();
  expect(onError).toHaveBeenCalledWith(expect.stringContaining("interrupted"));
});
it("does not deliver events after account cancellation", async () => {
  const controller = new AbortController();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      controller.abort();
      return new Response('{"type":"delta","content":"Private"}\n');
    }),
  );
  const onDelta = vi.fn();
  await streamChatMessage({
    token: "test",
    message: "Question",
    requestId: "request-test-2",
    onDelta,
    onDone: vi.fn(),
    onError: vi.fn(),
    signal: controller.signal,
  });
  expect(onDelta).not.toHaveBeenCalled();
});
