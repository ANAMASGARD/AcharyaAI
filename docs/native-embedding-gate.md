# Native embedding gate

Gate 1 is a stop/go check, not a shipped offline-AI feature. Existing recorder,
direct OpenAI reports, report UI, and new-classroom behavior remain unchanged.
No report indexing or sync is enabled before this gate passes. The independent
model download and local report history are described in [local models and history](local-models-and-history.md).

## What is implemented

- An app-owned `AcharyaSqliteConnection` facade inside pinned `expo-sqlite@57.0.4`,
  installed by patch-package. It uses Expo's existing JNI library, parameterized
  statements, a 1.5-second busy timeout, foreign keys, serialized short
  transactions, statement finalization, and explicit SQL/JNI connection close.
  It refuses a missing database and does not run application migrations.
- `expo.autolinking.android.buildFromSource` in package.json ensures the facade
  is compiled rather than bypassed by Expo's prebuilt SQLite AAR. This is a
  maintained compatibility patch, not an upstream public Expo API.
- A local Android module and **opt-in** native test source set. LiteRT-LM,
  WorkManager, the model adapter, and synthetic worker compile only when
  `acharyaNativeGate=true`. Normal builds expose `available: false` for inference, plus download/verification
  methods; no inference worker or bundled model artifact. iOS/web have no new native imports.
- Exact INT4 model verification, CPU two-thread configuration, FLOAT32 activations,
  model-card prefixes exactly once, 768 → 256 truncation, L2 normalization, and
  little-endian float32 serialization. [Research and primary sources](native-embedding-gate-research.md).
- Android instrumentation for real WorkManager execution before React initializes,
  real embeddings, English/Hindi/mixed fixtures, repeat stability, a retrieval
  smoke check, overflow rejection, two SQLite connections, rollback, reopening,
  integrity checking, and vector BLOB round trips. These are native tests, not
  JavaScript mocks. Their existence is not evidence that they passed.

## Compiler compatibility

The baseline generates Kotlin 2.1.20. LiteRT-LM carries Kotlin 2.4 metadata, which
that compiler cannot read without suppression. Clerk's installed Gradle script
adds `-Xskip-metadata-version-check` to all subprojects; the gate explicitly removes
it from this native module. The Android compatibility plugin pins builds to Kotlin
2.3.20 in both the Expo catalog and root compiler classpath. Setting only the
catalog did not change the actual compiler. Kotlin 2.4.0 itself was tried but Expo's
required `pika-compiler:0.3.2-2.4.0` is not published. Do not disable Pika or metadata
validation to force a green build. The evidence below determines whether the
2.3.20 combination is usable, rather than this configuration being proof.

## Reproduce locally

Use JDK 17 and the Android SDK. Do not use a production signing key or production
account. The config plugin gives this test application the separate ID
`com.acharya.app.nativegate`; tests refuse the normal app ID. Model weights are
packaged in the **test APK only**, copied to private no-backup storage for execution.
No classroom data or provider credentials are needed.

```bash
npm ci --no-audit --no-fund
npm run native:gate:prepare
cd android
JAVA_HOME=/usr/lib/jvm/java-17-temurin-jdk ANDROID_HOME=/home/linux/Android/Sdk \
  ./gradlew :app:assembleDebug :app:assembleDebugAndroidTest \
  --no-daemon --max-workers=4 -PreactNativeArchitectures=arm64-v8a
JAVA_HOME=/usr/lib/jvm/java-17-temurin-jdk ANDROID_HOME=/home/linux/Android/Sdk \
  ./gradlew :app:connectedDebugAndroidTest \
  --no-daemon --max-workers=4 -PreactNativeArchitectures=arm64-v8a
JAVA_HOME=/usr/lib/jvm/java-17-temurin-jdk ANDROID_HOME=/home/linux/Android/Sdk \
  ./gradlew :app:assembleRelease :app:assembleReleaseAndroidTest \
  -PacharyaGateBuildType=release --no-daemon --max-workers=4 \
  -PreactNativeArchitectures=arm64-v8a
JAVA_HOME=/usr/lib/jvm/java-17-temurin-jdk ANDROID_HOME=/home/linux/Android/Sdk \
  ./gradlew :app:connectedReleaseAndroidTest -PacharyaGateBuildType=release \
  --no-daemon --max-workers=4 -PreactNativeArchitectures=arm64-v8a
```

Use `x86_64` instead for a compatible emulator. The release test is minified and
resource-shrunk, locally debug-signed; it is not a distributable store release.
The native model is under `.expo/native-gate/assets`, never tracked in Git.
After testing, regenerate a normal native project with
`npx expo prebuild --clean --platform android --no-install` **without**
`ACHARYA_NATIVE_GATE`. This discards generated native folders; preserve any manual
native changes first. Check that `acharyaNativeGate` and `.nativegate` are absent
before building the normal application. Expo prebuild may update launch scripts.

## Acceptance and continuation

Do not pass this gate based on exports, Kotlin compilation, ELF alignment, or a
model hash. Both debug and minified release must actually execute the model and
SQLite worker without an Activity/React context. Capture instrumentation results,
ABI, Android version, device model, page size, model load time, latency, whole-app
peak memory, and integrity results. The smoke fixtures are not retrieval-quality
calibration. Compare 256/768 retrieval rankings on a consented representative
English/Hindi/mixed corpus before claiming search quality.

A physical 4 GB phone and final whole-APK/AAB 16 KB alignment plus a 16 KB runtime
environment remain release gates. Include a long queue, recorder start during
load/inference, thermal/battery measurements, process death, and model removal.

After Gate 1 passes, continue the agreed milestone, without changing its scope:

1. Durable report history and Calendar; report-save/index-request/report-outbox in
   one transaction, with a storage retry reusing the already generated result.
2. Local indexing with one migration authority, schema readiness, account-specific
   local grants, leases, expected chunk manifests, and atomic vector/job/outbox saves.
3. Authenticated two-way Neon sync of notes/reflection and locally generated vectors
   only. Coordinate all triggers with one **per-account persistent sync lease**;
   a stale response must never move the pull cursor backward. Every indexing commit
   and sync callback must verify **owner and captured account generation**.
4. Keep Clerk cold-start/offline and headless token restoration as real test gates;
   retain pending data on network/auth-refresh failure. No raw transcript syncing,
   cloud embeddings, OpenRouter, generative downloads, or RAG/search UI in this milestone.

## Current evidence (2026-10-12)

Fresh `npm ci` applied the SQLite patch; `npm run check` passed 127 tests,
typecheck, lint, and all platform exports. ARM64 debug and debug test APKs
assembled. Debug APK ZIP alignment passed `zipalign -c -P 16 4` (not a runtime
or complete ELF compatibility test). Release app assembly completed with R8
Kotlin-metadata warnings; release test assembly failed with missing
`androidx.concurrent.futures.SuspendToFutureAdapter`. Both issues need resolution
before accepting the release gate.

No instrumentation executed: emulators crashed before boot and the connected
Android 16 ARM64 phone disconnected before installation. Its approximately 8 GB
RAM and 4 KB pages would not prove the 4 GB / 16 KB release requirements anyway.
Gate 1 remains **unverified**. The user's subsequent request prioritizes normal
`npx expo start` / Expo Go use; native-dependent implementation has not continued.

## Follow-up build configuration

The gate now overrides R8 to 9.1.29 using its upstream Maven repository and aligns
concurrent-futures-ktx 1.3.0 in the gate app and test APK. Android test consistent
resolution rejected a test-only upgrade against the app's 1.1.0 dependency.
See [release follow-up](native-release-followup.md). Execution results must still
be captured from a connected device; these changes alone do not pass the gate.

Follow-up result: ARM64 minified release app and release instrumentation APK now
assemble successfully (`.expo/native-gate/followup-release.log`, 6m 58s). The Kotlin
metadata and missing adapter errors are resolved. R8 reports a non-fatal async
class-resource parsing warning. APKs are retained under `.expo/native-gate/apks/`.
No device is connected in ADB, so **Gate 1 is still not passed**. Automatic report
indexing has not been implemented/enabled. The regular app build contains only
the independent model download and local Calendar history changes.
