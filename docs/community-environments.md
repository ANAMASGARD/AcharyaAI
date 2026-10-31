# Online community environments

Expo Go, development builds, and standalone preview APKs call the same hosted
testing API. Production and staging release builds call the production API.
Both services verify Clerk tokens and use restricted database credentials.

| Client | Clerk instance | Neon project / branch | API origin |
| --- | --- | --- | --- |
| Local Expo Go, EAS development, EAS preview APK | Development (`pk_test_`) | `shy-king-73809963` / `br-steep-recipe-b3ujia3w` | `https://br-steep-recipe-b3ujia3w-acharya.compute.c-4.ap-southeast-1.aws.neon.tech` |
| EAS production/staging, local signed release | Production (`pk_live_`) | `bitter-hall-80986973` / `br-icy-resonance-b3camzf0` | `https://br-icy-resonance-b3camzf0-acharya.compute.c-4.ap-southeast-1.aws.neon.tech` |

Testing uses an empty, separate Neon project. No production records were copied.
The original development database and auth feasibility project are preserved.
The testing project's unused direct Data API table grants are revoked; mobile
access goes through the authenticated Function. Clerk remains the identity
authority in both environments.

## Run on Expo Go or an APK

The local ignored `.env` contains the development publishable key and testing
`EXPO_PUBLIC_NEON_FUNCTION_URL`. Restart Metro after configuration changes:

```sh
npx expo start --clear
```

Open the project in Expo Go and use email authentication. The community does not
require a custom native module or local API server. Two development teachers see
the same shared feed; group messages require joining the same invitation-only
group. Reports still follow the separate, optional report-sync consent setting.

EAS `development` and `preview` have the matching public Clerk key and API URL
configured. Their build profiles explicitly select those environments and include
the same public key/origin so initial config resolution works before EAS downloads
remote variables. No secret belongs in `eas.json`. For an
installable internal APK:

```sh
npx eas-cli build --platform android --profile preview
```

Production and staging select EAS's production environment. Local signed releases
use `scripts/release-environment.cjs`, which supplies the same production endpoint.
An existing installed bundle will not acquire new client code or configuration
from a backend deployment: rebuild it, or deliver a separately authorized compatible
OTA update. No APK/AAB build, OTA publication, or Play submission is triggered by
these setup instructions. Build configuration rejects a missing, insecure, or
credential-bearing API URL.
Checks and staging exports clear Metro's transform cache when switching between
testing and production configuration. The staging export also verifies that its
Android bundle contains the configured public API URL and Clerk key.

Expo inlines public environment variables when bundling; server credentials must
never be configured with `EXPO_PUBLIC_`. See [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)
and [EAS environments](https://docs.expo.dev/eas/environment-variables/usage/).

## Deploy the API

Testing deploys with `neon/community-testing.ts`; production retains `neon/neon.ts`.
Private deployment credentials live outside the checkout in the owner's restricted
`~/.local/share/acharya/` directory:

```sh
neon deploy --config neon/community-testing.ts \
  --env /home/linux/.local/share/acharya/neon-community-testing.env \
  --project-id shy-king-73809963 --branch br-steep-recipe-b3ujia3w --no-env-pull

neon deploy --config neon/neon.ts \
  --env /home/linux/.local/share/acharya/neon-release.env \
  --project-id bitter-hall-80986973 --branch br-icy-resonance-b3camzf0 --no-env-pull
```

To fill in deployment variables yourself, use the ignored `neon/.env` file,
created from `neon/.env.example`. It lists the exact `ACHARYA_*` names consumed by
both deployment configs. Fill only the matching testing or production auth/database
section, plus the optional media/moderation settings you want to configure. Keep
separate copies if testing and production need different ImageKit accounts.

Replace the command's `--env /home/linux/.local/share/acharya/...` argument with
`--env neon/.env` when using that file. Editing it does not change the hosted
Function until you deploy. Keep `--no-env-pull` so the CLI does not overwrite the
mobile `.env`. Existing private deployment files remain available; media credentials are server-only.

Use reviewed migrations before deploying a handler that needs them. Never overwrite
the mobile `.env` with an automatically pulled database connection string. Keep
development and production issuers separate. Browser requests use explicit CORS
origins from the server's `CLERK_AUTHORIZED_PARTIES`; native bearer requests do not
require an Origin header. Additional browser testing origins need explicit server
configuration and redeployment.

## Hosted verification

The opt-in hosted test targets only the isolated testing origin, requires a Clerk
development secret, creates three synthetic development identities without sending
email, and deletes their data/accounts through the deployed deletion endpoint:

```sh
COMMUNITY_HOSTED_TEST_URL=https://br-steep-recipe-b3ujia3w-acharya.compute.c-4.ap-southeast-1.aws.neon.tech \
  node --env-file=.env --test tests/community-hosted.test.cjs
```

It verifies authentication, shared posts/comments, concurrent votes, saves,
idempotent retries, invitation-only groups, chat pagination, member removal, and
moderator denial. `npm run check` skips hosted writes unless explicitly enabled.
Automated HTTP tests do not establish camera/library behavior or a physical phone's
end-to-end UI behavior.

For the opt-in hosted photo checks, prefix the same command with
`COMMUNITY_HOSTED_MEDIA_TEST=1`. It uploads synthetic PNG files through the real
backend and checks feed/group/chat attachments, private membership, unsigned
request denial, actual five-minute CDN expiry, and renewed authorized delivery.
Account deletion queues those files for the scheduled cleanup. Allow about six
minutes. It never publishes real teachers' drafts.

ImageKit credentials are in the private server deployment files. The local
`neon/.env` contains media settings for manual configuration; use the complete
private environment-specific file for deployments. ImageKit originals are private
and the account restricts unsigned image requests. Neither API keys nor cleanup
credentials belong in the Expo `.env` or EAS public variables. Testing and
production use different Neon cleanup trigger IDs. See
[ImageKit operations](community-imagekit.md).

The official ImageKit admin and DAM MCP connections are authenticated; devtools
needs no authentication. Eight official ImageKit skills are installed globally.
Restart Codex to load newly installed MCP tools/skills. MCP OAuth access does not
replace the application's server API key. No paid plan or automatic upgrade was
enabled.
