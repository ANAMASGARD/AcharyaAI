# Experimental offline classroom reports

Verified against primary sources on 2026-11-01. This document records the initial LiteRT investigation and subsequent GGUF implementation. The final three-model decision and actual smoke-test findings are recorded at the end; initial release gates below are historical, not the current download state.

## Product decision

Optional, explicitly downloaded Gemma 3 270M instruction-tuned reports follow the recording mode, with an explicit user override. Local reports remain local until the user shares them. Report generation precedes the existing local embedding flow. This experimental feature does not replace the online Gemini provider or imply equivalent quality.

## Candidate artifact and unresolved release gate

| Field | Verified value |
| --- | --- |
| Repository | `litert-community/gemma-3-270m-it` |
| Revision | `9d2093270fb5aa49a986b49b5779d763dde7b630` |
| File | `gemma3-270m-it-q8.litertlm` |
| Size | 304,005,120 bytes (about 290 MiB) |
| Runtime candidate | Existing LiteRT-LM Android 0.18.0, CPU |
| SHA-256 | Unverified: anonymous API redacts the LFS hash |
| Access | Hugging Face gated, automatic approval after accepting conditions |

Pinned upstream URL: `https://huggingface.co/litert-community/gemma-3-270m-it/resolve/9d2093270fb5aa49a986b49b5779d763dde7b630/gemma3-270m-it-q8.litertlm`.

Sources: [repository listing](https://huggingface.co/litert-community/gemma-3-270m-it/tree/main), [model metadata API](https://huggingface.co/api/models/litert-community/gemma-3-270m-it), [file metadata API](https://huggingface.co/api/models/litert-community/gemma-3-270m-it/tree/main). The Git blob object ID is not the model SHA-256. A release manifest must contain a verified artifact digest; never invent one or enable an unverified download.

Standard HF credential environment variables and standard cached token files were absent in the research environment. Therefore publisher acceptance and authorized artifact access could not be established. A read-only anonymous request for `ANAMASGARD/acharya-models` returned HTTP 401; this does not distinguish a nonexistent repository from a private one.

The [converted model card](https://huggingface.co/litert-community/gemma-3-270m-it/blob/main/README.md) describes GPU support as work in progress. CPU is the initial candidate; no device memory, speed, or battery claim has been verified for this artifact.

## Distribution

The upstream download requires an authorized account. User-authorized upstream download/import or publisher-controlled redistribution are possible designs. The latter requires fulfilling the [Gemma distribution terms, section 3](https://ai.google.dev/gemma/terms), including the agreement, required notice, use restrictions, and modification notices where relevant. Runtime Apache licensing does not replace the weights' Gemma terms. Never embed a publisher HF credential in the mobile app, accept terms on behalf of the user, or bypass the access gate using an unapproved mirror.

The inspected [current Gallery catalog](https://github.com/google-ai-edge/gallery/blob/main/model_allowlist.json) and [versioned 1.0.22 catalog](https://github.com/google-ai-edge/gallery/blob/main/model_allowlists/1_0_22.json) do not establish a public Google-hosted download for this base 270M instruction-tuned artifact. FunctionGemma TinyGarden/MobileActions entries are different models and are not substitutes. A public distribution URL remains unverified.

### Follow-up: publicly distributed compatible artifact

After the user requested an ungated Gemma 3 270M option, a compatible third-party distribution was verified. This supersedes the public-download blocker above, but does not independently establish a full-file hash match against gated upstream bytes.

| Field | Verified distributor metadata |
| --- | --- |
| Repository | `moonlauncher/moon-models` |
| Revision | `bbf238fa1804f295ea05df88502ac97a4732db30` |
| Artifact | `gemma/gemma3-270m-it-q8.litertlm` |
| Bytes | 304,005,120 |
| Published LFS SHA-256 | `757e9119fa5bd667a2774fb470ac4afcd3190a21c677f8e69a5d6bc908abdd63` |
| Access | Public, API `gated: false`; unauthenticated range GET succeeded |
| Format | First bytes are `LITERTLM`, followed by format metadata |

Pinned download: `https://huggingface.co/moonlauncher/moon-models/resolve/bbf238fa1804f295ea05df88502ac97a4732db30/gemma/gemma3-270m-it-q8.litertlm`.

The [publisher's model card](https://huggingface.co/moonlauncher/moon-models/blob/bbf238fa1804f295ea05df88502ac97a4732db30/README.md) explicitly identifies this as an unchanged copy from `litert-community/gemma-3-270m-it`. It includes a [NOTICE](https://huggingface.co/moonlauncher/moon-models/blob/bbf238fa1804f295ea05df88502ac97a4732db30/NOTICE), a [copy of the Gemma terms](https://huggingface.co/moonlauncher/moon-models/blob/bbf238fa1804f295ea05df88502ac97a4732db30/GEMMA_TERMS.md), and the use restrictions. This is a third-party distributor, not an official Google or Unsloth endpoint. Gemma's redistribution conditions still apply to the app.

The [pinned directory API](https://huggingface.co/api/models/moonlauncher/moon-models/tree/bbf238fa1804f295ea05df88502ac97a4732db30/gemma) exposes the SHA and size. Its Git LFS pointer object ID `0c3f9be8f95bab4ddabdb7b50b00c216756403ab` equals the official listing's pointer object ID, supporting the publisher's unchanged-file claim. This is metadata evidence, not an independent full-file cryptographic comparison with official bytes. Verify the downloaded file against the pinned published SHA before atomic installation.

The unauthenticated range response was HTTP 206 with `Content-Range: bytes 0-31/304005120`; no login or access-control bypass was needed. Runtime quality and physical-device compatibility remain unproven.

### Unsloth comparison

The [Unsloth instruction-tuned repository](https://huggingface.co/unsloth/gemma-3-270m-it) is ungated and Gemma-licensed, but contains `model.safetensors` and tokenizer/configuration files, not a LiteRT-LM bundle. Its revision was `23cf460f6bb16954176b3ddcc8d4f250501458a9`.

The [Unsloth GGUF repository](https://huggingface.co/unsloth/gemma-3-270m-it-GGUF) is also ungated and Gemma-licensed. At revision `c90975dbd40c0c7b275fefaae758c3415c906238`, `gemma-3-270m-it-Q4_K_M.gguf` is 253,115,424 bytes with published SHA-256 `b1baabd6b729e4041822220d3e648e00d99cac5df86b10dffb77bcccf0688e39`. GGUF requires a compatible runtime such as llama.cpp/llama.rn; it cannot be renamed to `.litertlm` or loaded by the existing bridge. Adding that native runtime would require a separate approved architecture change and a rebuilt application. The compatible public LiteRT-LM distribution above avoids that runtime change; it must not be represented as an Unsloth artifact.

### Requested anonymous-download comparison

On 2026-11-01, unauthenticated metadata requests and `Range: bytes=0-31` downloads succeeded for all three explicitly requested repositories. Each metadata response had `gated: false`; each download returned HTTP 206, the expected total size, and the `GGUF` version-3 header. These are actual successful public downloads of 32 bytes, not full-file hash verification or inference tests.

| Repository | Pinned revision | Representative file | Bytes | Published SHA-256 | Declared license |
| --- | --- | --- | --- | --- | --- |
| [unsloth/gemma-3-270m-it-GGUF](https://huggingface.co/unsloth/gemma-3-270m-it-GGUF) | `c90975dbd40c0c7b275fefaae758c3415c906238` | `gemma-3-270m-it-Q8_0.gguf` | 291,546,144 | `d156a5159f2f79c1b1d53c7c1cc20f1ff28ab8d00f17a292620aad13399b9698` | `gemma` |
| [unsloth/gemma-3-270m-it-qat-GGUF](https://huggingface.co/unsloth/gemma-3-270m-it-qat-GGUF) | `0bf934fbcd99f483e16763156bb3d75699b4fc76` | `gemma-3-270m-it-qat-Q8_0.gguf` | 448,832,608 | `95595ab89c7261c241545f55ec4d05e99bbe5c2d86b531e99bf8818a6661834f` | `gemma` |
| [ggml-org/gemma-3-270m-it-GGUF](https://huggingface.co/ggml-org/gemma-3-270m-it-GGUF) | `e7647be17ae1108f2f605ed061ca0608b171afff` | `gemma-3-270m-it-Q8_0.gguf` | 291,545,600 | `0ef57d2c838458a1952664260dcba38e5bdda37494f3af732f06e4add24068e3` | No license field in model metadata |

Pinned range-tested URLs: [Unsloth standard Q8](https://huggingface.co/unsloth/gemma-3-270m-it-GGUF/resolve/c90975dbd40c0c7b275fefaae758c3415c906238/gemma-3-270m-it-Q8_0.gguf), [Unsloth QAT Q8](https://huggingface.co/unsloth/gemma-3-270m-it-qat-GGUF/resolve/0bf934fbcd99f483e16763156bb3d75699b4fc76/gemma-3-270m-it-qat-Q8_0.gguf), [ggml-org Q8](https://huggingface.co/ggml-org/gemma-3-270m-it-GGUF/resolve/e7647be17ae1108f2f605ed061ca0608b171afff/gemma-3-270m-it-Q8_0.gguf).

The ggml-org README identifies `google/gemma-3-270m-it` as its base and recommends `llama-server`; the repository listing contains no separate license/notice file. Missing license metadata does not remove upstream Gemma obligations. The differently sized QAT file is not evidence of better quality, lower memory, or faster runtime; those properties require evaluation. All three are GGUF artifacts and remain incompatible with the current LiteRT-LM loader. Their availability does not require replacing the already selected compatible `.litertlm` download.

## Verified Kotlin 0.18.0 contract

Use the pinned sources rather than current-main examples:

- [Config.kt](https://github.com/google-ai-edge/LiteRT-LM/blob/v0.18.0/kotlin/java/com/google/ai/edge/litertlm/Config.kt): `Backend.CPU(threadCount = ...)`, `EngineConfig.maxNumTokens` for input plus output/KV capacity, `ConversationConfig.maxOutputToken`, and `enableResponseFormat`.
- [Conversation.kt](https://github.com/google-ai-edge/LiteRT-LM/blob/v0.18.0/kotlin/java/com/google/ai/edge/litertlm/Conversation.kt): synchronous `sendMessage`, asynchronous callback/Flow `sendMessageAsync`, per-request `maxOutputToken` and `responseFormat`, and explicit `cancelProcess()`.
- [ResponseFormat.kt](https://github.com/google-ai-edge/LiteRT-LM/blob/v0.18.0/kotlin/java/com/google/ai/edge/litertlm/ResponseFormat.kt): JSON Schema constrained decoding through `ResponseFormat.json(schema)`. Enable it on the conversation first; the configuration initializes LLGuidance. Runtime constraint support does not establish semantic accuracy or complete JSON at a token limit.
- [ModelInfo.kt](https://github.com/google-ai-edge/LiteRT-LM/blob/v0.18.0/kotlin/java/com/google/ai/edge/litertlm/ModelInfo.kt): inspect installed file with `ModelInfo.from(path)`, `maxContextTokens()`, `minRuntimeVersion()`, and `supportedBackends(...)` before loading.

Flow cancellation alone does not cancel native inference: the implementation has an empty `awaitClose {}`. Explicitly call `cancelProcess()`, await terminal completion, then release resources. The source notes that rollback of conversation state after cancellation is pending; recreate cancelled conversations. Serialize model lifetimes and do not free an engine while callbacks still use it.

`Conversation.getTokenCount()` reports the existing conversation KV-cache count, including prefill and decode. No public preflight tokenizer/count API for an arbitrary proposed input was found in the inspected Kotlin Engine/Conversation/Session API. Character count is not token count. A conservative UTF-8-byte input bound may be used provisionally, with native context-overflow handling, but must not be advertised as exact tokenization.

The inspected [Message.kt](https://github.com/google-ai-edge/LiteRT-LM/blob/v0.18.0/kotlin/java/com/google/ai/edge/litertlm/Message.kt) and Conversation callback contract do not expose an explicit finish/stop reason. `onDone` alone does not establish EOS rather than a token limit. Require complete schema-valid output and validate all application invariants; treat suspected truncation as failure. Full decoding-stop distinction remains a native verification item.

## Context, language, and report quality

The base 270M model has a 32K combined token context, not the 128K advertised for larger variants. The converted file may have a lower supported limit; inspect its metadata rather than assume the base limit. Its vocabulary contains about 256K tokens, which is unrelated to a safe words-per-token estimate. Sources: [model card](https://ai.google.dev/gemma/docs/core/model_card_3), [270M introduction](https://developers.googleblog.com/introducing-gemma-3-270m/).

Gemma instruction-tuned prompts use user/model turns. Put instructions in the initial user message and let the runtime's artifact template format the conversation; do not assume a separate system role is supported. [Prompt format](https://ai.google.dev/gemma/docs/core/prompt-structure).

Google positions 270M for narrow tasks and fine-tuning rather than complex conversational reasoning. Published instruction-tuned benchmarks include IFEval 51.2 and BIG-Bench Hard 26.7. The family multilingual claim does not prove Hindi classroom report quality; no 270M-specific Hindi report evaluation was established here. The model card states safety evaluation used English prompts. English, Hindi, and code-switched classroom evaluation are release requirements, not presumed capabilities.

## Proposed generation and acceptance boundary

Process bounded transcript segments in order, produce bounded evidence-bearing observations, then synthesize a concise report. Preserve segment references and verify quoted evidence against the source. Do not silently discard the middle or end of a long lesson. Validate JSON, field lengths, evidence references, and allowed report states before persistence. Bound retries and output tokens; present failures honestly instead of storing partial reports as completed. Do not invent objective teaching scores from unsupported evidence.

Store model ID/revision, prompt/schema version, and experimental provenance with local reports. Only completed validated reports proceed to the existing embedding flow. Prefer serialized Whisper, generation, and embedding lifetimes to avoid unnecessary peak memory. Cloud fallback requires explicit user action.

Before release, obtain an authorized artifact and verified SHA-256; verify artifact context/backend compatibility, schema support, cancellation, out-of-memory recovery, and long-transcript coverage on a physical target Android device. Measure peak memory, thermal/battery behavior, latency, English/Hindi faithfulness, and false-evidence rates. Typecheck or native compilation does not prove these properties.


## Actual desktop inference check — 2026-11-01

Downloaded the complete public LiteRT-LM artifact above: 304,005,120 bytes,
SHA-256 `757e9119fa5bd667a2774fb470ac4afcd3190a21c677f8e69a5d6bc908abdd63`.
Python LiteRT-LM 0.18.0 on desktop CPU loads it successfully. Artifact metadata
reports **4,096 context tokens**, not the base model's 32K capacity.

The actual TypeScript report pipeline was exercised on synthetic English and
Hindi/English fractions lessons. Initial constrained generation returned an
inexact English quote and exhausted 1,024 output tokens on mixed-language input.
A compact JSON schema experiment with bounded strings and exact quote enums
encountered LLGuidance token/grammar errors (including `token "▁Today" doesn't
satisfy the grammar`); neither case completed a valid report. An unconstrained
control produced Markdown-fenced JSON and fabricated/paraphrased quotations.
These outputs were rejected, not saved as successful reports. The problem is
not simply downloading the weights. No Android runtime equivalence, Hindi
quality, long-session performance, or successful end-to-end generation is claimed.

The public `ANAMASGARD/acharya-models` repository contains license/provenance
files. Two attempts to upload the large GitHub release asset timed out with
HTTP 408. Do not use its model URL as a verified working download. Keep the
app's publication gate closed while generation and hosting remain unresolved.

## Final implementation change — three GGUF choices

The user subsequently authorized the three named Gemma repositories and asked
not to spend time on benchmarks. The app now pins `llama.rn@0.12.9` and all three
Q8 artifacts from the comparison table. Downloads go directly to the immutable
public Hugging Face URLs; the incomplete GitHub-hosted LiteRT release is not
used. EmbeddingGemma keeps its existing LiteRT runtime. The standard Unsloth
file was fully downloaded and its SHA-256 matched the published hash.

Before benchmarking was stopped, llama.cpp b12024 on desktop generated valid
schema-constrained JSON for both synthetic English and mixed-language examples.
It also invented negative teaching observations; schema validity is not a
quality pass. This supports only the GGUF-format/grammar smoke test, not Android
compatibility, quality, latency, or thermal claims. Further benchmarking and
physical inference acceptance are explicitly deferred by user instruction.
See `offline-reports.md` for the current download and processing flow.
