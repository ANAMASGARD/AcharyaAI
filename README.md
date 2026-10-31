> Current release architecture: Clerk Production + Neon Functions/Data API/PostgreSQL. See [deployment and release gates](docs/clerk-neon-production.md). The old Managed Auth experiment is stopped; Vercel is not the mobile API backend.

# AcharyaApp

Expo Router app for Android, iOS, and web, using Expo SDK 57 and React Native 0.86.

## Development

```bash
npx expo start
```

Scan the QR code with **Expo Go compatible with SDK 57**, with your phone and
computer on the same Wi-Fi. Use email sign-in in Expo Go; Google/Facebook sign-in
requires a development build. On a fresh checkout, run `npm ci` once and configure
the Clerk publishable key in `.env` as described below. Provider features need
internet access and your saved API keys; they do not need a separate AI backend.

On-device EmbeddingGemma and native background indexing require a custom native
build and are not available in Expo Go. Normal startup does not load the native
gate or download a model. The opt-in [native gate](docs/native-embedding-gate.md)
is a separate test workflow and remains unverified on-device.
See Expo's [startup guide](https://docs.expo.dev/get-started/start-developing/),
[OAuth limitation](https://docs.expo.dev/guides/authentication/), and
[native-code limitation](https://docs.expo.dev/workflow/customizing/).

Routes live in `src/app/`; shared components, hooks, and theme constants live
outside the route directory. Use `npx expo install` for SDK-compatible packages.

App branding and icons are configured in [`app.config.ts`](app.config.ts) (same
`acharya-app` slug, EAS project, and icon assets as the production repo under
`~/Downloads/acharya-app`). If Expo Go still shows an old blue icon, remove the
stale **AcharyaApp** entry from Recent, clear Expo Go cache, and run
`npx expo start --clear`.

## Bring your own API keys

Open **Profile → App settings → AI API keys** to save Gnani, OpenAI-compatible,
Gemini, and Claude keys in encrypted device storage. Gnani powers class transcription, voice messages, and read aloud. Saving a text
provider selects it for chat; its model ID is editable. The eye button reveals
typed or saved keys. Settings → Run locally downloads the verified 165 MB
EmbeddingGemma 2 artifact in custom Android builds. Automatic embeddings remain
behind the native device gate. See [local models and history](docs/local-models-and-history.md).
See [storage, scope, and device checks](docs/byok-settings.md).

## Design system

Neo-brutalism tokens live in `src/theme/` (colors, typography, spacing, shadows).
Shared images are exported from `src/constants/images.ts` under `assets/images/`.
Fonts: Archivo Black (headings) and Space Grotesk (body), loaded in the root layout.

## Authentication

Copy `.env.example` to `.env` if you do not already have one, then paste your
Clerk keys:

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` is the public key (`pk_test_` or `pk_live_`).
- `CLERK_SECRET_KEY` is the secret key (`sk_test_` or `sk_live_`). Leave it
  without an `EXPO_PUBLIC_` prefix. The mobile app does not read it.

### Development vs production keys

| Environment | Publishable key | Console “development keys” warning |
|-------------|-----------------|----------------------------------|
| Local dev (`npx expo start`) | `pk_test_…` | Normal; suppressed in dev LogBox |
| EAS `production` / Play Store | `pk_live_…` | Should not appear |

Production builds **fail fast** if they still use `pk_test_`. Set live keys on EAS before
shipping:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY --value pk_live_...
# CLERK_SECRET_KEY is for your backend only; do not prefix with EXPO_PUBLIC_
eas build --platform android --profile production
```

In the [Clerk Dashboard](https://dashboard.clerk.com), register the production instance’s
Native application with Android package `com.acharya.app` and redirect URL `acharyaapp://`.

In the Clerk Dashboard, enable the Native API and register Android package
`com.acharya.app` before OAuth on device builds. Restart Metro after changing
`.env`.

Sign-in and sign-up use email verification codes plus Google and Facebook SSO
(same flow as the production Acharya reference app). Web uses Clerk prebuilt
components at `/sign-in` and `/sign-up`. Signed-in teachers reach the tabbed
app; Home includes sign-out and delete account (requires self-delete enabled in
Clerk). See `.env.example` for the full Dashboard checklist.

## Database (Drizzle + Neon + Expo SQLite)

- **Cloud:** Neon PostgreSQL on project `Acharya` (Gaurav org). Set `DATABASE_URL` in `.env` (server only).
- **Local:** `expo-sqlite` + Drizzle migrations in `drizzle/expo/`; the recorder initializes its repository on first use.
- **IDs:** 21-char NanoID for app records (`src/lib/id.ts`); Clerk user IDs unchanged.
- **API routes:** `src/app/api/*` (Clerk JWT required). Sync: `POST /api/sync/push`, `GET /api/sync/pull?cursor=…`.
- **EAS Hosting:** configure `DATABASE_URL` and `CLERK_SECRET_KEY` as supported server-side env vars (not `EXPO_PUBLIC_`). Optional `EXPO_PUBLIC_API_URL` for the hosted origin in production.

```bash
npm run db:generate:pg    # after PG schema changes
npm run db:migrate:pg     # apply to Neon (needs DATABASE_URL)
npm run db:generate:expo  # after SQLite schema changes
```

`expo-sqlite` works in Expo Go for development. Audio recordings stay as **local files**; SQLite stores paths and metadata only.

## Classroom transcription

The foreground recorder captures 30-second segments and displays Gnani transcripts
while recording. See [Gnani STT setup and device acceptance](docs/gnani-stt.md) for
direct device keys, retry behavior, and current verification limits. No custom AI
backend is needed for these direct calls. After transcription, **Send** creates
class notes and teaching feedback with OpenAI GPT-6 Luna. See [class reports](docs/class-reports.md).

## Validation

```bash
npm run check
```

This runs TypeScript, repository lint, regression tests, and production exports
for Android, iOS, and web, stopping at the first failure. Native release builds
and device testing are separate checks.

See [Dependency security](docs/dependency-security.md) for security overrides,
the Router compatibility patch, and remaining upstream advisories.

## Reset the starter

`npm run reset-project` prompts to move `src/` and `scripts/` into `example/`
or delete them, then creates blank routes in `src/app/`.
