import { createId } from '@/lib/id';
import { parseDrafts, parsePreferences, type PreviewAttachment, type PreviewStorage } from './types';

type AttachmentRecord = Omit<PreviewAttachment, 'uri'> & { owner: string; blob: Blob };
const objectUrls = new Map<string, string>();
let databasePromise: Promise<IDBDatabase> | undefined;
const accountPrefix = (owner: string) => `account:${encodeURIComponent(owner)}:`;

function database(): Promise<IDBDatabase> {
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('acharya-ui-preview', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('state');
      request.result.createObjectStore('attachments');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { databasePromise = undefined; reject(request.error); };
  });
  return databasePromise;
}

async function read<T>(store: string, key: string): Promise<T | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, 'readonly').objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function write(store: string, key: string, value?: unknown): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, 'readwrite');
    if (value === undefined) transaction.objectStore(store).delete(key);
    else transaction.objectStore(store).put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('Local storage write was interrupted.'));
  });
}

async function attachments(owner: string): Promise<AttachmentRecord[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction('attachments', 'readonly').objectStore('attachments').getAll();
    request.onsuccess = () => resolve((request.result as AttachmentRecord[]).filter((item) => item.owner === owner));
    request.onerror = () => reject(request.error);
  });
}

function materialize(record: AttachmentRecord): PreviewAttachment {
  const key = `${accountPrefix(record.owner)}${record.id}`;
  let uri = objectUrls.get(key);
  if (!uri) { uri = URL.createObjectURL(record.blob); objectUrls.set(key, uri); }
  return { id: record.id, uri, name: record.name, mimeType: record.mimeType, sizeBytes: record.sizeBytes };
}

export const previewStorage: PreviewStorage = {
  async readDrafts(owner) { return parseDrafts(await read<string>('state', `${accountPrefix(owner)}drafts`) ?? null); },
  async writeDrafts(owner, features) { await write('state', `${accountPrefix(owner)}drafts`, JSON.stringify({ version: 1, features })); },
  async readPreferences(owner) { return parsePreferences(await read<string>('state', `${accountPrefix(owner)}preferences`) ?? null); },
  async writePreferences(owner, value) { await write('state', `${accountPrefix(owner)}preferences`, JSON.stringify(value)); },
  async listAttachments(owner) { return (await attachments(owner)).map(materialize); },
  async saveAttachment(owner, input) {
    if (!input.file && !/^(blob|data):/.test(input.uri)) throw new Error('Choose a local file again before saving this attachment.');
    const blob = input.file ?? await (await fetch(input.uri)).blob();
    const record: AttachmentRecord = { id: createId(), owner, blob, name: input.name, mimeType: input.mimeType ?? blob.type, sizeBytes: blob.size };
    await write('attachments', `${accountPrefix(owner)}${record.id}`, record);
    return materialize(record);
  },
  async removeAttachment(owner, id) {
    const key = `${accountPrefix(owner)}${id}`;
    await write('attachments', key);
    const uri = objectUrls.get(key);
    if (uri) URL.revokeObjectURL(uri);
    objectUrls.delete(key);
  },
  async clearAccount(owner, includePreferences) {
    await write('state', `${accountPrefix(owner)}drafts`);
    if (includePreferences) await write('state', `${accountPrefix(owner)}preferences`);
    for (const record of await attachments(owner)) await previewStorage.removeAttachment(owner, record.id);
  },
};
