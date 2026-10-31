import type { saveReportHistory as Save, listReportHistory as List, readReportHistory as Read } from './history';
export const saveReportHistory: typeof Save = async () => { throw new Error('Report storage is available in the mobile app.'); };
export const listReportHistory: typeof List = async () => [];
export const readReportHistory: typeof Read = async () => null;
