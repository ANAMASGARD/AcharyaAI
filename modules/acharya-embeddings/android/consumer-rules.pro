# v0.18.0 AAR does not ship consumer rules. JNI looks up response/input and other
# API classes by their binary names; keep the small Kotlin API (native code unchanged).
-keep class com.google.ai.edge.litertlm.** { *; }

-keep class com.rnwhisper.** { *; }
