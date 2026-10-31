import { z } from "zod";
import OpenAI from "openai";
import { reserveUsage, settleUsage } from "./budget";
import { tokenCount } from "./tokens";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, RagError } from "./contracts";

const reservations = new WeakMap<Response, string>();
export function reasoningModel(): string {
  return process.env.OPENAI_REASONING_MODEL?.trim() || "gpt-5-mini";
}
export async function openAI(
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Response> {
  const key = (process.env.RAG_OPENAI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim());
  if (!key)
    throw new RagError(
      "OpenAI is not configured: set server OPENAI_API_KEY.",
      503,
    );
  const usageId = await reserveUsage(body);
  const timeout = AbortSignal.timeout(90_000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  // Retries are owned by our durable, budgeted processing steps. The SDK must
  // never perform another billable call behind a single reservation.
  const client = new OpenAI({ apiKey: key, maxRetries: 0, timeout: 90_000 });
  let response: Response;
  try {
    response = await client
      .post(`/${path}`, {
        body,
        signal: combined,
        stream: body.stream === true,
      })
      .asResponse();
  } catch (error) {
    if (!(error instanceof OpenAI.APIError))
      throw new RagError(
        "OpenAI connection interrupted. Retry from saved progress.",
        503,
      );
    // Never forward provider payloads containing user content or credentials.
    const retryAfter = error.headers?.get("retry-after");
    const retrySeconds = retryAfter
      ? /^\d+$/.test(retryAfter)
        ? Number(retryAfter)
        : Math.max(0, (Date.parse(retryAfter) - Date.now()) / 1000)
      : undefined;
    throw new RagError(
      error.status === 429
        ? "OpenAI is busy or its quota is exhausted. Retry later."
        : `OpenAI request failed (${error.status ?? "connection"}).`,
      error.status === 429 ? 429 : 502,
      retrySeconds,
    );
  }
  if (!body.stream) {
    const payload = (await response.clone().json()) as { usage?: unknown };
    await settleUsage(usageId, String(body.model), payload.usage);
  } else reservations.set(response, usageId);
  return response;
}
export async function embedTexts(
  texts: string[],
  signal?: AbortSignal,
): Promise<number[][]> {
  if (!texts.length) return [];
  if (texts.length > 16 || texts.some((t) => !t.trim() || tokenCount(t) > 8191))
    throw new RagError("Embedding batch exceeds its safe input limit.");
  const response = await openAI(
    "embeddings",
    { model: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMENSIONS, input: texts },
    signal,
  );
  const payload = z
    .object({
      data: z.array(
        z.object({
          index: z.number().int(),
          embedding: z.array(z.number().finite()).length(EMBEDDING_DIMENSIONS),
        }),
      ),
    })
    .parse(await response.json());
  const rows = payload.data.sort((a, b) => a.index - b.index);
  if (rows.length !== texts.length || rows.some((r, i) => r.index !== i))
    throw new RagError(
      "Embedding response does not match the requested batch.",
      502,
    );
  return rows.map((r) => r.embedding);
}
export async function structured<T>(
  name: string,
  schema: z.ZodType<T>,
  input: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await openAI(
    "responses",
    {
      model: reasoningModel(),
      store: false,
      input,
      max_output_tokens:
        name === "retrieval_translation" || name === "review_chat_selection"
          ? 2000
          : name === "evidence_support" || name === "question_alignment"
            ? 4000
            : name === "paper_questions"
              ? 16000
              : 14000,
      reasoning: { effort: name.startsWith("document_pages") ? "high" : "low" },
      text: {
        format: {
          type: "json_schema",
          name,
          strict: true,
          schema: z.toJSONSchema(schema),
        },
      },
    },
    signal,
  );
  const payload = z
    .object({
      status: z.string(),
      output: z.array(
        z.object({
          type: z.string(),
          content: z
            .array(z.object({ type: z.string(), text: z.string().optional() }))
            .optional(),
        }),
      ),
    })
    .parse(await response.json());
  if (payload.status !== "completed")
    throw new RagError(
      "AI extraction or analysis was incomplete. Retry with a smaller document.",
      422,
    );
  const text = payload.output
    .flatMap((o) => o.content ?? [])
    .filter((c) => c.type === "output_text")
    .map((c) => c.text ?? "")
    .join("");
  try {
    return schema.parse(JSON.parse(text));
  } catch {
    throw new RagError(
      "AI returned an invalid or refused result. No result was accepted.",
      502,
    );
  }
}
export async function streamAnswer(
  input: unknown,
  onDelta: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const response = await openAI(
    "responses",
    {
      model: reasoningModel(),
      store: false,
      input,
      stream: true,
      max_output_tokens: 6000,
      reasoning: { effort: "low" },
    },
    signal,
  );
  const reader = response.body?.getReader();
  if (!reader) throw new RagError("OpenAI stream unavailable.", 502);
  let buffer = "",
    answer = "",
    completed = false;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        const event = JSON.parse(data) as {
          type: string;
          delta?: string;
          response?: { usage?: unknown };
        };
        if (event.type === "response.output_text.delta" && event.delta) {
          answer += event.delta;
          onDelta(event.delta);
        }
        if (event.type === "response.completed") {
          completed = true;
          await settleUsage(
            reservations.get(response)!,
            reasoningModel(),
            event.response?.usage,
          );
        }
        if (
          ["error", "response.failed", "response.incomplete"].includes(
            event.type,
          )
        )
          throw new RagError(
            "The AI response did not finish. Please retry.",
            502,
          );
      }
      if (done) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  if (!completed || !answer.trim())
    throw new RagError("The AI response did not finish. Please retry.", 502);
  return answer;
}
