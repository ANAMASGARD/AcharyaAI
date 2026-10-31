import { createPreviewLifecycle } from './lifecycle';
import { previewStorage } from './storage';

export const previewLifecycle = createPreviewLifecycle(previewStorage.clearAccount);

export async function clearUiPreviewAccount(owner: string, includePreferences = false): Promise<void> {
  await previewLifecycle.clear(owner, includePreferences);
}
