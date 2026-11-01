# Offline reports 1.0.15 (Android code 16)

Implemented three independent public Gemma GGUF downloads, verified installation,
account-scoped selection, offline generation from saved transcripts, SQLite
report/notes history, explicit cloud-sharing permission, and existing local
embedding enqueueing. One native model lifetime runs at a time. The original
online report provider remains available via the inline choice.

Validation:

- `npm run check`: passed typecheck, lint, 269 tests (6 existing skips), and
  Android/iOS/web export. Nine focused offline-report tests pass, including
  selected model identities and waiting for native context release.
- Latest TypeScript and focused lint checks passed after the final adapter/UI changes.
- `patch-package --error-on-fail`: passed, including llama.rn 0.12.9 compatibility patch.
- Expo Doctor: 19/21; existing React Native Directory metadata and Expo package
  patch-version warnings remain. No compatibility-warning suppression was added.
- Android release build and APK verification: results appended below when finished.
- Further model benchmarks were skipped at the user's request. Physical-device
  inference, debug-device, Hindi/mixed-language quality, long-session/thermal and
  download-race device acceptance have not been run and remain validation limits.

This is experimental. The initial standard-Gemma desktop GGUF smoke test produced
valid JSON but inaccurate teaching feedback. Output validation and exact quotes
do not establish factual correctness. Generated notes and feedback are marked
experimental and require review. No end-to-end Android performance claim is made.


## Signed APK result

- Minified, signed ARM64 release build passed. The 2 GB Gradle heap exhausted
  memory during R8; packaging succeeded using `-Xmx6144m` and Java 17.
- Package: `com.acharya.app`, version `1.0.15`, version code `16`.
- APK signature verification and ZIP 16 KB alignment verification passed.
- All 45 packaged ARM64 shared libraries passed ELF LOAD alignment >=16 KB;
  llama runtime/JNI and Whisper libraries are present.
- All three model entries and the latest experimental labels are bundled.
  No GGUF or LiteRT model weights are bundled in the APK.

Artifact: `release/Acharya-AI-1.0.15-offline-reports-arm64.apk` (167,674,908 bytes).
SHA-256: `df075a64e3c328ce24993a3e3ca38a4ae60b08f8a5b90405386043b602cc5d63`.
