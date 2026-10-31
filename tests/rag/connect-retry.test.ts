import { afterEach, expect, it, vi } from "vitest";
import {
  failedBeforeConnect,
  fetchWithConnectRetry,
} from "@/server/rag/connect-retry";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("retries connection establishment only, never ambiguous sent SQL", async () => {
  expect(
    failedBeforeConnect({
      cause: {
        errors: [
          { syscall: "connect", code: "ETIMEDOUT" },
          { syscall: "connect", code: "ENETUNREACH" },
        ],
      },
    }),
  ).toBe(true);
  const ambiguous = new Error("socket closed", {
    cause: { code: "ECONNRESET" },
  });
  const call = vi.fn().mockRejectedValue(ambiguous);
  vi.stubGlobal("fetch", call);
  await expect(fetchWithConnectRetry("https://database.example")).rejects.toBe(
    ambiguous,
  );
  expect(call).toHaveBeenCalledTimes(1);
  vi.useFakeTimers();
  call
    .mockReset()
    .mockRejectedValueOnce(
      new Error("fetch failed", { cause: { syscall: "connect" } }),
    )
    .mockResolvedValue(Response.json({ ok: true }));
  const pending = fetchWithConnectRetry("https://database.example");
  await vi.runAllTimersAsync();
  expect((await pending).ok).toBe(true);
  expect(call).toHaveBeenCalledTimes(2);
});
