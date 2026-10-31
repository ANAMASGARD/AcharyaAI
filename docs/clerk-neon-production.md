# Clerk + Neon release implementation

13 October 2026. **Internal candidate only; public release is not approved.**

This decision supersedes the Neon Managed Better Auth migration. Clerk remains the sole identity authority. Neither Managed Auth nor self-hosted Better Auth is needed. Preserve the isolated `Acharya Auth Gate 1` project (`bitter-waterfall-60827780`) and original development database (`wandering-frost-72761340`).

## Configured services

- Clerk application `Acharya`: `app_3Kd7B91lMniy1wtJIYFGksi3k1L`.
- Production instance: `ins_3Kd7POLAKVucgVPprZ1R2eBFFfL`, domain `superacharya.com`.
- Native API enabled; Android `com.acharya.app` registered with the package-registration signing certificate. Google Play's eventual distribution certificate must also be registered if different.
- Email codes and links enabled at Clerk; passwords disabled. The existing custom native screens use **email codes**. Clerk documents that native email links require native AuthView; they are not implemented by these JavaScript screens.
- `user_model.first_name.enabled` must be true because the signup form submits `firstName`. This was initially disabled in production, causing `first_name is not a valid parameter`. It was enabled and verified through the live Frontend API on 13 October 2026. The non-secret signup contract is saved in `clerk.production.json`; preview it with `clerk config patch --app app_3Kd7B91lMniy1wtJIYFGksi3k1L --instance prod --file clerk.production.json --dry-run` before applying future configuration changes.
- Development and production accounts are separate. Existing Expo Go development users must sign up and verify their email in production before they can sign in there. This does not migrate their development reports or change development data.
- Google production OAuth disabled until the owner's Google Cloud credentials and consent configuration are supplied. The deploy CLI may still flag Google because development has it enabled. The verified production configuration is the authority. No SMS or MFA implementation was added.
- DNS-only CNAMEs at Cloudflare: clerk, accounts, clkmail, clk._domainkey, clk2._domainkey with the exact targets returned by Clerk. Existing root/www website DNS preserved.
- Neon release project `bitter-hall-80986973` (`Acharya Release`), branch `br-icy-resonance-b3camzf0` (`main`), Singapore, PostgreSQL 17.
- Neon Data API uses `https://clerk.superacharya.com/.well-known/jwks.json`, exposes `acharya`, and was provisioned without default grants or Neon Auth.
- Function `acharya`: `https://br-icy-resonance-b3camzf0-acharya.compute.c-4.ap-southeast-1.aws.neon.tech`.
- Custom function domain `api.superacharya.com` is active. HTTPS requests without a valid token return structured HTTP 401 responses. This candidate keeps the verified native Neon endpoint as its public API URL.

## Data and authentication

`neon/functions/mobile/index.ts` verifies the Clerk signature, expiry, exact issuer, session ID, user ID, and any present authorized-party claim before database work. Missing browser `azp` is accepted for native sessions. No owner supplied in a payload is trusted.

Migration credentials and the restricted `acharya_login` credential are separate. The Function explicitly uses the restricted credential and sets `acharya_runtime` plus a transaction-local owner. It does not use a database owner's bypass privileges. This is a trusted-server boundary: database credentials must never reach the client. Data API separately uses its verified claims, RLS, and read-only grants. Internal account state and direct report mutations are not granted to its authenticated role.

Migrations live in `neon/migrations`, independently from legacy Expo server tables. Provision an empty `acharya` schema, enable Data API (to create `auth.user_id()` and roles), then apply migrations in order. Create a NOINHERIT/NOBYPASSRLS login, grant it `acharya_runtime`, and store the credential outside the checkout. No original development migrations/data were altered remotely.

Reports are immutable in this milestone. The saved SQLite report itself is the durable queue entry until an acknowledgement is persisted. Uploads are idempotent by report ID and canonical content digest. Conflicting content is retained locally and reported. The SQL operation locks an account row before allocating a revision, so commit order cannot skip a lower in-flight revision. Rate limiting is enforced per account in SQL. No timestamps or tokens are used as sync identities.

Settings offers account-scoped, default-off consent and manual retry. A foreground pass runs after reconnect and every 30 seconds while the app is active; each pass is bounded. Pending work survives restart. Every request obtains a current Clerk token. Disabling sync, switching account, backgrounding, or signing out cancels in-flight work; fences precede local writes. The OS does not guarantee background scheduling, and this code does not claim continuous background sync.

Only structured feedback, notes and class metadata sync. No raw transcript, audio URI/blob, provider key or embedding is included. Restored history creates a metadata-only recording parent to satisfy the existing SQLite foreign key, with zero chunks and no recording/AI job. Calendar uses the same local history. Signing out removes keys/chat drafts but retains account-scoped class reports; account deletion removes them.

The Function commits an account tombstone and deletes cloud reports before requesting Clerk deletion. Retries cannot resurrect data. A failed Clerk deletion leaves the account blocked and the delete operation retryable. **Clerk Dashboard/portal deletions still require a verified user.deleted webhook and an operational retry/reconciliation process before public release.** The external deletion website also remains a release gate. Do not claim deletion is complete across all paths yet.

Developer-funded AI and subscriptions remain disabled; no private AI key was uploaded. BYOK provider calls remain unchanged. Native embedding work is outside this release gate.

## Deployment and signing

`neon/neon.ts` references secrets through environment variables. Use a restricted env file outside the checkout:

```bash
neon deploy --config neon/neon.ts --env /path/to/private-release.env --project-id bitter-hall-80986973 --branch main --no-env-pull
```

Its variables are `ACHARYA_RELEASE_CLERK_SECRET_KEY` and `ACHARYA_RUNTIME_DATABASE_URL`. Never paste their contents in chat or commit them. The original development `.env` was preserved. Release builds include only the public Clerk key, public Function URL and feature switches. Public configuration is necessarily in the mobile bundle; secrets are not.

`node scripts/build-closed-testing.cjs` prepares Android and builds a signed APK/AAB using the existing private keystore under `~/.local/share/acharya/signing/com.acharya.app/`. The password is passed through the build environment, not source code or command arguments. Output is in the ignored `releases/` directory. The script does not upload or publish an app. This local signing setup does not configure EAS-hosted signing credentials.

## Verification recorded on 13 October 2026

- `npm run check`: passed, including 141 tests and Expo exports.
- Expo Doctor: 21/21 checks passed.
- Clerk production DNS, SSL and mail status: complete; JWKS endpoint responds over HTTPS. The wizard still reports Google OAuth pending; production Google is disabled.
- Restricted database login: transactional push/pull, duplicate acknowledgement, content conflict, cross-account isolation, deletion tombstone and denied DDL checked with rolled-back test transactions.
- Live Function: missing and forged bearer tokens rejected. Data API denies anonymous reads. Actual native session-token tests remain pending.
- Signed local APK/AAB built successfully with Java 17: `releases/Acharya-AI-closed-testing.apk` and `.aab`. Package `com.acharya.app`, version 1.0.2 / code 3, target SDK 36, non-debuggable.
- APK signature verified against registered SHA-256 `28:3A:27:20:6F:94:E1:ED:2D:A4:9F:C0:A8:A0:F8:42:42:28:76:D7:AB:01:88:A7:C2:43:68:8D:B1:3F:E7:33`. AAB JAR signature verifies; self-signed certificate and ZIP entry-order warnings are not Play upload verification.
- Both artifacts contain the intended public production Clerk key and Neon endpoint. Scan against seven known local server-secret values and Clerk secret-key patterns found no matches. All 50 packaged 64-bit native libraries in each artifact meet 16 KB ELF segment alignment; APK ZIP alignment check passed. This does not replace a 16 KB runtime test.
- Connected RMX5110 currently has a debug-signed Acharya installation. Replacing it with this certificate requires uninstalling that app and deleting its local data; no uninstall was performed without approval.

## Startup network failure observed on the test phone

The first installed release stayed at the authentication spinner. Device logs showed Clerk client/environment requests failing. Android Private DNS was configured for NextDNS; `clerk.superacharya.com` resolved to loopback (`127.0.0.1`) on the phone and to a sinkhole address on the workstation. A public DNS query returned Clerk's real addresses, and a TLS-verified request using that result returned HTTP 200 from `/v1/environment`. The exact NextDNS blocking rule requires inspecting that profile's query log; it has not been established.

The root layout now shows a connection explanation and a Retry button after 12 seconds instead of waiting silently forever. Retry reloads the app without deleting its data. No DNS override is embedded in the app, and the phone's Private DNS settings were not changed. Allowlist the domain in the user's DNS profile, or use an unblocked connection, before testing real OTP delivery.

`npm run check` passed after this change. Both signed artifacts were rebuilt and passed the secret/configuration scan. The APK was installed successfully with `adb install -r` over the existing release, preserving data. The revised blocked-network error screen still needs a foreground phone check. The owner subsequently removed the DNS block and confirmed successful email signup after the first-name configuration fix.

## Remaining release gates

- Confirmed by the owner on 13 October 2026: after the DNS block and disabled first-name field were corrected, production signup delivered the email code, verification succeeded, and the installed Android app opened successfully. This is user-confirmed device evidence, not an automated end-to-end test.
- Still to verify on the installed release: subsequent sign-in, session restoration, expiry, offline history, two-account isolation, sync across two installations, deletion and provider BYOK processing.
- Data API authenticated claims and all RLS grants tested using actual production native JWTs; malformed/forged/missing tokens must fail.
- Clerk webhook deletion/retries, external deletion page, monitored support and confirmed legal publisher.
- Google OAuth only after its credentials and signed callback pass. Magic links only through a supported native flow.
- Play signing/distribution certificate, target SDK and 16 KB native library compatibility; applicable closed testing and reviewer access.
- Review cloud plan quotas, backups/restore, tombstone retention and alerts. ₹0 funded AI is not a promise that unlimited hosting is free.

See `clerk-neon-production-research.md` for current official references. Automated checks are not evidence of a completed Play-installed end-to-end test.
