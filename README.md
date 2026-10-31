# AcharyaApp

Expo Router app for Android, iOS, and web, using Expo SDK 57 and React Native 0.86.

## Development

```bash
npm ci
npm start
```

Routes live in `src/app/`; shared components, hooks, and theme constants live
outside the route directory. Use `npx expo install` for SDK-compatible packages.

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
