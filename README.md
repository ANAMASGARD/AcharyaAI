# AcharyaApp

Expo Router app for Android, iOS, and web, using Expo SDK 57 and React Native 0.86.

## Development

```bash
npm ci
npm start
```

Routes live in `src/app/`; shared components, hooks, and theme constants live
outside the route directory. Use `npx expo install` for SDK-compatible packages.

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
