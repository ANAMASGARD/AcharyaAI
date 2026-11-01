import { REPORT_MODELS } from './model';
import type { DownloadState } from '@/lib/local-models/downloads';
const states: Record<string, DownloadState> = Object.fromEntries(REPORT_MODELS.map(model => [model.id, { status: 'missing', progress: 0, error: null }]));
export const reportDownloads = {
  getState: () => states, subscribe: (_fn: () => void) => () => {}, check: async () => {},
  download: async (_id: string) => {}, pause: async (_id: string) => {}, cancel: async (_id: string) => {}, remove: async (_id: string) => false,
};
