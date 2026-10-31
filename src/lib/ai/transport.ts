import { fetch } from 'expo/fetch';
import { getProviderCredential } from '@/lib/ai-keys/vault';
import type { AiProvider, ProviderCredential } from '@/lib/ai-keys/providers';
import { registerAiRequest } from './cancellation';

export class AiRequestError extends Error {
  constructor(message: string, public readonly retryable = false, public readonly retryAfterMs = 0) { super(message); }
}
export function checkAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new AiRequestError('AI request cancelled or timed out.', true);
}
export async function withProvider<T>(owner: string, provider: AiProvider, signal: AbortSignal, operation: (credential: ProviderCredential, signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  const unregister = registerAiRequest(owner, controller);
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) cancel();
  const timer = setTimeout(cancel, 45_000);
  try {
    checkAborted(controller.signal);
    const credential = await getProviderCredential(owner, provider);
    checkAborted(controller.signal);
    const result = await operation(credential, controller.signal);
    checkAborted(controller.signal);
    return result;
  } finally { clearTimeout(timer); signal.removeEventListener('abort', cancel); unregister(); }
}

export async function providerFetch(url: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
  checkAborted(signal);
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal, redirect: 'error', credentials: 'omit' });
  } catch {
    checkAborted(signal);
    throw new AiRequestError('Could not reach the AI provider. Check your connection and HTTPS endpoint.', true);
  }
  checkAborted(signal);
  if (!response.ok) {
    // Never surface provider bodies: they may echo credentials or user content.
    const retrySeconds = Number(response.headers.get('retry-after'));
    const delay = Number.isFinite(retrySeconds) ? Math.min(300_000, Math.max(0, retrySeconds * 1000)) : 0;
    const message = response.status === 401 || response.status === 403 ? 'The provider rejected this API key or its permissions. Check AI API keys.'
      : response.status === 429 ? 'Provider quota or rate limit reached. Check billing or retry later.'
        : response.status === 404 ? 'Model or endpoint not found. Check the model ID in AI API keys.'
          : `AI provider request failed (${response.status}). Check your model configuration.`;
    throw new AiRequestError(message, response.status === 408 || response.status === 429 || response.status >= 500, delay);
  }
  return response;
}
export function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
export async function readBytes(response: Response, maxBytes: number): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) throw new AiRequestError('The AI provider returned no response body.', true);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new AiRequestError('The AI provider response is too large.'); }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } catch (error) {
    if (error instanceof AiRequestError) throw error;
    throw new AiRequestError('The AI provider response was interrupted. Please retry.', true);
  } finally { reader.releaseLock(); }
}
export async function readJson(response: Response): Promise<unknown> {
  const bytes = await readBytes(response, 1_000_000);
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new AiRequestError('The AI provider returned an unreadable response.', true); }
}
