import type { saveReportHistory as Save, listReportHistory as List, readReportHistory as Read } from './history';
export const saveReportHistory: typeof Save = async () => { throw new Error('Report storage is available in the mobile app.'); };
export const listReportHistory: typeof List = async () => [];
export const readReportHistory: typeof Read = async () => null;
export const listClassHistory: typeof import('./history').listClassHistory = async () => [];
export const readClassHistory: typeof import('./history').readClassHistory = async () => null;
export const readSavedReportResult: typeof import('./history').readSavedReportResult = async () => null;

export const reportSharingAllowed = async (_owner: string, _session: string): Promise<boolean> => false;
export const allowReportSharing = async (_owner: string, _session: string, _signal?: AbortSignal): Promise<void> => {};
