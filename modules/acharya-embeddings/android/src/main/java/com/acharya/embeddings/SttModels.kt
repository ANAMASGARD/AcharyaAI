package com.acharya.embeddings

import android.content.Context
import expo.modules.sqlite.AcharyaSqliteConnection
import java.io.File
import java.security.MessageDigest

object SttModels {
  data class Model(val id: String, val filename: String, val bytes: Long, val sha: String)
  val models = listOf(
    Model("whisper-small-q5_1-v1", "ggml-small-q5_1.bin", 190085487L, "ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb"),
    Model("whisper-medium-q5_0-v1", "ggml-medium-q5_0.bin", 539212467L, "19fea4b380c3a618ec4723c3eef2eb785ffba0d0538cf43f8f235e7b3b34220f")
  )
  fun model(id: String) = requireNotNull(models.find { it.id == id }) { "Unknown speech model" }
  fun directory(context: Context) = File(context.noBackupFilesDir, "speech-models").apply { check(isDirectory || mkdirs()) }
  fun partial(context: Context, id: String) = File(directory(context), "${model(id).filename}.part")
  fun file(context: Context, id: String) = File(directory(context), model(id).filename)
  fun verify(file: File, model: Model) {
    check(file.isFile && file.length() == model.bytes) { "Speech model size is invalid; download it again" }
    val hash = MessageDigest.getInstance("SHA-256")
    file.inputStream().buffered(65536).use { input ->
      val buffer = ByteArray(65536)
      while (true) { val count = input.read(buffer); if (count < 0) break; hash.update(buffer, 0, count) }
    }
    check(hash.digest().joinToString("") { "%02x".format(it) } == model.sha) { "Speech model checksum is invalid; download it again" }
  }
  fun prepare(context: Context, id: String, restart: Boolean): String {
    val model = model(id)
    val part = partial(context, id)
    check(directory(context).usableSpace >= model.bytes * 3 / 2) { "Free at least ${model.bytes * 3 / 2 / 1000000} MB to download this model" }
    if (restart && part.exists()) check(part.delete())
    if (!part.exists()) check(part.createNewFile())
    return android.net.Uri.fromFile(part).toString()
  }
  fun finish(context: Context, id: String) {
    val part = partial(context, id)
    verify(part, model(id))
    check(part.renameTo(file(context, id))) { "Could not save verified speech model" }
  }
  fun remove(context: Context, id: String) = InferenceCoordinator.withoutStt {
    model(id)
    val database = File(context.filesDir, "SQLite/acharya.db")
    if (database.exists()) AcharyaSqliteConnection.openExisting(database).use { db ->
      val pending = db.query("SELECT id FROM recording_sessions s WHERE stt_model_id=? AND (status IN ('starting','recording','stopping','finishing') OR (server_finalized=0 AND expected_chunk_count>0) OR EXISTS (SELECT 1 FROM recording_chunks c WHERE c.session_id=s.id AND c.status IN ('pending','processing','failed'))) LIMIT 1", listOf(id))
      check(pending.isEmpty()) { "Finish or retry saved transcription before removing this model" }
    }
    val file = file(context, id)
    check(!file.exists() || file.delete()) { "Could not remove speech model" }
  }
}
