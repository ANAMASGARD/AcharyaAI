# Offline report JSON fix — 1.0.16 / Android code 17

## Reproduced cause

On the connected RMX5110 running Android 16, the original adapter with Unsloth
Gemma 3 270M Q8 returned text beginning with `<start_of_turn>model` followed by
an opening Markdown JSON fence. The original `JSON.parse` failed with exactly
`JSON Parse error: Unexpected character: <`.

The artifact was verified against the pinned SHA-256
`d156a5159f2f79c1b1d53c7c1cc20f1ff28ab8d00f17a292620aad13399b9698`.

## Fix

- Disable Jinja formatting for these Gemma requests, allowing llama.rn's built-in
  Gemma chat formatting and explicit JSON-schema grammar to control generation.
- Parse strict JSON objects after removing only recognized Gemma/end-of-turn
  wrappers and an optional complete Markdown JSON fence. Reject HTML, arbitrary
  prose, incomplete JSON and invalid report fields/evidence.
- Bump the report prompt version to v2 so prior checkpoints cannot mix with the
  corrected generation path. Existing models, transcripts and reports stay intact.
- Replace the raw parse error with an actionable retry message on invalid output.

## Verification

A separate, minified release test app (`com.acharya.app.reportgate`) ran on the
physical phone. Its manifest removed INTERNET permission; it used synthetic
lessons and never accessed the teacher's account, recordings or app data.

The baseline reproduced the exact error. The corrected production adapter,
native reservation and report pipeline then passed English and Hindi/English
synthetic lessons: two validated stages per lesson, feedback and notes returned,
and context release completed. The gate reported `FIXED_PIPELINE_PASS`. The
model was side-loaded into the isolated test app; this was not a download-flow
or SQLite-history acceptance test. The test app and temporary phone files were
removed afterward. Reproduction entry and opt-in Gradle setup are in
`native-tests/offline-report-entry.tsx` and `offline-report-gate.gradle`.

`npm run check` passed (270 tests passed, 6 existing skips; typecheck, lint and
Android/iOS/web export). Ten focused offline-report tests passed, including the
exact combined wrapper/fence shape, malformed-output rejection, and schema
configuration at the native adapter boundary.

The test establishes local generation and parsing, not teaching-feedback
accuracy. This small model still produced unsupported observations in synthetic
feedback; the existing experimental/review labels remain. Long-session and
comprehensive cancellation/download testing are outside this fix's evidence.

Release signature, packaging and artifact details are appended after building.

## Release artifact

Signed/minified ARM64 production build passed (version code 17). Signature,
ZIP 16 KB alignment, and all 45 native libraries' ELF alignment checks passed.
The v2 prompt and parser are bundled; the isolated test entry is excluded.
Expo Doctor remains 19/21 with the existing metadata/patch-version warnings.

APK: `release/Acharya-AI-1.0.16-offline-reports-arm64.apk` (167,676,576 bytes).
SHA-256: `e03e779b66fa4f13318465956e6df53c6077615ed0f273a0d99586e2ffd83549`.
