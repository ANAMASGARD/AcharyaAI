package com.acharya.embeddings

import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.MessageDigest
import kotlin.math.sqrt

object EmbeddingContract {
  const val REVISION = "9be6e8b90982095dc05c2bd162e4b954ee4dbac7"
  const val FILE_NAME = "embeddinggemma-2-text-270m.litertlm"
  const val BYTES = 164626432L
  const val SHA256 = "2d079ee2f6f066b1f368e8d7c819f55214eaef1d0513b312321901f30ab286fb"
  const val ID = "eg2-text270m-int4-2d079ee2-litert018-cpu-f32-prefix1-mrl256-l2-chunk1"

  fun verify(file: File) {
    require(file.length() == BYTES) { "Model size mismatch" }
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().buffered().use { stream ->
      val buffer = ByteArray(65536)
      while (true) {
        val count = stream.read(buffer)
        if (count < 0) break
        digest.update(buffer, 0, count)
      }
    }
    require(digest.digest().joinToString("") { "%02x".format(it) } == SHA256) { "Model checksum mismatch" }
  }

  // Model-card semantic prefixes. LiteRT inserts BOS/EOS, not these strings.
  fun document(title: String, content: String) = "title: ${title.ifBlank { "none" }} | text: $content"
  fun query(content: String) = "task: search result | query: $content"

  fun truncateAndNormalize(native: FloatArray): FloatArray {
    require(native.size == 768 && native.all { it.isFinite() }) { "Invalid native vector" }
    val sum = native.take(256).sumOf { it.toDouble() * it.toDouble() }
    require(sum > 0 && sum.isFinite()) { "Invalid vector norm" }
    val norm = sqrt(sum)
    return FloatArray(256) { (native[it] / norm).toFloat() }
  }

  fun encode(vector: FloatArray): ByteArray {
    require(vector.size == 256 && vector.all { it.isFinite() })
    val norm = sqrt(vector.sumOf { it.toDouble() * it.toDouble() })
    require(kotlin.math.abs(norm - 1.0) <= 1e-4) { "Vector must be normalized" }
    return ByteBuffer.allocate(1024).order(ByteOrder.LITTLE_ENDIAN).apply {
      vector.forEach { putFloat(it) }
    }.array()
  }
}
