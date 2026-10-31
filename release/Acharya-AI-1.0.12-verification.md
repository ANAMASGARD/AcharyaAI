# Acharya AI 1.0.12 — direct paper review repair

Repository: `/home/linux/Desktop/AcharyaApp`
APK: `/home/linux/Desktop/AcharyaApp/release/Acharya-AI-1.0.12-rag-arm64.apk`
Package: `com.acharya.app`, version 1.0.12, versionCode 13, ARM64.
SHA256: `ccf224411d3e31bffbc0b0fd7cd8615ff268826a769ac3f9893d3acdc16bc40f`

## Changes

Question-paper selection registers the file but bypasses extraction, chunking and publication. Verify sends the original image/PDF directly to OpenAI, with server-resolved selected book/chapter metadata. Reference books still require complete extraction before publication. Saved direct reviews work even when the paper has no extracted pages or its extraction failed. No unreadable-source popup gates this review path.

The report retains the curriculum-fit ring and question outcomes, with a reduced-motion-aware entrance animation. Discuss this paper opens chat with the saved review; its summary button opens the same score card and findings. Review chat now fits the hosting request budget, checks authorization/deletion, and saves both messages atomically before emitting content. Duplicate requests return the stored answer.

## Verified

- TypeScript and lint: passed.
- Node suite: 238 passed, 6 skipped.
- RAG suite: 49 passed, 13 skipped.
- Separately enabled live-Neon integration: 2 passed, including simulated unreadable extraction failure, direct original-file review, chat persistence, retry consistency, cross-owner rejection and deletion.
- Expo web/server export: passed.
- Signed Android release build: passed (3m48s); APK signature/package/version verified.
- Android source map matches current upload hook, workspace, score card and chat screen.
- Configured server-secret scan of APK: zero matches.
- Hosted authenticated test on `https://acharya-app--xj7ibtzrd0.expo.app`: registration 201; original image review with ZERO extracted pages 200/completed (5.879 seconds); saved report 200; chat stream 200 with completed event; synthetic paper cleanup 200.
- App backend alias: `https://acharya-app--rag-desktop.expo.app`.

## Manual test

Install the APK, sign in, select book/chapter, select the original gallery image or PDF again, and tap Verify Paper. Inspect the curriculum-fit ring and question summary. Tap Discuss this paper in Chat, send a question, then open View curriculum fit & question summary. Delete the temporary paper when finished.

Physical-device interaction with this APK: NOT RUN. The hosted test used a synthetic readable image; an actually illegible image can still yield per-question review-needed outcomes. Book-name/chapter review is an alignment estimate using model knowledge, not textbook-passage retrieval or answer grading. Original PDFs/images are not permanently stored on the server. No book re-embedding or database migration was performed.
