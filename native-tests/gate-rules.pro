# Test entry points only: leave the remaining release application subject to R8.
-keep class com.acharya.embeddings.EmbeddingContract { public *; }
-keep class com.acharya.embeddings.LocalEmbeddingEngine { public *; }
-keep class expo.modules.sqlite.AcharyaSqliteConnection { public *; }
-keep class expo.modules.sqlite.AcharyaSqliteConnection$Companion { public *; }
-keep class com.acharya.embeddings.GateWorker { public *; }
# Instrumentation lives in a separate APK. R8 cannot see its WorkManager calls
# when optimizing the target app, including Operation.getResult().
-keep class androidx.work.** { *; }
