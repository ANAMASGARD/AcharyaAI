package com.acharya.embeddings

import android.content.Context
import java.io.File
import org.json.JSONObject
import org.json.JSONArray

/** Same allowlisted, verified atomic installation as Whisper; no user credentials. */
object ReportModel {
  fun manifest(context: Context, id: String): JSONObject {
    val all = context.assets.open("gemma-report.json").bufferedReader().use { JSONArray(it.readText()) }
    return (0 until all.length()).map { all.getJSONObject(it) }.firstOrNull { it.getString("id") == id } ?: error("Unknown report model")
  }
  fun definition(context: Context, id: String): SttModels.Model {
    val json = manifest(context, id)
    check(json.optBoolean("distributionApproved") && json.optString("sha256").matches(Regex("[a-f0-9]{64}"))) { "Gemma download is awaiting publisher verification" }
    return SttModels.Model(json.getString("id"), json.getString("filename"), json.getLong("bytes"), json.getString("sha256"))
  }
  private fun directory(context: Context) = File(context.noBackupFilesDir, "report-models").apply { check(isDirectory || mkdirs()) }
  fun file(context: Context, id: String) = File(directory(context), definition(context, id).filename)
  fun partial(context: Context, id: String) = File(directory(context), definition(context, id).filename + ".part")
  fun inspect(context: Context, id: String): Map<String, Any> {
    val model = file(context, id)
    return mapOf("downloaded" to (model.exists() && runCatching { SttModels.verify(model, definition(context, id)) }.isSuccess),
      "partialBytes" to partial(context, id).length(), "uri" to android.net.Uri.fromFile(partial(context, id)).toString())
  }
  fun prepare(context: Context, id: String, restart: Boolean): String {
    val model = definition(context, id)
    val part = partial(context, id)
    check(directory(context).usableSpace >= if (restart) model.bytes * 3 / 2 else model.bytes - part.length()) { "Not enough free storage for this model download" }
    if (restart && part.exists()) check(part.delete())
    if (!part.exists()) check(part.createNewFile())
    return android.net.Uri.fromFile(part).toString()
  }
  fun finish(context: Context, id: String) {
    val part = partial(context, id)
    SttModels.verify(part, definition(context, id))
    java.io.RandomAccessFile(part, "rw").use { it.fd.sync() }
    check(part.renameTo(file(context, id))) { "Could not install verified Gemma model" }
  }
  fun discard(context: Context, id: String) { val part = partial(context, id); check(!part.exists() || part.delete()) }
  fun remove(context: Context, id: String) = InferenceCoordinator.withoutStt {
    val model = file(context, id)
    check(!model.exists() || model.delete()) { "Could not remove Gemma model" }
  }
}
