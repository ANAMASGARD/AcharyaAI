# Separate test APK calls these helpers; the remainder of the release is minified normally.
-keep class com.acharya.embeddings.ClassRecordingService$Companion { public *; }
-keep class com.acharya.embeddings.ClassRecordingService { public static *; }
-keep class com.acharya.embeddings.InferenceCoordinator { public *; }
