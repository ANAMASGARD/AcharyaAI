# Compact Android releases

Version 1.0.7 keeps the same features and storage contracts as 1.0.6. The size
changes affect release packaging, not recording, authentication, model inference,
account keys, SQLite records, or cloud sync.

The previous universal APK contained four sets of native processor libraries
(about 139 MB combined), and code/resource shrinking was disabled. The compact
release enables R8 shrinking and compresses the JavaScript bundle. Native shared
libraries remain uncompressed for Android to load directly, avoiding extra
extracted copies on the device.

The local builder now generates a standalone APK for each processor type, plus
a universal APK and an Android App Bundle containing all architectures:

- `arm64-v8a`: use this smaller APK on the tested realme RMX5110 and modern ARM64 phones.
- `armeabi-v7a`, `x86`, `x86_64`: separate APKs for the corresponding devices.
- `universal`: larger fallback containing every processor type.
- `.aab`: Play distribution artifact; Google Play selects device-specific files.

These packages do not bundle the downloaded EmbeddingGemma weights. Its existing
verified download stays in the same device storage location. Install an update
over the existing application; uninstalling or clearing storage deletes app data.
Existing hardware requirements for local inference still apply.

Build with the existing private signing material outside the repository:

```sh
EXPO_PUBLIC_MICROSOFT_AUTH_ENABLED=true node scripts/build-closed-testing.cjs
```

`plugins/with-compact-android-release.cjs` persists the settings across Expo
prebuild. `acharya.splitApks=true` enables standalone ABI APKs in the local builder;
the App Bundle retains every ABI. All variants use the same package, version code,
and signing certificate, so they support in-place updates. Versioned artifacts
and SHA-256 sidecars are written to `releases/`.
The builder runs AAB packaging with splits disabled, then APK packaging with
splits enabled: AGP's resource shrinker cannot combine those tasks in one run.

References: [Android APK splits](https://developer.android.com/build/configure-apk-splits),
[R8 shrinking](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization),
[native library packaging tradeoff](https://developer.android.com/guide/practices/page-sizes).

## Verified artifacts — 15 October 2026

The ARM64 APK is **69,753,361 bytes (69.75 MB / 66.52 MiB)**, versus
181,032,586 bytes for 1.0.6: **61.47% smaller**. The universal fallback is
163,494,841 bytes; use the ARM64 file for the tested phone.

`npm run check` passed type checking, zero-warning lint, all 182 tests, and
Android/iOS/web exports. Final lint and JavaScript syntax checks also passed
after separating the packaging commands.

All five APKs passed signature/update-certificate, package/version, unchanged
permission/service manifest, ZIP integrity, 16 KB ZIP alignment, and known
server-secret checks. Every per-ABI native library was retained; LiteRT-LM,
Hermes, and SQLite shared libraries match the previous release byte-for-byte.
Every Metro image/font/audio resource matches its previously packaged bytes.
Persistent WorkManager worker names and the LiteRT-LM JNI API names are preserved.
The AAB signature/integrity and all four architectures were verified separately.

Results are saved in `releases/Acharya-AI-1.0.7-verification.json`. ZIP alignment
does not establish runtime proof on a 16 KB page device. These packaging checks
also do not replace full recording, model inference, or provider login tests.

The ARM64 APK was installed over 1.0.6 on the RMX5110; the installed APK hash
matches the verified artifact. The account session restored, automatic sync stayed
on, all 8 vectors remained ready with 0 pending, and the model still showed
"Downloaded and verified". Two visible provider cards retained "Saved locally"
without a key-read error. Profile, model, key settings, and recorder navigation
loaded. No recording or fresh model inference was triggered during this packaging
smoke test. The earlier isolated native test packages were also removed.
