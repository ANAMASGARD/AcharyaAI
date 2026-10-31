# Teacher community

The Home/community screens keep the Acharya layout from the reference app. Shared
records now live behind the authenticated Neon Function; earlier device-only
previews remain under **Local drafts**, and require an explicit copy and publish.
The reference checkout in `/home/linux/Downloads/acharya-app` is not modified.

## Storage and access

Clerk remains the sole identity authority. The Function verifies Clerk JWTs before
community dispatch. The migration adds relational records for shared posts,
comments, votes, saves, private groups, members, messages, media, blocks, reports,
and cleanup. The existing restricted database login calls a validated dispatcher;
mobile callers never receive database credentials or select a service role.

All signed-in teachers can read the main feed. Group content, member lists, and
media require membership. Invitation codes are case-sensitive: copy/paste them.
Removing a member revokes reads and writes and rotates the invitation code.
Owners can remove group messages and members. Moderator IDs come only from the
server configuration; reporting/blocking does not grant moderator privileges.
Blocking is reversible through the Blocked teachers screen.

Client requests use the existing `EXPO_PUBLIC_NEON_FUNCTION_URL` and Clerk tokens.
See [environment setup](community-environments.md) for Expo Go, test APKs, hosted
verification, and the separate production backend.
Zustand caches and outstanding requests are scoped to the current account. Draft
submission IDs are persisted before sending, and failed submissions keep their
content/photos. Shared content is not an offline publication queue. Chat polls
at five-second intervals only while its screen is focused and the app is active.
Home statistics come from saved class reports; unimplemented metrics display an
em dash rather than a fabricated result.

## Apply and deploy only after staging validation

1. Apply `neon/migrations/0004_community.sql` using migration credentials to an
   isolated test database first. Never put those credentials in the app.
2. Configure the server values described in `.env.example` and
   [ImageKit operations](community-imagekit.md). Deployment maps private
   `ACHARYA_*` release variables in `neon/neon.ts`. Use isolated synthetic files and development teacher accounts
   for live verification before enabling production.
3. Deploy the Function with the schema in place before distributing the new UI.
   Account deletion now also removes community content and queues photo cleanup.
4. Configure the Neon schedule for `/internal/community-cleanup-trigger` every
   five minutes, and pin its ID in `ACHARYA_COMMUNITY_NEON_TRIGGER_ID`. The adapter
   requires edge attestation and the matching recent schedule envelope. The
   separate `/internal/community-cleanup` endpoint requires the server-only
   `COMMUNITY_CLEANUP_SECRET` Bearer credential. Neither route accepts a teacher
   token. It claims at most five jobs per run; monitor backlog and drain additional
   batches when needed. Allow at least four minutes for a cleanup invocation.
   See [ImageKit operations](community-imagekit.md) for the Neon-only trust boundary.
5. Verify private ImageKit delivery, quota failures, and two-teacher interactions
   on staging and a physical Android phone. No production deployment, OTA update,
   Play submission, or billing change is performed by repository validation.

## Checks

`npm run check` covers strict TypeScript, lint, runtime tests, and exports for all
platforms. The SQL integration test runs only when
`COMMUNITY_TEST_DATABASE_URL` points to a disposable local PostgreSQL database:

```sh
COMMUNITY_TEST_DATABASE_URL=postgresql://localhost:5432/acharya_community_test node --test tests/community-backend.test.cjs
```

That opt-in test requires migrations 0001 and 0004 already applied to a disposable
database, writes synthetic fixture records, and is not intended for a production
database. Provider unit tests use injected ImageKit responses; they do
not establish live upload, private CDN configuration, retention completion, or
native camera/library behavior. Keep those acceptance results separate.
