export const cloudConfigured = () => false;
export const stopReportSync = (_owner: string) => {};
export const clearReportSync = async (_owner: string) => {};
export const onReportSyncChange = (_listener: () => void) => () => {};
export const reportSyncStatus = async (_owner: string): Promise<{ enabled: boolean; lastError: string | null } | undefined> => undefined;
export const setReportSyncConsent = async (_owner: string, _enabled: boolean) => { throw new Error('Cloud sync is available in the mobile app.'); };
export const syncReports = async (_owner: string, _getToken: () => Promise<string | null>) => {};
export const deleteCloudAccount = async (_getToken: () => Promise<string | null>) => { throw new Error('Delete your account in the mobile app.'); };
