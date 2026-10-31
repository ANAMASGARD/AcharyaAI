# Native release follow-up

Checked 12 October 2026. These are source-backed build fixes to try, not evidence
that the native worker passed Gate 1. No build or device execution was performed
for this research.

## R8 and Kotlin metadata

Keep the existing Kotlin 2.3.20 compiler pin for Expo/Pika compatibility. The
LiteRT-LM dependency contains Kotlin 2.4 metadata, so the shrinker needs a separate
update: Google's compatibility table specifies **R8 9.1.29** for Kotlin 2.4.
[Android compatibility table](https://developer.android.com/build/kotlin-support).

Merge the following into the existing `pluginManagement` block through
`withSettingsGradle`, preserving Expo's included builds and other configuration:

```groovy
buildscript {
  repositories {
    maven {
      url = uri('https://storage.googleapis.com/r8-releases/raw')
      content { includeModule('com.android.tools', 'r8') }
    }
    google()
    mavenCentral()
  }
  dependencies { classpath('com.android.tools:r8:9.1.29') }
}
```

This is the override location documented by
[R8 upstream](https://r8.googlesource.com/r8/+/refs/heads/main/README.md).
The official archive's
[9.1.29 Maven POM](https://storage.googleapis.com/r8-releases/raw/com/android/tools/r8/9.1.29/r8-9.1.29.pom)
was fetched successfully. The archive is an upstream-documented Maven source;
restrict it to the R8 module. Do not silence metadata warnings or replace AGP,
Expo, and Pika together merely to hide this incompatibility. Confirm the actual
resolved R8 version and absence of the warnings in a fresh minified build.

## Missing SuspendToFutureAdapter

The existing release log identifies `androidx.test.core.view.ViewCapture` as the
caller. `SuspendToFutureAdapter` was introduced in concurrent-futures **1.2.0**;
its class is in **concurrent-futures-ktx**, not concurrent-futures. This matches
inspection of the cached official 1.2.0 and 1.1.0 JARs. The 1.1.0 KTX JAR lacks
the class. The installed AndroidX Test Core 1.6.1 POM still requests KTX 1.1.0.
[AndroidX release notes](https://developer.android.com/jetpack/androidx/releases/concurrent),
[API reference](https://developer.android.com/reference/androidx/concurrent/futures/SuspendToFutureAdapter).

Add to the gate's test dependencies:

```groovy
androidTestImplementation 'androidx.concurrent:concurrent-futures-ktx:1.3.0'
```

1.3.0 is the documented stable version and includes the required bridge. Inspect
`releaseAndroidTestRuntimeClasspath` resolution, then rebuild the release test
APK. Do not apply the generated `-dontwarn` rule: it only suppresses the missing
class. If the class is already present in the resolved application dependency
but stripped from its minified output, preserve the referenced bridge in the
gate's app keep rules as well; only do this if the new build evidence establishes
that case. Current app mapping/usage files contain no bridge entry.

## Model contract reverified

The pinned Hugging Face metadata still identifies the requested CPU/GPU text
artifact as **164626432 bytes** (about 165 decimal MB), not a multimodal model:

- Repository: `litert-community/embeddinggemma-2-text-270m-litert-lm`.
- Revision: `9be6e8b90982095dc05c2bd162e4b954ee4dbac7`.
- Filename: `embeddinggemma-2-text-270m.litertlm`.
- SHA256: `2d079ee2f6f066b1f368e8d7c819f55214eaef1d0513b312321901f30ab286fb`.

[Revision metadata](https://huggingface.co/api/models/litert-community/embeddinggemma-2-text-270m-litert-lm/revision/9be6e8b90982095dc05c2bd162e4b954ee4dbac7?blobs=true),
[pinned model card](https://huggingface.co/litert-community/embeddinggemma-2-text-270m-litert-lm/blob/9be6e8b90982095dc05c2bd162e4b954ee4dbac7/README.md).
The model card specifies 270M text-only, INT4 per-channel QAT, and Apache 2.0.
Google's [LiteRT embedding guide](https://developers.google.com/edge/litert-lm/embedding_models)
directs users to this LiteRT Community model collection. Keep the pinned revision,
length, hash, FLOAT32 activations, and existing versioned prefix/MRL contract.
Download size is not peak runtime RAM; a 4 GB phone remains a hardware test gate.

The original gate still requires real debug and minified-release worker execution
before React initialization. A successful APK build cannot establish offline
inference, background recovery, numerical quality, or device memory suitability.

## Regular APK compatibility

The normal minified release also failed with SDK 57's default Kotlin 2.1.20:
`kotlinx.io.RawSink` referenced missing `kotlin.MustUseReturnValues` and the old R8
could not parse dependency metadata. That annotation is [available since Kotlin
2.3](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/-must-use-return-values/).
The Kotlin 2.3.20 / R8 9.1.29 configuration is therefore now shared by normal and
gate Android builds through `with-android-build-compatibility.cjs`. It does not
change the Expo SDK, React Native, JavaScript dependencies, iOS runtime or Expo Go.
The separate gate plugin only configures the isolated test app and dependencies.
