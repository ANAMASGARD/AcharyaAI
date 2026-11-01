export type RecordingStatus = 'starting' | 'recording' | 'stopping' | 'finishing' | 'complete' | 'partial' | 'failed';
export type ChunkStatus = 'pending' | 'processing' | 'done' | 'empty' | 'failed';
export type RecordingSession = {
  id: string; ownerClerkId: string; title: string; subject: string; grade: string;
  startedAt: string; updatedAt: string; durationMs: number; expectedChunkCount: number;
  status: RecordingStatus; serverCreated: boolean; serverFinalized: boolean; error: string | null;
  sttBackend: 'gnani' | 'whisper'; sttModelId: string | null; sttLanguage: string;
};
export type RecordingChunk = {
  id: string; sessionId: string; index: number; startMs: number; durationMs: number;
  localUri: string; status: ChunkStatus; transcript: string; attempts: number;
  nextAttemptAt: number | null; error: string | null; detectedLanguage?: string | null;
};
export type SttChunkResponse = {
  chunkId: string; chunkIndex: number; transcript: string; status: 'done' | 'empty';
  detectedLanguage?: string | null;
};
export type RecordingSnapshot = { session: RecordingSession; chunks: RecordingChunk[] };
export interface RecordingRepository {
  loadLatest(owner: string): Promise<RecordingSnapshot | null>;
  loadById(owner: string, id: string): Promise<RecordingSnapshot | null>;
  saveSession(session: RecordingSession): Promise<void>;
  saveChunk(owner: string, chunk: RecordingChunk): Promise<void>;
  writeAudio(owner: string, chunkId: string, wav: Uint8Array): Promise<string>;
  deleteAudio(owner: string, uri: string): Promise<void>;
  clearAccount(owner: string): Promise<void>;
}
export interface RecordingApi {
  create(session: RecordingSession, signal: AbortSignal): Promise<void>;
  finalize(session: RecordingSession, signal: AbortSignal): Promise<void>;
  transcribe(session: RecordingSession, chunk: RecordingChunk, signal: AbortSignal): Promise<SttChunkResponse>;
  dispose?(): Promise<void>;
}
export class RecordingApiError extends Error {
  constructor(message: string, public readonly retryable: boolean, public readonly retryAfterMs = 0) { super(message); }
}
