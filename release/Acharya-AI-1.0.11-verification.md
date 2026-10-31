# Acharya AI 1.0.11

APK: `/home/linux/Desktop/AcharyaApp/release/Acharya-AI-1.0.11-rag-arm64.apk`
Package `com.acharya.app`, version code 12, signed ARM64 release.
SHA256: `6ad7e338e25fc699adc6d74da51330ac5f91f2f9e06d2b2244ca0caacdb45d5e`.

## Requested behavior

- New verification sends the selected photo/PDF directly to OpenAI together with authorized book titles, class, subject and optional chapter labels. OpenAI uses its own curriculum knowledge; this mode does not perform vector retrieval or web search. Existing saved papers can be reviewed from saved extracted text when the original file is no longer available.
- The circular chart displays an AI alignment estimate and concise aligned/partial/outside/review counts. There are no claim-warning pop-ups or embedding implementation paragraphs.
- Recent papers have Select and Delete actions. Incomplete papers can be deleted rather than resumed. Deleting a paper also removes its related reports and chats. A new explicit file selection can upload the same paper again; a stale attempt cannot recreate its deleted source.
- Cached Clerk token rejection triggers one fresh-token retry, without relaxing server authentication or ownership checks.
- Existing ten shared books and 1,483 vectors remain untouched. The book selection UI remains available; old grounded verification/chat services are preserved.

## Actual verification

- Authenticated deployed API: library 200, upload registration/extraction 201, paper preparation 200, direct image review 200, deletion 200.
- Final direct report completed in 4.729 seconds for a synthetic one-question photo with Mridang selected; result partly_aligned, basis book_title_estimate, no fabricated citations. This is a small-case timing measurement, not a latency guarantee for larger papers.
- Final deployment https://acharya-app--fzxi430amj.expo.app; app alias https://acharya-app--rag-desktop.expo.app.
- TypeScript and lint passed. Node tests: 238 passed, six skipped. RAG tests: 47 passed, 12 opt-in tests skipped. Separately executed live-Neon direct-report integration passed, including ownership, saved-history loading, deletion, stale-attempt rejection and fresh re-upload.
- Regression tests cover token refresh, no retry loops, account switching during refresh, image hash mismatch, ownership, direct photo payload, selected book metadata and estimate scoring.
- Web/server export and signed Android release build passed. Source maps match the current upload hook, session helper, workspace and score card.
- APK signature/version checked. Credential scan found no configured server secrets; no PDFs bundled.
- Layout inspected using the real components with clearly labeled sample data; preview is not a real teacher report.
- Physical Android interaction testing of 1.0.11: NOT RUN. Existing installed app was not replaced automatically. The fresh-session authenticated backend test does not independently prove the cause of the earlier mobile cached-session failure.

Install the APK, sign in, select books with the red curriculum menu, pick a photo/PDF, and tap Verify Paper. Use Delete paper under recent papers to remove it and its reports.

Changes remain uncommitted in `/home/linux/Desktop/AcharyaApp`. Downloads remains clean at its restored GitHub branch. Detailed logs: `.codex-work/rag-ui/`.
