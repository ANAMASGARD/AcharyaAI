# Community photos: ImageKit operations

The mobile application authenticates to the community API with Clerk. The API alone
uses `@imagekit/nodejs`; Neon stores relationships and image metadata, while ImageKit
holds the original bytes. No client upload credentials or permanent delivery URLs
are returned.

## Required configuration

Set these **server-only** variables on the deployed API:

```dotenv
IMAGEKIT_PRIVATE_KEY=private_key_from_ImageKit_dashboard
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_account_id
COMMUNITY_CLEANUP_SECRET=at_least_32_characters_of_random_scheduler_secret
COMMUNITY_NEON_TRIGGER_ID=trigger_id_from_Neon_schedule
```

For a Neon deployment, fill `ACHARYA_IMAGEKIT_PRIVATE_KEY`,
`ACHARYA_IMAGEKIT_URL_ENDPOINT`, and `ACHARYA_COMMUNITY_CLEANUP_SECRET` in the
ignored `neon/.env` file. The deployment configs map them to the runtime names
above. `ACHARYA_COMMUNITY_NEON_TRIGGER_ID` pins the Neon schedule created for
that environment; it differs between testing and production.
`ACHARYA_COMMUNITY_MODERATOR_IDS` is optional. See
[deployment environment setup](community-environments.md#deploy-the-api).

Use an ImageKit account on its Free plan, without paid upgrades or paid feature
activation. Verify current account limits in its dashboard before rollout. No
provisioning, billing changes, or live uploads are performed by repository checks.

In ImageKit's URL endpoint security settings, enforce signed URLs for **all image
requests**. Do not configure public named transformations that grant access to
private classroom/community files. Uploads explicitly set `isPrivateFile: true`,
but ImageKit also permits named transformations for private files; the endpoint
security setting is part of the access-control deployment requirement.

## API and limits

`POST /community/uploads` uses a raw binary body with a matching `Content-Type` and
`X-Community-Image-Id` (a stable 21-character NanoID). Optional
`X-Community-Group-Id` restricts the image to that group. The API ignores the
original filename and chooses its own safe deterministic path. Files are limited
to 5 MiB and JPEG, PNG, WebP, or GIF; HEIC, SVG, and remote URLs are rejected. The
client should select/convert a supported photo explicitly. At most four image
attachments are accepted per published post or chat message.

The API bounds upload bytes and elapsed request time, checks actual magic bytes
against declared MIME, then checks decoded image dimensions, size, type, private
status, exact path, and a content-hash tag from persisted ImageKit metadata. Very
large decoded images (over 100 million pixels) are rejected. These checks do not
constitute content moderation or malware scanning.

`GET /community/images/:imageId?width=360|900|1600` rechecks current account and
content/group access, then returns `{ url, expiresAt }`. The URL expires in five
minutes; width defaults to 900. Refresh URLs through this authenticated endpoint,
including after a failed expired image load. Do not persist the URL as an image
identifier. Mobile image caches may retain downloaded pixels; signing prevents
future network access, not screenshots or already-downloaded copies.

ImageKit preserves originals. Feed/chat transforms request width, quality 85, and
automatic format. Original files may contain location/EXIF metadata; signed
transformed delivery does not imply that the original stored file was sanitized.

## Retries and cleanup

Neon commits a reservation containing the immutable content hash and schedules an
orphan-cleanup intent before calling ImageKit. Retrying the same image ID and bytes
reconciles the deterministic ImageKit path instead of generating another upload or
file version (`useUniqueFileName: false`, `overwriteFile: false`). Different bytes
under the same ID must be rejected by Neon. A response lost after upload can be
recovered by finding the exact path and validating the hash tag.

Registration rechecks active account/group membership after provider work. If that
check or the DB write fails, the reservation remains recoverable. Unattached photos
expire 24 hours after their latest authenticated upload attempt. Pending retries
renew that deadline before calling the provider. Post/message/account deletion must queue cleanup before
removing ownership/attachment records. Claims use a five-minute lease token;
completion and retries must match that token. Cleanup resolves a path even if the
file ID was never registered, treats a provider 404 as success, and requests cache
purges for original and all three served widths. Cache purges are asynchronous.
Provider errors and credentials are never saved to cleanup logs.

Deleting an unattached reservation delays its first sweep by two minutes, beyond
the bounded provider-upload work. Every failed upload/registration also invokes an
internal original-owner cleanup notification, even after account tombstoning. For
deleting images it reopens previously completed cleanup and fences an older worker's
acknowledgement; for an active owner's pending draft it leaves the stable retry ID
usable. If that notification fails, the upload returns a retryable finalization
error. This covers a provider upload completing after an early deletion sweep.

`cleanupCommunityMedia(clerkUserId, limit)` is a bounded authenticated-owner worker.
The mobile backend also exposes `POST /internal/community-cleanup` for a trusted
scheduler, with `Authorization: Bearer <COMMUNITY_CLEANUP_SECRET>`. Clerk sessions
and moderator identities cannot authorize this endpoint. It processes at most
five due jobs per invocation, with at most two jobs running concurrently, across **all** accounts, including deleted accounts
and users who never open the app again. Configure the deployment's scheduler and
secret before enabling uploads, and size its frequency to clear the observed
backlog. The implementation has bounded provider calls; allow up to 240 seconds
per cleanup invocation and avoid configuring a shorter host execution deadline.
Neon deployments use `POST /internal/community-cleanup-trigger`. The Neon edge
strips client-supplied `X-Neon-*` headers; the adapter requires its invocation
attestation, the configured trigger ID, a version-1 schedule envelope, and a recent
scheduled timestamp before invoking the same bounded worker. This adapter must
only run behind Neon Functions, never on a generic HTTP host. Both environments
use an API-managed schedule every five minutes. Deployments preserve these
triggers; recreate and update the pinned ID if the trigger is replaced. The direct
Bearer endpoint remains available for authorized maintenance. Do not expose a
privileged sweep through an unauthenticated HTTP endpoint.

Network/capacity errors retain drafts and return a generic retryable failure. They
never enable an upgrade or silently publish a post without its photos. Alert on
cleanup backlog/oldest job, repeated capacity failures, and provider/account
configuration errors, without recording signed URLs or classroom content.

## Hosted verification recorded on 22 October 2026

Both testing and production Functions were deployed with server-only ImageKit
settings and separate pinned cleanup triggers. ImageKit's **Restrict all requests**
image setting was saved and verified. Both schedules are enabled every five
minutes; public attempts to forge Neon trigger headers were rejected.

The opt-in hosted photo test passed against the isolated testing API with three
synthetic Clerk teachers. It exercised public and private photo posts, chat photos,
message/post retries, nonmember and removed-member denial, unsigned delivery denial,
actual five-minute CDN expiry, and authorized URL renewal. Account deletion queued
all synthetic images; scheduled runs completed all five cleanup jobs without a
retry, with no pending jobs or community files remaining at ImageKit. The
production schedule also completed an empty sweep successfully. Real production
teacher photo interactions and physical Android camera/library flows remain
unverified.

`npm run check` passed: TypeScript, lint, 237 passing tests, six opt-in tests skipped,
and Android/iOS/web export. The separately enabled hosted media test passed.
Expo Doctor passed 20/21 checks, reporting seven existing Expo patch mismatches.
No configured private credentials were found in the Android, iOS, web, or release
staging bundles. No app build, OTA publication, or Git delivery was performed.

## Verification before production

Run `node --test tests/community-media.test.cjs tests/community-cleanup.test.cjs`
and `npm run check`. For the optional PostgreSQL race tests, set
`COMMUNITY_TEST_DATABASE_URL` to a disposable database with migrations applied and
run `node --test tests/community-media-postgres.test.cjs`. These tests cover a
pending-upload retry near expiration, cleanup during uncommitted publication,
and deletion after an account tombstone. Then use an
isolated synthetic files plus two Clerk development teachers and a private group to
verify upload/retry, nonmember denial, five-minute expiry, unsigned/named URL
denial, deletion/cache purge, and orphan cleanup. Test real photo posts and chat
on a physical Android phone. Unit tests use an injected provider and do not prove
hosted ImageKit permissions, billing limits, CDN expiry, or device behavior.

Official API contracts consulted:

- [Node SDK source and file upload examples](https://github.com/imagekit-developer/imagekit-nodejs)
- [Upload API](https://imagekit.io/docs/api-reference/upload-file/upload-file)
- [Private files and signed URLs](https://imagekit.io/docs/media-delivery-basic-security)
- [List and search assets](https://imagekit.io/docs/api-reference/digital-asset-management-dam/list-and-search-assets)
- [Pricing](https://imagekit.io/plans/)
- [Neon trigger attestation](https://neon.com/docs/compute/functions/triggers/overview)
- [Neon scheduled triggers](https://neon.com/docs/compute/functions/triggers/schedule)
