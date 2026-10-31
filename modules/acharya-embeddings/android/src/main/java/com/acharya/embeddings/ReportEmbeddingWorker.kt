package com.acharya.embeddings

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters
import expo.modules.sqlite.AcharyaSqliteConnection
import java.io.File

/** One serialized CPU worker. No network, Clerk tokens, transcript copies or cloud inference. */
class ReportEmbeddingWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  companion object {
    val inferenceLock = Any()
    fun status(context: Context, owner: String, state: String, error: String? = null) {
      context.getSharedPreferences("acharya-index-status", Context.MODE_PRIVATE).edit()
        .putString("$owner.state", state).putString("$owner.error", error).apply()
      android.util.Log.i("AcharyaIndex", "state=$state" + (error?.let { " code=$it" } ?: ""))
    }
  }
  override fun doWork(): Result = synchronized(inferenceLock) {
    val owner = inputData.getString("owner") ?: return@synchronized Result.failure()
    val generation = inputData.getString("generation") ?: return@synchronized Result.failure()
    if (ClassRecordingService.instance != null) { status(applicationContext, owner, "waiting_for_recorder"); return@synchronized Result.retry() }
    val model = File(applicationContext.noBackupFilesDir, "embedding-model/${EmbeddingContract.FILE_NAME}")
    if (!model.isFile) { status(applicationContext, owner, "model_missing"); return@synchronized Result.success() } // Files stay queued; model download schedules again.
    var stage = "local_storage"
    try {
      AcharyaSqliteConnection.openExisting(File(applicationContext.filesDir, "SQLite/acharya.db")).use { db ->
        fun allowed() = !isStopped && db.query("SELECT generation FROM embedding_accounts WHERE owner=?", listOf(owner)).singleOrNull()?.first() == generation
        if (!allowed()) return@synchronized Result.success()
        val sessions = db.query("SELECT session_id FROM report_vectors WHERE owner=? AND vector IS NULL GROUP BY session_id ORDER BY MIN(enqueue_sequence)", listOf(owner))
        if (sessions.isEmpty()) return@synchronized Result.success()
        stage = "model_load"
        status(applicationContext, owner, "loading_model")
        LocalEmbeddingEngine(model, File(applicationContext.noBackupFilesDir, "embedding-cache")).use { engine ->
          stage = "inference"
          status(applicationContext, owner, "indexing")
          for (session in sessions) {
            val id = session[0] as String
            val chunks = db.query("SELECT id,title,content,contract FROM report_vectors WHERE owner=? AND session_id=? ORDER BY enqueue_sequence", listOf(owner, id))
            val vectors = chunks.map { row ->
              check(allowed() && ClassRecordingService.instance == null) { "Indexing paused" }
              check(row[3] == EmbeddingContract.ID) { "Incompatible vector contract" }
              EmbeddingContract.encode(engine.embedDocument(row[1] as String, row[2] as String))
            }
            db.transaction { tx ->
              check(allowed() && ClassRecordingService.instance == null) { "Indexing paused" }
              for ((index, row) in chunks.withIndex()) {
                tx.query("UPDATE report_vectors SET vector=?,synced=0 WHERE id=? AND owner=? AND content=? AND contract=? AND EXISTS (SELECT 1 FROM embedding_accounts WHERE owner=? AND generation=?)",
                  listOf(vectors[index], row[0], owner, row[2], EmbeddingContract.ID, owner, generation))
              }
            }
          }
        }
      }
      status(applicationContext, owner, "complete")
      Result.success()
    } catch (error: Throwable) {
      // No raw notes or native exception content in diagnostics. Durable source rows remain pending.
      status(applicationContext, owner, "retrying", "$stage:${error.javaClass.simpleName}")
      Result.retry()
    }
  }
}
