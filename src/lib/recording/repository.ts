import { and, asc, desc, eq } from 'drizzle-orm';
import { Directory, File, Paths } from 'expo-file-system';

import { readyLocalDb as database } from '@/db/ready';
import { recordingChunks, recordingSessions, localReports } from '@/db/schema';
import { clearNativeCapture } from './native-capture';
import { assertAcharyaId } from '@/lib/validate-id';
import type { RecordingRepository } from './types';

let tail: Promise<unknown> = Promise.resolve();
function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const next = tail.then(operation);
  tail = next.catch(() => {});
  return next;
}
function ownerDirectory(owner: string): Directory {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(owner)) throw new Error('Invalid recording owner');
  return new Directory(Paths.document, 'recordings', owner);
}
function ownedAudio(owner: string, uri: string): File {
  const directory = ownerDirectory(owner);
  const prefix = `${directory.uri.replace(/\/$/, '')}/`;
  if (!uri.startsWith(prefix) || !/^[A-Za-z0-9_-]{21}\.wav$/.test(uri.slice(prefix.length))) {
    throw new Error('Audio path does not belong to this account');
  }
  return new File(uri);
}

export const recordingRepository: RecordingRepository = {
  loadLatest: (owner) => serialized(async () => {
    ownerDirectory(owner);
    const db = await database();
    const [session] = await db.select().from(recordingSessions).where(eq(recordingSessions.ownerClerkId, owner))
      .orderBy(desc(recordingSessions.startedAt)).limit(1);
    if (!session) return null;
    const chunks = await db.select().from(recordingChunks).where(eq(recordingChunks.sessionId, session.id)).orderBy(asc(recordingChunks.index));
    return { session, chunks };
  }),
  saveSession: (session) => serialized(async () => {
    assertAcharyaId(session.id);
    ownerDirectory(session.ownerClerkId);
    const db = await database();
    const [existing] = await db.select().from(recordingSessions).where(eq(recordingSessions.id, session.id)).limit(1);
    if (existing && existing.ownerClerkId !== session.ownerClerkId) throw new Error('Recording owner mismatch');
    await db.insert(recordingSessions).values(session).onConflictDoUpdate({ target: recordingSessions.id, set: session });
  }),
  saveChunk: (owner, chunk) => serialized(async () => {
    assertAcharyaId(chunk.id); assertAcharyaId(chunk.sessionId);
    if (chunk.localUri) ownedAudio(owner, chunk.localUri);
    const db = await database();
    const [session] = await db.select().from(recordingSessions).where(and(eq(recordingSessions.id, chunk.sessionId), eq(recordingSessions.ownerClerkId, owner))).limit(1);
    if (!session) throw new Error('Recording session is unavailable');
    const [existing] = await db.select().from(recordingChunks).where(eq(recordingChunks.id, chunk.id)).limit(1);
    if (existing && (existing.sessionId !== chunk.sessionId || existing.index !== chunk.index)) throw new Error('Recording chunk identity mismatch');
    await db.insert(recordingChunks).values(chunk).onConflictDoUpdate({ target: recordingChunks.id, set: chunk });
  }),
  writeAudio: (owner, chunkId, wav) => serialized(async () => {
    assertAcharyaId(chunkId);
    if (Paths.availableDiskSpace < wav.byteLength + 10 * 1024 * 1024) throw new Error('Not enough storage to save recording audio');
    const directory = ownerDirectory(owner);
    directory.create({ intermediates: true, idempotent: true });
    const file = new File(directory, `${chunkId}.wav`);
    // IDs are created once: overwriting an existing chunk would corrupt pending work.
    file.create({ overwrite: false });
    try { file.writeSync(wav); } catch (error) { if (file.exists) file.delete(); throw error; }
    return file.uri;
  }),
  deleteAudio: (owner, uri) => serialized(async () => {
    if (!uri) return;
    const file = ownedAudio(owner, uri);
    if (file.exists) file.delete();
  }),
  clearAccount: (owner) => serialized(async () => {
    const directory = ownerDirectory(owner);
    const db = await database();
    // Explicit child deletion also works if another connection disabled SQLite FK enforcement.
    db.transaction((tx) => {
      tx.delete(localReports).where(eq(localReports.ownerClerkId, owner)).run();
      const sessions = tx.select({ id: recordingSessions.id }).from(recordingSessions).where(eq(recordingSessions.ownerClerkId, owner)).all();
      for (const session of sessions) tx.delete(recordingChunks).where(eq(recordingChunks.sessionId, session.id)).run();
      tx.delete(recordingSessions).where(eq(recordingSessions.ownerClerkId, owner)).run();
    });
    if (directory.exists) directory.delete();
    await clearNativeCapture(owner);
  }),
};
