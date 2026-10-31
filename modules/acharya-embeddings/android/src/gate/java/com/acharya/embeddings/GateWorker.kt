package com.acharya.embeddings

import android.content.Context
import android.os.Build
import android.os.Debug
import android.util.Log
import androidx.work.Data
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.facebook.react.ReactApplication
import expo.modules.sqlite.AcharyaSqliteConnection
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.abs

/** Synthetic fixtures, compiled only with -PacharyaNativeGate=true. */
class GateWorker(context: Context, parameters: WorkerParameters) : Worker(context, parameters) {
  override fun doWork(): Result {
    return try {
      check(applicationContext.packageName == "com.acharya.app.nativegate") { "Gate worker requires isolated test application" }
      check((applicationContext as ReactApplication).reactHost?.currentReactContext == null)
      val model = File(applicationContext.noBackupFilesDir, EmbeddingContract.FILE_NAME)
      val started = System.nanoTime()
      LocalEmbeddingEngine(model, File(applicationContext.noBackupFilesDir, "embedding-gate-cache")).use { engine ->
        val loaded = System.nanoTime()
        val text = "Plants use sunlight, water and carbon dioxide to make food through photosynthesis."
        val english = engine.embedDocument("Photosynthesis", text)
        val repeated = engine.embedDocument("Photosynthesis", text)
        val hindi = engine.embedDocument("प्रकाश संश्लेषण", "पौधे सूर्य के प्रकाश से अपना भोजन बनाते हैं।")
        val mixed = engine.embedDocument("Science class", "आज हमने photosynthesis और पौधों के भोजन के बारे में पढ़ा।")
        val query = engine.embedQuery("How do plants make food?")
        val maths = engine.embedDocument("Fractions", "Add fractions by finding a common denominator.")
        listOf(english, repeated, hindi, mixed, query, maths).forEach {
          val bytes = EmbeddingContract.encode(it)
          val decoded = FloatArray(256)
          ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer().get(decoded)
          check(it.contentEquals(decoded))
        }
        check(english.indices.all { abs(english[it] - repeated[it]) < 1e-4 })
        fun cosine(a: FloatArray, b: FloatArray) = a.indices.sumOf { a[it].toDouble() * b[it] }
        check(cosine(query, english) > cosine(query, maths)) { "Retrieval smoke test failed" }
        // Exercise the runtime's documented error path; a truncated success is unacceptable.
        val overflow = runCatching { engine.embedDocument("overflow", "photosynthesis ".repeat(10000)) }
        check(overflow.isFailure) { "Runtime silently accepted overlength input" }
        val error = overflow.exceptionOrNull()!!
        check(error.message.orEmpty().contains("length", ignoreCase = true)) { "Unclassified overflow failure" }
        val database = File(applicationContext.filesDir, "SQLite/acharya.db")
        database.parentFile!!.mkdirs()
        database.createNewFile() // isolated fixture only
        AcharyaSqliteConnection.openExisting(database).use { db ->
          db.query("CREATE TABLE IF NOT EXISTS native_gate_vectors (id INTEGER PRIMARY KEY, vector BLOB NOT NULL)")
          val vector = EmbeddingContract.encode(english)
          db.transaction { it.query("INSERT OR REPLACE INTO native_gate_vectors VALUES (?, ?)", listOf(1, vector)) }
          check((db.query("SELECT vector FROM native_gate_vectors WHERE id=1").single().single() as ByteArray).contentEquals(vector))
          check(db.query("PRAGMA integrity_check").single().single() == "ok")
        }
        Log.i("AcharyaNativeGate", "abi=${Build.SUPPORTED_ABIS.joinToString()} sdk=${Build.VERSION.SDK_INT} loadMs=${(loaded-started)/1000000} totalMs=${(System.nanoTime()-started)/1000000} pssKb=${Debug.getPss()} dimensions=256")
      }
      Result.success(Data.Builder().putInt("dimensions", 256).build())
    } catch (error: Throwable) {
      // Synthetic fixtures only. Never use this raw diagnostic path for classroom jobs.
      Log.e("AcharyaNativeGate", "Synthetic gate failed", error)
      Result.failure(Data.Builder().putString("failure", error.javaClass.simpleName + ": " + error.message.orEmpty().take(500)).build())
    }
  }
}
