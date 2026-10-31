# AGENTS.md — Acharya AI

> Source of truth for coding agents building the **Acharya AI app**. All features here are targets, not claims about existing code. Inspect the repository before making changes.

## Mission

Acharya AI is a teacher-first React Native app for recording 1–2 hour classroom lessons, generating transcripts and actionable teaching reports, browsing session history, verifying notes against curriculum, and chatting with a voice/text teaching coach. Build a reliable, accessible, production-minded app with readable, strict TypeScript. Prioritize recording reliability over flashy features.

## Required stack and replacements

| Area | Required choice |
|---|---|
| Mobile | **Expo SDK 57 (target)**, React Native, Expo Router, strict TypeScript |
| Auth | **Clerk** (`@clerk/expo`); no custom authentication |
| State | Zustand; AsyncStorage for small non-sensitive preferences |
| Styling | NativeWind v5 + Tailwind CSS v4 when compatible and installed; otherwise React Native StyleSheet |
| Recording | `expo-audio`, subject to SDK compatibility; avoid deprecated `expo-av` for new recording code |
| Speech | **Gnani AI** (STT/TTS and verified voice services), **not Sarvam AI** |
| LLM | **Google Gemini** for reports, analysis, summaries, lesson plans, and initial chat reasoning |
| Database | **Neon-hosted PostgreSQL** + **pgvector** for online RAG; **not Neo4j AuraDB** |
| ORM | Prefer Drizzle ORM and SQL migrations after checking dependencies |
| Offline, later | On-device **SQLite** and open-source/Hugging Face-hosted STT, LLM, TTS models, selected after benchmarking |

**Expo SDK 57 is the requested target, not a verified installed version.** Check official SDK availability and React Native/React/Expo Router/native module compatibility before installing. Do not guess versions or silently downgrade.


## Product features

### 1. Active Listening Recorder (top priority)

- One-tap start/stop; target 1–2 hour sessions and screen-locked/background use when OS permissions allow.
- Handle interruptions, low storage, denied permissions, app restarts, partial uploads, and failed jobs. Never promise uninterrupted recording under all OS conditions.
- Capture bounded, ordered chunks or another verified safe long-recording strategy. Verify `expo-audio` capabilities before assuming native chunk callbacks exist.
- Persist session/chunk IDs, sequence, timestamps, status, and retry information.
- Show: `idle → recording → stopping → uploading → transcribing → analyzing → completed`, plus failed/retry states.
- Backend transcribes with Gnani STT, merges transcript segments in order, analyzes with Gemini, saves structured report in Neon, and updates UI.
- Reports should include lesson topic, summary, strengths, actionable improvements, and evidence-backed suggestions. Scores are estimates, not objective facts.

### 2. Recorder quick access

Phase 1: deep link / app shortcut (e.g. `acharyaapp://`). Phase 2: native Android/iOS home-screen widgets, after confirming support and using custom development builds. Widgets are controls, not processing engines. Do not assume Expo Go supports native widgets.

### 3. Calendar, reports, dashboard

Date-based session history, recorded-day indicators, session cards (topic, subject, grade, duration, processing state), transcript and report detail screens. Dashboard may show weekly activity, teaching trends, strengths, and teacher-entered engagement reflections.

### 4. Chat Acharya — voice and text

An in-app AI teaching coach, able to answer general questions and questions grounded in the teacher's authorized classes/notes. Initial reliable architecture: **Gnani STT → retrieve relevant Neon pgvector context → Gemini LLM → Gnani TTS**. Use streaming, interruption/cancellation, and low-latency audio transport only when supported and tested.

Gnani Agent Builder's documented REST API is for agent configuration, FAQs, call triggering, logs, and chat-widget settings. **It does not establish a Vapi-like live microphone session API for Expo.** Gnani Warp speech-to-speech is a candidate for later evaluation, but **do not assume** it supports direct mobile streaming, arbitrary context injection, RAG tools, or Mem0 until the current official API confirms this. Do not invent SDK names/endpoints. Keep provider/transport interfaces swappable.

### 5. Notes verification / curriculum RAG

Teachers select grade and subject, upload notes, and receive curriculum-aligned corrections, gaps, and suggestions. Parse and chunk source documents; store metadata, text, owner, and embeddings in **Neon PostgreSQL + pgvector**. At query time embed the question, retrieve access-controlled relevant chunks, pass **retrieved text with source references** to Gemini, and generate a grounded answer. Never pass raw embedding vectors as if they were readable LLM context. Retrieval reduces hallucination risk but cannot eliminate it.

Embedding model is **TBD** (a Gemma-based embedding model may be evaluated). Confirm exact model, dimension, license, and runtime. Version vectors and re-embed when changing models; do not mix incompatible vectors in one index.

### 6. Secondary features

Teacher profile and preferences, Indian-language support where Gnani actually supports it, lesson-plan generator, optional teacher-entered student engagement notes, share/export summaries, and useful notification settings.

## Architecture

```text
Expo app (Clerk + recorder + calendar + chat + notes)
    |
    | authenticated HTTPS / verified realtime connection
    v
Secure hosted backend (Node/TypeScript or supported Expo Router API routes)
    |-- Clerk token verification and ownership checks
    |-- Gnani STT / TTS adapters
    |-- Gemini analysis / chat adapter
    |-- RAG: embedding → Neon pgvector retrieval → source context
    |-- Durable recording upload/transcription/report jobs
    |-- Neon PostgreSQL: users, sessions, reports, chunks, chat, RAG
    `-- Object storage: large audio files/chunks
```

A React Native app **cannot securely hold long-lived Gnani, Gemini, or database secrets**. Never put them in `EXPO_PUBLIC_*` or client bundles. A secure backend is required for these operations. Expo Router API routes require an actual compatible server deployment; static export is not a backend. Long recordings need durable asynchronous jobs, not one long HTTP request. Use resumable/idempotent uploads, bounded retries, and clear progress.

## Database — Neon PostgreSQL, not Neo4j

**Primary keys:** Acharya-owned rows use **21-character NanoID** (`varchar(21)` / SQLite `text`), generated once at create time (secure `nanoid` + `react-native-get-random-values` on mobile). Clerk `clerk_user_id` stays as Clerk provides. Same ID on device and Neon for sync; ownership always from verified Clerk JWT on the server.

**Local + cloud:** Drizzle ORM on **Neon PostgreSQL** (API routes / EAS Hosting) and **Expo SQLite** on-device. Phase 1: schemas and migrations. Phase 2: cursor-based pull, idempotent push, server `revision`, outbox (metadata only—never audio blobs in SQL).

Use relational schemas, migrations, constraints, foreign keys, and parameterized SQL. Conceptual tables:

- `users`: unique `clerk_user_id`, app metadata/preferences (no passwords).
- `teaching_sessions`: owner, grade, subject, times, status.
- `recording_chunks`: session, order, storage key, upload/STT state.
- `transcript_segments`: session/chunk, text, timestamps, language.
- `teaching_reports`: session, structured JSON, schema/model version.
- `documents` and `document_chunks`: source, owner, text, metadata, embedding model/version, pgvector embedding.
- `chat_threads` and `chat_messages`: owner, roles, text, references.
- `processing_jobs`: idempotency key, status, attempts, errors.

**Security:** Every server query involving user data must check the authenticated Clerk user ID and resource ownership. Use indexes for common queries and RAG filters. Choose pgvector dimensions/index type only after the embedding model is selected. Store long audio in object storage, **not Postgres BLOBs**; Neon stores metadata/object keys. Handle deletion and retention across both systems. Clerk is the sole auth authority.

Suggested server-only environment variables (actual names/contracts depend on verified SDKs):

```env
DATABASE_URL=postgresql://...
GNANI_API_KEY=...
GEMINI_API_KEY=...
CLERK_SECRET_KEY=...
OBJECT_STORAGE_BUCKET=...
OBJECT_STORAGE_ACCESS_KEY_ID=...
OBJECT_STORAGE_SECRET_ACCESS_KEY=...
```

Use `.env.example` placeholders and gitignore real secrets. Public Clerk publishable keys are distinct from secret keys.

## Gnani AI integration rules

- Consult `https://docs.gnani.ai/llms.txt` and the linked current STT/TTS documentation before implementation.
- Gnani Prisma STT and Timbre TTS are candidate named services; confirm current API names, access, limits, sample rates, formats, supported languages, streaming modes, and auth headers.
- Gemini remains the initial reasoning provider. Gnani Evon/Aion may be evaluated later but are not automatically substituted.
- Gnani Agent Builder is a managed agent configuration product, **not proof of an Expo voice SDK**. Agent Builder account access may also be separately gated.
- Gnani Warp speech-to-speech may replace some orchestration later **only after** confirming API access and whether external RAG/tool/context hooks exist.
- Keep provider calls server-side, log non-sensitive request IDs, enforce timeouts and rate limits, and do not log raw classroom transcripts unnecessarily.
- Voice cloning, if added, requires explicit consent and applicable rights to the source voice.

## Future offline mode (not part of first MVP)

**Goal:** when internet is unavailable, teachers can use downloaded content and, after a later implementation milestone, run **STT, LLM, and TTS directly on their smartphones** without cloud inference.

- **SQLite** on-device (prefer `expo-sqlite` after compatibility check) for session metadata, transcripts, chat, notes, local retrieval metadata, and durable sync/outbox records.
- **Local STT, local LLM, local TTS**: choose suitable open-source/Hugging Face-hosted models **later**. No model names, inference runtime, or performance promises are finalized. Hugging Face hosting does not itself guarantee an open-source license or mobile compatibility.
- Benchmark target Android phones for RAM, quantization, storage, CPU/GPU/NPU acceleration, battery, heat, latency, Hindi/English support, and model licenses.
- Native inference may require development builds, config plugins, and platform-specific code; **do not assume Expo Go can run large local models**.
- Download model weights while online with visible size/progress, version checks, and user control. Do not silently fall back to cloud while labeled Offline.
- Before local models ship, allow useful offline recording and viewing of already-downloaded sessions where possible; queue server processing for later with user consent.
- When fully implemented, route: `microphone → local STT → local retrieval/context → local LLM → local TTS → speaker`, with no network requirement.
- Neon pgvector is not accessible offline. Local semantic retrieval requires a compatible local embedding model/index or another verified approach; do not assume online and offline embeddings are interchangeable.
- Sync only with explicit consent and clear states. Design stable IDs, ownership, idempotency, deletion/tombstones, conflict resolution, retries, and privacy before two-way synchronization.
- If a model is not downloaded or hardware is insufficient, show an honest limitation and offer recording/local review rather than claiming offline AI works.
- Keep clean service contracts such as `SpeechToText`, `TextToSpeech`, `Reasoning`, `Retrieval`, and `SessionRepository`, each with online and later offline implementations.

**Phases:** (1) online MVP, (2) SQLite/local cache and offline recording, (3) benchmark/select local models, (4) on-device AI, (5) robust synchronization and QA. Do not implement all phases at once.

## Project layout (guideline; create only as needed)

```text
app/                 # Expo Router screens/layouts; optionally +api.ts routes if hosted
  (auth)/
  (tabs)/
  lesson/
  notes/
components/
  ui/
  recording/
  chat/
  calendar/
  verification/
constants/            # colors.ts, images.ts
assets/images/
data/                 # typed static languages, NCERT subjects
hooks/
store/                # Zustand
lib/                  # mobile-safe helpers, API client, service interfaces
types/
server/               # only if separate backend: auth, Gnani, Gemini, jobs, DB
  db/
  services/
  jobs/
drizzle/              # SQL migrations if Drizzle chosen
docs/
```

Keep screens thin: screens compose components and hooks; no complex business logic in route files. Do not put backend secrets in mobile `lib/`. Prefer reusable components only when reused, when they clarify a screen, or when they represent a meaningful UI concept. Centralize image imports in `constants/images.ts`.

## Design system — preserve original Acharya Neo-Brutalism

- Thick black borders, hard offset shadows, bold color blocks, energetic typography, large buttons, accessible contrast, responsive phone layouts.
- Palette: yellow `#FFDB33`, mint `#B8E5E1`, sky `#A8D5E5`, coral `#FFB5A7`, lime `#C5E99B`, lavender `#E0D4F7`, black `#1A1A1A`, white `#FFFFFF`, cream `#FFF8E7`.
- Define tokens in `constants/colors.ts`. Touch targets at least 44×44 points where applicable. Show useful loading, recording, error, and empty states.
- If the user supplies a UI reference, reproduce spacing, typography, color, shadows, and alignment as closely as feasible rather than inventing a new look.
- Check NativeWind installation before using `className`. Use `StyleSheet` for platform-specific shadows, dynamic values, `SafeAreaView`, animations, native props, and press states when utilities are unreliable.
- For assets: store in `assets/images/`, export through `constants/images.ts`, and reuse centrally.

## Coding-agent operating rules

1. Inspect `package.json`, `app.json/app.config`, `tsconfig`, routes, and installed packages first. **Never assume old repo files or generated docs exist** in this fresh project.
2. Read any existing `docs/agents/README.md` or module contracts **if present**. Run `docs:check`, `docs:update`, or `docs:query` only if the new repository actually defines those scripts; do not copy stale history requirements from the old app.
3. Understand the request, identify the smallest files to change, and build feature by feature.
4. Do not install new major libraries, switch AI/database providers, or introduce native infrastructure without user approval. Explain the tradeoff first.
5. Strict TypeScript: avoid `any`, prefer clear domain types, use explicit exported return types where useful.
6. Use Zustand only for shared state; AsyncStorage for appropriate small data; SQLite later for durable offline data. Do not treat client state as proof of persisted server data.
7. Use Clerk session tokens for authenticated backend requests; verify tokens on the server and enforce ownership. Never store passwords or secret API keys in Neon or client code.
8. Make recording/reprocessing idempotent, observable, and recoverable. Avoid pretending partial success means the full pipeline passed.
9. Follow Android/iOS privacy permissions, classroom recording consent, storage controls, and data deletion requirements.
10. After changes, run the available checks and report what was actually executed, not what was assumed.

## Development and verification commands

```bash
npx expo start             # Start Metro; open in Expo Go only if supported
npx expo start --clear     # Clear Metro cache
npm run lint               # If lint script exists
npx tsc --noEmit           # TypeScript check
npx expo-doctor            # SDK/dependency compatibility diagnostics
```

For native modules, background recording, widgets, and on-device AI, use a **development build** (`npx expo run:android` or an appropriate EAS build) when required. A green typecheck/lint does **not** prove audio, native modules, backend jobs, or offline inference work; validate on a physical Android phone.

## Completion checklist

- [ ] Followed current project files and this contract; did not assume legacy code exists.
- [ ] Used Gnani rather than Sarvam; Neon PostgreSQL rather than Neo4j.
- [ ] Kept Gemini and Clerk unless change was explicitly approved.
- [ ] No private API keys in the mobile bundle; backend auth and ownership checked.
- [ ] Long recording handles permissions, interruptions, ordering, retries, and progress.
- [ ] Database changes use migrations, constraints, and user-scoped queries.
- [ ] RAG uses retrieved **text** with sources, not raw vector embeddings as prompt content.
- [ ] Offline features are clearly labeled future/TBD unless implemented and tested on-device.
- [ ] UI matches Acharya's Neo-Brutal visual system and any provided reference.
- [ ] Ran available lint/typecheck/Expo diagnostics and relevant physical-device tests.
- [ ] Final response says what changed, which files, how to test, and any blockers.

**Final principle:** Build Acharya AI as a trustworthy daily teaching tool, not a demo. Prefer correct recording, useful grounded feedback, privacy, and predictable recovery over unnecessary complexity.
