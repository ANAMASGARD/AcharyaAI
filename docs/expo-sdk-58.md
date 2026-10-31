# Expo SDK 58 upgrade

Upgrade date: October 31, 2026.

## Compatibility changes

- Expo 58.0.22, React Native 0.88.1, React 19.3.0, Router 58.0.29, and
  Expo-recommended native dependencies. See package-lock.json for exact versions.
- App version 1.0.9 / Android version code 10 separates the new native runtime
  from the SDK 57 app under the existing `appVersion` OTA policy.
- Audio cache and recording persistence use `File.writeSync()` to retain their
  existing write-before-transcribe/play behavior. SDK 58 changed `write()` to async.
- Custom tabs use Router's `emitter` and `navigateToTab` callbacks; the initial
  recorder anchor is configured in `unstable_settings.anchor` with `backBehavior="initialRoute"`.
- Native refs use React's `ComponentRef`; absent list components use `undefined`.
- The pinned SQLite facade patch was reapplied to 58.0.15. The JNI methods it uses
  still exist; native embedding gate acceptance remains a separate workflow.
- Removed the obsolete query-string patch/decoder override. Query regression tests
  exercise Router 58's URL-based parser, including malformed UTF-8 replacement.
- Clerk 4.10.1 failed Android compilation with a missing Compose saved-state import.
  Updated to Clerk 4.14.5 (same major, declared Expo 58 support). This app uses
  custom auth screens, not Clerk native UI; the newer package no longer bundles
  that unused native SDK. Removed the old root-classpath/R8 rewrites. Retained
  Kotlin 2.3.20 via the SDK 58 template's supported property because the existing
  LiteRT-LM embedding dependency uses Kotlin 2.4 metadata (unreadable by 2.2).

## Local verification

The SDK 57 baseline passed TypeScript, lint, 237 tests (6 skipped), and all-platform
exports before dependency changes. SDK 58 verification is recorded below. Latest local logs are under `.expo/sdk58-validation/` (gitignored).

- Clean `npm ci` in an isolated temporary directory: passed, including SQLite patch.
- `npx expo install --check`: passed.
- `npx expo-doctor`: 20/20 checks passed.
- `npm run check`: TypeScript, lint, and 237 tests passed (6 skipped); Android, iOS, and web production exports passed.
- `npx expo serve --port 8083`: `/` and `/sign-in` returned HTTP 200 HTML.
- Android prebuild and `npx expo run:android --no-bundler` compilation: passed
  (`BUILD SUCCESSFUL`, 588 tasks). Installation onto the existing phone app was
  rejected with `INSTALL_FAILED_UPDATE_INCOMPATIBLE` because signing keys differ.
  Installed a separate `com.acharya.app.dev` / "Acharya AI Dev" debug copy with
  user approval; the existing app/data were preserved. The debug application ID
  suffix and label were applied only to generated Android files, then restored.
  APK: `releases/acharya-sdk58-development.apk` (gitignored).
- Physical Android startup: passed. Metro bundled the app; Clerk initialized with
  development keys. The user completed Google OAuth, the callback returned to the
  development app, and the signed-in recorder screen rendered. No ReactNativeJS
  error or AndroidRuntime crash was observed during this smoke test.
- Clerk CLI 4.1.0 doctor: account access, project link, reachable application,
  instance IDs, and environment presence passed; only optional shell completion warned.
- Host DNS resolves `clerk.superacharya.com` to `0.0.0.0`, so its frontend API
  request fails on this computer. The attached phone resolves a public address.
  This network issue is independent of the Expo SDK version.
- iOS native compilation: not available on this Linux host; requires macOS/Xcode.

Five skipped tests require an isolated community PostgreSQL fixture; one requires
hosted Clerk/community integration configuration. Passing local tests does not
verify live provider calls, 1–2 hour background recording, or the optional native
embedding gate. See the feature-specific device acceptance documents.

`npm audit` still reports dependency advisories; see [dependency security](dependency-security.md).

## Commands

```bash
npm ci
npm run check
npx expo install --check
npx expo-doctor
npx expo run:android
# On macOS:
npx expo run:ios
```

There is no `expo run verify` command. Use `npm run check` for repository validation
and `expo run:android` for native build/install/start.

References: [SDK 58 release notes](https://expo.dev/changelog/sdk-58),
[upgrade guide](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).

## Continue development on the attached phone

The installed **Acharya AI Dev** copy preserves the original **Acharya AI** app.
Metro was left running on port 8081. After reconnecting USB or restarting Metro:

```bash
adb reverse tcp:8081 tcp:8081
npx expo start --localhost --port 8081
```

To reinstall the saved development APK without replacing the original app:

```bash
npx expo run:android --binary releases/acharya-sdk58-development.apk --app-id com.acharya.app.dev
```

The saved APK contains the native SDK 58 runtime; development JavaScript loads
from Metro. Generated Android files were restored to the normal package after
building this separate copy. A normal `expo run:android` still targets
`com.acharya.app` and cannot overwrite the differently signed existing install.

After the device smoke test, Router's deprecated initial-route setting was
replaced by `anchor` and matching `backBehavior`. TypeScript, lint, and all 237
active regression tests passed again after that adjustment.
