# Clerk + Neon production backend research

Verified against current first-party documentation on 13 October 2026. This is capability research and a local source review, not a deployed-service or signed-device acceptance result. No cloud resource was changed for this research. The decision is Clerk authentication, Neon PostgreSQL/Data API/Functions, SQLite first, existing BYOK, and no further Managed Better Auth migration.

## Hosting and budget

Neon Functions are real, branch-scoped HTTPS backend deployments on Node.js 24, available on every plan. Supported regions currently include `aws-us-east-1`, `aws-us-east-2`, `aws-eu-central-1`, and `aws-ap-southeast-1`. JS/TS entry points export a `fetch(Request): Response | Promise<Response>` object or a default async handler. Hono is optional; an additional web framework is unnecessary for Acharya's small router. This provides a managed backend without hosting a separate Next.js application. [Functions overview](https://neon.com/docs/compute/functions/overview)

Free-plan monthly allowances currently include 10 active Capacity-Hours, 400 waiting Capacity-Hours, and 1 million invocations. Limits apply both across the account and per project; network egress shares the public transfer allowance. These are service allowances, not proof of this account's remaining quota or a promise of unlimited free operation. Developer-funded AI remains disabled under the user's ₹0 budget decision. [Neon plans](https://neon.com/docs/introduction/plans#functions)

Each isolate can process concurrent requests and can restart. Module-level pools/caches are appropriate but do not provide durable idempotency, quotas, or locks. The default account-wide concurrency limit is 100 invocations; excess calls return 429 with `Retry-After`. Time-to-first-byte and `waitUntil` work are limited to 15 minutes. Persist deletion/retry jobs in PostgreSQL; Functions are not a durable job queue. [Runtime limits](https://neon.com/docs/compute/functions/reference/runtime-limits)

## Authentication boundary

Functions have no automatic authentication gate. Neon Auth's injected JWKS variables are irrelevant when Clerk is the selected provider: use the correct Clerk production configuration explicitly. Verify every private request before parsing expensive content or querying private data; derive the owner from verified identity. [Function authentication](https://neon.com/docs/compute/functions/authentication)

Clerk's supported backend entry point is `createClerkClient(...).authenticateRequest(request, { acceptsToken: 'session_token', ... })`, followed by checking `isAuthenticated` and reading `toAuth()`. It requires a publishable key and either the backend secret or JWT public key. Keep session tokens distinct from API, OAuth, and M2M tokens. A token signed by a development instance must not be valid in production. [Clerk authenticateRequest](https://clerk.com/docs/reference/backend/authenticate-request)

Use bearer tokens for native requests and obtain a current token for each retry. Set an explicit authorized-party allowlist, but do not reject legitimate native tokens solely because they have no browser origin: Clerk documents that the `azp` check may be skipped when the claim is absent. Check the observed native flow, exact issuer, algorithm, expiry, and not-before claims. Do not log tokens. [Clerk JWT verification](https://clerk.com/docs/guides/sessions/manual-jwt-verification)

Deleting/revoking an account needs a database deletion barrier in addition to signature verification, because a previously issued short-lived token can remain cryptographically valid. This barrier must cover direct Data API reads as well as Function writes. This is an application design requirement, not a feature automatically supplied by JWT validation.

## Data API and RLS

Neon explicitly supports Clerk as an external JWT issuer without Managed Better Auth. Configure the production Clerk JWKS URL copied from Clerk; its documented shape is `https://<clerk-domain>/.well-known/jwks.json`. An audience is optional for Clerk unless the issued token actually has one; if configured, Neon rejects tokens without the matching audience. Never invent a token template/audience merely to match a guess. [External authentication](https://neon.com/docs/data-api/custom-authentication-providers)

The Data API is PostgREST-compatible and works with standard HTTP; neither `@neondatabase/auth` nor a custom auth server is required. It maps validated JWTs to PostgreSQL roles, and `auth.user_id()` extracts the JWT `sub`. PostgreSQL grants and RLS are the entire authorization layer. Enabling the API through the Console can automatically grant broad access to the public schema; therefore provision with default grants disabled and expose only deliberately authorized tables or a narrow API schema. Verify grants and policies afterward. [Data API overview](https://neon.com/docs/data-api/overview), [Access control](https://neon.com/docs/data-api/access-control)

For private rows, enable RLS and use both `USING` and `WITH CHECK` ownership predicates. Deny anonymous access and keep internal quota, idempotency, tombstone, and deletion-job tables outside the exposed schema. Do not grant direct mutation privileges that bypass the sync protocol. Avoid security-definer views/functions unless their owner, fixed search path, grants, and explicit ownership checks are reviewed. These are implementation recommendations based on PostgreSQL's authorization model.

Functions connecting by SQL need a restricted runtime role without `BYPASSRLS`, separate from the migration owner. Injected `DATABASE_URL` is a convenience, not proof that its role is restricted. With self-verified tokens, set `request.jwt.claims` transaction-locally together with the query, then use the same RLS identity helper. Never carry per-user state between pooled requests. [Driver RLS transaction pattern](https://neon.com/docs/serverless/serverless-driver-configuration#using-transactions-with-jwt-self-verification)

The exact upstream `pg_session_jwt` implementation was inspected at commit `937a79a65e596d916295d078b3a82ab421291665`: `auth.user_id()` reads the string `sub` from JSON in **`request.jwt.claims`**, not `request.jwt.claim.sub`, when no `pg_session_jwt.jwk` is configured. `auth.uid()` attempts UUID conversion and is unsuitable for Clerk's string IDs. If a JWK is configured, the fallback is disabled and the verified `auth.jwt_session_init(jwt)` flow applies instead. Inspect the actual installed extension/version and current configuration before relying on either mode. [Pinned implementation](https://github.com/neondatabase/pg_session_jwt/blob/937a79a65e596d916295d078b3a82ab421291665/src/lib.rs#L333-L372)

For the documented claims fallback, the Function verifies Clerk first and then executes `SELECT set_config('request.jwt.claims', $1, true)` with serialized verified claims in the same database transaction as its work. Data API supplies its own verified claims. Both paths can therefore use `auth.user_id()` ownership policies consistently. The extension explicitly warns that any SQL user can modify this setting: never expose the runtime database credentials, arbitrary SQL execution, or an RPC that lets clients set trusted identity. RLS with self-asserted claims is defense in depth behind a trusted Function, not protection against compromise of its database credential. [Pinned extension contract and warning](https://github.com/neondatabase/pg_session_jwt/blob/937a79a65e596d916295d078b3a82ab421291665/README.md)

## Atomic sync approach and current code findings

The HTTP driver supports non-interactive transaction batches. Use `Pool`/`Client` and `drizzle-orm/neon-serverless` for interactive transactions, or execute the conflict/idempotency/revision work in one SQL function invoked within a bounded transaction. Node.js 24 has native WebSocket support; first inspect the installed driver's requirements before adding `ws`. [Neon driver](https://neon.com/docs/serverless/serverless-driver)

Local files inspected during research have these release blockers:

- `src/server/db/client.ts` selects `drizzle-orm/neon-http`, while `src/server/sync/push.ts` calls an interactive `db.transaction(async tx => ...)`.
- The base-revision check is outside that transaction and not repeated under a row/account lock. Concurrent updates can pass the same stale check.
- Duplicate acknowledgements look up the request's `recordId` rather than a stored operation result, and the lookup is not owner-scoped. An existing same-user operation ID paired with someone else's record ID can become a disclosure path unless effective database RLS blocks it.
- `src/server/sync/apply-change.ts` can clear `deletedAt` on update, allowing a stale upload to revive a tombstone.

Recommended transaction boundary: acquire a per-owner lock; check the account deletion barrier; check an idempotency key bound to owner, target, and payload hash; return its stored acknowledgement on retry; check ownership and base revision; apply one change; allocate an account-monotonic revision while holding the lock; save the immutable acknowledgement/change log; commit. Pull reads only committed revisions. Failed/lost responses must retry safely without repeating paid AI. Test two-account isolation, concurrent operations, lost acknowledgements, tombstones, and interrupted account deletion. These steps are application design recommendations, not claims that current code already implements them.

## Documented CLI and deployment contract

Use the current `neon` CLI, with explicit project and branch IDs to avoid operating on the preserved development or isolated auth-gate project. These command templates are documented; they were not executed as mutations during this research. [Functions CLI](https://neon.com/docs/cli/functions), [Data API CLI](https://neon.com/docs/cli/data-api)

```sh
neon functions list --project-id <project> --branch <branch>
neon functions deploy acharya --src <entry.ts> --runtime nodejs24 --project-id <project> --branch <branch>
neon functions get acharya --list-env-variables --project-id <project> --branch <branch>

neon data-api create --project-id <project> --branch <branch> --database <database> --auth-provider external --provider-name Clerk --jwks-url <verified-clerk-jwks-url> --add-default-grants=false --db-schemas <reviewed-api-schema>
neon data-api get --project-id <project> --branch <branch> --database <database>
neon data-api refresh-schema --project-id <project> --branch <branch> --database <database>
```

Function slugs are permanent lowercase alphanumeric identifiers, 1–20 characters. Default deploy bundles the entry with esbuild and waits for deployment completion. Inspect CLI help for the installed version before invoking deployment. A CLI success is not an auth/security acceptance test.

Neon injects branch-specific database variables, and custom variables can be supplied per deployment. User-defined variable updates merge; unmentioned variables carry over, and an explicit empty value removes one. For secrets, prefer `neon.ts` environment references with `neon deploy --env <ignored-restricted-env-file>` rather than literals in shell history/process arguments. Only declared values are deployed. Never call `neon env pull` into the mobile root without controlling its destination: it writes database credentials locally. [Environment variables](https://neon.com/docs/compute/functions/environment-variables)

Custom domain configuration is supported:

```sh
neon functions domains register api.superacharya.com --slug acharya --project-id <project> --branch <branch> --output json
neon functions domains list --project-id <project> --branch <branch> --output json
```

Use the returned CNAME target, DNS-only in Cloudflare. If CAA records exist, they must authorize Let's Encrypt. The custom domain's active status does not verify certificate issuance; make a real HTTPS request. Both the custom hostname and native Neon URL remain reachable and need identical auth. Registering the API hostname does not configure Clerk's separate production domain. [Custom domains](https://neon.com/docs/compute/functions/custom-domains)

## Remaining verification

This research did not verify the account's live region/quotas, provision a production database, apply migrations, deploy Functions, change DNS, inspect a real Clerk native JWT, exercise cross-account Data API access, or test a signed phone installation. These remain acceptance gates before a closed-testing release candidate can be described as working end to end. Preserve the isolated Managed Auth test project and existing development data.
