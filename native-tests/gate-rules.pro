# Test entry points only: leave the remaining release application subject to R8.
-keep class com.acharya.embeddings.EmbeddingContract { public *; }
-keep class com.acharya.embeddings.LocalEmbeddingEngine { public *; }
-keep class expo.modules.sqlite.AcharyaSqliteConnection { public *; }
-keep class expo.modules.sqlite.AcharyaSqliteConnection$Companion { public *; }
-keep class com.acharya.embeddings.GateWorker { public *; }
