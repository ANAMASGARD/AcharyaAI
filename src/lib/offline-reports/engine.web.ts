export const localReportBusy = () => false;
export const subscribeLocalReport = (_fn: () => void) => () => {};
export async function stopLocalReports(_owner: string): Promise<void> {}
export const withLocalReportEngine: typeof import('./engine').withLocalReportEngine = async () => { throw new Error('Local reports require the Android app.'); };
