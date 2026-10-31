# Neon Managed Auth native feasibility

Checked 13 October 2026. Primary-source research for the mandatory native migration gate; this is not a successful Android authentication test.

## Decision

**Keep Clerk until Gate 1 passes.** Neon Managed Auth supports the requested authentication methods, but the reviewed official contract does not establish an Expo native session/OAuth integration. Its supported frameworks are web frameworks. The required upstream Expo server plugin is absent from the published managed plugin list. This is a concrete integration gap, not proof that every possible native integration is impossible. Do not work around it by inventing a credential relay, copying browser cookies into deep links, or self-hosting Better Auth, which the requested architecture excludes. [Neon roadmap](https://neon.com/docs/auth/roadmap), [managed plugins](https://neon.com/docs/auth/guides/plugins), [upstream Expo integration](https://www.better-auth.com/docs/integrations/expo)

## Verified capabilities and limits

| Capability | Evidence and boundary |
| --- | --- |
| Managed service | Neon documents Managed Better Auth as generally available. Next.js, Vite/React, React Router and TanStack Router are listed; Expo/React Native is not. Absence is a documentation/support boundary, not a tested server rejection. [Roadmap](https://neon.com/docs/auth/roadmap) |
| Email OTP | Managed `emailOtp.sendVerificationOtp({ type: 'sign-in' })` and `signIn.emailOtp` are documented. Codes are generated and verified by Neon; their expiry/rate limits are server concerns. New-account behavior still needs a live configuration test. [OTP guide](https://neon.com/docs/auth/guides/plugins/email-otp) |
| Magic links | Supported, disabled by default, with configurable expiration and `disable_sign_up`. Browser verification creates a session and redirects; the guide does not demonstrate transfer into a native app's secure session store. [Magic Link guide](https://neon.com/docs/auth/guides/plugins/magic-link) |
| Google, GitHub, Microsoft | The management API explicitly accepts all three (plus Vercel), with `microsoft_tenant_id`. This is stronger evidence for Microsoft than the narrower prose OAuth guide. Credentials, actual tenant behavior and Android callbacks remain unverified. [OAuth management API](https://api-docs.neon.tech/reference/addbranchneonauthoauthprovider) |
| Custom SMTP | Branch email-provider settings include SMTP host, port, username/password and sender identity. Brevo can supply these, but configuration support is not delivery or native sign-in proof. [Email provider API](https://api-docs.neon.tech/reference/updateneonauthemailprovider) |
| JWT to Functions/Data API | `authClient.token()` retrieves a short-lived JWT from an established session; the JWT does not solve initial native session establishment or persistent renewal. Neon documents EdDSA signatures and 15-minute access tokens. [JWT guide](https://neon.com/docs/auth/guides/plugins/jwt) |
| Custom app scheme | Trusted-domain documentation describes HTTP(S) origins and wildcard hosts. It does **not** explicitly establish that `acharyaapp://` is forbidden or supported. Check the managed API and actual native callback, rather than extrapolating. [Trusted domains](https://neon.com/docs/auth/guides/configure-domains) |

## SDK and server-plugin evidence

`npm view @neondatabase/auth version dist-tags --json` returned `0.6.0-beta` as `latest`; no dependency was installed. The official repository at commit `df11df8da7f38e39275be6869c52ae127a290aea` has React, vanilla, Next.js and server exports, with no Expo export. Its adapter options omit `plugins`, and the constructor replaces plugins with a fixed supported list, excluding `expoClient`. Thus adding an upstream Expo client plugin to these managed adapter options is not an exposed integration. [Package manifest](https://github.com/neondatabase/neon-js/blob/df11df8da7f38e39275be6869c52ae127a290aea/packages/auth/package.json), [adapter implementation](https://github.com/neondatabase/neon-js/blob/df11df8da7f38e39275be6869c52ae127a290aea/packages/auth/src/core/adapter-core.ts)

The upstream Better Auth Expo guide requires **both** a server `expo()` plugin and client `expoClient()` with SecureStore. The server plugin handles `expo-origin`, has a `/expo-authorization-proxy` endpoint, and adjusts successful non-HTTP OAuth/magic-link/verification callbacks for the native client. Installing only a client package cannot supply this server behavior. [Guide](https://www.better-auth.com/docs/integrations/expo), [server plugin](https://github.com/better-auth/better-auth/blob/1d95ebf3fe9a788d9b6566495e0016e60d1fd7fd/packages/expo/src/index.ts), [proxy route](https://github.com/better-auth/better-auth/blob/1d95ebf3fe9a788d9b6566495e0016e60d1fd7fd/packages/expo/src/routes.ts)

The official `neon-auth-react-native-demo` is a **legacy Stack Auth** template with a separate Next.js backend; it is not evidence that current Managed Better Auth works with native Expo. [Template README](https://github.com/neondatabase/neon-auth-react-native-demo)

## Live isolated-project gate result

The coordinating agent provisioned an empty test project (`bitter-waterfall-60827780`, branch `br-long-sound-b3192n7p`) and reported these actual API responses on 13 October 2026:

- Managed auth `/ok`, `/get-session`, `/.well-known/jwks.json`, and `/open-api/generate-schema` returned HTTP 200.
- `/expo-authorization-proxy` returned HTTP 404, unlike the upstream Expo server plugin's registered route.
- Adding the app's existing `acharyaapp://` trusted callback scheme returned HTTP 400 `VALIDATION_ERROR`: `[body.domain] Scheme "acharyaapp" is not allowed; use http or https`.
- The live managed plugin configuration listed organization, magic link, phone, email and OAuth options, with no Expo plugin option.

**Gate 1 is blocked for the existing native callback approach.** An HTTPS Android App Link might pass domain validation, but that alone would not transfer the browser's managed session securely into native SecureStore or prove renewal. No supported alternative native handoff has been established. These are isolated-environment observations, not a signed Android sign-in result or a claim that all future native protocols are impossible. Retain Clerk and request a supported native integration from Neon before removing it.

## Functions are available

Current Neon documentation describes deployed branch-scoped Functions, Node.js 24, public HTTPS invocation, custom environment variables and injected database/auth settings. Functions themselves do not authenticate callers: handlers must verify the correct JWT issuer/signature/expiry and authorize each resource. This research does not prove this account's quotas or an actual deployed handler. [Overview](https://neon.com/docs/compute/functions/overview), [environment variables](https://neon.com/docs/compute/functions/environment-variables), [authentication](https://neon.com/docs/compute/functions/authentication)

Functions may restart; process memory is not durable. `waitUntil` is limited to 15 minutes and is explicitly not a durable background-job system. Sync/deletion retries therefore require persisted database state, even with Functions hosting. [Runtime limits](https://neon.com/docs/compute/functions/reference/runtime-limits)

## Evidence required to unblock Gate 1

1. Establish an officially supported managed native client/server protocol, including supported custom callback registration and secure session persistence. A managed plugin listing plus a safe GET of `/expo-authorization-proxy` without query parameters can help distinguish exposed protocol from assumptions; do not initiate OAuth or alter auth state merely to detect the endpoint.
2. On an isolated project with real configured email/social delivery, test a signed Android installation: OTP/new account, OTP/existing account, each social callback, magic link, restart, expiration/renewal, revoke, logout and account switch.
3. Use the resulting session to obtain a JWT and reach a user-scoped protected Function. A successful browser sign-in, SDK import, build, SMTP test or unsigned HTTP probe is insufficient.
4. If Neon cannot provide a supported native protocol, report the blocker and preserve Clerk. Do not silently substitute self-hosted Better Auth or a custom session bridge.

This research task changed only this document. The isolated project provisioning and callback validation above were performed by the coordinating agent; no production auth or application code was changed by this research task.
