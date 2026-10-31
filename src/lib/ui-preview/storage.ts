import { Directory, File, Paths } from 'expo-file-system';
import { SQLiteStorage } from 'expo-sqlite/kv-store';

import { createId } from '@/lib/id';
import { parseDrafts, parsePreferences, PreviewDataError, type PreviewAttachment, type PreviewStorage } from './types';

// Deliberately separate from acharya.db and its production Drizzle/sync schemas.
const storage = new SQLiteStorage('acharya-ui-preview.db');
const accountPrefix = (owner: string) => `account:${encodeURIComponent(owner)}:`;
const accountDirectory = (owner: string) => new Directory(Paths.document, 'acharya-ui-preview', encodeURIComponent(owner));
type StoredAttachment = Omit<PreviewAttachment, 'uri'> & { filename: string };

function parseAttachment(raw: string): StoredAttachment {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new PreviewDataError('drafts');
  const item = value as Partial<StoredAttachment>;
  if (typeof item.id !== 'string' || !/^[A-Za-z0-9_-]{21}$/.test(item.id) ||
      typeof item.filename !== 'string' || !/^[A-Za-z0-9_-]{21}(?:\.[a-z0-9]{1,12})?$/i.test(item.filename) ||
      !item.filename.startsWith(item.id) || typeof item.name !== 'string' ||
      typeof item.mimeType !== 'string' || typeof item.sizeBytes !== 'number') {
    throw new PreviewDataError('drafts');
  }
  return item as StoredAttachment;
}

async function attachmentKeys(owner: string): Promise<string[]> {
  const prefix = `${accountPrefix(owner)}file:`;
  return (await storage.getAllKeysAsync()).filter((key) => key.startsWith(prefix));
}

export const previewStorage: PreviewStorage = {
  async readDrafts(owner) {
    return parseDrafts(await storage.getItemAsync(`${accountPrefix(owner)}drafts`));
  },
  async writeDrafts(owner, features) {
    await storage.setItemAsync(`${accountPrefix(owner)}drafts`, JSON.stringify({ version: 1, features }));
  },
  async readPreferences(owner) {
    return parsePreferences(await storage.getItemAsync(`${accountPrefix(owner)}preferences`));
  },
  async writePreferences(owner, value) {
    await storage.setItemAsync(`${accountPrefix(owner)}preferences`, JSON.stringify(value));
  },
  async listAttachments(owner) {
    const attachments: PreviewAttachment[] = [];
    for (const key of await attachmentKeys(owner)) {
      const raw = await storage.getItemAsync(key);
      if (!raw) continue;
      const saved = parseAttachment(raw);
      const file = new File(accountDirectory(owner), saved.filename);
      attachments.push({ id: saved.id, name: saved.name, mimeType: saved.mimeType, sizeBytes: saved.sizeBytes, uri: file.exists ? file.uri : '' });
    }
    return attachments;
  },
  async saveAttachment(owner, input) {
    const directory = accountDirectory(owner);
    directory.create({ intermediates: true, idempotent: true });
    const id = createId();
    const extension = input.name.match(/\.[a-z0-9]{1,12}$/i)?.[0] ?? '';
    const filename = `${id}${extension}`;
    const target = new File(directory, filename);
    await new File(input.uri).copy(target);
    const saved: StoredAttachment = { id, filename, name: input.name, mimeType: input.mimeType ?? 'application/octet-stream', sizeBytes: target.size ?? input.sizeBytes ?? 0 };
    try {
      await storage.setItemAsync(`${accountPrefix(owner)}file:${id}`, JSON.stringify(saved));
    } catch (error) {
      if (target.exists) target.delete();
      throw error;
    }
    return { id, uri: target.uri, name: saved.name, mimeType: saved.mimeType, sizeBytes: saved.sizeBytes };
  },
  async removeAttachment(owner, id) {
    const key = `${accountPrefix(owner)}file:${id}`;
    const raw = await storage.getItemAsync(key);
    if (raw) {
      const saved = parseAttachment(raw);
      const file = new File(accountDirectory(owner), saved.filename);
      if (file.exists) file.delete();
    }
    await storage.removeItemAsync(key);
  },
  async clearAccount(owner, includePreferences) {
    const prefix = accountPrefix(owner);
    const keys = (await storage.getAllKeysAsync()).filter((key) => key.startsWith(prefix) && (includePreferences || key !== `${prefix}preferences`));
    for (const key of keys) await storage.removeItemAsync(key);
    const directory = accountDirectory(owner);
    if (directory.exists) directory.delete();
  },
};
