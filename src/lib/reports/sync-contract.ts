/** Reports are immutable in this milestone; IDs are also retry/idempotency keys. */
export type SyncedReport = {
  id: string; title: string; subject: string; grade: string; recordedAt: string;
  durationMs: number; reportJson: string; classNotes: string; model: string; createdAt: string;
};
const strings: Record<string, number> = { title: 300, subject: 100, grade: 50,
  reportJson: 100_000, classNotes: 100_000, model: 100 };
export function validateSyncedReport(value: unknown): SyncedReport {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid report');
  const row = value as Record<string, unknown>;
  const allowed = ['id', 'recordedAt', 'durationMs', 'createdAt', ...Object.keys(strings)];
  if (Object.keys(row).length !== allowed.length || Object.keys(row).some(key => !allowed.includes(key)) ||
      typeof row.id !== 'string' || !/^[A-Za-z0-9_-]{21}$/.test(row.id) ||
      !Number.isSafeInteger(row.durationMs) || (row.durationMs as number) < 0 || (row.durationMs as number) > 86_400_000) throw new Error('Invalid report');
  for (const [key, max] of Object.entries(strings)) {
    if (typeof row[key] !== 'string' || !(row[key] as string).trim() || (row[key] as string).length > max) throw new Error('Invalid report');
  }
  for (const key of ['recordedAt', 'createdAt']) {
    if (typeof row[key] !== 'string' || (row[key] as string).length > 40 || !Number.isFinite(Date.parse(row[key] as string))) throw new Error('Invalid date');
  }
  const report: unknown = JSON.parse(row.reportJson as string);
  if (!report || typeof report !== 'object' || Array.isArray(report)) throw new Error('Invalid reflection');
  const fields = ['classroomEnvironment', 'whatWentWrong', 'areasToImprove', 'topicSpecificFeedback'];
  const reflection = report as Record<string, unknown>;
  if (Object.keys(reflection).length !== 5 || !Number.isInteger(reflection.overallScore) ||
      (reflection.overallScore as number) < 0 || (reflection.overallScore as number) > 100 ||
      !fields.every(key => typeof reflection[key] === 'string' && reflection[key].trim() && reflection[key].length <= 20_000)) throw new Error('Invalid reflection');
  // Reconstruct in a stable order before hashing. Never send raw transcript or provider credentials.
  return { id: row.id, title: row.title as string, subject: row.subject as string, grade: row.grade as string,
    recordedAt: row.recordedAt as string, durationMs: row.durationMs as number, reportJson: JSON.stringify({
      overallScore: reflection.overallScore, ...Object.fromEntries(fields.map(key => [key, reflection[key]])) }),
    classNotes: row.classNotes as string, model: row.model as string, createdAt: row.createdAt as string };
}
