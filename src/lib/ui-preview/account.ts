import { stopLocalReports } from '@/lib/offline-reports/engine';
import { stopReportIndexing } from '@/lib/embeddings/indexing';
import { clearReportSync, stopReportSync } from '@/lib/reports/cloud';
import { clearProviderCredentials } from '@/lib/ai-keys/vault';
import { cancelAiRequests } from '@/lib/ai/cancellation';
import { clearRecorderAccount } from '@/lib/recording/lifecycle';
import { createPreviewLifecycle } from './lifecycle';
import { previewStorage } from './storage';

export const previewLifecycle = createPreviewLifecycle(previewStorage.clearAccount);

export async function clearUiPreviewAccount(owner: string, includePreferences = false): Promise<void> {
  cancelAiRequests(owner);
  await stopLocalReports(owner);
  stopReportSync(owner);
  await stopReportIndexing(owner);
  if (includePreferences) await clearReportSync(owner);
  const results = await Promise.allSettled([
    // Sign-out preserves account-isolated keys; explicit account deletion erases them.
    ...(includePreferences ? [clearProviderCredentials(owner), clearRecorderAccount(owner)] : []),
    previewLifecycle.clear(owner, includePreferences),
  ]);
  const failure = results.find((result) => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
}
