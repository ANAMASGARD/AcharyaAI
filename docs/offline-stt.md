# Offline recorder speech-to-text

This branch targets Expo SDK 58. The device and APK results below refer to the
SDK 57 build; the SDK 58 port still needs its own native build and device tests.

Whisper is an optional recorder add-on. Gnani remains the default online option.
Offline reports/LLM inference are not included.

## Download and select

Open Profile → Run locally, the same page as EmbeddingGemma 2. Download Whisper
small (190 MB) or medium (539 MB), wait for verification, then choose **Use for
offline STT**. Both downloads can remain on the phone. Downloading never selects
a model automatically. Small is the starting recommendation; medium requires
more memory and may be slower. Neither size guarantees real-time performance.

These are multilingual models for English, Hindi and mixed Hinglish speech.
Language detection is automatic and translation is disabled. Hindi may appear in
Devanagari; Romanized Hinglish and accurate code switching are not guaranteed.
Each saved chunk is transcribed separately, so context across chunk boundaries
and classroom noise need real lesson testing.

Offline speech requires the updated custom Android APK, not Expo Go. iOS/web
show an availability message. Version 1.0.14 / Android version code 15 introduces
the native dependency; installing only an OTA update on an older APK is insufficient.

Pause saves a validated resume checkpoint. Cancel removes the partial download.
If Android kills the app during an active download, a complete file is checked;
an incomplete download without a valid pause checkpoint restarts explicitly.
There is no eight-minute total deadline; a transfer stalled for 60 seconds offers
Retry. Keep the app open while downloading. Free space is checked before download;
allow space for retained recording audio separately (about 115 MB per hour).
Models live in Android no-backup storage and are verified by exact size and SHA-256.
The source, license and immutable artifact details are in [research](offline-stt-research.md).

## Record and reopen classes

Open Recorder and check the engine label. Record normally. The existing native
capture saves ordered 30-second WAV chunks, plus the shorter tail when stopped.
Whisper reads those local files and adds text to the existing transcript panel
when inference finishes. The pending count shows any backlog. Network changes
never switch the engine; there is no cloud fallback for an offline session.

Stop flushes capture and continues transcription. Model/engine changes are locked
until unfinished transcription is resolved. Missing/corrupt models keep queued
audio available: repair the original model through Run locally, then Retry in
Recorder. Removing a model needed by any unfinished local session is blocked.

Completed transcripts are classes even without a report. Start another classroom
and reopen older transcripts in Calendar. **Generate report online** explicitly
uses the existing report provider and credentials. Going online alone does not
submit a transcript. The transcript is never retranscribed to generate a report.

## Sign-in, recovery and retention

After installing the new APK, open Acharya online while signed in once to populate
Clerk's experimental resource cache. A usable cached Clerk identity is necessary
for offline cold start. Missing cache shows reconnect guidance; no remembered
user ID bypasses authentication. Offline STT itself performs no token fetch.

Ordinary interruption/sign-out preserves account-isolated recordings and reports.
Account deletion waits for inference/capture teardown before erasing account data.
Pending audio is retained on cancellation; results from stale owners are ignored.
Surviving orphaned audio partials are finalized only when the native writer has
stopped. Audio that never reached storage cannot be recovered. Android may pause
JavaScript transcription scheduling while native capture continues; reopening
resumes durable work. Do not assume uninterrupted background inference.

The embedding worker defers while Whisper is loading, active, draining its backlog,
or releasing. Only one Whisper operation runs at a time across the app.

## Verification

Run `npm run check`, `npx expo-doctor`, and Android debug/minified release builds.
The automated suites include session pinning, no online dispatch for offline
sessions, cancellation settlement, download checkpoint/range handling, SQLite
migration, transcript-only history and report persistence. These tests do not
prove device inference performance or recognition accuracy.

Device acceptance requires both models, a 65-second 30/30/5 recording, warm-cache
and missing-cache airplane-mode startup, account switching, process death at
file/database boundaries, low storage with slow inference, and sustained 60–120
minute recording. Measure inference time/audio duration, memory, heat and backlog.
Include Hindi/English code switching, sentences across boundaries, silence and
noise. A 4 GB device requires its own acceptance results. See the delivery report
for the checks actually performed in this implementation run.

### Isolated device gate

The opt-in gate uses a separate `com.acharya.app.sttgate` package with OTA updates
disabled and a synthetic entry point. It downloads through the production model
downloader and runs the real engine/controller/SQLite history against a pinned
public JFK sample repeated to 65 seconds. It never opens the microphone, signs
into Clerk or accesses the teacher's app data. This proves file inference and
persistence; physical microphone capture and language-quality acceptance remain
separate tests.

```sh
node scripts/offline-stt-gate/prepare.cjs  # requires ffmpeg and espeak-ng
npx expo prebuild --platform android --no-install
cd android
JAVA_HOME=/usr/lib/jvm/java-17-temurin-jdk ACHARYA_METRO_WORKERS=2 ./gradlew :app:assembleDebug :app:assembleAndroidTest -PacharyaSttGate=true -PreactNativeArchitectures=arm64-v8a --max-workers=3
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.acharya.app.sttgate/com.acharya.app.MainActivity
adb logcat -s ReactNativeJS:I
```

`AcharyaSttGate` messages report verified downloads, load/inference times, chunk
counts and completion. Additional Hindi/Hinglish/silence fixtures log only their
synthetic test transcripts; no classroom audio is used. Debug results also
live in `files/offline-stt-gate.json` inside the isolated package. The separate
instrumentation APK tests orphan partial recovery and model residency exclusion.
For release use `assembleRelease`, `-PacharyaGateBuildType=release`, and the same
`-PacharyaSttGate=true` flag. For the teacher APK omit both gate flags.

To also test real Hugging Face Cancel/Pause/Resume, create
`files/download-controls.flag` in the isolated debug package before launching the
gate. This intentionally removes and downloads only that test package's Small
model. It never changes downloads in the teacher app.

## Delivery validation — 2026-11-01

- Main app: signed `com.acharya.app`, version 1.0.14 / code 15, arm64 APK at
  `releases/Acharya-AI-1.0.14-offline-stt-arm64.apk` (88,247,379 bytes), with a
  matching `.sha256` file. Models are downloaded separately inside the app.
- `npm run check` passed typecheck, lint, tests and Android/iOS/web exports.
  Following the final download/lifecycle fixes, typecheck, lint and the full test
  suite passed again: 257 passing, zero failing, six hosted integrations skipped.
- Java 17 debug and minified release builds passed. The final main APK's signature,
  ZIP alignment and all 31 arm64 ELF libraries passed the 16 KB alignment checks.
- Two physical Android instrumentation tests passed for partial-WAV recovery and
  Whisper/embedding exclusion. Both real Whisper models completed the 65-second
  English file test in the original debug run; timings and the subsequently fixed
  duplicate-harness issue are documented in `offline-stt-research.md`.
- Expo Doctor: 19/21 checks. Existing Expo patch-version mismatches and React Native
  Directory warnings remain, with Whisper additionally lacking directory metadata.
  These warnings were not suppressed or addressed through unrelated upgrades.
- The clean minified test APK compiled, but its attempted installation lost the USB
  device connection. A clean release-device rerun, real phone Download/Pause/Resume,
  Hindi/Hinglish quality, silence/noise, microphone airplane-mode capture, Clerk
  cache/account switching and 60–120-minute endurance remain acceptance checks.
  Source/unit tests and the short debug fixture runs do not prove those outcomes.

Install the new main APK, launch/sign in online once, then use Profile → Run locally.
Use Small first on the tested phone; Medium's measured backlog is much larger.
