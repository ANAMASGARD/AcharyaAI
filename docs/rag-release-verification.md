# Acharya 1.0.9 RAG release verification

Checkout: `/home/linux/Desktop/AcharyaApp`, branch `codex/neon-rag-port`, base commit `78135ab`. Changes remain uncommitted. The installed Expo 57 stack, existing route structure, Clerk production configuration, recorder/Gnani, community backend and existing local sync remain in place.

## What is connected

- Chat's attachment button and Upload/Verify use one private-library pipeline.
- Shared book and chapter selection, personal PDF sources, separate question-paper uploads, per-question checks and saved checks are backed by Neon/OpenAI.
- Discuss in Chat carries the saved paper review and selected source versions. Initial Chat navigation and cached-history reopening preserve source scope. Starting a new chat while history loads releases the send guard.
- Generate Paper reads published curriculum availability and books from Neon; its library action opens the shared workflow.
- The Expo 57 native upload adapter uses `expo-file-system` File objects accepted by `expo/fetch`.
- Provider keys remain server-side. The release uses the dedicated `https://acharya-app--rag-desktop.expo.app` endpoint and the existing production Clerk key/signing identity.

## Live database evidence

Read-only checks reconciled **10 curriculum books, 115 chapter PDFs, 1,464 pages, 1,483 chunks and 1,483 vectors**. Published sources have no unresolved pages and use `text-embedding-3-small`, 1,536 dimensions. A separate seven-page diagnostic pilot exists but is excluded from the user-facing catalog. Curiosity remains failed/unpublished at the user's request. The six legacy Marigold files remain excluded from Santoor and are retained locally.

No migration, preload, curriculum re-embedding or corpus deletion ran during this port. The embedding-call count stayed **194**. Existing `public.users` and `public.teaching_sessions` counts stayed **0 / 0** in this configured database; the separate existing community/recording backend was not changed.

The protected deployed extraction probe made three reasoning/vision calls on synthetic fixtures, with **$0.00565575** additional recorded token cost. The shared ledger now records **$2.45425166 measured**, **$5.22225166 committed including ambiguous reservations**, under the unchanged **$10 cap**. These are ledger calculations, not a provider invoice.

## Verification performed

| Check | Result |
|---|---|
| TypeScript | Passed |
| ESLint, zero-warning gate | Passed |
| Existing Node tests | 238 passed, 6 skipped |
| RAG tests | 32 passed, 9 opt-in integration tests skipped |
| Expo export for Android, iOS and web | Passed; final Android/web artifacts rebuilt after the small contrast correction |
| Android signed arm64 release | Built with Java 17; version/code/package verified, signing certificate matches the previous release, and final JavaScript refresh passed |
| Server credentials in client exports/APK | Checked against actual configured credential bytes, without printing them |
| Anonymous API access / malformed token | Rejected with 401, including source, verification, chat-history and curriculum endpoints |
| Hosted English PDF and Hindi image extraction | Protected synthetic fixture probe returned 200; all three checks passed |
| Hosted native PDF text parser | Unavailable (503 diagnostic); tested inline OpenAI vision fallback succeeds |
| Expo Doctor | 20/21 checks; seven pre-existing Expo patch updates available; installed versions retained |
| Documentation check script | Not defined in this repository |
| Physical Android picker/camera and signed-in teacher flow | Not run; reserved for the user's manual test |
| New database-writing/provider integration suite | Not run; this port reuses existing indexed data |

The fresh review identified native multipart incompatibility and two source-selection regressions. Regression tests reproduced each failure before the fixes passed. Additional checks cover late responses after source deletion, live catalog availability and conversation authentication status. This does not claim complete end-to-end physical-device validation or offline AI.

## Manual test

Install the signed arm64 APK from `release/`. Open Upload/Verify, select a published book as **syllabus**, optionally upload a private reference PDF, then upload the question paper separately. Run verification, inspect page citations and choose **Discuss in Chat**. Ask which questions need review or are outside the selected scope. Try Generate Paper with a published English curriculum choice.

An insufficient-evidence result is not a correctness grade or proof that a question is outside syllabus. Answer correctness remains `not_assessed`. Uploads are limited to 10 MiB/100 pages; interrupted extraction may require reselecting the same file. Text and required page images go to OpenAI; original PDFs are not retained by this workflow.

## Decisions made during the port

- Use an isolated `src/server/rag` DB adapter instead of replacing the public-schema ORM or Neon Functions. A RAG configuration failure remains separate from existing community/sync services.
- Keep installed framework versions and the explicitly authorized OpenAI provider. Existing Expo patch-update warnings remain a device-test consideration.
- Use a separate RAG deployment alias and prefixed server settings with matching production Clerk authentication. Mismatches fail closed; the earlier test deployment and existing community configuration remain independent.
- Preserve evidence logs in ignored `.codex-work/rag-port/` because no commit was requested. The skill's referenced reviewer template was missing; a fresh reviewer received an equivalent explicit review brief.
- Exclude the existing diagnostic pilot from curriculum counts, matching runtime retrieval filters. It remains stored for diagnostics.
- Restart interrupted builds with bounded Metro workers. This trades build speed for lower laptop resource usage.
- Fix source-selection, upload and authentication findings before delivery. Other provider/database integration and physical-device checks are explicitly unclaimed.

No deferred reviewer findings remain. Existing SDK patch updates and manual runtime checks are the remaining verification limits.
