import { TapSoundProvider } from '@/components/feedback/tap-sound-provider';
import { useThemeColors, useThemeStyles , AppThemeProvider } from '@/theme/use-theme';
import type { ThemeColors } from '@/theme/colors';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { previewLifecycle } from '@/lib/ui-preview/account';
import { confirmAction } from '@/lib/confirm-action';
import { PreviewSessionEndedError } from '@/lib/ui-preview/lifecycle';
import { previewStorage } from '@/lib/ui-preview/storage';
import { DEFAULT_UI_PREFERENCES, PreviewDataError, restoreAttachmentUris, type AttachmentInput, type PreviewFeatures, type UiPreferences } from '@/lib/ui-preview/types';
import { fontFamilies } from '@/theme/typography';

type PreviewState = { features: PreviewFeatures; preferences: UiPreferences };
const makeStore = () => createStore<PreviewState>(() => ({ features: {}, preferences: { ...DEFAULT_UI_PREFERENCES, teachingClassIds: [] } }));
type PreviewContextValue = {
  store: ReturnType<typeof makeStore>;
  owner: string;
  session: ReturnType<typeof previewLifecycle.createSession>;
  persistDrafts: () => void;
  persistPreferences: () => void;
};
const PreviewContext = createContext<PreviewContextValue | null>(null);

export function UiPreviewProvider({ owner, children }: { owner: string; children: ReactNode }): React.ReactElement {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);

  const [store] = useState(makeStore);
  const [session] = useState(() => previewLifecycle.createSession(owner));
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [corruptPreferences, setCorruptPreferences] = useState(false);
  const alive = useRef(true);

  const reportError = useCallback((cause: unknown) => {
    if (alive.current && !(cause instanceof PreviewSessionEndedError)) {
      setError(cause instanceof Error ? cause.message : 'Your draft could not be saved on this device.');
      setCorruptPreferences(cause instanceof PreviewDataError && cause.kind === 'preferences');
    }
  }, []);

  const hydrate = useCallback(() => {
    return session.run(async () => {
        const [features, preferences, attachments] = await Promise.all([
          previewStorage.readDrafts(owner), previewStorage.readPreferences(owner), previewStorage.listAttachments(owner),
        ]);
        return { features: restoreAttachmentUris(features, attachments) as PreviewFeatures, preferences };
      }).then((value) => {
      if (alive.current) { store.setState(value); setError(null); setHydrated(true); }
    }).catch(reportError);
  }, [owner, reportError, session, store]);

  useEffect(() => {
    alive.current = true;
    void hydrate();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void session.flush();
    });
    return () => {
      alive.current = false;
      subscription.remove();
      // React development effect replay reuses this mounted provider and its queue.
      queueMicrotask(() => { if (!alive.current) void session.close(); });
    };
  }, [hydrate, session]);

  const persistDrafts = useCallback(() => {
    const features = store.getState().features;
    void session.run(() => previewStorage.writeDrafts(owner, features)).catch(reportError);
  }, [owner, reportError, session, store]);
  const persistPreferences = useCallback(() => {
    const preferences = store.getState().preferences;
    void session.run(() => previewStorage.writePreferences(owner, preferences)).catch(reportError);
  }, [owner, reportError, session, store]);
  const value = useMemo(() => ({ store, owner, session, persistDrafts, persistPreferences }), [store, owner, session, persistDrafts, persistPreferences]);

  const resetLocalData = async () => {
    const confirmed = await confirmAction('Reset local previews?', corruptPreferences
      ? 'This removes this account’s local drafts, copied files, and unreadable preferences. Your Clerk account stays unchanged.'
      : 'This removes this account’s local drafts and copied files. Your saved preferences and Clerk account stay unchanged.', 'Reset');
    if (!confirmed) return;
    try {
      await session.run(() => previewStorage.clearAccount(owner, corruptPreferences));
      await hydrate();
    } catch (cause) { reportError(cause); }
  };

  if (!hydrated) {
    return <View style={styles.loading}>
      {error ? <>
        <Text style={styles.error}>{error}</Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => { setError(null); void hydrate(); }}><Text style={[styles.label, { color: colors.onAccent }]}>Retry</Text></Pressable>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => void resetLocalData()}><Text style={[styles.label, { color: colors.onAccent }]}>Reset local previews</Text></Pressable>
      </> : <><ActivityIndicator color={colors.foreground} /><Text style={styles.label}>Opening your local drafts…</Text></>}
    </View>;
  }
  return <PreviewContext value={value}>
    {error ? <View accessibilityRole="alert" style={styles.banner}>
      <Text style={[styles.error, { color: colors.onAccent }]}>{error}</Text>
      <Pressable accessibilityRole="button" onPress={() => { setError(null); persistDrafts(); persistPreferences(); }}><Text style={[styles.retry, { color: colors.onAccent }]}>Retry saving</Text></Pressable>
    </View> : null}
    <PreviewTheme>{children}</PreviewTheme>
  </PreviewContext>;
}

function usePreviewContext(): PreviewContextValue {
  const context = use(PreviewContext);
  if (!context) throw new Error('Preview hooks must be used inside UiPreviewProvider.');
  return context;
}

export function usePreviewFeature<T>(key: string, initial: T): readonly [T, (next: T | ((current: T) => T)) => void] {
  const { store, persistDrafts } = usePreviewContext();
  const initialValue = useRef(initial);
  const selected = useStore(store, (state) => Object.hasOwn(state.features, key) ? state.features[key] as T : initialValue.current);
  const update = useCallback((next: T | ((current: T) => T)) => {
    const current = store.getState().features;
    const previous = Object.hasOwn(current, key) ? current[key] as T : initialValue.current;
    const result = typeof next === 'function' ? (next as (value: T) => T)(previous) : next;
    store.setState({ features: { ...current, [key]: result } });
    persistDrafts();
  }, [key, persistDrafts, store]);
  return [selected, update] as const;
}

function PreviewTheme({ children }: { children: ReactNode }): React.ReactElement {
  const { colorMode, soundEffectsEnabled } = useUiPreferences();
  return <AppThemeProvider mode={colorMode}><TapSoundProvider enabled={soundEffectsEnabled}>{children}</TapSoundProvider></AppThemeProvider>;
}

export function useUiPreferences() {
  const { store, persistPreferences } = usePreviewContext();
  const preferences = useStore(store, (state) => state.preferences);
  const update = useCallback((changes: Partial<UiPreferences>) => {
    store.setState({ preferences: { ...store.getState().preferences, ...changes } });
    persistPreferences();
  }, [persistPreferences, store]);
  return useMemo(() => ({
    ...preferences,
    hasHydrated: true,
    setSoundEffectsEnabled: (enabled: boolean) => update({ soundEffectsEnabled: enabled }),
    setColorMode: (mode: UiPreferences["colorMode"]) => update({ colorMode: mode }),
    setSelectedLanguageId: (id: string | null) => update({ selectedLanguageId: id }),
    setSelectedLanguage: (id: string) => update({ selectedLanguageId: id }),
    clearLanguagePreference: () => update({ selectedLanguageId: null }),
    setTeachingClassIds: (ids: string[]) => update({ teachingClassIds: ids }),
    toggleTeachingClass: (id: string) => {
      const current = store.getState().preferences.teachingClassIds;
      update({ teachingClassIds: current.includes(id) ? current.filter((value) => value !== id) : [...current, id] });
    },
    setPushNotificationsEnabled: (enabled: boolean) => update({ pushNotificationsEnabled: enabled }),
  }), [preferences, store, update]);
}

export function usePreviewAttachments() {
  const { owner, session } = usePreviewContext();
  return useMemo(() => ({
    saveAttachment: (input: AttachmentInput) => session.run(() => previewStorage.saveAttachment(owner, input)),
    removeAttachment: (id: string) => session.run(() => previewStorage.removeAttachment(owner, id)),
  }), [owner, session]);
}

/** Wait for queued draft writes before an idempotent remote publication starts. */
export function useFlushDrafts(): () => Promise<void> {
  const { owner, session, store } = usePreviewContext();
  return useCallback(async () => {
    // Queue.flush intentionally absorbs earlier background errors. An explicit
    // publication must await a fresh write and propagate failure to its form.
    await session.run(() => previewStorage.writeDrafts(owner, store.getState().features));
  }, [owner, session, store]);
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  label: { fontFamily: fontFamilies.sansBold, color: colors.foreground, fontSize: 16 },
  error: { fontFamily: fontFamilies.sans, color: colors.foreground, fontSize: 14 },
  button: { minHeight: 44, padding: 12, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.primary, borderRadius: 8 },
  banner: { backgroundColor: colors.coral, padding: 12, borderBottomWidth: 2, borderColor: colors.border },
  retry: { fontFamily: fontFamilies.sansBold, textDecorationLine: 'underline', paddingVertical: 8 },
});
