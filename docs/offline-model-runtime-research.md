# Lightweight offline report runtime decision

Checked 1 November 2026 against publisher sources and published package source.

## Recommendation and limits

Evaluate **Gemma 3 270M IT Q8_0 GGUF with llama.rn 0.12.9** first. It is the smaller candidate (291.5 MB versus 396.7 MB for Qwen3 0.6B Q4_K_M), and Google reports only 100M transformer parameters versus Qwen's 440M non-embedding parameters. This suggests lower compute cost; it is **not a measured Android speed comparison**. Google positions 270M for specialized instruction following and text structuring, explicitly excluding complex conversation as its intended strength. Hindi, mixed Hindi/English, long classroom transcript accuracy, and useful pedagogical feedback remain unproven. Grammar can enforce JSON structure, not factual grounding. [Google model introduction](https://developers.googleblog.com/introducing-gemma-3-270m/), [Qwen model card](https://huggingface.co/Qwen/Qwen3-0.6B).

If Gemma fails the existing evidence/quality gate, Qwen3 0.6B Q4_K_M is the next modest-size candidate, with thinking disabled. Its publisher documents multilingual capabilities and `enable_thinking=False` for efficient non-thinking operation; those general claims do not establish Acharya's report quality. Do not promise either as a validated replacement until the actual report pipeline passes. [Qwen model card](https://huggingface.co/Qwen/Qwen3-0.6B).

## Immutable artifact candidates

Publisher metadata was fetched through the Hugging Face model API with `blobs=true`. These are Unsloth conversions, not Google/Qwen-authored GGUFs.

| Field | Gemma candidate | Qwen fallback candidate |
| --- | --- | --- |
| Repository | `unsloth/gemma-3-270m-it-GGUF` | `unsloth/Qwen3-0.6B-GGUF` |
| Revision | `c90975dbd40c0c7b275fefaae758c3415c906238` | `50968a4468ef4233ed78cd7c3de230dd1d61a56b` |
| File | `gemma-3-270m-it-Q8_0.gguf` | `Qwen3-0.6B-Q4_K_M.gguf` |
| Bytes | 291546144 | 396705472 |
| SHA-256 | `d156a5159f2f79c1b1d53c7c1cc20f1ff28ab8d00f17a292620aad13399b9698` | `ac2d97712095a558e31573f62f466a3f9d93990898b0ec79d7c974c1780d524a` |

Sources: [Gemma publisher file listing](https://huggingface.co/unsloth/gemma-3-270m-it-GGUF/tree/c90975dbd40c0c7b275fefaae758c3415c906238), [Qwen publisher file listing](https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/tree/50968a4468ef4233ed78cd7c3de230dd1d61a56b). Metadata hashes still require local full-file verification after download. Gemma remains subject to [Gemma terms](https://ai.google.dev/gemma/terms); Qwen's base model is Apache-2.0 per its model card.

## Runtime contract

The npm `latest` tag currently points to **0.13.0-rc.9**, while the newest non-prerelease version is **0.12.9**. Pin 0.12.9 rather than silently selecting the prerelease. The published 0.12.9 tarball source was inspected, not just current `main`. [npm stable package metadata](https://registry.npmjs.org/llama.rn/0.12.9), [npm latest metadata](https://registry.npmjs.org/llama.rn/latest).

Verified 0.12.9 APIs:

- `initLlama({ model, n_ctx, ... })` creates a context; `context.completion(...)` returns the completion promise.
- `response_format: { type: 'json_schema', json_schema: { strict: true, schema } }` converts the schema into native grammar; explicit `grammar` takes precedence. Supply the actual bounded report schema, then retain application validation and evidence checks.
- `enable_thinking: false` is available for Qwen. Use model messages/chat templates rather than assuming interchangeable prompt markers.
- `context.stopCompletion(): Promise<void>` forwards cancellation to native code. `context.release(): Promise<void>` releases the native context. Application teardown should request stop, await the original inference's settlement, then release in `finally` before releasing the existing shared native-model reservation. Abort must also prevent late persistence.

Sources: [versioned index API source](https://github.com/mybigday/llama.rn/blob/v0.12.9/src/index.ts), [versioned native parameter types](https://github.com/mybigday/llama.rn/blob/v0.12.9/src/types.ts).

llama.rn requires React Native New Architecture from v0.10. Its peer dependencies are wildcard React/RN, which **does not certify React Native 0.86.3 compatibility**. Acharya currently uses Expo 57 and RN 0.86.3. Android source build flags enable flexible page sizes; this is not proof that every bundled library in the resulting APK supports 16 KB pages. A native rebuild and installed-device inference/cancellation test remain necessary. Start with CPU execution; Android Hexagon support is experimental. [Versioned README](https://github.com/mybigday/llama.rn/blob/v0.12.9/README.md), [Android build file](https://github.com/mybigday/llama.rn/blob/v0.12.9/android/build.gradle).

## Acceptance boundary

The existing LiteRT-LM report failure in `offline-reports-research.md` is a reason to test constrained generation, not evidence that the GGUF conversion fixes content. Require English and Hindi/mixed fixtures, bounded long-input handling, valid schema, transcript-grounded evidence, cancellation without late writes, release before EmbeddingGemma starts, account-change isolation, and airplane-mode execution on the target Android phone. Measure prompt processing, generation time, peak memory and thermal behavior before describing the choice as fast or supported.

## Implemented decision

The user explicitly selected the three Gemma repositories and asked to skip
further benchmarks. Qwen is not included. `llama.rn@0.12.9` is pinned, with a
small reproducible patch to use ReactContext.getJSCallInvokerHolder directly
for RN 0.86 bridgeless/minified builds and to make native invalidation idempotent.
The native reservation remains held until llama context release finishes.
All three downloads use independent IDs/files and exact SHA-256 manifests.
No comparative phone-speed or report-quality claim is made.
