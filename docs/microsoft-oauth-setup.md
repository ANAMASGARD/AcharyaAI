# Microsoft sign-in for Acharya

## Architecture and cost

Microsoft is a social OAuth connection managed by Clerk. The Expo app uses `oauth_microsoft`; the existing Neon Function verifies Clerk session tokens and enforces ownership. No Microsoft secret belongs in Neon database rows, public environment variables, or mobile bundles. Basic sign-in uses Entra ID Free; paid licenses, hosting, and billing upgrades are outside this setup. [Microsoft pricing](https://www.microsoft.com/en-us/security/business/microsoft-entra-pricing), [Clerk Microsoft setup](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/microsoft)

## Callbacks and security

- Production Microsoft Web callback: `https://clerk.superacharya.com/v1/oauth_callback`.
- Current Acharya development callback: `https://funny-duckling-5953.clerk.accounts.dev/v1/oauth_callback`.
- Native Clerk return: `acharyaapp:///`; this is not the provider Web callback.
- Support organizational and personal Microsoft accounts. Leave `acceptMappedClaims` false: Microsoft warns against enabling it on multitenant apps, despite the conflicting Clerk guide. [Microsoft manifest guidance](https://learn.microsoft.com/en-us/entra/identity-platform/reference-app-manifest)
- Treat optional `xms_edov` claims as unproven until real tokens/Clerk verification demonstrate their behavior. Microsoft describes the claim as domain verification; do not substitute it for arbitrary account ownership checks. [Optional claims](https://learn.microsoft.com/en-us/entra/identity-platform/optional-claims-reference)
- An incomplete Microsoft signup needing an email continues the existing Clerk signup with email entry and an OTP. The app must not activate its session before verification or merge identities itself by email.

## Feature gates and development identities

`EXPO_PUBLIC_MICROSOFT_AUTH_ENABLED` defaults to false. The signed candidate builder accepts an explicit true value for validation builds. Clerk's provider configuration is a separate control; disabling an app flag alone does not disable OAuth through the web/Account Portal.

The existing local `.env` uses an older Clerk development instance. Its key and data are preserved. Validation of the current Acharya instance uses temporary publishable-key overrides, not a silent identity migration. Expo Go disables app-owned native OAuth redirects.

## Credentials and rotation

Credentials are to be held by Clerk and an owner-only backup outside this checkout, at `~/.local/share/acharya/microsoft-oauth-production.json`. Directory permission: 0700; file permission: 0600. Never paste the secret into chat, command arguments, screenshots, or tracked source. Record the six-month expiry in this private backup and rotate at least 30 days before expiration. The old credential should only be revoked after the replacement succeeds in Clerk. [Clerk credential expiry guidance](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/microsoft)

## Validation status

- Implementation: Microsoft follows Facebook on native and web sign-in/sign-up; cancellation, independent gating, pending email verification, and session activation are covered by focused tests.
- `npm run check`: passed TypeScript, lint, 163 tests, and Android/iOS/web exports.
- Expo Doctor: 21/21 passed.
- Azure CLI 2.91.0 installed from Microsoft's signed repository. Owner device-code authentication succeeded; Default Directory has no paid Entra SKU.
- Created dedicated Acharya AI registration (`89d249e5-4097-4d68-a9a4-d7525d03f767`) in the verified directory. Uses authorization-code flow, the two Web callbacks, token version 2, standard identity/Graph User.Read scopes, optional email claims, and `acceptMappedClaims: false`. `xms_edov` has not been enabled or proven.
- Custom credentials saved and read back in current Clerk development and production; development is enabled. Production was enabled after the owner requested an APK with Microsoft available for on-device testing; live owner verification remains pending. Private backup created with mode 0600. Secret expires April 14, 2027; rotate by March 15, 2027.
- Real Microsoft callbacks, verified email, installed Android return/session restoration, and Microsoft-session Neon authorization: pending.
- Production provider: enabled for the owner-requested APK test. Android device was not connected during this run. No hosted app deployment, Google Play submission, or Git publication has been performed. The owner will test the new APK directly rather than completing the web test first.

## Rollback

Disable `connection_oauth_microsoft.enabled` in the affected Clerk instance (preview the patch first), read back the disabled state, and set the app's public Microsoft flag false for future builds. Preserve Google/Facebook/email config and existing users. Revoke only the Microsoft credential created for this app after confirming its identity; do not delete unrelated Azure applications or tenants.

## NextDNS diagnosis and optional telemetry

On October 14, direct queries to the local NextDNS resolver returned `0.0.0.0` / `::` for Acharya's production Clerk hostnames, while a public resolver returned valid Clerk/Cloudflare addresses. NextDNS allowed the shared Clerk service hostnames and the current development hostname. This establishes a domain-specific production DNS block; the exact blocking rule/list requires the owner's NextDNS query-log reason. The domain's official registry record reports registration on October 13, 2026, making newly registered-domain filtering a hypothesis, not a confirmed cause. [Registry RDAP](https://rdap.verisign.com/com/v1/domain/SUPERACHARYA.COM)

The Expo root provider now passes `telemetry={false}` to disable optional SDK usage telemetry. Clerk CLI telemetry is also disabled and its status was verified. This does not turn off necessary authentication traffic or Clerk's server-side security/session processing. [Clerk telemetry documentation](https://clerk.com/docs/guides/how-clerk-works/security/clerk-telemetry)

Keep Private DNS enabled and add only `clerk.superacharya.com` and `accounts.superacharya.com` to the active NextDNS profile's Allowlist if the owner chooses to permit Acharya login. The optional `clerk-telemetry.com` domain can remain blocked. The application does not bypass Private DNS, hardcode DNS answers, weaken TLS, or alter NextDNS settings. Disabling telemetry cannot change an upstream DNS domain classification.

## Version 1.0.3 update and local data

Build 4 retains `com.acharya.app`, the existing release signing key, production Clerk identity, native callback scheme, SecureStore service `acharya.byok.v1`, and `byok.v1.<owner-hash>.<provider>` entry names. Sign-out/session cleanup now retains account-isolated encrypted credentials, as requested by the owner; key removal and account deletion still erase them. Do not uninstall or clear app storage before installing this APK as an update. [Expo SecureStore persistence](https://docs.expo.dev/versions/latest/sdk/securestore/#data-persistence)

EmbeddingGemma 2 stays in Android's persistent `noBackupFilesDir/embedding-model/embeddinggemma-2-text-270m.litertlm`. The directory, filename, model revision, and checksum have not changed. Startup checks an existing verified file rather than redownloading it. This storage is retained by an in-place update but is not a backup or a transfer to another device.

Automated regression tests cover fresh-runtime credential reads, account isolation, sign-out/session key retention, explicit deletion, and reuse of an existing verified model. Physical-device update/retention and Microsoft login are still owner tests.

## Delivered validation build

Version 1.0.3 / Android build 4: `releases/Acharya-AI-1.0.3.apk` (installable) and `.aab` (not submitted). Matching SHA-256 files and `Acharya-AI-1.0.3-verification.json` accompany the artifacts.

The final APK signature is valid and matches the previous signed APK; the package remains `com.acharya.app`. The final bundle contains Microsoft sign-in/signup and the key-retention notices. Known server credentials were absent from all APK entries when scanned as UTF-8 and UTF-16. ZIP 16 KB page alignment passed; this is packaging proof, not a physical 16 KB runtime test. `npm run check` passed TypeScript, lint, 163 tests, and all platform exports on the delivered source.

The owner explicitly chose on-device APK testing instead of the unfinished web login. Microsoft is enabled in production for that test. Physical Microsoft callback/verified-email/session restoration/Neon authorization and in-place update retention remain owner validation steps. Keep NextDNS enabled with the two required login domains allowlisted, or use automatic DNS for the test; telemetry opt-out does not remove the upstream domain block.
