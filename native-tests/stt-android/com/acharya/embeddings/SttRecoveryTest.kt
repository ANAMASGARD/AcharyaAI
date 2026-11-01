package com.acharya.embeddings

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class SttRecoveryTest {
  @Test fun orphanPartialBecomesSampleAlignedWavExactlyOnce() {
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    val dir = File(context.cacheDir, "synthetic-stt-recovery").apply { deleteRecursively(); mkdirs() }
    try {
      val part = File(dir, "0.part")
      part.writeBytes(ByteArray(44 + 16001))
      ClassRecordingService.recoverPartials(dir)
      val wav = File(dir, "0.wav")
      assertFalse(part.exists()); assertEquals(16044L, wav.length())
      val header = ByteBuffer.wrap(wav.readBytes().take(44).toByteArray()).order(ByteOrder.LITTLE_ENDIAN)
      assertEquals(16000, header.getInt(40)); assertEquals(16000, header.getInt(24))
      ClassRecordingService.recoverPartials(dir)
      assertEquals(1, dir.listFiles()!!.size)
      File(dir, "1.part").writeBytes(ByteArray(27))
      ClassRecordingService.recoverPartials(dir)
      assertEquals(1, dir.listFiles()!!.size)
      val invalid = File(dir, "1.part")
      RandomAccessFile(invalid, "rw").use { it.setLength(44L + ClassRecordingService.CHUNK_BYTES + 2) }
      assertTrue(runCatching { ClassRecordingService.recoverPartials(dir) }.isFailure)
      assertTrue(invalid.exists()); assertFalse(File(dir, "1.wav").exists())
    } finally { dir.deleteRecursively() }
  }

  @Test fun speechWaitsForEmbeddingCloseAndExcludesNewEmbeddingLoads() {
    val embeddingEntered = CountDownLatch(1); val allowClose = CountDownLatch(1)
    val reserved = CountDownLatch(1); val allowRelease = CountDownLatch(1)
    val embedding = Thread {
      InferenceCoordinator.withEmbedding { embeddingEntered.countDown(); check(allowClose.await(5, TimeUnit.SECONDS)) }
    }.apply { start() }
    assertTrue(embeddingEntered.await(5, TimeUnit.SECONDS))
    val speech = Thread {
      InferenceCoordinator.acquire("synthetic-test")
      try { reserved.countDown(); check(allowRelease.await(5, TimeUnit.SECONDS)) }
      finally { InferenceCoordinator.release("synthetic-test") }
    }.apply { start() }
    try {
      assertFalse(reserved.await(100, TimeUnit.MILLISECONDS))
      allowClose.countDown(); assertTrue(reserved.await(5, TimeUnit.SECONDS))
      assertNull(InferenceCoordinator.withEmbedding { error("Overlapping model load") })
    } finally { allowClose.countDown(); allowRelease.countDown(); embedding.join(5000); speech.join(5000) }
    assertEquals("available", InferenceCoordinator.withEmbedding { "available" })
  }
}
