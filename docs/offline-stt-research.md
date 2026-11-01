# Offline STT research

Source review completed 1 November 2026. This note establishes upstream API and
artifact contracts; it does not establish successful Android inference, recognition
quality, release packaging, or sustained recording performance. No model binaries
were downloaded or independently hashed during this research, and no device tests
were run as part of it.

## Scope and version boundary

Offline Whisper is an additional recorder transcription option. Gnani remains the
existing online option. Teachers can choose a downloaded model for offline use or
while connected. A completed transcript must remain a saved class without a report,
appear in Calendar, reopen under its owner, and support explicit online report
generation later. Offline LLM, offline report generation, and iOS inference are
outside this increment.

The inspected dependency baseline was Expo `57.0.28`, React Native `0.86.3`,
`expo-file-system` `57.0.7`, and `@clerk/expo` `4.10.1`. These installed versions
establish the source-review baseline, not compatibility proof for a new native
library. Whisper API conclusions below use `whisper.rn@0.7.4`, whose tag resolves to
commit `4d750cb7917973c2528a46cd3902dfe4ebbcbe7f`.
[Whisper tag](https://github.com/mybigday/whisper.rn/tree/v0.7.4).

Context7 library searches and focused documentation lookups were performed through
its `context7.sh` script. Whisper results included newer `main` documentation;
version-specific conclusions were checked against the tagged source instead. Do
not infer stable-version features or compatibility from newer examples.

## Immutable model manifest

Repository: `ggerganov/whisper.cpp`. Both multilingual artifacts are pinned to
revision `5359861c739e955e79d9a303bcbc70fb988958b1`.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `ggml-small-q5_1.bin` | 190085487 | `ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb` |
| `ggml-medium-q5_0.bin` | 539212467 | `19fea4b380c3a618ec4723c3eef2eb785ffba0d0538cf43f8f235e7b3b34220f` |

The official repository-tree API and raw Git LFS pointers independently agreed on
these metadata values. This verifies the revision-to-file mapping, not the bytes
of an app download. Verify every completed download against the manifest before
promotion or model initialization.
[Revision metadata](https://huggingface.co/api/models/ggerganov/whisper.cpp/tree/5359861c739e955e79d9a303bcbc70fb988958b1?recursive=false&expand=false),
[small pointer](https://huggingface.co/ggerganov/whisper.cpp/raw/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-small-q5_1.bin),
[medium pointer](https://huggingface.co/ggerganov/whisper.cpp/raw/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-medium-q5_0.bin).

Download URLs must contain the immutable revision:

- [Small download](https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-small-q5_1.bin).
- [Medium download](https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-medium-q5_0.bin).

Recommended application contract: persist each session's engine, immutable model
identity, and requested language when creating it; enforce them on initial work,
recovery, and retries. Missing or corrupt artifacts require repair rather than
silently switching engines. Download completion does not change the selected
engine/model. Requested `auto` language and detected language are separate values.

## File transcription and native lifecycle

The tagged file API accepts a local WAV path and returns `{ stop, promise }`. Its
resolved result includes `isAborted`; an aborted operation need not reject. The
JavaScript `stop()` awaits an abort request, not the original transcription result.
[Tagged API](https://github.com/mybigday/whisper.rn/blob/v0.7.4/src/index.ts#L260-L325),
[native abort request](https://github.com/mybigday/whisper.rn/blob/v0.7.4/cpp/jsi/RNWhisperJSI.cpp#L2121-L2148).

Use this application lifecycle:

1. Reserve native model residency and prevent new embedding model loads.
2. Await any active embedding inference and engine closure before loading Whisper.
3. Initialize the pinned model and permit one transcription job across the app.
4. Keep the reservation through capture and the post-Stop transcription backlog.
5. For cancellation or account teardown, mark cancellation immediately, request
   `stop()`, and await the original transcription promise's settlement. Reject
   aborted results and results whose session/account ownership has become stale.
6. Await context `release()`, then release the native residency reservation.

Upstream `release()` already aborts and waits for native tasks before freeing the
context. Awaiting the original promise at application level additionally settles
the application's persistence and lifecycle work; this is not a claim that the
upstream release function frees an active context unsafely.
[Native release](https://github.com/mybigday/whisper.rn/blob/v0.7.4/cpp/jsi/RNWhisperJSI.cpp#L1812-L1845).

Stop recording should finalize the last chunk and drain queued transcription.
Cancellation should preserve unfinished audio for recovery. A request to cancel
another worker is not evidence that its model has finished closing. Likewise,
partial-audio recovery needs exclusive access to the writer before modifying an
orphaned file; an absent service instance alone is insufficient synchronization.
These are application requirements rather than guarantees supplied by Whisper.

Tagged Android initialization sets `use_gpu=false`; GPU/NPU hardware does not
establish acceleration for this integration. The transcription configuration sets
`no_context=true`, so retaining the model context does not automatically preserve
linguistic context between WAV calls. Measure chunk-boundary recognition and mixed
Hindi/English speech explicitly.
[Android initialization](https://github.com/mybigday/whisper.rn/blob/v0.7.4/android/src/main/jni.cpp#L624-L632),
[decoding configuration](https://github.com/mybigday/whisper.rn/blob/v0.7.4/cpp/jsi/RNWhisperJSI.cpp#L919-L923).

## Download pause, resume, and interruption

The installed Expo FileSystem `57.0.7` legacy TypeScript and Android source matched
upstream commit `9e5319c0f821a27b7924841903abae50e2b41790`. Legacy `savable()` returns
the already stored `resumeData`; it does not capture a fresh checkpoint during an
active download. New resume data is assigned after successful `pauseAsync()`.
[SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem-legacy/),
[version-matched JS source](https://github.com/expo/expo/blob/9e5319c0f821a27b7924841903abae50e2b41790/packages/expo-file-system/src/legacy/FileSystem.ts#L457-L566).

Android adds a Range header when resume data exists and appends the response body.
It returns status and headers after writing rather than checking `206` and
`Content-Range` before appending. Its pause function reads file length immediately
after requesting cancellation. These details constrain the app's recovery promise.
[Android request and pause](https://github.com/expo/expo/blob/9e5319c0f821a27b7924841903abae50e2b41790/packages/expo-file-system/android/src/main/java/expo/modules/filesystem/legacy/FileSystemLegacyModule.kt#L621-L701),
[Android response writing](https://github.com/expo/expo/blob/9e5319c0f821a27b7924841903abae50e2b41790/packages/expo-file-system/android/src/main/java/expo/modules/filesystem/legacy/FileSystemLegacyModule.kt#L920-L954).

Recommended minimum contract using the existing downloader and native storage
bridge:

- Keep independent manifest identity, partial path, and state for each model.
- On Pause, await `pauseAsync()` and the original download/resume promise. Check
  that the stopped partial size equals the saved Android offset, with the offset
  strictly between zero and the expected full length, before persisting a paused
  checkpoint. Preserve this partial; Cancel removes it after the operation settles.
- Validate checkpoint identity, path, offset, and existing partial size before
  Resume. Persist active state before starting it, so an older checkpoint cannot be
  mistaken for a valid pause after process death.
- On startup, independently verify a complete-sized candidate and promote it only
  if its SHA matches. Preserve a valid explicitly paused checkpoint. For an active
  download interrupted by process death, otherwise invalidate its stale checkpoint
  and offer a clear restart from zero. Do not fabricate resume data from progress.
- For resumed completion require `206`, a `Content-Range` starting at the saved
  offset and ending at the expected final byte with the manifest total, exact full
  file length, and SHA-256. Reject ignored-range `200`, invalid ranges, `416`, and
  integrity failures; restart cleanly with bounded retries. A fresh download also
  requires an acceptable success status and exact full length/hash.
- Recheck available storage before resumed and fresh attempts. Because response
  validation occurs after writing, an ignored Range may append an entire file.
  Budget audio backlog separately and handle write failures without promoting the
  candidate. Verification/promotion must not race Cancel or model removal.

These rules prevent unverified files from becoming usable models; they do not add
pre-write HTTP validation to Expo. A dedicated native Range downloader is only
needed if early response rejection or seamless recovery from an actively killed
download becomes a requirement. Neither periodic `savable()` calls nor a HEAD
request proves that the subsequent download response is resumable.

## Clerk offline identity

Clerk documents `resourceCache` from `@clerk/expo/resource-cache`, passed as
`__experimental_resourceCache` alongside the token cache. It requires
`expo-secure-store` and remains experimental. Enable it, then complete an online
launch/sign-in before relying on airplane-mode cold start; an earlier token-only
login does not establish cached resource snapshots.
[Official offline guide](https://clerk.com/docs/guides/development/offline-support).

The pinned `@clerk/expo@4.10.1` implementation returns `null` for missing or
unreadable cached resources. On cache fallback, missing resources are replaced by
dummy resources, including a client with no sessions, while retries are scheduled.
The UI therefore needs reconnect guidance both for unresolved initialization and
for initialization that resolves without an authenticated user.
[Cache reads](https://github.com/clerk/javascript/blob/d0b1ccb58070145f188ad528648897bff307eb71/packages/expo/src/cache/ResourceCache.ts#L31-L42),
[bootstrap fallback](https://github.com/clerk/javascript/blob/d0b1ccb58070145f188ad528648897bff307eb71/packages/expo/src/provider/singleton/createClerkInstance.ts#L236-L282).

Use only Clerk's restored user identity to scope local recordings and history.
Do not substitute a remembered user ID. Local STT should not require `getToken()`
or online credentials. Cached tokens are not a promise of indefinite backend
authorization: the Expo fallback applies only to token calls without options when
a network error occurs. Normal server token verification and ownership checks
remain required for later online actions.
[Version-matched token hook](https://github.com/clerk/javascript/blob/d0b1ccb58070145f188ad528648897bff307eb71/packages/expo/src/hooks/useAuth.ts#L7-L33).

## Compatibility and device acceptance gates

The source findings above do not replace these integration checks:

- Run the repository's available typecheck, lint, tests, platform exports, and Expo
  diagnostics after integration. Build both debug and minified release Android
  variants. Native model execution requires a rebuilt app, not an OTA-only change.
- Transcribe actual recorder WAVs using both artifacts on a physical Android
  phone, including silence, classroom noise, Hindi, English, code-switching, and
  sentences crossing chunk boundaries. Empty successful results must complete
  rather than retry indefinitely.
- Measure sustained inference time/audio duration, peak memory, battery, heat,
  and retained-audio storage. A real-time factor above one grows the backlog;
  artifact size and total device RAM cannot prove sustained usability.
- Verify a 65-second airplane-mode recording produces ordered 30/30/5-second
  chunks and transcript updates without Gnani credentials or speech requests.
  Complete two classes, restart, reopen both through history, then explicitly
  generate an online report without retranscribing.
- Exercise preferences changing after session creation, missing/corrupt models,
  account changes during inference, Stop with a backlog, and cancellation before
  native initialization or transcription finishes. No late result may cross owners.
- Test partial-audio recovery and process death around file promotion, SQLite
  ingestion, native acknowledgement, transcript persistence, and audio deletion.
  Exclusive writer access and idempotent ingestion are required.
- Test paused download restoration, active-download interruption, ignored or invalid
  Range responses, size/hash failures, low storage, and Pause/Cancel during final
  verification. Confirm a verified artifact survives a crash between promotion and
  UI-state persistence.
- Test Clerk cold start after cache warm-up, missing/corrupt cache, sign-out, and
  account switching. Keep retained records isolated under their original owner.

The requirements above are acceptance gates, not claims that every check passed.
The following section records the limited build and device evidence collected.

## Implementation observations — 2026-11-01

Both pinned files were downloaded in full from Hugging Face and their local
SHA-256 hashes matched the manifest. Context7's `/mybigday/whisper.rn` API lookup
also confirms the local-file context/transcription interface; version-specific
behavior was checked against the pinned package and tagged source above.

On a physical RMX5110, Android 16, arm64, approximately 7.6 GB RAM, an isolated
debug package ran both real models against a public English sample split into
30/30/5-second WAV files. The original controller runs completed with 655 and
654 transcript characters respectively. Small took 76.9 seconds (0.57-second
load); Medium took 327.6 seconds (1.46-second load). These are short-run wall
times, not sustained benchmarks. The test app was backgrounded during Medium's
run while connecting Wi-Fi, so the timings are not directly comparable. Sampled
process PSS was about 0.77 GB for Small and 1.28 GB for Medium, with additional
swap usage; these are observations, not measured peaks or memory guarantees.

Reopening the initial test Activity accidentally launched a second test controller
against the unfinished Medium session. Its blocked start was incorrectly labeled
“Model initialization failed”; both actual model loads had succeeded. The original
Medium run completed, but the duplicate controller later overwrote synthetic chunk
states. The harness now runs once per JavaScript runtime and waits for restored
work. Production recorder registration also closes and awaits a predecessor before
restoring the same owner's saved chunks. Regression tests cover ordinary unmount,
overlapping registration, native settlement and account deletion. Only isolated
synthetic test data was reset for the clean rerun; teacher app data was untouched.

Debug and minified release compilation succeeded with Java 17. R8 exceeded the
default 2 GB build heap; retrying with a 6 GB build heap succeeded. This changes
the build machine's limit, not the app's device memory limit. Debug native tests
passed for orphan partial recovery and inference reservation exclusion. The debug
APK's 31 arm64 libraries passed ELF 16 KB segment alignment and APK zip alignment.
Further delivery and release-device outcomes are recorded in `offline-stt.md`.
