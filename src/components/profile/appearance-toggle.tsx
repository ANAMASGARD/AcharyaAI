import { ProfileToggleRow } from '@/components/profile/profile-toggle-row';
import { useUiPreferences } from '@/components/preview/preview-provider';

export function AppearanceToggle(): React.ReactElement {
  const { colorMode, setColorMode } = useUiPreferences();
  const dark = colorMode === 'dark';

  // Reuse the RN settings control: no intrinsic-size Compose/SwiftUI Host in the pager.
  return (
    <ProfileToggleRow
      icon={dark ? 'weather-night' : 'white-balance-sunny'}
      label="Dark mode"
      subtitle={dark ? 'Dark backgrounds, bright accents' : 'Light backgrounds, bright accents'}
      value={dark}
      onValueChange={(value) => setColorMode(value ? 'dark' : 'light')}
    />
  );
}
