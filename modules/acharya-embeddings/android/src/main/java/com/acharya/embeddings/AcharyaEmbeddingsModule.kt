package com.acharya.embeddings

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/** Downloads are independent of the inference gate. No user data is sent to the model host. */
class AcharyaEmbeddingsModule : Module() {
  private fun directory(): File {
    val context = requireNotNull(appContext.reactContext)
    return File(context.noBackupFilesDir, "embedding-model").apply { check(isDirectory || mkdirs()) }
  }
  override fun definition() = ModuleDefinition {
    Name("AcharyaEmbeddings")
    Constants("contract" to EmbeddingContract.ID, "available" to false, "downloadsAvailable" to true)
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
