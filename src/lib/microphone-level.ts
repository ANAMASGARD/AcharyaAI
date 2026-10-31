/** Map mono float PCM to a bounded visual level; quiet room noise stays dotted. */
export function microphoneLevel(samples: Float32Array): number {
  if (!samples.length) return 0;
  let energy = 0;
  for (const sample of samples) energy += Number.isFinite(sample) ? sample * sample : 0;
  const rms = Math.sqrt(energy / samples.length);
  const db = 20 * Math.log10(Math.max(rms, 1e-8));
  if (db <= -45) return 0;
  return Math.min(1, Math.max(0, (db + 45) / 35));
}
