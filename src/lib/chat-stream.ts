import { fetch } from "expo/fetch";
import type { SourceSelection } from "@/types/rag";
import { getApiBaseUrl } from "@/lib/api-client";
import type { NdjsonStreamEvent } from "@/types/chat";

type StreamChatMessageOptions = Readonly<{
  token: string;
  conversationId?: string | null;
  message: string;
  requestId: string;
  verificationId?: string | null;
  selections?: SourceSelection[];
  onDelta: (content: string) => void;
  onDone: (event: Extract<NdjsonStreamEvent, { type: "done" }>) => void;
  onError: (message: string) => void;
  onStreamOpen?: () => void;
  onStreamActivity?: () => void;
  signal?: AbortSignal;
}>;

function parseNdjsonLines(buffer: string): {
  events: NdjsonStreamEvent[];
  remainder: string;
} {
  const lines = buffer.split("\n");
  const remainder = lines.pop() ?? "";
  const events: NdjsonStreamEvent[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    try {
      events.push(JSON.parse(trimmed) as NdjsonStreamEvent);
    } catch {
      // skip malformed lines
    }
  }

  return { events, remainder };
}

function handleEvents(
  events: NdjsonStreamEvent[],
  options: StreamChatMessageOptions,
): boolean {
  let shouldStop = false;

  for (const event of events) {
    if (options.signal?.aborted) return true;
    if (event.type === "delta") {
      options.onDelta(event.content);
      continue;
    }

    if (event.type === "done") {
      options.onDone(event);
      shouldStop = true;
      continue;
    }

    if (event.type === "error") {
      options.onError(event.error);
      shouldStop = true;
    }
  }

  return shouldStop;
}

export async function streamChatMessage(
  options: StreamChatMessageOptions,
): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/api/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.token}`,
      "Content-Type": "application/json",
      Accept: "application/x-ndjson",
    },
    body: JSON.stringify({
      conversationId: options.conversationId ?? undefined,
      message: options.message,
      requestId: options.requestId,
      verificationId: options.verificationId ?? undefined,
      selections: options.selections,
    }),
    signal: options.signal,
  });

  if (response.status === 499 || options.signal?.aborted) {
    return;
  }

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof (payload as { error: unknown }).error === "string"
        ? (payload as { error: string }).error
        : `Chat failed (${response.status})`;

    options.onError(message);
    return;
  }

  options.onStreamOpen?.();

  const reader = response.body?.getReader();
  let hasStreamActivity = false;

  if (reader) {
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        if (options.signal?.aborted) {
          return;
        }

        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        if (!hasStreamActivity && value && value.byteLength > 0) {
          hasStreamActivity = true;
          options.onStreamActivity?.();
        }

        buffer += decoder.decode(value, { stream: true });
        const parsed = parseNdjsonLines(buffer);
        buffer = parsed.remainder;

        if (handleEvents(parsed.events, options)) {
          return;
        }
      }

      if (buffer.trim()) {
        const parsed = parseNdjsonLines(`${buffer}\n`);
        if (handleEvents(parsed.events, options)) return;
      }
      if (!options.signal?.aborted)
        options.onError(
          "The response was interrupted. Retry to resume safely.",
        );
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
    return;
  }

  const text = await response.text();
  const parsed = parseNdjsonLines(`${text}\n`);
  if (!handleEvents(parsed.events, options) && !options.signal?.aborted)
    options.onError("The response was interrupted. Please retry.");
}
