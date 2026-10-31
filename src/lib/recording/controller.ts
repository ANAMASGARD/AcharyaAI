import { PcmChunker, type PcmBuffer } from './pcm';
import { RecordingApiError, type RecordingApi, type RecordingChunk, type RecordingRepository, type RecordingSession, type RecordingSnapshot } from './types';

type Capture = { start: () => Promise<void>; stop: () => void };
export type RecorderView = { snapshot: RecordingSnapshot | null; busy: boolean; error: string | null; hydrated: boolean };
const RETRIES = [1000, 4000, 16000];
const terminal = (chunk: RecordingChunk) => chunk.status === 'done' || chunk.status === 'empty' || chunk.status === 'failed';

/** One owner, one microphone, one upload worker. Persist before dispatch and before deleting audio. */
export class RecorderController {
  private view: RecorderView = { snapshot: null, busy: false, error: null, hydrated: false };
  private listeners = new Set<() => void>();
  private writes: Promise<void> = Promise.resolve();
  private request: AbortController | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private worker = false;
  private accepting = false;
  private closed = false;
  private closing = false;
  private generation = 0;
  private chunker: PcmChunker | null = null;
  private pendingWrites = 0;
  private captureError: string | null = null;
  private lastBufferAt = 0;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private stopping: Promise<void> | null = null;
  private nextIndex = 0;

  constructor(private readonly owner: string, private readonly repository: RecordingRepository,
    private readonly api: RecordingApi, private readonly capture: Capture, private readonly id: () => string) {}

  getSnapshot = (): RecorderView => this.view;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private publish(snapshot = this.view.snapshot, error = this.view.error, busy = this.view.busy): void {
    if (this.closed) return;
    this.view = { ...this.view, snapshot, error, busy };
    this.listeners.forEach((listener) => listener());
  }
  private updateSession(patch: Partial<RecordingSession>): RecordingSession {
    const snapshot = this.view.snapshot!;
    const session = { ...snapshot.session, ...patch, updatedAt: new Date().toISOString() };
    this.publish({ ...snapshot, session });
    return session;
  }
  private updateChunk(chunk: RecordingChunk): void {
    const snapshot = this.view.snapshot!;
    const chunks = [...snapshot.chunks.filter((item) => item.id !== chunk.id), chunk].sort((a, b) => a.index - b.index);
    this.publish({ ...snapshot, chunks });
  }
  private enqueueWrite(operation: () => Promise<void>): Promise<void> {
    const next = this.writes.then(operation);
    this.writes = next.catch(() => {});
    return next;
  }
  private async persistSession(patch: Partial<RecordingSession>): Promise<void> {
    const session = this.updateSession(patch);
    await this.enqueueWrite(() => this.repository.saveSession(session));
  }

  async restore(): Promise<void> {
    try {
      const saved = await this.repository.loadLatest(this.owner);
      if (this.closed) return;
      if (saved) {
        this.publish(saved);
        const interrupted = ['starting', 'recording', 'stopping'].includes(saved.session.status);
        if (interrupted) {
          this.captureError = 'Recording was interrupted. Saved segments are available; audio after the last saved segment may be missing.';
          await this.persistSession({ status: 'finishing', expectedChunkCount: saved.chunks.length, error: this.captureError });
        } else {
          this.captureError = saved.session.status === 'partial' ? saved.session.error : null;
          if (!saved.session.serverFinalized && saved.session.status !== 'finishing') {
            await this.persistSession({ status: 'finishing' });
          }
        }
        for (const chunk of saved.chunks) {
          if (chunk.status === 'processing') {
            const pending: RecordingChunk = { ...chunk, status: 'pending' };
            await this.repository.saveChunk(this.owner, pending); this.updateChunk(pending);
          }
        }
      }
      this.view = { ...this.view, hydrated: true };
      this.publish();
      if (saved && !saved.session.serverFinalized) void this.pump();
    } catch (error) {
      if (this.closed) return;
      this.view = { ...this.view, hydrated: true };
      this.publish(undefined, message(error));
    }
  }

  async start(metadata: { title: string; subject: string; grade: string }): Promise<void> {
    if (this.closed || this.closing || !this.view.hydrated || this.view.busy || this.accepting || this.worker ||
      this.view.snapshot?.chunks.some((chunk) => !terminal(chunk) || chunk.status === 'failed') ||
      (this.view.snapshot?.chunks.length && !this.view.snapshot.session.serverFinalized)) return;
    const generation = ++this.generation;
    this.captureError = null; this.nextIndex = 0; this.chunker = null;
    const now = new Date().toISOString();
    const session: RecordingSession = { ...metadata, id: this.id(), ownerClerkId: this.owner,
      startedAt: now, updatedAt: now, durationMs: 0, expectedChunkCount: 0,
      status: 'starting', serverCreated: false, serverFinalized: false, error: null };
    this.publish({ session, chunks: [] }, null, true);
    const request = new AbortController();
    try {
      await this.enqueueWrite(() => this.repository.saveSession(session));
      if (this.closed || generation !== this.generation) return;
      this.request = request;
      await this.api.create(session, request.signal);
      if (this.closed || generation !== this.generation) return;
      await this.persistSession({ serverCreated: true });
      if (this.closed || generation !== this.generation) return;
      this.chunker = new PcmChunker((wav, startMs, durationMs) => this.acceptChunk(wav, startMs, durationMs));
      // Accept callbacks during native start: some platforms emit before the promise resolves.
      this.accepting = true;
      this.lastBufferAt = Date.now();
      await this.capture.start();
      if (this.closed || generation !== this.generation || !this.accepting) { this.capture.stop(); return; }
      await this.persistSession({ status: 'recording', startedAt: new Date().toISOString() });
      this.watchdog = setInterval(() => {
        if (this.accepting && Date.now() - this.lastBufferAt > 5000) void this.stop('Microphone capture was interrupted. Tap Record to start a new recording.');
      }, 1000);
      this.publish(undefined, null, false);
    } catch (error) {
      if (this.closed || generation !== this.generation) return;
      await this.stop(message(error));
    } finally { if (this.request === request) this.request = null; }
  }

  push(buffer: PcmBuffer): void {
    if (!this.accepting || this.closed) return;
    this.lastBufferAt = Date.now();
    try { this.chunker?.push(buffer); } catch (error) { void this.stop(message(error)); }
  }

  private acceptChunk(wav: Uint8Array, startMs: number, durationMs: number): void {
    const session = this.view.snapshot?.session;
    if (!session || this.closed) return;
    if (this.pendingWrites >= 3) { void this.stop('Storage could not keep up with recording. Saved segments are retained.'); return; }
    const chunk: RecordingChunk = { id: this.id(), sessionId: session.id, index: this.nextIndex++,
      startMs: Math.round(startMs), durationMs: Math.max(1, Math.round(durationMs)), localUri: '', status: 'pending', transcript: '', attempts: 0, nextAttemptAt: null, error: null };
    this.pendingWrites++;
    void this.enqueueWrite(async () => {
      if (this.closed) return;
      chunk.localUri = await this.repository.writeAudio(this.owner, chunk.id, wav);
      await this.repository.saveChunk(this.owner, chunk);
      this.updateChunk(chunk);
      const current = this.updateSession({ durationMs: chunk.startMs + chunk.durationMs, expectedChunkCount: chunk.index + 1 });
      await this.repository.saveSession(current);
    }).then(() => { void this.pump(); }).catch((error: unknown) => {
      this.captureError = message(error);
      this.publish(undefined, message(error));
      void this.stop(message(error));
    }).finally(() => { this.pendingWrites--; });
  }

  stop(reason: string | null = null): Promise<void> {
    if (reason) this.captureError = reason;
    if (this.stopping) return this.stopping;
    this.stopping = this.finishCapture().finally(() => { this.stopping = null; });
    return this.stopping;
  }
  private async finishCapture(): Promise<void> {
    if (this.closed || !this.view.snapshot || !['starting', 'recording'].includes(this.view.snapshot.session.status)) return;
    ++this.generation;
    if (this.view.snapshot.session.status === 'starting') this.request?.abort();
    // Stop native capture first, then flush all buffers delivered to this controller.
    this.capture.stop(); this.accepting = false;
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
    this.publish(undefined, this.captureError, true);
    try {
      await this.persistSession({ status: 'stopping' });
      this.chunker?.flush(); this.chunker = null;
      await this.writes;
      if (this.closed) return;
      const chunks = this.view.snapshot!.chunks;
      await this.persistSession({ status: 'finishing', expectedChunkCount: chunks.length, error: this.captureError });
      this.publish(undefined, this.captureError, false);
      void this.pump();
    } catch (error) {
      this.updateSession({ status: 'failed', error: message(error) });
      this.publish(undefined, message(error), false);
    }
  }

  private schedule(delay: number): void {
    if (this.closed) return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => { this.retryTimer = null; void this.pump(); }, delay);
  }
  private async pump(): Promise<void> {
    if (this.closed || this.closing || this.worker || !this.view.snapshot) return;
    this.worker = true;
    try {
      while (!this.closed && !this.closing) {
        const snapshot = this.view.snapshot!;
        const pending = snapshot.chunks.filter((chunk) => chunk.status === 'pending');
        const chunk = pending.find((item) => !item.nextAttemptAt || item.nextAttemptAt <= Date.now());
        if (!chunk) {
          if (pending.length) this.schedule(Math.max(1, Math.min(...pending.map((item) => item.nextAttemptAt!)) - Date.now()));
          break;
        }
        let processing: RecordingChunk = { ...chunk, status: 'processing', attempts: chunk.attempts + 1, nextAttemptAt: null };
        await this.enqueueWrite(() => this.repository.saveChunk(this.owner, processing));
        if (this.closed || this.closing) return;
        this.updateChunk(processing);
        const request = new AbortController();
        this.request = request;
        try {
          if (!snapshot.session.serverCreated) {
            await this.api.create(snapshot.session, request.signal);
            if (this.closed || this.closing) return;
            await this.persistSession({ serverCreated: true });
          }
          if (this.closed || this.closing) return;
          const result = await this.api.transcribe(processing, request.signal);
          if (this.closed || this.closing) return;
          if (result.chunkId !== chunk.id || result.chunkIndex !== chunk.index) throw new RecordingApiError('Transcription response did not match this segment.', false);
          processing = { ...processing, status: result.status, transcript: result.transcript, error: null };
          await this.enqueueWrite(() => this.repository.saveChunk(this.owner, processing));
          if (this.closed || this.closing) return;
          this.updateChunk(processing);
          try {
            await this.repository.deleteAudio(this.owner, processing.localUri);
            if (this.closed || this.closing) return;
            const withoutAudio = { ...processing, localUri: '' };
            await this.enqueueWrite(() => this.repository.saveChunk(this.owner, withoutAudio));
            this.updateChunk(withoutAudio);
          } catch { /* Acknowledged transcript is durable; account cleanup retries file removal. */ }
        } catch (error) {
          if (this.closed || this.closing) return;
          const transient = error instanceof RecordingApiError && error.retryable;
          const delay = RETRIES[processing.attempts - 1];
          const retry = transient && delay !== undefined;
          const failed: RecordingChunk = { ...processing, status: retry ? 'pending' : 'failed',
            error: message(error), nextAttemptAt: retry ? Date.now() + Math.max(delay, error.retryAfterMs) : null };
          await this.enqueueWrite(() => this.repository.saveChunk(this.owner, failed));
          this.updateChunk(failed);
        } finally { if (this.request === request) this.request = null; }
      }
      if (!this.closed && !this.closing && this.view.snapshot!.session.status === 'finishing' && this.view.snapshot!.chunks.every(terminal)) {
        await this.finalize();
      }
    } catch (error) {
      if (!this.closed && !this.closing) {
        for (const chunk of this.view.snapshot!.chunks) {
          if (!terminal(chunk)) this.updateChunk({ ...chunk, status: 'failed', error: message(error) });
        }
        this.publish(undefined, message(error));
        if (this.accepting) void this.stop(message(error));
        else this.updateSession({ status: 'partial' });
      }
    } finally { this.worker = false; }
  }

  private async finalize(): Promise<void> {
    const { chunks, session } = this.view.snapshot!;
    const failures = chunks.some((chunk) => chunk.status === 'failed') || Boolean(this.captureError);
    const status = !chunks.length ? 'failed' : failures ? 'partial' : 'complete';
    const error = this.captureError ?? (!chunks.length ? 'No audio was captured. Try recording again.' : null);
    await this.persistSession({ status, error });
    this.publish(undefined, error);
    if (!session.serverCreated) return;
    if (this.closed || this.closing) return;
    const request = new AbortController();
    this.request = request;
    try {
      await this.api.finalize(this.view.snapshot!.session, request.signal);
      if (!this.closed && !this.closing) await this.persistSession({ serverFinalized: true });
    } catch (error) {
      if (!this.closed && !this.closing) {
        await this.persistSession({ status: 'partial', serverFinalized: false });
        this.publish(undefined, message(error));
      }
    } finally { if (this.request === request) this.request = null; }
  }

  async retry(): Promise<void> {
    if (this.closed || this.closing || this.worker || this.accepting || this.view.busy || !this.view.snapshot) return;
    this.publish(undefined, null, true);
    try {
      for (const chunk of this.view.snapshot.chunks) {
        if (chunk.status !== 'failed') continue;
        const pending: RecordingChunk = { ...chunk, status: 'pending', attempts: 0, nextAttemptAt: null, error: null };
        await this.enqueueWrite(() => this.repository.saveChunk(this.owner, pending)); this.updateChunk(pending);
      }
      await this.persistSession({ status: 'finishing', serverFinalized: false });
      this.publish(undefined, null, false);
      void this.pump();
    } catch (error) { this.publish(undefined, message(error), false); }
  }

  /** Invalidate callbacks before account cleanup; unfinished files remain recoverable on ordinary unmount. */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closing = true;
    this.request?.abort();
    await this.stop();
    this.closed = true; ++this.generation; this.accepting = false;
    this.capture.stop(); this.request?.abort();
    if (this.watchdog) clearInterval(this.watchdog);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.listeners.clear();
    await this.writes;
  }
}
function message(error: unknown): string { return error instanceof Error ? error.message : 'Recording failed. Please try again.'; }
