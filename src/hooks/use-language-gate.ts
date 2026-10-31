import { useUiPreferences } from '@/components/preview/preview-provider';
import { allLanguages } from '@/data/languages';

/** Language is an optional preference; it never gates authenticated entry. */
export function useLanguageGate() {
  const preferences = useUiPreferences();
  return {
    isReady: preferences.hasHydrated,
    needsLanguageSelection: false,
    selectedLanguage: allLanguages.find((item) => item.id === preferences.selectedLanguageId) ?? null,
  };
}
