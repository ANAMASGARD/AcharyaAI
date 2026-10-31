import { SttError } from '@/server/recording/validation';

export async function transcribeWithGnani(audio: Blob): Promise<string> {
  const key = process.env.GNANI_API_KEY;
  if (!key) throw new SttError('PROVIDER_NOT_CONFIGURED', 'Speech service is not configured', 503);
  const form = new FormData();
  form.append('audio_file', audio, 'chunk.wav');
  form.append('language_code', 'en-IN');
  form.append('format', 'transcribe');
  try {
    const response = await fetch('https://api.vachana.ai/stt/v3', { method: 'POST', headers: { 'X-API-Key-ID': key }, body: form, signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw new SttError('PROVIDER_ERROR', 'Speech service could not process this segment', 502, response.status === 429 || response.status >= 500);
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('success' in body) || body.success !== true || !('transcript' in body) || typeof body.transcript !== 'string') throw new SttError('PROVIDER_RESPONSE', 'Speech service returned an invalid response', 502, true);
    return body.transcript.trim();
  } catch (error) {
    if (error instanceof SttError) throw error;
    throw new SttError('PROVIDER_UNAVAILABLE', 'Speech service timed out or is unavailable', 503, true);
  }
}
