import { useSyncExternalStore } from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';

function subscribe(onChange: () => void) {
  const subscription = Appearance.addChangeListener(onChange);
  return () => subscription.remove();
}

function getSnapshot(): ColorSchemeName {
  return Appearance.getColorScheme() ?? 'light';
}

// Match the static page during hydration, then subscribe to the system theme.
export function useColorScheme() {
  return useSyncExternalStore<ColorSchemeName>(subscribe, getSnapshot, () => 'light');
}
