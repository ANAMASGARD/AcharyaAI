package com.acharya.embeddings

import android.content.Context
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CancellationException

/** Native reservation survives JS inference and is released only after llama context teardown. */
object LocalReportEngine {
  private val operations = Object()
  private val cancelled = ConcurrentHashMap.newKeySet<String>()
  @Volatile private var pendingToken: String? = null
  @Volatile private var token: String? = null
  private fun allowed(id: String) { if (cancelled.contains(id)) throw CancellationException("Report cancelled") }
  fun open(context: Context, id: String, modelId: String, destroyed: () -> Boolean): String = synchronized(operations) {
    require(id.matches(Regex("[A-Za-z0-9_-]{21}")))
    check(token == null) { "Another local report is running" }
    pendingToken = id
    try {
      InferenceCoordinator.acquire(id) { cancelled.contains(id) || destroyed() }
      token = id
      allowed(id)
      check(!ClassRecordingService.anyWriterActive()) { "Finish recording before generating a report" }
      val model = ReportModel.file(context, modelId)
      SttModels.verify(model, ReportModel.definition(context, modelId))
      allowed(id)
      if (destroyed()) throw CancellationException("Report module closed")
      model.absolutePath
    } catch (error: Throwable) { close(id); throw error }
    finally { pendingToken = null }
  }
  fun cancel(id: String) { cancelled.add(id) }
  fun close(id: String) = synchronized(operations) {
    if (token == id) { token = null; InferenceCoordinator.release(id) }
    cancelled.remove(id)
  }
  fun shutdown(releaseNative: () -> Unit) {
    val id = pendingToken ?: token ?: return
    cancel(id)
    synchronized(operations) {
      // llama.rn invalidation interrupts work and joins its worker pool before freeing contexts.
      releaseNative()
      close(id)
    }
  }
  fun busy(): Boolean = pendingToken != null || token != null
}
