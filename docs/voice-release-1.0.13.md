# Acharya AI 1.0.13 voice release

Implementation checkout: `/home/linux/Desktop/AcharyaApp`, branch `codex/live-voice`.

The chat composer keeps Gnani microphone dictation and adds an independent pink OpenAI voice control and send control. The voice control opens a full-screen modal with the existing animated Acharya mascot, live captions, mute, pause/resume, hang-up, and teaching-practice controls. Practice disables automatic responses until the teacher asks the student or requests feedback. Completed captions and feedback are saved to the current private conversation; interrupted assistant speech is represented by an interruption marker.

The native transport uses react-native-webrtc 124.0.8 and config plugin 15.0.2. Server-side OpenAI call creation uses the existing server API key configuration (optionally VOICE_OPENAI_API_KEY), configurable OPENAI_VOICE_MODEL defaulting to gpt-realtime-2, and the shimmer voice. Neither provider keys nor database credentials are returned to the device. The context includes authorized recent chat, selected curriculum metadata, and the saved paper review; it does not perform new embedding ingestion.

The additive `0006_voice_sessions.sql` migration was applied. Call records are private, transcript item saves are idempotent, and conversation/source deletion terminates associated active calls. Capturing stops on navigation/backgrounding; reconnection is explicit. The ten-minute device cutoff is not a guaranteed provider billing ceiling.

## Manual validation handoff

At the user's explicit request, no standalone test suite, TypeScript check, JavaScript lint, paid model-access check, live voice test, or physical-device test was run. Export and Android release packaging are delivery operations, not evidence that audio works. Native Android/iOS compatibility, speaker echo, Hindi/English recognition, interruption, caption ordering, account switching, and network recovery remain unverified. The separate US$5 live-test allowance is unused.

Install the new native APK; an OTA update or Expo Go cannot add WebRTC. Sign in and open Chat. The blue microphone should dictate into the composer. The pink button should open the voice modal, request microphone access, and greet once. Try a spoken turn, interrupt the reply, mute/unmute, pause/resume, and practise teaching with a long pause. Use Ask the student and Finish & get feedback. End the call and reopen chat to inspect saved captions. Also check denied microphone permission, backgrounding, reconnection, and conversation deletion.

No raw voice recordings are stored by Acharya. Audio is sent to OpenAI; provider data handling is separate from app storage. Captions are approximate and client-reported, not audited provider usage records.

## Backend delivery

The server export completed and was deployed to the existing EAS alias `https://acharya-app--rag-desktop.expo.app`. Immutable deployment: `https://acharya-app--4v0xscua1b.expo.app`. No authenticated request or live call was made to validate this deployment.

## Android delivery

Signed ARM64 release packaging completed successfully (Gradle `assembleRelease`, Java 17). APK: `/home/linux/Desktop/AcharyaApp/release/Acharya-AI-1.0.13-voice-arm64.apk`, app version 1.0.13/code 14. The Android build ran its built-in release lint tasks; no standalone lint or test suite was invoked. The initial packaging process was interrupted; the subsequent packaging run succeeded. This APK has not been installed or audio-tested by the agent.

## Connection lifecycle correction — 2026-11-01

The installed `@clerk/expo` useAuth implementation returns a fresh getToken wrapper on each render. The voice effect depended on that wrapper, so status/caption updates could repeatedly clean up and restart connection setup. The effect now depends on loaded authentication/account identity and reads the current token function from a ref. Account changes still tear down the old session. No new provider call or embedding work was introduced.

Read-only diagnostics found no voice-session rows in the configured local Neon database. An OpenAI model metadata lookup with the local server key successfully returned gpt-realtime-2; it generated no audio or text and does not establish deployed-key or two-way audio operation. No phone was connected. Live audio remains for manual verification.

The corrected signed APK built successfully: `/home/linux/Desktop/AcharyaApp/release/Acharya-AI-1.0.13-voice-connection-fix-arm64.apk`. Install this replacement instead of the earlier voice APK. No backend change was required for this lifecycle correction. Two-way audio has not been device-tested.

## Voice preference — 2026-11-01

Changed the built-in voice to `shimmer` and explicitly requested a warm, feminine delivery with a natural Indian English accent, plus natural Hindi/Hinglish pronunciation when the teacher uses those languages. Accent instructions do not force a language switch. The preference is server-side and applies to new calls, including from the already-installed APK. Guidance: https://developers.openai.com/api/docs/guides/voice-prompting?voice-api=realtime . Accent fidelity remains model-dependent.

The user reported that live voice worked after installing the connection-fix APK. This is user-reported confirmation, not an agent-run physical audio test.

## Authorized automated validation — 2026-11-01

The user subsequently requested full checks before Git delivery. `npm run check` completed successfully: TypeScript, zero-warning lint, Node tests (239 passed, 6 skipped, 0 failed), and Expo exports for Android, iOS, and web. `npm run test:rag` also passed (49 passed, 13 skipped, 0 failed). Skipped tests remain unverified. No paid audio generation was performed to audition the new accent.

Checks exposed a missing vendor declaration in react-native-webrtc 124.0.8; a minimal patch re-exports its shipped source declaration. Expo route declarations were regenerated. The token getter ref now updates in an effect to satisfy React's render rules without restarting voice on each render. Composer tests now cover distinct dictation/live voice/send actions and microphone contention.

## Upstream SDK 58 port — 2026-11-01

Ported the voice feature to ANAMASGARD/AcharyaAI while preserving its Expo SDK 58, React Native, Clerk, and other existing dependency versions. The earlier SDK 57 device/build evidence above does not establish native SDK 58 compatibility. In the SDK 58 checkout, `npm run check` passed TypeScript, lint, 239 Node tests (6 skipped), and Android/iOS/web exports. RAG tests passed 49 tests (13 skipped). No new SDK 58 native build or physical audio test was run for this port.
