# AcharyaApp — implementation memory

Updated: 2026-11-01. Repository root: `/home/linux/Desktop/AcharyaApp`.
All paths below are relative to that root unless stated otherwise.
This document describes implemented code and separates automated checks from device verification. Sections 1–11 are historical snapshots; the latest status below supersedes outdated preview-only descriptions.

## 1. Stack, configuration, and branding

- Expo `~57.0.27`, React Native `0.86.3`, React `19.2.3`, Expo Router `~57.0.25`, strict TypeScript, Clerk `@clerk/expo`.
- `package.json` and `package-lock.json` define the installed dependency set. Keep the lockfile, overrides, and existing compatibility patches together.
- UI dependencies include `react-native-tab-view` 4.3.3, `react-native-pager-view` 8.0.2, keyboard-controller 1.21.9, Reanimated 4.5.1, Gesture Handler ~2.32.0, Lottie ~7.3.8, Expo Blur ~57.0.3, document/image pickers, file system, clipboard, and Zustand 5.0.15.
- `app.config.ts` is the single application config; `app.json` was removed. Name: Acharya; slug: `acharya-app`; scheme: `acharyaapp`; Android package: `com.acharya.app`. Web uses `output: 'server'` for the retained API routes.
- App icons and splash art: `assets/images/acharya-app-icon.png`, `assets/images/acharya-splash-icon.png`, and Android launcher resources in `assets/app-icons/android/`.
- Branding components: `src/components/animated-icon.tsx`, `animated-icon.web.tsx`, and `animated-icon.module.css`. Starter Expo icon assets and starter tab components were removed.
- Styling remains React Native StyleSheet. Tokens are in `src/theme/colors.ts`, `tokens.ts`, and `typography.ts`. Asset registries are under `src/constants/`, including `lottie.ts`.
- Shared controls: `src/components/ui/neo-button.tsx`, `neo-card.tsx`, and `acharya-blur.tsx`.

## 2. Authentication and protected navigation

1. `src/app/index.tsx` uses Clerk session state to choose the signed-in destination or onboarding.
2. `src/app/onboarding.tsx` and `src/components/onboarding/onboarding-screen.tsx` present the three slides only to unsigned users. Signed-in users skip onboarding.
3. `src/lib/routes.ts` centralizes destinations:
   - `SIGNED_IN_HOME = '/(app)/(tabs)/recorder'`.
   - `SIGNED_OUT_ENTRY = '/onboarding'`.
   - `SIGN_IN_ROUTE = '/sign-in'`.
4. `src/lib/auth-flow.ts`, `src/hooks/use-social-auth.ts`, and routes under `src/app/(auth)/` use the signed-in destination after authentication.
5. `src/app/(app)/_layout.tsx` guards all product screens with Clerk, supplies the gesture root and keyboard provider, scopes UI state by user ID, and hosts the product stack and blur provider.
6. `src/app/(app)/(tabs)/_layout.tsx` composes the five-tab navigator. Secondary routes are stack screens above the tabs.
7. `src/hooks/use-onboarding-gate.ts` was removed. `src/lib/onboarding-persistence.ts` is not an authentication routing gate.
8. `src/hooks/use-account-actions.ts` returns to onboarding after sign-out or account deletion, with local cleanup described below.

## 3. Five tabs and their implementation locations

| Tab | Route under `src/app/(app)/(tabs)/` | Presentation and hooks |
| --- | --- | --- |
| Home | `home.tsx` | `src/components/home/`; `src/hooks/use-home-dashboard.ts`, `use-home-greeting.ts` |
| Calendar | `calendar.tsx` | `src/components/calendar/`; `src/hooks/use-calendar-sessions.ts`; `src/lib/calendar/`; `src/store/calendar-store.ts` |
| Recorder | `recorder.tsx` | `src/components/recording/`; `src/hooks/use-recorder.ts`; `src/data/recorder-options.ts` |
| Chat | `chat.tsx` | `src/components/chat/`; `src/hooks/use-chat.ts`, `use-local-chat.ts`, `use-chat-history.ts`, `use-voice-input.ts` |
| Profile | `profile.tsx` | `src/components/profile/`; `src/hooks/use-profile-summary.ts`, `use-profile-photo.ts`, `use-profile-account.ts`, `use-teacher-display-name.ts` |

- Home includes greeting, mascot, activity statistics, empty state, teaching shortcuts, and Feed/Groups sections.
- Calendar includes month/date selection, empty state, session cards, bookmarks, and a detail sheet with reflection and class-notes views.
- Recorder includes topic/subject/class controls, selection modals, timer/start-stop presentation, transcript, report, and notes panels. Recording is a labeled local timer preview: it does not capture microphone audio or create a real transcript/report/session.
- Chat stores local user messages and supports new/select/rename/delete history. It does not invent assistant responses. Voice actions explain that voice processing is not connected.
- Profile includes identity, summary, preferences, account actions, and help/about rows. Placeholder legal destinations are not treated as verified production links.
- Display types live in `src/types/{calendar,chat,community,curriculum,home-dashboard,language,notes-verification,question-paper,recorder,async-resource}.ts`.

## 4. Secondary screens

All route paths in this table are beneath `src/app/(app)/`.

| Route file | Main implementation |
| --- | --- |
| `language.tsx` | `src/components/language/`, `src/data/languages.ts`, `src/hooks/use-language-gate.ts` |
| `profile/account.tsx` | `src/components/profile/profile-account-fallback.tsx`, `profile-native-account-view.tsx`, `src/hooks/use-profile-account.ts` |
| `profile/teaching-classes.tsx` | `src/components/profile/teaching-classes-screen.tsx`, `src/lib/teaching-classes.ts` |
| `notes/upload.tsx` | `src/components/verification/`, `src/hooks/use-question-paper-upload.ts`, `use-question-paper-verify.ts` |
| `notes/generate.tsx` | `src/components/verification/question-paper-generate-screen.tsx`, `src/hooks/use-question-paper-generate.ts` |
| `community/feed.tsx` | `src/components/community/community-feed-screen.tsx` |
| `community/create-post.tsx` | `src/components/community/create-post-screen.tsx` |
| `community/post/[postId].tsx` | `src/components/community/post-detail-screen.tsx` |
| `community/groups/index.tsx` | `src/components/community/groups-screen.tsx` |
| `community/groups/create.tsx` | `src/components/community/create-group-screen.tsx` |
| `community/groups/[groupId]/index.tsx` | `src/components/community/group-detail-screen.tsx` |
| `community/groups/[groupId]/chat.tsx` | `src/components/community/group-chat-screen.tsx` |
| `community/join.tsx` | `src/components/community/join-group-screen.tsx` |

Together with the five tabs, these are 18 product content screens.

- Curriculum selection, books/chapters, upload previews, and result displays are in `src/components/verification/`, supported by `src/hooks/use-curriculum-*.ts` and `src/data/curriculum-catalog.ts`.
- File validation is in `src/lib/notes-file-validation.ts`. Document/gallery/camera selections remain local. Processing actions explain that processing is unavailable.
- Community hooks: `src/hooks/use-community-feed.ts`, `use-community-groups.ts`, `use-community-preview.ts`, `use-community-post-images.ts`, and `use-group-chat.ts`; supporting modules: `src/lib/community/` and `src/store/community-store.ts`.
- Posts, comments, groups, memberships, and group messages are local previews. Join codes resolve locally created groups only.
- `src/app/(app)/ui-gallery.tsx` and `src/components/preview/ui-gallery-screen.tsx` expose protected development-only result fixtures. They do not populate normal history.

## 5. Durable account-scoped UI state

1. `src/components/preview/preview-provider.tsx` hydrates account data before showing the product UI and exposes feature drafts, preferences, attachment actions, and retry/reset states.
2. `src/lib/ui-preview/types.ts` defines snapshots, attachments, validation, and missing-file restoration behavior.
3. `src/lib/ui-preview/storage.ts` uses Expo SQLite key-value storage in the separate `acharya-ui-preview.db`. Both drafts and small preferences currently use this store; AsyncStorage was not added for this implementation.
4. Native attachment files are stored beneath the app document directory `acharya-ui-preview/<encoded-account-id>/`. Persisted references use owned relative filenames instead of temporary picker URIs.
5. `src/lib/ui-preview/storage.web.ts` uses IndexedDB database `acharya-ui-preview`, with `state` and `attachments` stores. Browser attachment blobs survive reloads; object URLs are rebuilt as needed.
6. `src/lib/ui-preview/lifecycle.ts` serializes writes, rejects stale session callbacks, drains accepted work before cleanup, and coordinates cleanup/hydration. Failed cleanup must be retried before old data can hydrate.
7. `src/lib/ui-preview/account.ts` coordinates account cleanup. `src/components/preview/preview-auth-cleanup.tsx` observes authentication transitions.
8. Sign-out clears account drafts and owned files, retaining isolated preferences. Account deletion clears preferences too. Cleanup errors are surfaced rather than silently reporting success.
9. Timers, open overlays, loading/processing state, and Clerk credentials are not durable UI drafts. An interrupted preview timer restarts idle.
10. Missing attachments require reselection without discarding draft text. Corrupt snapshots and storage failures have recovery paths.

## 6. Real Clerk profile operations

- `src/components/profile/profile-edit-name-modal.tsx`: name changes use `user.update()` followed by `user.reload()`, with pending/error states.
- `src/hooks/use-profile-photo.ts`: profile-image selection and Clerk image update.
- `src/hooks/use-profile-account.ts`: opens Clerk's configured HTTPS user-profile URL through `expo-web-browser`, refreshes identity afterward, and handles unavailable settings. No native Clerk UserProfileView is required.
- `src/hooks/use-account-actions.ts`: existing Clerk sign-out and account deletion plus account-scoped local cleanup.
- `src/lib/confirm-action.ts`: confirmation behavior for native and web.
- `src/store/preferences-store.ts`: shared preference state; durable persistence uses the preview storage modules above.

## 7. Navigation, keyboard, motion, and blur fixes

- `src/components/navigation/acharya-tabs.tsx`: Router `js-top-tabs`, five named screens, Recorder initial route, native swipe paging, on-drag keyboard dismissal, reduced-motion-aware transitions.
- `acharya-tabs.web.tsx`: web tap navigation fallback.
- `acharya-tab-bar.tsx`, `tab-bar-item.tsx`, `tab-bar-icon.tsx`, `tab-lottie-icon.tsx`, and `tab-lottie-icon.web.tsx`: floating dock, selected indicator, icons, Lottie, haptics, and press feedback.
- `tab-bar-constants.ts` and `tab-bar-glass.ts`: shared dock dimensions and appearance. Pill height 64, indicator 50, bottom float gap 8; horizontal inset 16 through spacing tokens.
- Home, Calendar, Recorder, and Profile screen components increase bottom content clearance when safe-area size requires it.
- `src/components/chat/chat-screen.tsx`: measured composer clearance and keyboard-sticky offset that removes the dock gap when the keyboard opens.
- `chat-edit-title-dialog.tsx`, `chat-delete-confirm-dialog.tsx`, and `chat-history-drawer.tsx`: responsive window sizing, pending-state controls, and Android Back closing the nested edit/delete dialog before the drawer.
- `src/components/calendar/session-detail-modal.tsx` and `src/components/verification/curriculum-select-sheet.tsx`: responsive sheet animation distance.
- Recorder, create-post, post-detail, create-group, and join-group forms use keyboard-aware scrolling. Group chat and the profile name editor use keyboard avoidance.
- `src/components/recording/recorder-starting-label.tsx`: core Animated starting dots honor reduced motion.
- `src/components/ui/acharya-blur.tsx`: focused screens register a `BlurTargetView`; blur overlays receive that target while forwarding refs and animated props.
- Fixed Android startup warning: `dimezisBlurViewSdk31Plus` is enabled only when a target is registered. Before registration and during focus gaps, the method is `none`; the registered target automatically restores Android blur. Explicit target/method choices remain supported. iOS/web defaults remain unchanged. No LogBox suppression or dependency patch was added.

## 8. Backend boundary and retained infrastructure

- `src/app/_layout.tsx` no longer mounts the application database/sync providers. Product startup and local teaching actions do not initiate those services.
- Backend schemas, migrations, routes, and implementation remain available for a later integration milestone:
  - PostgreSQL: `drizzle/pg/`, `src/server/db/`.
  - SQLite application database: `drizzle/expo/`, `src/db/schema.ts`.
  - API: `src/app/api/health/db+api.ts`, `sessions+api.ts`, `sync/push+api.ts`, `sync/pull+api.ts`.
  - Server sync: `src/server/sync/{push,pull,apply-change}.ts`.
  - Client sync: `src/lib/sync/` and `src/components/sync/sync-provider.tsx`.
- SyncProvider's account transition logic avoids clearing the application database while an authenticated user ID is still loading; it is currently unmounted.
- IDs remain 21-character NanoIDs through `src/lib/id.ts` and `validate-id.ts`.
- No microphone capture, teaching upload, transcription, speech synthesis, or AI processing was connected. Future providers remain Gnani, Gemini, and Neon PostgreSQL/pgvector.
- Secrets stay in ignored environment files. Do not put database/provider credentials in public Expo variables.

## 9. Step-by-step development and verification

1. Open `/home/linux/Desktop/AcharyaApp`; inspect `git status` before editing.
2. Install the committed dependency set with `npm ci` when needed. The postinstall applies the existing compatibility patches.
3. Configure local Clerk environment values using `.env.example`; never commit real secret values.
4. Run `npm run start` yourself to open Expo. For USB Android networking, use `adb reverse tcp:8081 tcp:8081` if Metro is otherwise unreachable.
5. Sign in and confirm Recorder opens directly. Tap all five dock items and swipe between them on native.
6. Check scrolling and dock clearance, recorder selectors, calendar sheets, chat history/rename/delete, and every secondary route listed above.
7. Focus inputs on narrow screens, test keyboard dismissal and Android Back, rotate where supported, and enable larger text/reduced motion.
8. Restart to check local drafts/files. Test missing files, canceled/denied pickers, failed storage, and account switching. Sign-out should remove drafts/files while retaining that account's preferences.
9. Test live Clerk name/photo changes and configured account settings separately from local teaching previews.
10. After changes run `npm run check`: TypeScript, lint with zero warnings, Node tests, then Expo export for Android, iOS, and web. Exporting retained API routes is not deployment.
11. For dependency changes also run `npx expo install --check` and `npx expo-doctor`.

## 10. Verified results and outstanding proof

- Latest completed `npm run check`: passed typecheck, zero-warning lint, **26 tests**, and Android/iOS/web exports after the Android blur fix.
- `tests/blur-target.test.cjs`: three regression tests for initial registration/focus cleanup, explicit targets/ref/animated-prop forwarding, and iOS/web defaults. These exercise rendered props using mocked native modules, not device blur rendering.
- `tests/ui-preview.test.cjs`: write ordering, failure retry, sign-out cleanup, stale callbacks, account isolation/deletion, hydration coordination, corrupt snapshots, and missing attachments.
- `tests/ui-backend-isolation.test.cjs`: traverses reachable product imports to reject database/sync/provider dependencies.
- Existing onboarding, configuration, IDs, theme/assets, and dependency compatibility tests remain in `tests/`.
- Earlier compatibility diagnostics passed Expo Doctor 21/21 and `expo install --check`; rerun after dependency changes.
- No connected Android device was available during the UI review. Exact device visual parity, swipe/keyboard behavior, live Clerk mutations, and native blur appearance remain runtime verification tasks. Static checks and exports do not establish those results.
- No teaching backend deployment, real recording pipeline, or live sync end-to-end validation was performed.
- The agent-started web development server was stopped after the UI review. Subsequent checks performed exports without starting an interactive development server.

## 11. Chat composer, tap feedback, and microphone level preview (2026-10-11)

- `src/components/chat/chat-composer.tsx`: ChatGPT-inspired composer; exact placeholder “Ask Acharya AI”; lavender plus opens the local Camera/Photos/Files sheet; empty text uses the pink circular voice action, typed text switches to Send. Existing blue mic opens the voice level preview.
- `src/components/chat/chat-attachment-menu.tsx`, `chat-attachments.tsx`, `chat-history-search.tsx`, and `src/hooks/use-chat-attachments.ts`: themed attachment options/icons, blurred background, local picked-file previews, existing validation/account storage, and a UI-only chat history search. Chat attachments remain local; no upload or AI response was added.
- `src/components/chat/chat-header.tsx` uses a circular history control. `chat-history-drawer.tsx` narrows New Chat and places a circular search action alongside it. Search results are not connected.
- `src/components/feedback/pressable.tsx` wraps native product controls and routes completed taps to the shared sound feedback. Background dismissal and sheet touch interceptors explicitly set `soundFeedback={false}`. Tabs and actionable icons/buttons play feedback; ordinary background taps and scrolling do not.
- `src/components/feedback/tap-sound-provider.tsx` preloads and manages one Expo Audio player for the hydrated account. `assets/audio/drop.mp3` is the bundled click sound. `src/lib/tap-sound.ts` immediately seeks/replays every tap, including after the Android player ends; volume is 100%, audio mixes, silent mode is respected, and app backgrounding/mute disposes playback.
- Profile → App settings → Sound effects persists via `soundEffectsEnabled` in `src/lib/ui-preview/types.ts` and preview preferences. Older preference records default it to enabled. Haptics remain independently enabled. `app.config.ts` configures Expo Audio with microphone permission solely for the separate chat level preview and disables background playback/recording.
- `src/hooks/use-microphone-level.ts` requests permission only after the user taps the chat mic. Expo Audio PCM samples are reduced immediately by `src/lib/microphone-level.ts` to RMS levels; no audio file is stored, and there is no STT, upload, or AI. `src/components/chat/voice-input-preview.tsx` shows low-noise dots and shifts recent loud levels right-to-left into waves. This is amplitude detection, not speech classification, so loud ambient sounds can also animate it. Stream stops on close, stop, tab blur, or app background. Web shows a microphone-level-unavailable message.
- Migration and test instructions: `docs/chat-composer.md`, `docs/sound-effects.md`; regression tests: `tests/chat-composer.test.cjs`, `tests/tap-sound.test.cjs`, `tests/microphone-level.test.cjs`. Existing attachment/chat fields and interaction code also changed in `src/hooks/use-chat.ts`, `use-local-chat.ts`, `src/types/chat.ts`, and relevant feature buttons now import the shared feedback Pressable.
- Latest verified `npm run check` after local microphone visualization and silent backdrop handling: typecheck, lint, **40 tests**, and Android/iOS/web Expo exports passed. No Android device was connected (`adb devices` was empty), so permission prompts, live tap audio latency, volume, and speech visualization remain to be confirmed on a physical phone.
- Repository commit and remote push status: update this after delivery.


## 12. Current release and offline reports (2026-11-01)

- Current app version: **1.0.17 / Android versionCode 18**, Expo ~57.0.28, React Native 0.86.3; package/lockfile and app.config.ts are authoritative.
- Recording now has real Gnani transcription, durable ordered SQLite chunks/recovery, and an optional on-device Whisper path. Historical preview-only descriptions above no longer describe current recording/chat/community integrations.
- Both src/lib/ai/speech.ts and src/server/recording/provider.ts explicitly send model=prisma-v3.0 to https://api.vachana.ai/stt/v3. The current official Gnani REST contract defaults to Prisma v2.5 when model is omitted. Language en-IN and format transcribe were retained. Offline transcription still selects Whisper small/medium independently.
- The existing 1.0.16 APK contains the prisma-v3.0 selection string too. A fresh signed ARM64 1.0.17 APK was built at release/Acharya-AI-1.0.17-prisma-v3-arm64.apk; SHA-256 0d3f7bf486cde6c97f84b81dba85c1df311fdf31b3b4acb161dcf1fa47818998. APKs remain gitignored; verification Markdown is tracked.
- The 1.0.17 build includes the current offline-report work: llama.rn runtime, explicit report-engine choice, model download/settings, shared native inference coordination, local report/history/cloud indexing changes, SQLite migration 0007, licenses/manifests and native test harnesses. See docs/offline-reports.md, docs/offline-reports-release-1.0.15.md, docs/offline-reports-json-fix-1.0.16.md and docs/offline-model-runtime-research.md for scope and limitations.
- The 1.0.16 handoff documents a physical isolated offline-report gate reproducing and fixing Gemma turn-marker/Markdown JSON parsing, with English/Hindi synthetic lessons and no network permission. This is recorded evidence from that work, not a new device test during the 1.0.17 release. Small-model teaching-feedback accuracy remains experimental.
- 1.0.17 validation: TypeScript and 27 focused direct-AI/recording-backend tests passed; signed assembleRelease and Android release lint passed; APK signature, package/version, ARM64-only packaging, bundled Prisma selection and ZIP 16 KB alignment verified. Initial R8 minification failed with a 2 GB Java heap; retry passed using ACHARYA_GRADLE_JVM_ARGS='-Xmx4096m -XX:MaxMetaspaceSize=1024m' and ACHARYA_APK_ONLY=1 node scripts/build-closed-testing.cjs.
- The new APK was not installed or microphone/Gnani-tested on a physical phone. No backend deployment or Google Play publication occurred. See release/Acharya-AI-1.0.17-verification.md.
- Before publication, full npm test passed: 270 passing, 6 skipped, no failures; npm run lint passed. The llama.rn patch contains required blank context lines flagged by git diff --check; all other staged files passed whitespace checks.
- User requested memory update, commit and pushes to main on both origin (ANAMASGARD/Acharya) and upstream (ANAMASGARD/AcharyaAI). Check remote heads before pushing; this entry records authorization, not a claim that pushes already succeeded.

### Upstream Expo 58 port

This checkout preserves upstream Expo 58 / React Native dependency versions and its existing compatibility changes. The 1.0.17 APK and native validation above apply to the Expo 57 build in AcharyaApp. No Expo 58 APK was built for this port. Dependency conflicts were resolved by retaining upstream dependencies and adding only the pinned llama.rn runtime from the release commit.

Upstream port validation before publication: clean npm ci with scripts disabled, all four compatibility patches applied successfully, TypeScript and lint passed, 270 tests passed and 6 skipped. No Expo 58 native build/device test was performed for this port. Origin/main release commit b44d577 was pushed successfully.
