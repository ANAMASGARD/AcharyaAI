# Android recording and automatic report indexing — 1.0.6 candidate

The native Android build records with a microphone foreground service, an ongoing
recording notification, and a bounded partial wake lock. Native code persists PCM16
16 kHz mono audio as ordered 30-second WAV files, then flushes the last short file
on Stop. JavaScript ingests and acknowledges files only after saving the audio and
chunk metadata. Screen lock, app backgrounding, and tab blur do not stop this
Android service. Transcription remains the existing ordered Gnani BYOK workflow;
network failures retain audio for retry. Stop finalizes recording rather than
pausing/resuming a single native capture session. Two hours is the capture limit.

Android's system recording indicator/notification remains visible. Force-stop,
permission revocation, low storage, calls, battery restrictions, and OS process
termination can interrupt capture. Complete native chunks remain recoverable;
process death can lose the unfinished final chunk (at most 30 seconds). iOS and
Expo Go retain the existing foreground-only stream; this change does not claim
background iOS support.

Report generation uses the account's selected default reasoning provider/model.
OpenAI's existing default is gpt-6-luna; Gemini and Claude follow their saved model
selection. The native embedding model is separate from this generative model.

Saving a report and immutable notes/reflection source chunks happens in one SQLite
transaction. Native WorkManager uses the verified downloaded EmbeddingGemma text
artifact, conservative Unicode chunks with overlap, the model-card document
prefix, and normalized 256-dimensional float32 vectors. One CPU inference worker
runs independently of React and checks the captured account generation before
committing all vectors for a report. It pauses while recording, retries failures,
and retains pending source rows when the model is absent. No loading overlay or
cloud embedding fallback is added. Model download completion and account/app
resume schedule pending work. OS scheduling and battery limits determine timing.

SQLite remains in app-private storage, with owner filters and foreign-key cascade
cleanup. This is Android sandbox protection, not application-level encrypted
SQLite. API keys remain in the existing encrypted SecureStore account namespace.
Model storage, filename, revision and checksum are unchanged.

With Sync reports enabled, authenticated uploads send notes/reflection vectors
after the report acknowledgement. Offline vectors remain local and are retried
on connectivity, a 30-second live-app timer, and resume. This does not promise
immediate headless cloud sync after the app process is killed: Clerk token access
requires a live authenticated app. Sync consent remains account-specific; turning
it off stops uploads. No audio, raw transcript, API keys, or OAuth secrets are
included. Neon stores owner/report/kind/chunk/source/contract/vector columns and
forces RLS. Account deletion cascades to vectors. No RAG chat UI is introduced;
the structured vectors/source text are available for a later authorized retriever.

## Verification

Neon migration validation used a rolled-back synthetic fixture for idempotency,
RLS owner isolation, and deletion cascade before applying the additive migration.
The mobile Neon Function deployment completed; unauthenticated vector POST returns
401. JS tests exercise source chunking, model/shape/norm checks, SQLite transactions,
consent/acknowledgement behavior, native ingestion ordering and async Stop.

These initial automated checks did not establish physical-device locked-screen
capture, Gnani transcription, model inference, thermal/memory behavior, or
authenticated real-vector upload. Subsequent device and Neon evidence appears
below. This build remains a device-test candidate, not a passed full native gate.
Install over the existing same-signed app without uninstalling or clearing data.
Test at least 65 seconds locked, return and Stop, confirm ordered transcription,
generate a report, and test offline vectors followed by enabled cloud sync.

## 1.0.6 sync repair and FIFO queue

The installed React Native AbortSignal does not implement throwIfAborted; sync
now checks the supported aborted flag. Vector BLOBs use Uint8Array rather than
Node Buffer. New accounts default to automatic sync, while an explicitly saved
Off preference remains Off.

Source chunks receive a persistent enqueue_sequence inside the report-save
transaction. The migration assigns existing rows a sequence without changing
IDs, vector bytes, or acknowledgement state. Native indexing selects the oldest
pending report first. Upload selects the oldest unsynced vectors, batches only
contiguous ready rows from the same report, and stops behind an unfinished head.
A failed head never allows later vectors to overtake it. Each pass is bounded to
ten batches of twenty rows; subsequent network/timer/resume triggers continue.
Rows are retained locally and marked synced only after a validated server ack.

Temporary 429 responses retry the identical idempotent payload up to three times,
with bounded increasing delay. Permanent failure, missing auth, cancellation,
or offline connectivity leaves the queue intact. Android may suspend live-app
network callbacks; process termination does not provide always-on cloud sync.
Pending uploads resume with an authenticated live app. Native offline inference
is independent of the network, provided the verified model is downloaded.

Production readback on 15 October confirmed two actual test reports, Gane and
Gravity, with four vectors each (one notes and three reflection), all dimension
256 and normalized within 2e-8. The connected Android phone showed eight ready
vectors and zero pending after the 1.0.5 in-place update. Thus real local-to-Neon
upload is established for these reports; this is not an exhaustive security audit
or proof of every device/background condition. Automated coverage includes the
actual mobile AbortController, offline queue retention, FIFO ordering, head
blocking, 429 retry, invalid ack, cancellation, and migration byte preservation.

Version 1.0.6 (Android code 7) was installed over 1.0.5 on the connected RMX5110.
The phone retained eight ready vectors, zero pending, enabled automatic sync,
and the verified downloaded model. The cloud error cleared. Subsequent Neon
readback still showed eight unique vector IDs across two reports, without
duplicates. The full check passed 182 tests, strict typecheck, zero-warning lint,
and Android/iOS/web exports; signed APK/AAB verification also passed.

The isolated, minified release instrumentation passed both native tests on that
phone with Wi-Fi and mobile data disabled, before an Activity or React context.
It exercised the exact model's English/Hindi/mixed embeddings, repeat stability,
plants-versus-maths retrieval smoke check, overlength rejection, 256-dimensional
float32 round trips, concurrent SQLite writes, rollback, reopening, and integrity.
Model load took 1002 ms; model plus fixtures took 2431 ms. End-of-test PSS was
295696 KB (a snapshot, not a measured peak). Original radio settings were restored.
The phone has approximately 7.6 GB RAM and 4 KB pages; debug instrumentation,
4 GB/16 KB devices, long recordings, process death, and thermal/battery soak tests
remain outside this evidence. Test-only R8 rules preserve WorkManager methods
called from the separate instrumentation APK; BLOB assertions read Expo's native
ByteBuffer representation. Neither adjustment changes the production APK.
