package com.acharya.embeddings

import com.google.ai.edge.litertlm.ActivationDataType
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.EmbeddingEngine
import com.google.ai.edge.litertlm.EmbeddingEngineConfig
import com.google.ai.edge.litertlm.EmbeddingOptions
import com.google.ai.edge.litertlm.InputData
import java.io.File

/** Blocking native API. Owned by one background coordinator, never called on the UI thread. */
class LocalEmbeddingEngine(model: File, cache: File) : AutoCloseable {
  private val engine: EmbeddingEngine
  init {
    EmbeddingContract.verify(model)
    check(cache.isDirectory || cache.mkdirs()) { "Cannot create model cache" }
    engine = EmbeddingEngine(EmbeddingEngineConfig(
      modelPath = model.canonicalPath,
      backend = Backend.CPU(threadCount = 2),
      cacheDir = cache.canonicalPath,
      maxInputLength = 2048,
      activationDataType = ActivationDataType.FLOAT32,
    ))
    engine.initialize()
  }

  fun embedDocument(title: String, text: String): FloatArray =
    embed(EmbeddingContract.document(title, text))

  fun embedQuery(text: String): FloatArray = embed(EmbeddingContract.query(text))

  private fun embed(prefixed: String): FloatArray = EmbeddingContract.truncateAndNormalize(
    engine.computeEmbedding(
      listOf(InputData.Text(prefixed)),
      EmbeddingOptions(normalize = false, insertSpecialTokens = true, outputSize = 768),
    ).embedding,
  )

  override fun close() {
    if (engine.isInitialized()) engine.close()
  }
}
