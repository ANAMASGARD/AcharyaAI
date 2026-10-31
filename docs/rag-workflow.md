# Neon/OpenAI curriculum workflow

Implemented in `/home/linux/Desktop/AcharyaApp` on the existing Expo 57 app. Routes and the themed navigation remain in place. Chat uses the OpenAI SDK on the Expo backend; Gnani voice controls, recorder/report providers, community and existing Neon Functions remain separate.

## Existing library — reuse, do not ingest again

`npm run rag:status` reads this checkout's `.env` and performs SELECT queries only. It reports published chapter/page/chunk/vector counts and provider usage. It never calls OpenAI, creates embeddings, migrates or resets the database.

The verified shared corpus contains 10 published books, 115 chapters, 1,464 pages and 1,483 vectors (`text-embedding-3-small`, 1,536 dimensions). Curiosity remains deferred/unpublished. Six legacy Marigold PDFs were excluded from the Santoor edition; local source files remain in the original checkout. These files are not bundled into the app.

`docs/rag-schema/` is a reference snapshot of the six already-applied RAG migrations. Do not run the application's public-schema migration command to initialize or replace these tables. Runtime RAG services use `acharya_rag` through their own DB adapter; the existing public schema, calendar, community and offline vector sync are unchanged.

## Configuration

Local development uses `DATABASE_URL`, `OPENAI_API_KEY` and the existing Clerk server auth configuration (`CLERK_SECRET_KEY`, `CLERK_ISSUER`, `CLERK_AUTHORIZED_PARTIES`). The URL and key must be server-side. Optional `RAG_*` overrides isolate the hosted RAG deployment from the existing backend. No provider keys are stored in Neon or native app configuration.

The release uses `EXPO_PUBLIC_RAG_API_URL=https://acharya-app--rag-desktop.expo.app`. Its backend validates production Clerk identities. The community URL and Clerk instance are preserved. A development Clerk token cannot authenticate against that production RAG deployment: use matching local configuration for development, or the signed release for manual testing.

Server routes are deployed with EAS Hosting. Sensitive server environment variables accompany that deployment; changing a local `.env` alone does not update hosted configuration. The release environment helper strips server secrets and sets only the public RAG URL. Production/staging APKs use the established signing key and production Clerk settings. No Play Store or OTA publication is performed by the local build.

## Teacher workflow

1. Open Upload/Verify or Chat's plus button. Select shared curriculum books or add a private book/notes PDF. Choose syllabus or supporting roles and, when needed, chapters.
2. Upload the question paper separately, or take a paper photo. A question paper is excluded from its own evidence by file/text identity.
3. Run verification; active requests continue saved extraction/indexing/checking steps. Open saved checks, inspect per-question evidence, and choose **Discuss in Chat** to ask which questions are outside scope or need review.
4. Generate Paper remains available from the verification screen. Generated marks are draft suggestions; official chapter weights and answer correctness are not asserted.

Source references show saved excerpts and PDF page numbers. This is cloud processing: necessary text/page images go to OpenAI. Original PDFs are not retained in Neon. Uploads remain private and are limited to 10 MiB and 100 pages. Interrupted extraction requires the same file again if its bytes are unavailable; embedding resumes from saved text. Processing does not run unattended when all clients stop.

Deleting a private source removes its text/vectors and dependent checks/chats/drafts, including uncited derived content. The deletion UI explains this. Session changes clear in-memory RAG stores and invalidate outstanding responses.

## Checks and limits

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:rag`, `npm run rag:status`, and Expo export. Database-writing/provider integration tests are opt-in and are not part of the default test run. The port deliberately reuses existing indexed content without repeating ingestion or embedding acceptance calls.

The original shared $10 spending ledger is retained. Failed/ambiguous provider requests keep conservative reservations. Hitting the cap returns a recoverable error; do not reset the ledger to bypass it. `gpt-5-mini` is the configured reasoning model. Answer correctness is explicitly `not_assessed`; alignment does not grade a solution.

Create an arm64 manual-test APK with:

```sh
ACHARYA_APK_ONLY=1 ACHARYA_UPDATE_CHANNEL=staging node scripts/build-closed-testing.cjs
```

Artifacts and SHA-256 files are written to `releases/`. Physical Android PDF picking, real sign-in and the complete teacher flow must be tested on the resulting APK; local checks do not establish those outcomes.


### Direct question-paper review (1.0.12)

Selecting a paper registers its owner, page count and content hash, then retains the picker file temporarily. It does not extract, embed or publish the paper as a reference. Verify sends those original image/PDF bytes and the selected source/chapter IDs to the authenticated direct-review route. The server validates ownership and the file hash, resolves book metadata, and asks OpenAI to read the file and estimate alignment. Unreadable reference pages still block reference publication; they do not gate direct paper review. No original bytes are stored permanently on the server.

A paper whose device copy is gone needs the original selected again when no saved text exists. Saved reports remain available independently and can be discussed in chat. The chat report path authorizes the report and source versions, performs one model selection call, then atomically checks deletion and saves both messages before sending the answer. The UI offers the same animated curriculum-fit chart and question summary from the chat screen. No extraction failure popup is introduced.
