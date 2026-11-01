import type { SttModelId } from '@/lib/offline-stt/models';
export type UiPreferences = {
  colorMode: 'light' | 'dark';
  offlineSttEnabled: boolean;
  offlineReportsEnabled: boolean;
  offlineReportModelId: string | null;
  offlineSttModelId: SttModelId | null;
  selectedLanguageId: string | null;
  teachingClassIds: string[];
  pushNotificationsEnabled: boolean;
  soundEffectsEnabled: boolean;
};

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  colorMode: 'light',
  offlineSttEnabled: false,
  offlineReportsEnabled: false,
  offlineReportModelId: null,
  offlineSttModelId: null,
  selectedLanguageId: null,
  teachingClassIds: [],
  pushNotificationsEnabled: true,
  soundEffectsEnabled: true,
};

export type PreviewFeatures = Record<string, unknown>;

export class PreviewDataError extends Error {
  readonly kind: 'drafts' | 'preferences';
  constructor(kind: 'drafts' | 'preferences') {
    super(`Saved ${kind} cannot be opened. Retry or reset this account's local data.`);
    this.name = 'PreviewDataError';
    this.kind = kind;
  }
}

function parseJson(raw: string, kind: 'drafts' | 'preferences'): unknown {
  try { return JSON.parse(raw); } catch { throw new PreviewDataError(kind); }
}

export type PreviewAttachment = {
  id: string;
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
};

export type AttachmentInput = {
  uri: string;
  name: string;
  mimeType?: string;
  sizeBytes?: number;
  file?: Blob;
};

export type PreviewStorage = {
  readDrafts: (owner: string) => Promise<PreviewFeatures>;
  writeDrafts: (owner: string, value: PreviewFeatures) => Promise<void>;
  readPreferences: (owner: string) => Promise<UiPreferences>;
  writePreferences: (owner: string, value: UiPreferences) => Promise<void>;
  listAttachments: (owner: string) => Promise<PreviewAttachment[]>;
  saveAttachment: (owner: string, input: AttachmentInput) => Promise<PreviewAttachment>;
  removeAttachment: (owner: string, id: string) => Promise<void>;
  clearAccount: (owner: string, includePreferences: boolean) => Promise<void>;
};

export function parseDrafts(raw: string | null): PreviewFeatures {
  if (raw === null) return {};
  const value = parseJson(raw, 'drafts');
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 ||
      !('features' in value) || !value.features || typeof value.features !== 'object' || Array.isArray(value.features)) {
    throw new PreviewDataError('drafts');
  }
  return value.features as PreviewFeatures;
}

export function parsePreferences(raw: string | null): UiPreferences {
  if (raw === null) return { ...DEFAULT_UI_PREFERENCES, teachingClassIds: [] };
  const value = parseJson(raw, 'preferences');
  if (!value || typeof value !== 'object' || !('selectedLanguageId' in value) ||
      !(value.selectedLanguageId === null || typeof value.selectedLanguageId === 'string') ||
      !('teachingClassIds' in value) || !Array.isArray(value.teachingClassIds) ||
      !value.teachingClassIds.every((id: unknown) => typeof id === 'string') ||
      !('pushNotificationsEnabled' in value) || typeof value.pushNotificationsEnabled !== 'boolean') {
    throw new PreviewDataError('preferences');
  }
  const mode = 'colorMode' in value ? value.colorMode : 'light';
  if (mode !== 'light' && mode !== 'dark') throw new PreviewDataError('preferences');
  const soundEffectsEnabled = 'soundEffectsEnabled' in value ? value.soundEffectsEnabled : true;
  if (typeof soundEffectsEnabled !== 'boolean') throw new PreviewDataError('preferences');
  const offlineSttEnabled = 'offlineSttEnabled' in value ? value.offlineSttEnabled : false;
  const offlineSttModelId = 'offlineSttModelId' in value ? value.offlineSttModelId : null;
  if (typeof offlineSttEnabled !== 'boolean' || (offlineSttModelId !== null &&
      (typeof offlineSttModelId !== 'string' || !['whisper-small-q5_1-v1', 'whisper-medium-q5_0-v1'].includes(offlineSttModelId)))) throw new PreviewDataError('preferences');
  const offlineReportsEnabled = 'offlineReportsEnabled' in value ? value.offlineReportsEnabled : false;
  if (typeof offlineReportsEnabled !== 'boolean') throw new PreviewDataError('preferences');
  const offlineReportModelId = 'offlineReportModelId' in value && typeof value.offlineReportModelId === 'string' ? value.offlineReportModelId : null;
  return { ...value, offlineReportModelId, offlineReportsEnabled, colorMode: mode, soundEffectsEnabled, offlineSttEnabled, offlineSttModelId } as UiPreferences;
}

/** Saved sandbox and blob URLs are temporary. Resolve references from their stable attachment IDs. */
export function restoreAttachmentUris(value: unknown, attachments: readonly PreviewAttachment[]): unknown {
  const byId = new Map(attachments.map((attachment) => [attachment.id, attachment.uri]));
  function visit(current: unknown): unknown {
    if (Array.isArray(current)) return current.map(visit);
    if (!current || typeof current !== 'object') return current;
    const record = current as Record<string, unknown>;
    const result = Object.fromEntries(Object.entries(record).map(([key, child]) => [key, visit(child)]));
    if (typeof record.id === 'string' && typeof record.uri === 'string') {
      result.uri = byId.get(record.id) ?? (/^(file|content|blob):/.test(record.uri) ? '' : record.uri);
    }
    return result;
  }
  return visit(value);
}
