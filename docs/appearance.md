# Appearance

Profile → App settings → Dark mode switches all signed-in product screens between
light and dark appearances. Light is the default. The setting is saved per account
through the existing preference storage, retained on sign-out, and removed by
account deletion. Older preference records without this field load as light.

`src/theme/colors.ts` owns both palettes. Dark neutral surfaces use near-black
backgrounds and charcoal cards; primary and muted text use contrasting light
colors. Yellow, mint, sky, coral, lime, lavender, and pink controls keep their fills.
Use `onAccent` or `mutedOnAccent` for content on those bright fills, including
selected states. Do not use the neutral foreground on an accent button.

`src/theme/use-theme.tsx` provides the palette, navigation appearance, status bar,
and memoized StyleSheet factories. Components subscribe through `useThemeColors`
and `useThemeStyles`; changing the theme does not remount screens or clear forms.
Profile's colored menu cards provide an accent-content context for their rows.

`src/components/profile/appearance-toggle.tsx` reuses `ProfileToggleRow` and its React Native
Switch, matching the notification preference. This avoids an intrinsic-size
Compose/SwiftUI Host inside the tab pager. The settings card keeps its lavender
background and dark text in both modes.

`src/components/preview/preview-provider.tsx` applies the stored theme after
account hydration. `src/lib/ui-preview/types.ts` validates the preference and
handles older records. Existing retry/reset handling reports failed saves.

Automated checks in `tests/color-mode.test.cjs` cover palette contrast, unchanged
accent fills, old preference records, invalid modes, and theme/colored-card context.
Run `npm run check` for typecheck, lint, tests, and all-platform export.

Phone verification: toggle both ways, visit all tabs and secondary screens, open
selectors and dialogs, inspect selected chips/dates and chat bubbles, restart to
confirm restoration, and switch accounts to confirm isolation. Verify native
switch layout, keyboard appearance, status bars, and large text on Android/iOS.
Automated rendering tests do not establish native visual correctness.

## Profile stability investigation

The appearance row previously mounted `Host matchContents` from `@expo/ui`.
Expo issue [47625](https://github.com/expo/expo/issues/47625) documents native
layout re-entry with Reanimated. Installed package source includes the upstream
fix, but Expo Go supplies the native binary independently. The row now avoids
that host entirely; this is a targeted mitigation, not a device-confirmed diagnosis.
Native and web tab navigators lazily mount screens on first visit, retaining them
afterward. Native swipe and selection animations remain enabled.

No device was attached during investigation. Verify opening Profile repeatedly,
swiping between every tab, changing appearance both ways, and returning to
existing drafts. If Expo Go still exits, capture Android logcat around the exit
(or an iOS crash report); JavaScript exports cannot establish native stability.
