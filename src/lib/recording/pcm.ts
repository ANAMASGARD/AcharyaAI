/** Native PCM buffers are float32 mono. WAV uploads are PCM16 mono, 16 kHz. */
export const SAMPLE_RATE = 16000;
export const CHUNK_SAMPLES = SAMPLE_RATE * 30;
export type PcmBuffer = { data: ArrayBuffer; sampleRate: number; channels: number };

export function encodeWav(samples: Float32Array): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const label = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i);
  };
  label(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); label(8, 'WAVE');
  label(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); label(36, 'data'); view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
  }
  return bytes;
}

export class PcmChunker {
  private samples = new Float32Array(CHUNK_SAMPLES);
  private length = 0;
  private total = 0;
  constructor(private readonly emit: (wav: Uint8Array, startMs: number, durationMs: number) => void) {}
  push(buffer: PcmBuffer): void {
    if (buffer.sampleRate !== SAMPLE_RATE || buffer.channels !== 1 || buffer.data.byteLength % 4) {
      throw new Error('This microphone did not provide 16 kHz mono audio. Try reconnecting your microphone.');
    }
    const input = new Float32Array(buffer.data);
    if (input.some((sample) => !Number.isFinite(sample))) throw new Error('The microphone returned invalid audio. Please try again.');
    let offset = 0;
    while (offset < input.length) {
      const count = Math.min(CHUNK_SAMPLES - this.length, input.length - offset);
      this.samples.set(input.subarray(offset, offset + count), this.length);
      this.length += count; offset += count;
      if (this.length === CHUNK_SAMPLES) this.flush();
    }
  }
  flush(): void {
    if (!this.length) return;
    const length = this.length;
    const wav = encodeWav(this.samples.subarray(0, length));
    const startMs = this.total * 1000 / SAMPLE_RATE;
    this.total += length;
    this.length = 0;
    this.emit(wav, startMs, length * 1000 / SAMPLE_RATE);
  }
}
