# Offline reports — 1.0.16 experimental Android build

## Use

1. Profile → Run locally contains three Gemma 3 270M GGUF cards: Unsloth
   standard Q8 (292 MB), Unsloth QAT Q8 (449 MB), and ggml-org Q8 (292 MB).
2. Download whichever you want, then select a verified model and enable offline
   reports. Downloads never automatically select a model or change mode.
3. Finish Whisper transcription, then tap Send. The selected model produces
   feedback and notes locally. Existing online recordings default to the online
   report provider; the inline control permits an explicit override before Send.
4. Reports save in SQLite and reopen in Calendar. EmbeddingGemma indexes saved
   report/notes sources after generation releases the native reservation. Missing
   embedding weights leave indexing pending without losing the saved report.

The model downloads are public Hugging Face URLs pinned to immutable revisions,
exact sizes and SHA-256 values in `assets/models/gemma-report.json`. No account,
token or external page is required. Gemma terms and notices are included in the
app. Each download has independent progress, Pause/Resume, Cancel/Retry and
Remove controls. Installation checks size/hash, free space and resume offsets,
then atomically promotes into no-backup storage. Retrying does not erase a
verified installed model. The two 292 MB choices minimize download size; no
phone speed or quality ranking is claimed.

## Processing and recovery

`llama.rn@0.12.9` replaces the unsuccessful LiteRT generation experiment for
reports only. Existing EmbeddingGemma continues using LiteRT-LM. Generation uses
CPU, two threads, 4,096 context tokens and a 1,024-token output ceiling. Each
request applies a JSON schema; final validation rejects malformed/truncated
responses, invalid fields and quotations absent from the source. Text appears
only after the complete report is validated. All models are text-only here.

Whisper → Gemma → EmbeddingGemma use a shared native reservation. Account
changes and cancellation request interruption, await the original inference,
release the GGUF context, and only then release the reservation. Model removal
is blocked during native processing. Selection is frozen by capturing the model
ID at Send. Every report saves its exact model revision and prompt version.

Long transcripts are divided into bounded 1,400-byte sections without dropping
characters; pairwise synthesis uses bounded prompts. Notes retain each section
summary. Valid intermediate results are owner-scoped SQLite checkpoints keyed
by transcript hash, model revision and prompt version. Retry reuses matching
checkpoints. Reports and embeddings remain local until per-report sharing and
account sync are both explicitly enabled. Reconnection never generates reports.

## Limitations and verification boundary

This is experimental feedback, not an objective teaching assessment. Scores
are estimates. The initial Gemma standard desktop smoke test generated valid
JSON with GGUF but also unsupported negative feedback. Exact source quotations
do not establish the truth of generated commentary. Review feedback and notes.
Hindi/mixed language, long lessons, speed, heat and memory remain unverified.

Version 1.0.16 fixes Gemma chat markers/Markdown around JSON. A physical Android
test reproduced the previous parse error and passed corrected local report/notes
generation for English and Hindi/English synthetic lessons without INTERNET
permission. See `offline-reports-json-fix-1.0.16.md`. This is not broad language
quality, download/history lifecycle, or long-session acceptance testing. QAT and ggml-org have not had an
inference smoke test. No cloud fallback occurs in offline mode.
