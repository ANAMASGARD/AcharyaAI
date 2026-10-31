import { useUiPreferences } from '@/components/preview/preview-provider';

/** Compatibility at the presentation seam; persistence belongs to the preview provider. */
export function usePreferencesStore<T>(selector: (state: ReturnType<typeof useUiPreferences>) => T): T {
  return selector(useUiPreferences());
}
