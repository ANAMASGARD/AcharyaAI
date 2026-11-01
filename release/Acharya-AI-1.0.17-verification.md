# Acharya AI 1.0.17 / Android build 18

Signed ARM64 APK: `Acharya-AI-1.0.17-prisma-v3-arm64.apk`.

Both app and backend Gnani STT adapters explicitly select `prisma-v3.0`, keeping `en-IN` and `transcribe`. The existing 1.0.16 APK also contains the Prisma v3.0 selection string. This build includes the current workspace changes, including offline reports.

Validation: TypeScript passed; 27 focused direct-AI and recording-backend tests passed; Android assembleRelease and release lint passed; APK signature verified; package com.acharya.app, version 1.0.17/code 18 confirmed; ARM64 only; ZIP 16 KB alignment passed; bundled endpoint and prisma-v3.0 string verified. SHA-256 is in the adjacent sidecar.

Initial minification exhausted the default 2 GB Java heap. Retry succeeded using ACHARYA_GRADLE_JVM_ARGS='-Xmx4096m -XX:MaxMetaspaceSize=1024m'. Build logs: /tmp/acharya-1.0.17-build.log and /tmp/acharya-1.0.17-build-retry.log.

Not installed or microphone/Gnani-tested on a physical device during this build. No backend deployment or store publication performed.
