# Foreground classroom transcription

The recorder uses Gnani STT on Android and iOS while its screen is open. Topic,
subject and class are required. Text appears in **Class Transcribe** after each
30-second segment finishes; Stop submits the nonempty remainder. English–Hindi
mixed speech is requested with Latin-script output. Send remains disabled because
report generation is outside this milestone. Web recording is unavailable.

## Current default: direct BYOK

Save a Gnani key in **Profile → App settings → AI API keys**. `use-recorder.ts`
now uses `recording/direct-api.ts`; audio goes directly to Gnani. Session metadata,
chunk retries and transcripts stay in device SQLite. Neither API hosting, a Neon
migration nor server provider keys are required for this path. Device SQLite
migrations still run automatically. The 30-second capture and recovery behavior
below remains in use. `serverCreated` / `serverFinalized` are retained local schema
field names for adapter acknowledgements; with this adapter they do not assert
cloud persistence.

Provider timeouts have a 45-second deadline. The direct path does not have the
legacy server's rate limits, leases or server-side idempotency. The local serial
queue replaces acknowledgements by chunk ID, but a provider success followed by
a lost response or app crash may be billed again on retry. Existing incomplete
local recordings resume through the direct adapter using the current user's key.

Account deletion attempts legacy remote cleanup only when `EXPO_PUBLIC_API_URL`
is explicitly set. Keep that URL configured if the account has recordings on a
previous hosted backend. Local-only BYOK accounts need no custom API for deletion.

## Legacy hosted setup (not used by the default recorder)

1. Configure `CLERK_SECRET_KEY`, `DATABASE_URL` and `GNANI_API_KEY` on the API
   server. Use the matching public Clerk publishable key in the app. Never expose
   provider/database secrets through `EXPO_PUBLIC_*`.
2. Review and apply the committed Neon migrations against the intended database:
   `npm run db:migrate:pg`. This includes `drizzle/pg/0002_empty_vapor.sql`.
   Device SQLite migrations run when the recording repository first opens.
3. Deploy the Expo Router server output and API routes to a compatible server
   runtime supporting multipart forms, Web Crypto, streaming request bodies,
   and outbound HTTPS. Allow at least 45 seconds per request. A static site alone
   cannot serve these APIs.
4. Set `EXPO_PUBLIC_API_URL=https://your-api-origin` for standalone builds. In
   development the app falls back to the Metro host. The phone must reach that
   host and its authenticated API routes.
5. Build/install a compatible SDK 57 app on each physical platform. Native audio
   permissions and streaming behavior must be tested on the installed binary;
   an exported JavaScript bundle is not that verification.

`expo-asset` is declared directly because Expo Doctor identified it as a required
native peer of the already-installed `expo-audio`; SDK versions are unchanged.

## Capture and durability

`use-recorder.ts` handles permissions, foreground/navigation lifecycle, and audio
mode. `recording/controller.ts` owns state, serialized persistence and a single
upload worker. `recording/pcm.ts` validates actual 16 kHz mono float32 buffers and
encodes 480,000 samples per PCM16 WAV; overflow carries to the next segment.
There is no pause/restart gap between normal chunks. An unexpected format stops
capture rather than mislabeling samples. A five-second buffer stall stops capture.

Audio is kept in owner-specific document files. SQLite stores stable IDs, order,
timing, attempts, status and transcript. The worker persists each chunk before
upload, then persists its acknowledged text before deleting audio. It keeps at
most three queued disk writes and stops if storage cannot keep up. A failed file
write stops recording with an explicit error. A process kill can lose the current
in-memory, incomplete segment; saved chunks survive. This is foreground capture,
not guaranteed uninterrupted or background recording.

Transient upload failures retry after 1, 4 and 16 seconds (or a longer server retry
delay), then remain for manual retry. Reopening the recorder restores interrupted
work without starting the microphone. Pending work runs while the recorder is
mounted; no OS background worker is installed. The app retains the latest session
on this screen and blocks a new recording until its failed/unfinalized work is
resolved. Older sessions remain stored, but history/calendar integration is not
part of this change.

Transcript acknowledgements replace the same chunk by identity, then render in
sequence. Repeated spoken words are preserved. Empty successful results render
`[inaudible]`; failed segments stay visibly marked. Leaving the screen,
backgrounding, or capture failure flushes available audio and marks interruption
honestly. Restarting capture requires another tap.

Sign-out closes recording work and clears that account's local recordings. Account
deletion closes work, deletes owned server recording rows, deletes the Clerk user,
then clears local files/preferences. Server deletion and Clerk deletion are not
an atomic transaction; if Clerk deletion fails after server deletion, retry the
account-deletion action. Another account cannot read or clear these local records.

## Legacy API contract (retained for hosted installations)

All operations require a Clerk bearer token; owner identity comes from verified
JWTs, never multipart fields.

- `POST /api/sessions`: `{ id, title, subject, grade, startedAt }`; immutable,
  owner-scoped creation with a client-generated 21-character NanoID.
- `POST /api/gnani/stt`: multipart `audio`, `sessionId`, `chunkId`, `chunkIndex`,
  `startMs`, `durationMs`; returns `{ chunkId, chunkIndex, transcript, status }`,
  where status is `done` or `empty`.
- `PATCH /api/sessions`: `{ id, durationMs, expectedChunkCount, status }`; verifies
  complete recordings against ordered acknowledged chunks. Partial sessions can
  be finalized again after retries.
- `DELETE /api/sessions`: removes the authenticated owner's recording sessions,
  chunks and rate-limit row for account deletion. Existing GET/history and sync
  APIs remain independent.

Structured failures use `{ error: { code, message, retryable, retryAfterMs? } }`.
The server rejects noncanonical WAVs, invalid identity/timing and oversized bodies;
limits body reading to 15 seconds; and admits one new provider attempt per user
per second. Provider calls have a 25-second deadline; mobile requests have a
45-second deadline including token acquisition. Completed duplicates return the
saved transcript. Unique sequence constraints and atomic claims prevent concurrent
active duplicate provider calls. A 120-second lease and claim token fence stale
completions. An expired unknown provider outcome may be billed again on retry;
there is no claimed provider-level exactly-once guarantee.

Neon retains metadata and transcripts, not audio. The API forwards audio transiently
to Gnani and does not log classroom text. Actual provider-side retention is governed
by the configured Gnani account. The regular client serializes uploads before
finalization. Arbitrary same-owner requests racing a new upload with finalization
are not a serializable database transaction; this is a remaining server hardening
boundary, separate from duplicate-claim protection.

## Verified references and choices (12 October 2026)

The [Gnani documentation index](https://docs.gnani.ai/llms.txt) was fetched before
following the [REST STT guide](https://docs.gnani.ai/api/STT/speech-to-text.md).
That guide specifies `POST https://api.vachana.ai/stt/v3`, `X-API-Key-ID`,
`audio_file`, `language_code` and `format`. Its `en-IN` description explicitly
includes English–Hindi mixed input with Latin-script output. REST accepts up to
60 seconds and recommends at most 30 seconds; this app imposes the stricter
30-second limit. `format=transcribe` requests inverse text normalization. No Sarvam
`auto` parameter or realtime protocol is reused.

The [Expo SDK 57 audio reference](https://docs.expo.dev/versions/v57.0.0/sdk/audio/)
and installed `expo-audio@57.0.5` source were inspected, including
`src/AudioStream.ts`, `src/AudioStream.types.ts` and Android/iOS native capture.
`useAudioStream` provides sample buffers; it does not supply durable chunk files.
The app owns PCM conversion and persistence. Context7 was queried, but its focused
lookup did not return the required new streaming API, so versioned official docs
and installed source determined the implementation.

## Validation and device acceptance

Automated tests cover arbitrary-buffer 65-second capture producing 30/30/5-second
WAVs; exact boundaries and immediate Stop; silence and repeated speech; invalid
formats; startup cancellation and late callbacks; capture stalls; disk errors;
ordered persistence and deletion; retry exhaustion/manual retry; restart recovery;
authentication/ownership, duplicate claims, malformed requests, rate limits,
provider failures, finalization, and SQLite migration constraints. Backend tests
use database doubles; they do not prove live Neon transaction behavior.

Implementation verification: `npm run check` passed (TypeScript, zero-warning lint,
90 tests, Android/iOS/web exports); `npx expo-doctor` passed 21/21.
Before declaring live readiness, complete
these checks on **both physical Android and iOS**, with consented audio:

- Record 65 seconds of English, Hindi, and mixed speech. Confirm text appears
  during recording after each full chunk and that Stop adds the final five seconds
  in order. Repeat words intentionally near chunk boundaries.
- Test denied permission, immediate Stop, silence, phone-call/audio interruption,
  backgrounding and navigation away. None should restart the microphone silently.
- Disconnect the network, restore it, exhaust retries and manually retry; kill and
  reopen the app with pending work. Check no duplicate transcript and retained audio
  until acknowledgement. Test low storage and a missing saved file.
- Switch accounts/sign out during uploads and delete an account. Check ownership
  and cleanup in both SQLite/files and Neon.
- Run a 1–2 hour foreground session and measure memory, heat, timing and lost audio.

No physical phone was attached during implementation (`adb devices` was empty).
A Gnani key was not configured, and no live Gnani request or Neon migration was
executed. Native recording quality, script accuracy, hosted API reachability and
long-session behavior remain device/deployment acceptance work.
