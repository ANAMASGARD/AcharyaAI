package com.acharya.embeddings

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.facebook.react.ReactApplication
import expo.modules.sqlite.AcharyaSqliteConnection
import java.io.File
import java.nio.ByteBuffer
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

/** Runs against com.acharya.app.nativegate only. Does not launch an Activity or Metro. */
@RunWith(AndroidJUnit4::class)
class NativeGateTest {
  private val instrumentation = InstrumentationRegistry.getInstrumentation()
  private val context = instrumentation.targetContext

  private fun blobBytes(value: Any?): ByteArray = when (value) {
    is ByteArray -> value
    is ByteBuffer -> value.duplicate().let { buffer -> ByteArray(buffer.remaining()).also { buffer.get(it) } }
    else -> error("Unexpected SQLite BLOB type")
  }

  private fun assertHeadless() {
    check(context.packageName == "com.acharya.app.nativegate") { "Refusing to run against real app data" }
    assertNull((context.applicationContext as ReactApplication).reactHost?.currentReactContext)
  }

  @Test
  fun sqliteConnectionsBeforeReact() {
    assertHeadless()
    val database = File(context.filesDir, "SQLite/acharya.db")
    database.parentFile!!.mkdirs()
    database.createNewFile()
    AcharyaSqliteConnection.openExisting(database).use { first ->
      assertEquals("wal", first.query("PRAGMA journal_mode=WAL").single().single())
      assertEquals(1L, first.query("PRAGMA foreign_keys").single().single())
      // Isolated gate fixture, not app migrations or a future native migration authority.
      first.query("CREATE TABLE IF NOT EXISTS native_gate (id INTEGER PRIMARY KEY, value INTEGER NOT NULL, vector BLOB)")
      first.query("DELETE FROM native_gate")
      first.query("INSERT INTO native_gate(id,value) VALUES(1,0)")
      try {
        first.transaction { db ->
          db.query("UPDATE native_gate SET value=99 WHERE id=1")
          error("rollback fixture")
        }
      } catch (_: IllegalStateException) { /* expected */ }
      assertEquals(0L, first.query("SELECT value FROM native_gate WHERE id=1").single().single())
      val pool = Executors.newFixedThreadPool(2)
      try {
        val futures = (1..2).map {
          pool.submit {
            AcharyaSqliteConnection.openExisting(database).use { connection ->
              repeat(25) {
                connection.transaction { db -> db.query("UPDATE native_gate SET value=value+1 WHERE id=?", listOf(1)) }
              }
            }
          }
        }
        futures.forEach { it.get(30, TimeUnit.SECONDS) }
      } finally { pool.shutdownNow() }
      assertEquals(50L, first.query("SELECT value FROM native_gate WHERE id=1").single().single())
      val vector = EmbeddingContract.truncateAndNormalize(FloatArray(768) { (it + 1).toFloat() })
      val bytes = EmbeddingContract.encode(vector)
      first.query("UPDATE native_gate SET vector=? WHERE id=?", listOf(bytes, 1))
      assertArrayEquals(bytes, blobBytes(first.query("SELECT vector FROM native_gate WHERE id=1").single().single()))
      assertEquals("ok", first.query("PRAGMA integrity_check").single().single())
    }
    // Explicit close/reopen exercises sqlite3_close, not only releasing JNI wrappers.
    AcharyaSqliteConnection.openExisting(database).use { reopened ->
      assertEquals(50L, reopened.query("SELECT value FROM native_gate WHERE id=1").single().single())
    }
    assertHeadless()
  }

  @Test
  fun realModelInHeadlessWorker() {
    assertHeadless()
    val model = File(context.noBackupFilesDir, EmbeddingContract.FILE_NAME)
    instrumentation.context.assets.open(EmbeddingContract.FILE_NAME).use { input ->
      model.outputStream().use { output -> input.copyTo(output) }
    }
    EmbeddingContract.verify(model)
    val manager = WorkManager.getInstance(context)
    val request = OneTimeWorkRequestBuilder<GateWorker>().build()
    manager.enqueue(request).result.get(30, TimeUnit.SECONDS)
    val deadline = System.nanoTime() + TimeUnit.MINUTES.toNanos(10)
    while (System.nanoTime() < deadline) {
      val info = manager.getWorkInfoById(request.id).get(10, TimeUnit.SECONDS)!!
      if (info.state.isFinished) {
        assertEquals(info.outputData.getString("failure"), androidx.work.WorkInfo.State.SUCCEEDED, info.state)
        assertEquals(256, info.outputData.getInt("dimensions", 0))
        assertHeadless()
        return
      }
      Thread.sleep(250)
    }
    manager.cancelWorkById(request.id)
    fail("Native worker exceeded ten-minute gate deadline")
  }
}
