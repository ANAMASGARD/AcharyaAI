/** Native SQLite/model indexing is unavailable in the web build. */
export async function startReportIndexing(_owner: string): Promise<void> {}
export async function stopReportIndexing(_owner: string): Promise<void> {}
export async function scheduleReportIndexing(_owner: string): Promise<void> {}
export function addReportIndexSources(_tx: unknown, _row: unknown): void {}

export async function reportIndexStatus(_owner: string) { return { ready: 0, pending: 0, state: 'unavailable', error: null }; }
