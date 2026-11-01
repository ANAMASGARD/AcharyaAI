package com.acharya.embeddings

/** The reservation covers model loading and release, not only individual inference calls. */
object InferenceCoordinator {
  private val monitor = Object()
  private var embedding = false
  private var stt: String? = null
  private var waiting = 0
  fun acquire(token: String, cancelled: () -> Boolean = { false }) = synchronized(monitor) {
    waiting++
    try {
      while (embedding || stt != null) {
        if (cancelled()) throw java.util.concurrent.CancellationException("Inference cancelled")
        monitor.wait(100)
      }
      if (cancelled()) throw java.util.concurrent.CancellationException("Inference cancelled")
      stt = token
    } finally { waiting-- }
  }
  fun release(token: String) = synchronized(monitor) {
    check(stt == token) { "Inference reservation mismatch" }
    stt = null
    monitor.notifyAll()
  }
  fun sttRequested(): Boolean = synchronized(monitor) { waiting > 0 || stt != null }
  fun <T> withoutStt(action: () -> T): T = synchronized(monitor) {
    check(stt == null && waiting == 0) { "A speech model is in use" }
    action()
  }
  fun <T> withEmbedding(action: () -> T): T? {
    synchronized(monitor) {
      if (embedding || waiting > 0 || stt != null) return null
      embedding = true
    }
    try { return action() }
    finally { synchronized(monitor) { embedding = false; monitor.notifyAll() } }
  }
}
