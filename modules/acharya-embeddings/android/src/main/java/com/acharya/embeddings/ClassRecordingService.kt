package com.acharya.embeddings

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Semaphore
import java.util.concurrent.TimeUnit

/** Native capture and disk writes continue independently of React/Activity and JS timers. */
class ClassRecordingService : Service() {
  companion object {
    @Volatile var instance: ClassRecordingService? = null
    private val writers = ConcurrentHashMap<String, Semaphore>()
    private fun writer(dir: File) = writers.getOrPut(dir.absolutePath) { Semaphore(1) }
    fun anyWriterActive() = writers.values.any { it.availablePermits() == 0 }
    fun awaitStopped(dir: File) {
      val lock = writer(dir)
      check(lock.tryAcquire(3, TimeUnit.SECONDS)) { "Microphone is still stopping" }
      lock.release()
    }
    fun writerActive(dir: File) = writer(dir).availablePermits() == 0
    fun recoverPartials(dir: File) {
      val lock = writer(dir)
      if (!lock.tryAcquire()) return
      try {
        for (part in dir.listFiles().orEmpty().filter { it.extension == "part" }) {
          val index = part.nameWithoutExtension.toIntOrNull()
          check(index != null && index in 0..240 && part.name == "$index.part") { "Invalid saved audio index" }
          val payload = part.length() - 44
          // Process death while creating the placeholder header has not captured any PCM yet.
          if (payload <= 0) { check(part.delete()); continue }
          check(payload in 0..CHUNK_BYTES.toLong()) { "Invalid unfinished audio length; saved file retained" }
          val bytes = (payload / 2 * 2).toInt()
          if (bytes < 32) { check(part.delete()); continue }
          val wav = File(dir, "$index.wav")
          check(!wav.exists()) { "Conflicting saved audio; files retained" }
          RandomAccessFile(part, "rw").use { output ->
            output.setLength(44L + bytes); output.seek(0); output.write(wavHeader(bytes)); output.fd.sync()
          }
          check(part.renameTo(wav)) { "Could not recover saved audio" }
        }
      } finally { lock.release() }
    }
    private fun wavHeader(size: Int): ByteArray = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN).apply {
      put("RIFF".toByteArray()); putInt(size + 36); put("WAVEfmt ".toByteArray()); putInt(16)
      putShort(1); putShort(1); putInt(RATE); putInt(RATE * 2); putShort(2); putShort(16)
      put("data".toByteArray()); putInt(size)
    }.array()
    const val RATE = 16000
    const val CHUNK_BYTES = RATE * 2 * 30
    fun directory(root: File, owner: String, session: String): File {
      require(owner.matches(Regex("[A-Za-z0-9_-]{1,128}")) && session.matches(Regex("[A-Za-z0-9_-]{21}")))
      return File(root, "class-capture/$owner/$session")
    }
  }
  @Volatile private var running = false
  private var thread: Thread? = null
  private var recorder: AudioRecord? = null
  private var wake: PowerManager.WakeLock? = null
  var owner = ""; private set
  var session = ""; private set

  override fun onBind(intent: Intent?): IBinder? = null
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent == null) { stopSelf(); return START_NOT_STICKY }
    if (running) return START_NOT_STICKY
    owner = intent.getStringExtra("owner") ?: ""
    session = intent.getStringExtra("session") ?: ""
    val dir = directory(noBackupFilesDir, owner, session)
    check(dir.mkdirs() || dir.isDirectory)
    val manager = getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(NotificationChannel("class-recording", "Class recording", NotificationManager.IMPORTANCE_LOW))
    val launch = packageManager.getLaunchIntentForPackage(packageName)!!
    val pending = PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    val notification = android.app.Notification.Builder(this, "class-recording")
      .setContentTitle("Acharya is recording your class")
      .setContentText("Tap to return and stop recording")
      .setSmallIcon(android.R.drawable.ic_btn_speak_now).setContentIntent(pending).setOngoing(true).build()
    if (Build.VERSION.SDK_INT >= 29) startForeground(4102, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
    else startForeground(4102, notification)
    check(writer(dir).tryAcquire()) { "Microphone writer is still active" }
    instance = this
    running = true
    thread = Thread({ capture(dir) }, "AcharyaClassCapture").also { it.start() }
    return START_NOT_STICKY
  }

  private fun capture(dir: File) {
    var partial: File? = null
    var file: RandomAccessFile? = null
    var bytes = 0
    var index = 0
    fun finishChunk() {
      val output = file ?: return
      if (bytes > 0) {
        output.seek(0); output.write(wavHeader(bytes)); output.fd.sync(); output.close()
        check(partial!!.renameTo(File(dir, "$index.wav")))
        index++
      } else { output.close(); partial?.delete() }
      file = null; bytes = 0
    }
    try {
      val min = AudioRecord.getMinBufferSize(RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
      check(min > 0) { "Unsupported microphone format" }
      val audio = AudioRecord(MediaRecorder.AudioSource.MIC, RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, maxOf(min, 32000))
      recorder = audio
      check(audio.state == AudioRecord.STATE_INITIALIZED) { "Microphone initialization failed" }
      wake = (getSystemService(POWER_SERVICE) as PowerManager).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Acharya:ClassCapture").apply { acquire(2 * 60 * 60 * 1000L + 60_000) }
      audio.startRecording()
      check(audio.recordingState == AudioRecord.RECORDSTATE_RECORDING)
      File(dir, "started").writeText("started")
      val buffer = ByteArray(3200)
      val started = android.os.SystemClock.elapsedRealtime()
      while (running) {
        check(dir.usableSpace > 16 * 1024 * 1024) { "Not enough storage to continue recording" }
        check(android.os.SystemClock.elapsedRealtime() - started < 2 * 60 * 60 * 1000L) { "Two-hour recording limit reached" }
        if (Build.VERSION.SDK_INT >= 29) check(audio.activeRecordingConfiguration?.isClientSilenced != true) { "Microphone was interrupted by another app or call" }
        val count = audio.read(buffer, 0, buffer.size, AudioRecord.READ_BLOCKING)
        check(count > 0) { "Microphone capture interrupted" }
        var offset = 0
        while (offset < count) {
          if (file == null) {
            partial = File(dir, "$index.part")
            file = RandomAccessFile(partial, "rw").apply { setLength(0); write(ByteArray(44)) }
          }
          val size = minOf(count - offset, CHUNK_BYTES - bytes)
          file!!.write(buffer, offset, size); bytes += size; offset += size
          if (bytes == CHUNK_BYTES) finishChunk()
        }
      }
    } catch (error: Throwable) {
      // No class audio/text or credentials in logs. The UI reads this bounded error.
      runCatching { File(dir, "error").writeText(error.message?.take(200) ?: "Recording interrupted") }
    } finally {
      runCatching { finishChunk() }
      runCatching { file?.close() }
      runCatching { recorder?.stop() }; runCatching { recorder?.release() }; recorder = null
      runCatching { if (wake?.isHeld == true) wake?.release() }; wake = null
      running = false
      writer(dir).release()
      runCatching { File(dir, "stopped").writeText("stopped") }
      stopSelf()
    }
  }
  fun stopCapture() { running = false; thread?.join(3000); check(thread?.isAlive != true) { "Microphone is still stopping" } }
  override fun onDestroy() {
    running = false
    if (instance === this) instance = null
    super.onDestroy()
  }
}
