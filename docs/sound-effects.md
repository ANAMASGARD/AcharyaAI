# Tap sound effects

Profile → App settings → Sound effects enables/disables the bundled drop sound.
It defaults on; the existing account-scoped preferences storage persists it,
retains it on sign-out, and removes it on account deletion. Old records default on.

- Asset: assets/audio/drop.mp3, byte-for-byte from assets/click-003.mp3 in
  https://github.com/ANAMASGARD/Gaurav_ANAMASGARD at
  3fb720070da2a190bbb8fcf303e0198d976c5125.
  The supplied repository has no license or asset attribution file; reuse was
  requested by its owner. No broader license grant is asserted here.
- src/components/feedback/tap-sound-provider.tsx owns one Expo Audio player per
  enabled, hydrated account. Disabling, leaving the app, or signing out stops it.
  Playback mixes with other audio and respects silent mode/device media volume.
  The asset preloads at module initialization; player volume is 1 (100%) and
  keepAudioSessionActive avoids repeated iOS session teardown between taps.
- src/lib/tap-sound.ts dispatches seek and play immediately on every tap, without
  a throttle, loaded-state gate, or asynchronous wait before playback.
  Playback errors never block navigation.
- src/components/feedback/pressable.tsx preserves native Pressable props/ref and
  plays only for completed, enabled presses. Product controls import it instead
  of the native primitive, including controls inside modals and the tab dock.
  Background/backdrop dismissal and sheet touch interceptors explicitly set
  soundFeedback={false}. Scrolling, typing, and noninteractive content do not produce sounds. Settings switches also use feedback;
  the sound toggle itself stays silent. Authentication/native OS controls are excluded.
- src/lib/ui-preview/types.ts validates soundEffectsEnabled and upgrades old preferences.
- Existing haptics remain independent of this audio-only switch.
- Tap sounds require no microphone, AI, upload, or remote sound requests.
  Microphone permission is separately enabled for the user-triggered local chat
  level display; background audio remains disabled.

Verification: run npm run check and npx expo install --check.
On a phone, test taps on all tabs, sheets, and dialogs; disabled controls and scrolls
should stay silent. Toggle off, restart, and confirm it stays off. Verify silent
mode, other music, backgrounding, and account switching. Native listening/device
verification must be done separately from the automated checks.
