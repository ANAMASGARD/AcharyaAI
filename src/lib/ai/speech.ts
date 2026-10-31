import { withProvider, providerFetch, readJson, readBytes, isRecord, AiRequestError } from './transport';

export async function transcribeAudio(owner: string, audio: Blob, signal: AbortSignal): Promise<string> {
  if (!audio.size || audio.size > 2_000_000) throw new AiRequestError('Audio segment is empty or too large.');
  return withProvider(owner, 'gnani', signal, async ({ apiKey }, requestSignal) => {
    const form = new FormData();
    form.append('audio_file', audio, 'segment.wav');
    form.append('language_code', 'en-IN');
    form.append('format', 'transcribe');
    const response = await providerFetch('https://api.vachana.ai/stt/v3', {
      method: 'POST', headers: { 'X-API-Key-ID': apiKey }, body: form,
    }, requestSignal);
    const data = await readJson(response);
    if (!isRecord(data) || data.success !== true || typeof data.transcript !== 'string') throw new AiRequestError('Gnani returned an invalid transcript.', true);
    return data.transcript.trim();
  });
}

export async function synthesizeSpeech(owner: string, text: string, signal: AbortSignal): Promise<Uint8Array> {
  if (!text.trim() || text.length > 2000) throw new AiRequestError('Read aloud supports up to 2,000 characters per message.');
  return withProvider(owner, 'gnani', signal, async ({ apiKey }, requestSignal) => {
    const response = await providerFetch('https://api.vachana.ai/api/v1/tts/inference', {
      method: 'POST', headers: { 'X-API-Key-ID': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: 'Poorvi', model: 'timbre-v2.5', language: 'hi-en', speed: 1,
        audio_config: { sample_rate: 24000, num_channels: 1, sample_width: 2, encoding: 'linear_pcm', container: 'wav' } }),
    }, requestSignal);
    const bytes = await readBytes(response, 20_000_000);
    if (bytes.length < 44 || bytes.length > 20_000_000 || String.fromCharCode(...bytes.slice(0, 4)) !== 'RIFF' || String.fromCharCode(...bytes.slice(8, 12)) !== 'WAVE') {
      throw new AiRequestError('Gnani returned invalid speech audio.', true);
    }
    return bytes;
  });
}
