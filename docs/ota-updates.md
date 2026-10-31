# Acharya OTA operations

OTA uses Expo EAS Update, project `@animint2/acharya-app`
(`b9e06999-942a-4f0a-8429-633865958f1b`). The first supported binary is
1.0.8, Android versionCode 9. Earlier builds cannot receive OTA.

## Safety and compatibility

Updates check at startup without waiting for a download. A completed update
activates on a later cold launch (QA may require two cold launches). Never call
`reloadAsync` during recording, transcription, generation or sync. No restart UI,
new analytics or crash SDK is installed. Offline/DNS failures use the embedded or
last cached working bundle. Keep Expo anti-bricking protections enabled.

Runtime policy is `appVersion`. Every native dependency, native module, config
plugin, permission, SDK or native configuration change requires a new app version,
versionCode and store binary. Review native diffs before every OTA; runtime strings
alone cannot detect a forgotten version bump. Never force an incompatible runtime.
Keep local data changes backward compatible so rollback remains safe. This change
introduces no storage migrations and does not erase keys, models or queued reports.

## Build channels

EAS profiles specify explicit channels and environments. `staging` extends
`production` and uses the same production public environment, with its own channel.
Local builds must embed the header too; eas.json is not read by Gradle:

```sh
EXPO_PUBLIC_MICROSOFT_AUTH_ENABLED=true node scripts/build-closed-testing.cjs
ACHARYA_UPDATE_CHANNEL=staging EXPO_PUBLIC_MICROSOFT_AUTH_ENABLED=true node scripts/build-closed-testing.cjs
```

Production filenames remain unchanged; staging artifacts include `-staging`.
Both use the existing signing certificate and package. Install with `adb install -r`;
never uninstall or clear app data to work around an install failure.

## Environment and manual publication

Use EAS `production` environment for both staging and production OTA exports.
The shared release-environment.cjs helper deliberately excludes inherited public settings from older deployments. To add a new public setting, update that shared allowlist for both build and export. Match the binary's public values: `EXPO_PUBLIC_APP_VARIANT=production`, live Clerk
publishable key, Neon Function URL, Google/Facebook/Microsoft enabled flags, and
any configured API/legal/support URLs. Public variables are visible in bundles;
never add provider keys, DATABASE_URL, Clerk secret or signing credentials.
Set `EXPO_NO_DOTENV=1` to avoid accidentally exporting development .env values.

Check `eas update --help` before use. Publish Android only for this rollout:

```sh
EXPO_PUBLIC_MICROSOFT_AUTH_ENABLED=true node scripts/export-ota-staging.cjs
EXPO_NO_DOTENV=1 ACHARYA_UPDATE_CHANNEL=staging npx eas-cli@latest update --channel staging --environment production --platform android --skip-bundler --input-dir .expo/ota-staging --message "Describe tested JS fix"
```

Before production: pass checks, review native compatibility and Google policies,
test staging on the real phone, verify persistence and recording, and obtain
explicit production publication authorization. Promote the exact tested update
with `eas update:republish --group <tested-group-id> --destination-channel production`
(check current command help). Never enable automatic publishing on Git pushes.
Record commit, group/update IDs, channel, runtime, environment and QA outcome.

For a bad update, inspect `eas update:rollback --help`, then use
`eas update:rollback <latest-group-id> --platform android --message "Reason"`.
Rollback must preserve compatibility with already-written device data. Test it on
staging first. Expo recovery is a safeguard, not a guarantee against all crashes.

## Privacy, cost and Play policy

Expo receives update-delivery requests and operational metadata (such as IP,
platform, runtime/channel and update identifiers); this is not zero network
telemetry. Do not send classroom content, BYOK keys or Clerk tokens in update
headers. Disclose Expo update delivery in the published privacy policy before
public release. HTTPS update traffic uses u.expo.dev and Expo asset/CDN hosts;
DNS filtering failures must not be bypassed in code.

Use Free allowances; do not activate paid subscriptions. Quota exhaustion must
leave the installed bundle usable. Free currently includes 1,000 OTA MAU;
end-to-end OTA signing is a paid feature and is not claimed here. Existing Android
APK/AAB signing remains in place.

OTA is restricted to compliant JavaScript fixes and static assets supporting the
reviewed app. Native executable code (DEX/JAR/.so), permissions and native features
must go through Play. Never hide functionality from reviewers or use OTA to bypass
review. Google approval is not guaranteed merely by using Expo.

Official sources:
- https://docs.expo.dev/versions/v57.0.0/sdk/updates/
- https://docs.expo.dev/eas-update/getting-started/
- https://docs.expo.dev/eas-update/deployment/
- https://docs.expo.dev/eas-update/error-recovery/
- https://expo.dev/pricing
- https://support.google.com/googleplay/android-developer/answer/9888379?hl=en

## Setup validation record (2026-10-16)

A no-functional-change Android baseline was published to staging only:
- Runtime: `1.0.8`
- Group: `00f9ea8d-9803-4f62-a205-910f8e646bee`
- Android update: `01a145e8-6975-7417-ae60-b6f00bd9fc29`
- Source: working tree based on `32f27bdf`; changes were not committed/pushed.

Publication success does not establish on-device download/activation or recording
safety. USB disconnected during setup, so those checks require a connected phone.
No production OTA was published and no store submission was performed.
