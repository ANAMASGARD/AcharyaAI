import { File } from 'expo-file-system';
import { fetch } from 'expo/fetch';

import { getApiOrigin } from '@/lib/api-origin';
import { RecordingApiError, type RecordingApi, type SttChunkResponse } from './types';

type GetToken = () => Promise<string | null>;
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
async function authenticatedToken(getToken: GetToken, signal: AbortSignal): Promise<string | null> {
  // Clerk token refresh may outlive a network deadline; cancellation must also bound that wait.
  return new Promise((resolve, reject) => {
    const aborted = () => reject(new RecordingApiError('Recording request was interrupted', true));
    signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) { aborted(); signal.removeEventListener('abort', aborted); return; }
    Promise.resolve().then(getToken).then(resolve, (error: unknown) => {
      const status = isObject(error) ? error.status ?? error.statusCode : null;
      reject(new RecordingApiError(status === 401 || status === 403 ? 'Sign in again to upload your recording' : 'Could not refresh your session. Try again when connected.', status !== 401 && status !== 403));
    }).finally(() => signal.removeEventListener('abort', aborted));
  });
}
async function request(getToken: GetToken, path: string, method: string, body: BodyInit | undefined, signal: AbortSignal, json = false): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) controller.abort();
  const timeout = setTimeout(abort, 45_000);
  try {
    const token = await authenticatedToken(getToken, controller.signal);
    if (controller.signal.aborted) throw new RecordingApiError('Recording request was interrupted', true);
    if (!token) throw new RecordingApiError('Sign in again to upload your recording', false);
    let origin: string;
    try { origin = getApiOrigin(); } catch { throw new RecordingApiError('The recording service URL is not configured correctly', false); }
    const response = await fetch(`${origin}${path}`, {
      method, body, signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, ...(json ? { 'Content-Type': 'application/json' } : {}) },
    });
    const data: unknown = await response.json().catch(() => null);
    if (controller.signal.aborted) throw new RecordingApiError('Recording request was interrupted', true);
    if (!response.ok) {
      const error = isObject(data) && isObject(data.error) ? data.error : null;
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      throw new RecordingApiError(
        error && typeof error.message === 'string' ? error.message : `Recording request failed (${response.status})`,
        error && typeof error.retryable === 'boolean' ? error.retryable : retryable,
        error && typeof error.retryAfterMs === 'number' && Number.isFinite(error.retryAfterMs) ? Math.max(0, error.retryAfterMs) : 0,
      );
    }
    return data;
  } catch (error) {
    if (error instanceof RecordingApiError) throw error;
    if (controller.signal.aborted) throw new RecordingApiError('Recording request timed out or was interrupted', true);
    throw new RecordingApiError('Could not reach the recording service. Try again when connected.', true);
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
}

export function createRecordingApi(getToken: GetToken): RecordingApi {
  return {
    async create(session, signal) {
      await request(getToken, '/api/sessions', 'POST', JSON.stringify({
        id: session.id, title: session.title, subject: session.subject, grade: session.grade, startedAt: session.startedAt,
      }), signal, true);
    },
    async finalize(session, signal) {
      await request(getToken, '/api/sessions', 'PATCH', JSON.stringify({
        id: session.id, durationMs: session.durationMs, expectedChunkCount: session.expectedChunkCount, status: session.status,
      }), signal, true);
    },
    async transcribe(chunk, signal): Promise<SttChunkResponse> {
      if (!chunk.localUri) throw new RecordingApiError('Saved audio is missing for this segment', false);
      const file = new File(chunk.localUri);
      if (!file.exists) throw new RecordingApiError('Saved audio is missing for this segment', false);
      const body = new FormData();
      body.append('audio', file, `${chunk.id}.wav`);
      body.append('sessionId', chunk.sessionId);
      body.append('chunkId', chunk.id);
      body.append('chunkIndex', String(chunk.index));
      body.append('startMs', String(chunk.startMs));
      body.append('durationMs', String(chunk.durationMs));
      const data = await request(getToken, '/api/gnani/stt', 'POST', body, signal);
      if (!isObject(data) || data.chunkId !== chunk.id || data.chunkIndex !== chunk.index ||
          typeof data.transcript !== 'string' || (data.status !== 'done' && data.status !== 'empty') ||
          (data.status === 'done' && !data.transcript.trim()) || (data.status === 'empty' && data.transcript !== '')) {
        throw new RecordingApiError('The transcription service returned an invalid segment', true);
      }
      return { chunkId: chunk.id, chunkIndex: chunk.index, transcript: data.transcript, status: data.status };
    },
  };
}

export async function deleteRecordingAccount(getToken: GetToken): Promise<void> {
  await request(getToken, '/api/sessions', 'DELETE', undefined, new AbortController().signal);
}
