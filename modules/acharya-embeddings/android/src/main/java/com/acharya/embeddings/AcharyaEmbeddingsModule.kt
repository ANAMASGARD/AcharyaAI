package com.acharya.embeddings

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers

/** Downloads are independent of the inference gate. No user data is sent to the model host. */
class AcharyaEmbeddingsModule : Module() {
  private fun directory(): File {
    val context = requireNotNull(appContext.reactContext)
    return File(context.noBackupFilesDir, "embedding-model").apply { check(isDirectory || mkdirs()) }
  }
  override fun definition() = ModuleDefinition {
    Name("AcharyaEmbeddings")
    Constants("contract" to EmbeddingContract.ID, "available" to true, "downloadsAvailable" to true, "recordingAvailable" to true, "sttAvailable" to true)
    AsyncFunction("inspectSttModel") { id: String ->
      val context = requireNotNull(appContext.reactContext)
      val file = SttModels.file(context, id)
      mapOf("downloaded" to (file.exists() && runCatching { SttModels.verify(file, SttModels.model(id)) }.isSuccess),
        "partialBytes" to SttModels.partial(context, id).length(), "uri" to android.net.Uri.fromFile(SttModels.partial(context, id)).toString())
    }
    AsyncFunction("prepareSttDownload") { id: String, restart: Boolean -> SttModels.prepare(requireNotNull(appContext.reactContext), id, restart) }
    AsyncFunction("finishSttDownload") { id: String -> SttModels.finish(requireNotNull(appContext.reactContext), id) }
    AsyncFunction("discardSttDownload") { id: String ->
      val file = SttModels.partial(requireNotNull(appContext.reactContext), id)
      check(!file.exists() || file.delete()) { "Could not remove partial download" }
    }
    AsyncFunction("removeSttModel") { id: String -> SttModels.remove(requireNotNull(appContext.reactContext), id) }
    AsyncFunction("sttModelPath") { id: String ->
      val file = SttModels.file(requireNotNull(appContext.reactContext), id)
      SttModels.verify(file, SttModels.model(id))
      file.absolutePath
    }
    AsyncFunction("acquireSttResidency") { token: String -> InferenceCoordinator.acquire(token) }.runOnQueue(CoroutineScope(Dispatchers.IO))
    AsyncFunction("releaseSttResidency") { token: String -> InferenceCoordinator.release(token) }
    AsyncFunction("startClassRecording") { owner: String, session: String ->
      val context = requireNotNull(appContext.reactContext)
      check(appContext.currentActivity?.hasWindowFocus() == true) { "Open Acharya before starting recording" }
      check(ClassRecordingService.instance == null && !ClassRecordingService.anyWriterActive()) { "A class is already recording" }
      val dir = ClassRecordingService.directory(context.noBackupFilesDir, owner, session)
      check(!dir.exists()) { "Capture session already exists" }
      context.startForegroundService(android.content.Intent(context, ClassRecordingService::class.java).putExtra("owner", owner).putExtra("session", session))
      for (attempt in 0 until 100) {
        if (File(dir, "error").exists()) error(File(dir, "error").readText())
        if (File(dir, "started").exists()) break
        Thread.sleep(50)
      }
      check(File(dir, "started").exists()) { "Microphone did not start" }
    }
    AsyncFunction("stopClassRecording") { owner: String, session: String ->
      ClassRecordingService.instance?.let {
        check(it.owner == owner && it.session == session) { "Recording owner mismatch" }
        it.stopCapture()
      }
      ClassRecordingService.awaitStopped(ClassRecordingService.directory(requireNotNull(appContext.reactContext).noBackupFilesDir, owner, session))
    }
    AsyncFunction("classRecordingStatus") { owner: String, session: String ->
      val context = requireNotNull(appContext.reactContext)
      val dir = ClassRecordingService.directory(context.noBackupFilesDir, owner, session)
      ClassRecordingService.recoverPartials(dir)
      mapOf("active" to ClassRecordingService.writerActive(dir),
        "error" to File(dir, "error").takeIf { it.exists() }?.readText(),
        "chunks" to dir.listFiles().orEmpty().filter { it.extension == "wav" }.sortedBy { it.nameWithoutExtension.toInt() }.map {
          mapOf("index" to it.nameWithoutExtension.toInt(), "uri" to android.net.Uri.fromFile(it).toString(), "durationMs" to ((it.length() - 44) * 1000 / 32000))
        })
    }
    AsyncFunction("ackClassChunk") { owner: String, session: String, index: Int ->
      require(index >= 0)
      val context = requireNotNull(appContext.reactContext)
      val file = File(ClassRecordingService.directory(context.noBackupFilesDir, owner, session), "$index.wav")
      check(!file.exists() || file.delete()) { "Could not acknowledge saved audio" }
    }
    AsyncFunction("clearClassCapture") { owner: String ->
      require(owner.matches(Regex("[A-Za-z0-9_-]{1,128}")))
      ClassRecordingService.instance?.takeIf { it.owner == owner }?.stopCapture()
      val context = requireNotNull(appContext.reactContext)
      val directory = File(context.noBackupFilesDir, "class-capture/$owner")
      directory.listFiles().orEmpty().filter { it.isDirectory }.forEach { ClassRecordingService.awaitStopped(it) }
      check(!directory.exists() || directory.deleteRecursively()) { "Could not remove saved recording audio" }
    }
    AsyncFunction("scheduleReportIndex") { owner: String, generation: String ->
      require(owner.matches(Regex("[A-Za-z0-9_-]{1,128}")))
      val context = requireNotNull(appContext.reactContext)
      val work = androidx.work.OneTimeWorkRequestBuilder<ReportEmbeddingWorker>()
        .setInputData(androidx.work.Data.Builder().putString("owner", owner).putString("generation", generation).build())
        .setConstraints(androidx.work.Constraints.Builder().setRequiresBatteryNotLow(true).build())
        .setBackoffCriteria(androidx.work.BackoffPolicy.EXPONENTIAL, 30, java.util.concurrent.TimeUnit.SECONDS).build()
      androidx.work.WorkManager.getInstance(context).enqueueUniqueWork("report-index-$owner", androidx.work.ExistingWorkPolicy.KEEP, work)
    }
    AsyncFunction("getIndexingDiagnostic") { owner: String ->
      val context = requireNotNull(appContext.reactContext)
      val prefs = context.getSharedPreferences("acharya-index-status", android.content.Context.MODE_PRIVATE)
      mapOf("state" to prefs.getString("$owner.state", "pending"), "error" to prefs.getString("$owner.error", null))
    }
    AsyncFunction("cancelReportIndex") { owner: String ->
      val context = requireNotNull(appContext.reactContext)
      androidx.work.WorkManager.getInstance(context).cancelUniqueWork("report-index-$owner").result.get(10, java.util.concurrent.TimeUnit.SECONDS)
    }
    AsyncFunction("modelDownloaded") {
      val model = File(directory(), EmbeddingContract.FILE_NAME)
      model.exists() && runCatching { EmbeddingContract.verify(model) }.isSuccess
    }
    AsyncFunction("prepareDownload") {
      val directory = directory()
      val partial = File(directory, "model.part")
      if (partial.exists()) check(partial.delete()) { "Could not clear interrupted download" }
      check(directory.usableSpace >= EmbeddingContract.BYTES + 64 * 1024 * 1024) { "Free at least 230 MB to download the model" }
      // Expo's file permission service allows a pre-created writable no-backup file.
      check(partial.createNewFile()) { "Could not prepare model download" }
      android.net.Uri.fromFile(partial).toString()
    }
    AsyncFunction("finishDownload") {
      val directory = directory()
      val partial = File(directory, "model.part")
      EmbeddingContract.verify(partial)
      check(partial.renameTo(File(directory, EmbeddingContract.FILE_NAME))) { "Could not save verified model" }
    }
    AsyncFunction("discardDownload") {
      val partial = File(directory(), "model.part")
      if (partial.exists()) check(partial.delete()) { "Could not clear download" }
    }
    AsyncFunction("removeModel") {
      val model = File(directory(), EmbeddingContract.FILE_NAME)
      if (model.exists()) check(model.delete()) { "Could not remove model" }
    }
  }
}
