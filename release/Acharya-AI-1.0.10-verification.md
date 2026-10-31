# Acharya AI 1.0.10 — verification candidate

Built from `/home/linux/Desktop/AcharyaApp` on 31 October 2026.

APK: `/home/linux/Desktop/AcharyaApp/release/Acharya-AI-1.0.10-rag-arm64.apk`
Package: `com.acharya.app`; version code 11; signed ARM64 release build.
SHA256: `51c659146b0179e9fdd8e5c447c2e4072d115ecd18d1292729b9da10625e4c89`
Backend: https://acharya-app--rag-desktop.expo.app

## Fix and behavior

The deployed failure was reproduced as `Too many subrequests by single Worker invocation`. The EAS Free limit is ten outbound requests per invocation. Registration, page extraction, publication, question extraction, retrieval, alignment, evidence checking, and provisional review now use separate persisted steps. Real local network instrumentation measured a maximum of nine outbound requests per workflow step, leaving one for Clerk verification. Multiple selected books are authorized together; syllabus/supporting retrieval is one SQL request with separate role quotas.

OpenAI reads the photo/PDF. Saved text supplies question extraction; selected Neon book passages, with their text and references, supply alignment evidence. Raw vectors are not LLM prompt content. Query embedding outages fall back to authorized lexical retrieval. Unsupported evidence produces an explicitly provisional clarity review, not an invented curriculum percentage. Answers are not graded. Hindi/notation OCR includes visual proofreading in one high-reasoning request, avoiding a second provider call within the upload request.

The red curriculum button opens Classes 1–12 with actual availability. There are ten published English books: Mridang (2), Santoor (3/4), Marigold (5), An Alien Hand (7), Honeydew (8), Kaveri (9), First Flight (10), Hornbill (11), Flamingo (12). Class 1 has no indexed book; Class 6 Curiosity remains excluded. Counts: 115 chapters, 1,464 pages, 1,483 chunks and 1,483 vectors. No shared book re-ingestion was run.

## Evidence

- TypeScript, lint with zero warnings, standard Node tests and RAG tests passed.
- RAG unit suite: 39 passed, 11 opt-in tests skipped.
- Selected live-Neon recovery, verification, and lexical-fallback integrations: six passed, using synthetic documents and mocked provider calls.
- Real OpenAI photo test locally: completed, aligned, supported, Mridang page citation. Each request-budget measurement passed.
- Deployed photo test: completed, aligned, supported, Mridang page 1 citation. One earlier model result was conservatively downgraded to insufficient evidence; this is not a guarantee that every question receives a verified score.
- Deployed PDF without source evidence: completed, insufficient evidence, provisional clarity score 65, zero fabricated citations.
- Deployed unauthenticated sources and verification endpoints return 401.
- The native PDF text parser is unavailable in EAS. The tested inline OpenAI vision fallback handles extraction there; parser health reports this limitation explicitly.
- All-platform Expo export passed; subsequent server-only edits passed a web/server export and deployment.
- Signed Android release build passed. APK credentials scan found no configured server secrets or retained PDFs; source-map comparison confirms current UI and upload hook are bundled.
- Physical Android testing of this candidate: NOT RUN. Authenticated mobile route transport has not been retested on a device in this turn; protected deployed probes exercise the same processing services with synthetic data.

Final deployment: https://acharya-app--yz7tdaenq2.expo.app (stable alias above).
Grounded/fallback workflow probes ran on the immediately preceding deployment with identical processing code; the final deployment removes obsolete diagnostics.

Shared ledger after validation: measured USD 2.49778775, committed/reserved USD 5.39378775 of USD 10. These are cumulative ledger amounts, including 22 ambiguous reservations retained conservatively, not a claim about the exact bill for this turn.

## Manual check

Install the APK, sign in, open Verify Question Paper, tap the red menu, choose a class/subject/book and optional chapters, close the menu, pick a photo/PDF, and tap Verify Paper. Inspect per-question findings, source citations, alignment score and evidence coverage. With no eligible evidence, check that the report clearly labels its provisional review. Reopen after interruption to resume saved processing.

## Preserved checkout

Downloads was backed up fully at `/home/linux/Backups/acharya-app-before-restore-20261031/acharya-app`, then restored to GitHub branch `origin/codex/production-hardening` at `2eeeaccc2f3aa087284b9f68be297fcdae5238d0`. Its Git status is clean. Ignored environment/dependency files remain intact. Desktop changes are uncommitted; no commit, push, store submission or OTA publication was performed.

Detailed logs are under `/home/linux/Desktop/AcharyaApp/.codex-work/rag-fix/`.
