# UI migration

Source: `/home/linux/Downloads/acharya-app`, current working tree. Destination uses Expo 57.0.27, React Native 0.86.3 and React 19.2.3. Preserve the source's post-auth presentation, not its SDK 54 dependency pins or provider integrations.

## Screen mapping

Home, Calendar, Recorder, Chat and Profile retain their source presentation modules. Secondary screens include language, teaching classes, account, paper verification/generation, community feed/create/detail, and group list/create/join/detail/chat. Home has an explicit `/home` path; authenticated entry is Recorder. Authentication and onboarding remain destination-owned.

## Compatibility decisions

- Use `expo-router/js-top-tabs` with official tab-view and SDK-compatible pager packages. Keep the custom dock and native horizontal paging.
- Use keyboard-controller's provider, sticky composer and keyboard-aware scroll views. SDK 57 includes it in Expo Go: https://docs.expo.dev/versions/v57.0.0/sdk/keyboard-controller/
- Adapt Android blur to BlurTargetView/blurTarget: https://docs.expo.dev/versions/v57.0.0/sdk/blur-view/
- Keep the existing fonts/theme and identical images/Lottie assets. Translate the few source NativeWind declarations to StyleSheet.
- Full Clerk native UserProfileView requires a development build; use JS name/photo edits and Clerk's configured account URL instead: https://clerk.com/docs/reference/expo/native-components/overview
- Native draft storage uses a separate SQLite key-value database. Web uses IndexedDB rather than requiring SQLite WASM/COOP/COEP: https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/
- Persist selected native attachments under app document storage, not cache; browser blobs belong in IndexedDB: https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/

## Scope

Teaching interactions are local previews. No microphone capture, AI responses, transcription, cloud uploads, or sync is connected. Existing server/schema/sync implementations are retained but not mounted by the product UI. Drafts and copied files survive restart and clear on sign-out; preferences remain account-scoped. Real Clerk account operations remain network operations.

## Verification

Before migration: typecheck, lint and 15 tests passed. Source docs freshness check matched 390 file hashes and 66 commits. No Android device was attached at the beginning of implementation. Final checks and remaining device limitations must be reported from actual execution.

Browser verification during implementation: unsigned `/` rendered the existing three-slide onboarding, and direct `/recorder` rendered Clerk sign-in. A capture is saved at `/tmp/acharya-ui-verification/protected-recorder-sign-in.png`. No authenticated browser session or attached Android device was available; signed-in visual parity, native gestures/keyboard and live Clerk mutations remain unverified.

Final automated validation: `npm run check` passed strict TypeScript, zero-warning lint, 23 tests, Android/iOS bundles and web/server export. `npx expo install --check` passed and Expo Doctor passed 21/21 checks. Export includes the four retained API routes; migrated product UI does not import their database/sync implementation. The development-only authenticated `/ui-gallery` renders sample result presentations without populating normal app history.
