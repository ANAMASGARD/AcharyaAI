# Native embedding feasibility research — Gate 1

Verified 12 October 2026 against pinned upstream source and the downloaded Android
AAR. This note establishes API and artifact contracts, **not** successful Android
inference, a passing release build, or support for a physical 4 GB phone.

## Pinned artifact and runtime

- Model: `litert-community/embeddinggemma-2-text-270m-litert-lm`, revision
  `9be6e8b90982095dc05c2bd162e4b954ee4dbac7`, file
  `embeddinggemma-2-text-270m.litertlm`, **164626432 bytes**, LFS SHA256
  `2d079ee2f6f066b1f368e8d7c819f55214eaef1d0513b312321901f30ab286fb`.
  These values match [Hugging Face's revision metadata](https://huggingface.co/api/models/litert-community/embeddinggemma-2-text-270m-litert-lm/revision/9be6e8b90982095dc05c2bd162e4b954ee4dbac7?blobs=true).
  Verify the downloaded bytes independently before loading them.
- The pinned [model card](https://huggingface.co/litert-community/embeddinggemma-2-text-270m-litert-lm/blob/9be6e8b90982095dc05c2bd162e4b954ee4dbac7/README.md)
  specifies the text-only 270M variant, INT4 per-channel quantization-aware training
  for transformer and embeddings, Apache 2.0, and signatures including 2048 tokens.
  This is distinct from original EmbeddingGemma and the full 740M multimodal model.
- Use `implementation("com.google.ai.edge.litertlm:litertlm-android:0.18.0")`
  from Google's Maven repository. Its [POM](https://dl.google.com/dl/android/maven2/com/google/ai/edge/litertlm/litertlm-android/0.18.0/litertlm-android-0.18.0.pom)
  declares Gson 2.14.0, Kotlin reflect 2.4.0, and coroutines-android 1.11.0.
  `javap` confirms Kotlin metadata version `[2,4,0]` in the distributed classes;
  compiler compatibility must be proven without suppressing metadata checks.

## Actual Android API

The [Kotlin API](https://github.com/google-ai-edge/LiteRT-LM/blob/v0.18.0/kotlin/java/com/google/ai/edge/litertlm/EmbeddingEngine.kt)
and [configuration](https://github.com/google-ai-edge/LiteRT-LM/blob/v0.18.0/kotlin/java/com/google/ai/edge/litertlm/EmbeddingConfig.kt)
match the downloaded AAR's public constructors. Run initialization, inference, and
close on a serialized background executor:

```kotlin
import com.google.ai.edge.litertlm.*

val engine = EmbeddingEngine(
  EmbeddingEngineConfig(
    modelPath = verifiedModelPath,
    backend = Backend.CPU(threadCount = 2),
    cacheDir = privateNoBackupCachePath,
    maxInputLength = 2048,
    activationDataType = ActivationDataType.FLOAT32,
  )
)
try {
  engine.initialize()
  val native768: FloatArray = engine.computeEmbedding(
    listOf(InputData.Text("title: none | text: $document")),
    EmbeddingOptions(normalize = false, insertSpecialTokens = true, outputSize = 768),
  ).embedding
  require(native768.size == 768 && native768.all { it.isFinite() })
  val leading256 = native768.copyOfRange(0, 256)
  val norm = kotlin.math.sqrt(leading256.sumOf { it.toDouble() * it.toDouble() })
  require(norm.isFinite() && norm > 0.0)
  val vector256 = FloatArray(256) { (leading256[it] / norm).toFloat() }
  // Validate the resulting norm and persist float32 values, not rounded strings.
} finally {
  if (engine.isInitialized()) engine.close()
}
```

Vision/audio backends default to null; no separate tokenizer or pooling module is
needed. Native close waits on the same engine lock as inference; do not call it on
the UI thread or make microphone startup await it. The
[activation enum](https://github.com/google-ai-edge/LiteRT-LM/blob/v0.18.0/kotlin/java/com/google/ai/edge/litertlm/Config.kt)
supports FLOAT32 explicitly. Google warns that ordinary FLOAT16 can produce invalid
or degraded values; 256-dimensional truncation must be followed by normalization.
[Model numerical and MRL guidance](https://ai.google.dev/gemma/docs/embeddinggemma/model_card_2).

## Prefixes and overflow

Use `title: {title} | text: {content}` for documents (`none` for missing title) and
`task: search result | query: {query}` for retrieval queries. These agree between
Google's model card and the [official SentenceTransformer configuration](https://huggingface.co/google/embeddinggemma-2/blob/main/config_sentence_transformers.json).
The [LiteRT embedding guide](https://developers.google.cn/edge/litert-lm/embedding_models)
currently shows a different prefix pair. Follow the model-specific card/config,
version this decision, and include both languages and mixed speech in quality tests.

The pinned [native implementation](https://github.com/google-ai-edge/LiteRT-LM/blob/v0.18.0/runtime/core/embedding_engine_impl.cc)
adds BOS/EOS via `InsertSpecialTokens`; it does not insert those semantic prefixes.
Pass each semantic prefix exactly once. The runtime owns tokenization, model
execution, pooling, and projection; the app owns prefix formatting and final 256d
normalization.

The [engine options](https://github.com/google-ai-edge/LiteRT-LM/blob/v0.18.0/runtime/engine/embedding_engine.h)
default to `InputOverflowStrategy::kError`. The
[executor](https://github.com/google-ai-edge/LiteRT-LM/blob/v0.18.0/runtime/executor/embedding_litert_compiled_model_executor.cc)
returns an invalid-argument status when input exceeds the longest enabled signature.
Kotlin exposes no overflow-strategy option. [JNI](https://github.com/google-ai-edge/LiteRT-LM/blob/v0.18.0/kotlin/java/com/google/ai/edge/litertlm/jni/litertlm.cc)
propagates failures through `LiteRtLmJniException`; Kotlin responses expose the
vector only, not the C++ input-length/truncation diagnostics. Gate tests must force
an oversized input and verify rejection rather than assuming silent truncation is
impossible in the distributed native binary.

## AAR inspection and release gates

Downloaded [AAR](https://dl.google.com/dl/android/maven2/com/google/ai/edge/litertlm/litertlm-android/0.18.0/litertlm-android-0.18.0.aar)
to temporary host storage and inspected ZIP entries, manifest, class signatures,
and `readelf -lW` on both native libraries:

- AAR SHA256: `706cbb8a87739b2818111bf3a19a78b8f7781586d10f80adf3415581fab7595f`.
- Manifest minimum SDK: 24. Includes `arm64-v8a` and `x86_64` JNI libraries, so the
  x86_64 emulator is a valid candidate for functional tests. No 32-bit ABI included.
- Both libraries' ELF LOAD alignments are `0x4000` (16 KB). This is not a claim that
  every library or ZIP entry in Acharya's final APK/AAB is correctly aligned.
- No consumer ProGuard rules in this AAR or its classes JAR. JNI uses class names
  and constructors reflectively, including `EmbeddingResponse([F)V`. Add explicit
  consumer keep rules for `com.google.ai.edge.litertlm.**` for the feasibility build,
  then prove actual inference in the minified release app.

Gate 1 must prove debug and minified release compilation, independent model hash,
real 768d output and normalized 256d output, English/Hindi/mixed retrieval ranking,
oversized-input rejection, repeat initialization/close, and cold native execution
before React mounts. SQLite facade/worker tests must use Expo's existing native
SQLite library and prove concurrency/recovery separately. Measure whole-app peak
memory and recording contention on a physical 4 GB Android phone; emulator and
upstream flagship-phone benchmark numbers cannot establish that support.
