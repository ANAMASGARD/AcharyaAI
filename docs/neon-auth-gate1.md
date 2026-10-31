# Neon authentication migration — Gate 1 evidence

13 October 2026. **Blocked before application migration. No public release.**

The approved attachment replaces Clerk with Neon Managed Better Auth, but requires a signed Android native-authentication gate before removing Clerk. The current managed callback protocol does not pass that gate. See [primary-source research](neon-auth-feasibility-research.md).

## Work completed

- Created mobile branch `feat/neon-managed-auth-production` from `local-embeddings-gate1`, preserving all existing tracked and untracked work.
- Audited both repositories and the live Neon service using official documentation, CLI 6.3.0, management tools, and public authentication endpoints.
- Created a separate empty Neon project, **Acharya Auth Gate 1**, in the existing Acharya organization. It was not cloned from existing classroom or authentication data.
- Provisioned **managed** Better Auth on the test project. No self-hosted authentication server was created.
- No application dependencies, authentication UI, ownership records, migrations, provider keys, or production configuration were changed for this migration.
- The website remains unchanged, including its pre-existing untracked `app/.Rhistory`.

## Isolated resources

| Resource | Identifier |
| --- | --- |
| Organization | `org-damp-night-76499721` |
| Project | `bitter-waterfall-60827780` |
| Branch | `br-long-sound-b3192n7p` (`gate1`) |
| Database | `neondb` |
| Auth URL | `https://ep-floral-block-b33d6vmo.neonauth.c-4.ap-southeast-1.aws.neon.tech/neondb/auth` |

The existing `Acharya` project (`wandering-frost-72761340`) has a branch named `production`; Managed Auth is not enabled there. It was inspected, not modified.

The test project uses the minimum 0.25 CU configuration. An initial request with a 300-second suspension interval failed with HTTP 412; the account does not permit changing that interval. Creation succeeded with the platform default, returned as `suspend_timeout_seconds: 0`. Automatic suspension and Free-plan quota assumptions are therefore **not verified for this account**. The project remains available for investigation; no resource was deleted.

## Reproducible live results

| Probe | Result | What it establishes |
| --- | --- | --- |
| Auth `/ok` | HTTP 200 | Service reachable |
| Auth `/get-session` without credentials | HTTP 200, null session | Does not authenticate an anonymous caller |
| Auth `/.well-known/jwks.json` | HTTP 200 | Signing-key endpoint exists |
| Auth `/open-api/generate-schema` | HTTP 200 | Published managed endpoint contract accessible |
| Auth `/expo-authorization-proxy` without parameters | HTTP 404 | Required upstream Expo server route not exposed |
| Register `acharyaapp://` through managed trusted-domain API | HTTP 400 `VALIDATION_ERROR` | Exact error: `Scheme "acharyaapp" is not allowed; use http or https` |
| `adb devices -l` | No device | Physical Android tests unavailable |

The managed configuration initially has shared Google and shared email delivery. Magic links are disabled. No real OTP or email was requested, no test identity was created, and no OAuth session was completed. Brevo and production OAuth credentials were not configured. These results are preflight evidence, not a successful signed-app test.

An HTTPS Android App Link alone does not establish browser-to-native session transfer, secure persistence, or renewal. Do not replace this blocked protocol with an invented cookie relay or accept arbitrary credentials from a deep link. The supported Neon native session protocol must be established before continuing.

## Repository audit and later migration inventory

| Area | Current implementation | Retain or change after the gate |
| --- | --- | --- |
| Mobile startup/login | Clerk provider, secure token cache, native email screens, social hook | Retain until native gate passes; preserve screen appearance during later replacement |
| Recorder and AI | Clerk identity scopes recorder/hooks; direct user-owned provider calls | Retain capture/report contracts and BYOK; developer-funded Functions mode requires explicit user selection and quotas |
| Local history | SQLite reports use Clerk owner IDs and a recording-session foreign key | Never map identities by email; decouple remote report restoration from original audio/session dependency |
| Sync | Existing teaching-session metadata queue, not complete report sync | Implement one authenticated report outbox/cursor pipeline only after the new identity protocol passes |
| Website | Next.js/Clerk with existing API routes and separate data schema | Keep website; independently fix missing auth in paid routes, anonymous upload ownership, embedded admin fallback, and mock-success processing before public use |
| Native models | Existing unfinished embedding gate | Remains outside the production authentication/sync release |

Future target, **not yet implemented**:

```text
Expo + account-scoped SQLite
  -> Neon Managed Auth (native session protocol still blocked)
  -> Neon Functions (verified JWT + transactional operations)
  -> Neon PostgreSQL / Data API with RLS

User-owned keys -> selected AI provider directly
Optional developer-funded AI -> authenticated, quota-limited Functions
Vercel website -> legal / support / external deletion pages
```

## Commands and checks

Read-only repository inspection used `git status --short`, `git branch --show-current`, `git remote -v`, `git log -1 --oneline`, and targeted `rg`, `cat`, and `sed` reads. Documentation was fetched from Neon's official index and linked pages, upstream Better Auth, Context7, and the official npm registry.

```bash
git switch -c feat/neon-managed-auth-production
neon --version
neon me
neon neon-auth plugins list --project-id bitter-waterfall-60827780 --branch br-long-sound-b3192n7p --output json
adb devices -l
npm view @neondatabase/auth version dist.tarball exports peerDependencies dependencies --json
npm run check > .expo/neon-gate-baseline-check.log 2>&1
npx expo-doctor > .expo/neon-gate-doctor.log 2>&1
```

The npm registry reported `@neondatabase/auth@0.6.0-beta`. Its published tarball was inspected in memory, without installation. It exposes React/web/server adapters; its adapter type explicitly omits custom `plugins`. Its callback verifier handling uses browser `window.location`. The package README supplied by the user lists browser, Node, Edge and Bun compatibility; it does not demonstrate native SecureStore/session integration.

Management tools used: `list_projects`, `list_branches`, `get_neon_auth_config`, `create_project`, `provision_neon_auth`, and the rejected `add_auth_trusted_domain` request. Only the empty test project was provisioned; existing resources were read-only.

Baseline verification completed with exit code 0: `npm run check` passed typecheck, lint, **137/137 tests**, and Android/iOS/web export. Expo Doctor passed **21/21 checks**. These verify the retained application, not a Neon migration. No APK/AAB was built in this gate, and no physical-device, OTP, OAuth, SMTP, RLS or paid-provider test passed by implication.

## To resume / rollback

1. Obtain a supported Neon Managed Auth native integration contract addressing this exact scheme rejection and session handoff. Then test OTP, OAuth, magic links, restart, expiry and a protected request in a signed Android app.
2. Configure Brevo SMTP credentials and a verified sender domain securely in Neon; configure Google/Microsoft/GitHub credentials and tenant policy. Do not put credentials in this document, Git, or chat logs.
3. Connect a physical Android test device. Signing/Play Console access, publisher/support details and production domain ownership remain owner-controlled prerequisites.
4. Only after Gate 1 and the later authorization/SMTP/Functions gates pass, replace Clerk and migrate the app's identity contracts. Old Clerk-owned local data remains isolated unless a verified ownership mapping is explicitly implemented.

No application rollback is necessary: active login and data have not changed. Keep the test project isolated; removing it is a separate destructive action requiring authorization. Do not treat this branch or the prior APK as a production-ready Neon migration.
