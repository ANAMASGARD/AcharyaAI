import { clearReportSync, stopReportSync } from '@/lib/reports/cloud';
import { clearProviderCredentials } from '@/lib/ai-keys/vault';
import { clearRecorderAccount } from '@/lib/recording/lifecycle';
import { createPreviewLifecycle } from './lifecycle';
import { previewStorage } from './storage';

export const previewLifecycle = createPreviewLifecycle(previewStorage.clearAccount);

export async function clearUiPreviewAccount(owner: string, includePreferences = false): Promise<void> {
  stopReportSync(owner);
  if (includePreferences) await clearReportSync(owner);
  const results = await Promise.allSettled([
    clearProviderCredentials(owner),
    ...(includePreferences ? [clearRecorderAccount(owner)] : []),
    previewLifecycle.clear(owner, includePreferences),
  ]);
  const failure = results.find((result) => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
}
