/** Isolated synthetic gate: never the entry point of the normal application. No microphone or account access. */
import '../src/lib/entry-polyfills';
import { registerRootComponent } from 'expo';
import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { STT_MODELS } from '../src/lib/offline-stt/models';
import { cancelSttDownload, checkSttDownloads, downloadSttModel, getSttDownloads, pauseSttDownload, removeSttModel, subscribeSttDownloads } from '../src/lib/offline-stt/download';
import { createOfflineEngine } from '../src/lib/offline-stt/engine';
import { createSessionRecordingApi } from '../src/lib/recording/session-api';
import { recordingRepository } from '../src/lib/recording/repository';
import { RecorderController } from '../src/lib/recording/controller';
import { createId } from '../src/lib/id';
import { listClassHistory, readClassHistory } from '../src/lib/reports/history';

const owner = 'offline_stt_synthetic_gate';
function ensure(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function waitForFinished(controller: RecorderController): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const check = () => {
      const snapshot = controller.getSnapshot().snapshot;
      if (!snapshot?.session.serverFinalized) return;
      unsubscribe(); clearTimeout(timeout);
      if (snapshot.chunks.some(c => c.status !== 'done' && c.status !== 'empty')) reject(new Error(snapshot.chunks.find(c => c.error)?.error ?? 'Transcription failed'));
      else resolve();
    };
    const unsubscribe = controller.subscribe(check);
    const timeout = setTimeout(() => { unsubscribe(); reject(new Error('Inference exceeded 30-minute gate deadline')); }, 30 * 60 * 1000);
    check();
  });
}
async function run(log: (message: string) => void) {
  const events: string[] = [];
  let activeController: RecorderController | null = null;
  const report = (message: string) => {
    events.push(message); log(message); console.info(`AcharyaSttGate ${message}`);
    new File(Paths.document, 'offline-stt-gate.json').write(JSON.stringify(events));
  };
  const asset = Asset.fromModule(require('../.expo/offline-stt-gate/class.wav'));
  await asset.downloadAsync(); ensure(asset.localUri, 'Fixture missing');
  const audio = await new File(asset.localUri).bytes();
  // Fixture is standard PCM WAV. Native capture's exact 44-byte header is rebuilt below.
  let dataAt = 12;
  const source = new DataView(audio.buffer, audio.byteOffset, audio.byteLength);
  while (String.fromCharCode(...audio.slice(dataAt, dataAt + 4)) !== 'data') dataAt += 8 + source.getUint32(dataAt + 4, true);
  const pcm = audio.slice(dataAt + 8, dataAt + 8 + source.getUint32(dataAt + 4, true));
  ensure(pcm.length === 65 * 32000, 'Expected a 65-second PCM fixture');
  function wav(start: number, seconds: number) {
    const payload = pcm.slice(start * 32000, (start + seconds) * 32000);
    const result = new Uint8Array(44 + payload.length); const view = new DataView(result.buffer);
    const text = (at: number, value: string) => [...value].forEach((c, i) => { result[at + i] = c.charCodeAt(0); });
    text(0, 'RIFF'); view.setUint32(4, result.length - 8, true); text(8, 'WAVEfmt '); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 16000, true); view.setUint32(28, 32000, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, payload.length, true); result.set(payload, 44); return result;
  }
  try {
    const previous = await listClassHistory(owner);
    for (const saved of previous) {
      const detail = await readClassHistory(owner, saved.sessionId);
      ensure(detail?.recording?.session.ownerClerkId === owner, 'History owner mismatch after restart');
      if (detail.recording.session.serverFinalized) ensure(detail.transcript, 'Saved transcript missing after restart');
    }
    report(`restored ${previous.length} saved classes`);
    if (new File(Paths.document, 'stt-gate-completed.flag').exists) {
      ensure(previous.length >= 2, 'Saved classes missing after cold restart');
      report('PASS cold restart reopened saved transcript-only classes');
      return;
    }
    await checkSttDownloads();
    if (new File(Paths.document, 'download-controls.flag').exists) {
      const model = STT_MODELS[0];
      ensure(await removeSttModel(model.id), 'Could not prepare isolated download control test');
      for (const control of ['cancel', 'pause'] as const) {
        let requested = false; let action: Promise<void> | null = null;
        const unsubscribe = subscribeSttDownloads(() => {
          const state = getSttDownloads()[model.id];
          log(`Download control test: ${state.status} ${Math.round(state.progress * 100)}%`);
          if (!requested && state.status === 'downloading' && state.progress > 0.02 && state.progress < 0.8) {
            requested = true;
            action = control === 'cancel' ? cancelSttDownload(model.id) : pauseSttDownload(model.id);
          }
        });
        try { await downloadSttModel(model.id); await action; } finally { unsubscribe(); }
        const expected = control === 'cancel' ? 'missing' : 'paused';
        ensure(requested && getSttDownloads()[model.id].status === expected, `Download ${control} failed: ${getSttDownloads()[model.id].error}`);
        report(`PASS download ${control}`);
      }
      await downloadSttModel(model.id);
      ensure(getSttDownloads()[model.id].status === 'downloaded', getSttDownloads()[model.id].error ?? 'Resume verification failed');
      report('PASS download resume and checksum verification');
      new File(Paths.document, 'download-controls.flag').delete();
    }
    for (const model of STT_MODELS) {
      report(`download ${model.id}`);
      const unsubscribe = subscribeSttDownloads(() => log(`${model.label}: ${getSttDownloads()[model.id].status} ${Math.round(getSttDownloads()[model.id].progress * 100)}%`));
      await downloadSttModel(model.id); unsubscribe();
      ensure(getSttDownloads()[model.id].status === 'downloaded', getSttDownloads()[model.id].error ?? 'Model unavailable');
      report(`verified ${model.id}`);
      const controller = new RecorderController(owner, recordingRepository, createSessionRecordingApi(owner), { durable: true, start: async () => {}, stop: async () => {} }, createId);
      activeController = controller;
      await controller.restore();
      const restored = controller.getSnapshot().snapshot;
      if (restored && !restored.session.serverFinalized && restored.chunks.length) {
        report(`recovering unfinished ${restored.session.sttModelId}`);
        await waitForFinished(controller);
      }
      const started = Date.now();
      await controller.start({ title: `Synthetic ${model.label}`, subject: 'English', grade: '6' }, { sttBackend: 'whisper', sttModelId: model.id, sttLanguage: 'auto' });
      ensure(controller.getSnapshot().snapshot?.session.status === 'recording', controller.getSnapshot().error ?? 'Recorder did not start; check unfinished saved transcription');
      report(`loaded ${model.id} ${Date.now() - started}ms`);
      for (const [index, start, seconds] of [[0, 0, 30], [1, 30, 30], [2, 60, 5]]) await controller.ingestNativeChunk(index, wav(start, seconds), seconds * 1000);
      const finished = waitForFinished(controller);
      await controller.stop(); await finished;
      const saved = controller.getSnapshot().snapshot!;
      ensure(saved.chunks.length === 3 && saved.chunks.every(c => !c.localUri), 'Chunk persistence/audio cleanup failed');
      ensure(saved.chunks.some(c => /country|americans|ask/i.test(c.transcript)), 'Expected English fixture words were not recognized');
      const detail = await readClassHistory(owner, saved.session.id);
      ensure(detail?.transcript && !detail.report, 'Transcript-only class could not reopen');
      report(`PASS ${model.id} totalMs=${Date.now() - started} chunks=30,30,5 chars=${detail.transcript.length}`);
      await controller.close();
      activeController = null;
      const engine = createOfflineEngine();
      try {
        for (const [name, sourceAsset] of [
          ['hindi', require('../.expo/offline-stt-gate/hindi.wav')],
          ['hinglish', require('../.expo/offline-stt-gate/hinglish.wav')],
          ['silence', require('../.expo/offline-stt-gate/silence.wav')],
        ] as const) {
          const sample = Asset.fromModule(sourceAsset); await sample.downloadAsync();
          ensure(sample.localUri, 'Synthetic fixture unavailable');
          const began = Date.now();
          const result = await engine.transcribe(saved.session, { ...saved.chunks[0], localUri: sample.localUri }, new AbortController().signal);
          // These texts are generated/public test fixtures, never classroom data.
          report(`SAMPLE ${model.id} ${name} ms=${Date.now() - began} language=${result.detectedLanguage} text=${result.transcript}`);
        }
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), 500);
        try {
          await engine.transcribe(saved.session, { ...saved.chunks[0], localUri: asset.localUri }, abort.signal);
          throw new Error('Cancelled inference returned a result');
        } catch (error) {
          ensure(abort.signal.aborted && error instanceof Error && /cancelled/i.test(error.message), 'Native cancellation did not settle safely');
        } finally { clearTimeout(timer); }
      } finally { await engine.dispose(); }
      report(`PASS cancellation and context release ${model.id}`);
    }
    ensure((await listClassHistory(owner)).length >= 2, 'Both classes must remain in history');
    new File(Paths.document, 'stt-gate-completed.flag').write('complete');
    report('PASS all models and transcript history');
  } catch (error) { report(`FAIL ${error instanceof Error ? error.message : String(error)}`); }
  finally { await activeController?.close(); }
}
let runningGate: Promise<void> | null = null;
function Gate() {
  const [status, setStatus] = useState('Preparing synthetic STT gate…');
  useEffect(() => { runningGate ??= run(setStatus); }, []);
  return <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}><Text>{status}</Text></View>;
}
registerRootComponent(Gate);
