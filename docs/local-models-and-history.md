# Local model download and class history

Settings → Run locally opens the EmbeddingGemma 2 download page. Android custom
APKs include the download bridge; Expo Go, iOS and web display the native-build
requirement. The page downloads the pinned 164,626,432-byte text-only INT4 artifact
linked in [the model research](native-release-followup.md). Downloaded is a file
state, not a claim of successful inference.

Downloads use native file streaming and progress callbacks. The app verifies the
exact length and SHA256 in Kotlin using a 64 KB buffer before atomically renaming
the partial file. Model files live in Android no-backup storage, outside the APK.
They contain public weights, no account data. Cancellation removes the partial
file; after process death, Retry starts a fresh download. Leave the app open for
reliable downloading. Available storage is checked before downloading. There is
no cloud embedding fallback, and the device sends no notes to the model host.

Generated notes and teaching reflection are saved in SQLite `local_reports` before
the recorder acknowledges completion. The session ID is the stable report identity.
A failed save can be retried without calling the report provider again while the
recorder remains mounted. Existing latest-report previews are imported when their
matching recorder session is opened. Calendar uses the existing Acharya class
cards and notes/reflection sheet, with local-date dots and chronological periods.
History is account-scoped and removed by the existing sign-out/account cleanup.
Raw transcript text is not duplicated into report history.

The shared `readyLocalDb` function is the JS migration authority. The report
migration is local-only. No Neon migration or remote deployment is performed.

## Verification boundary

Automatic report chunking, vector indexing and background inference are **not
enabled** until [Gate 1](native-embedding-gate.md) actually executes successfully
in Android debug and minified release on a connected device. Downloading the
artifact, compiling an APK and passing JavaScript tests do not satisfy that gate.
The screen states this explicitly. A 4 GB phone remains a separate hardware gate.

## 1.0.1 local installation build

APK: `releases/Acharya-1.0.1-arm64.apk` (SHA256 sidecar in the same folder).
Package `com.acharya.app`, version code 2, Android ARM64, minimum Android API 24.
Built with minification and resource shrinking, locally debug-signed for testing.
This is not a production-signed Play Store release. JavaScript is bundled; Metro
is not needed to launch it. Model weights are downloaded separately.

`npm run check` passed: typecheck, lint, 135 tests, Android/iOS/web exports.
Expo Doctor passed 21/21. Release assembly, APK signature verification, ZIP
integrity, and ZIP 16 KB alignment checks passed. ZIP alignment is not an ELF or
16 KB runtime validation. No phone is connected, so install/start/download,
physical microphone/provider behavior, and model inference are not device-tested.
Automatic background vectors remain unfinished and disabled, not silently sent
to a cloud service. Native gate release APKs are preserved for the next device run.
