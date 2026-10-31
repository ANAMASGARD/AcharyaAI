# Recorder and report indexing implementation plan

**Goal:** Compact authentication screens, provider profile photos, screen-locked Android recording, and durable local report embeddings with consented Neon sync.

**Architecture:** Native Android microphone foreground service writes bounded 30-second files before JavaScript transcription. A separate native worker reads locally saved reports after migrations and commits model-versioned vectors atomically. Existing Clerk authorization and per-account cloud consent remain authoritative.

**Tech stack:** Existing Expo 57, Kotlin, Expo SQLite, LiteRT-LM, WorkManager, Neon Functions/PostgreSQL.

- [x] Remove native authentication subtitles, reduce top spacing, hide web subtitles, and resolve actual provider images rather than Clerk's generic image.
- [x] Add native recording service with microphone foreground notification, wake lock, durable 30-second files, explicit stop and account cleanup. Connect controller ingestion with acknowledgements after SQLite persistence. Keep iOS interruption handling until its native capture supports durable background work.
- [x] Add SQLite vector/job migration through the existing migration authority. Queue saved notes and reflection without indexing raw transcript.
- [x] Enable the verified model adapter in normal Android builds and run one native background worker. Retain pending jobs if the model is absent or inference fails. Fence commits on account grant and source identity; cancel on sign-out.
- [x] Add owner-scoped Neon pgvector storage and authenticated idempotent upload, preserving account deletion and sync consent. Retry locally pending vectors on app/network resume.
- [x] Run TypeScript, lint, meaningful recorder/indexing/sync regressions, native build and packaging checks. Record device-only proof limits explicitly.

No paid service, cloud embedding fallback, hidden recording, credential migration, or model substitution is authorized.
