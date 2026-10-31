# Dependency security

The app uses Expo SDK 58 with React Native 0.88.1. Keep native dependencies aligned
with `npx expo install --check`; use `npx expo install` when adding or updating them.

## Security overrides

- Xcode's `uuid` dependency is pinned to **11.1.1**, a patched release that retains
  its CommonJS `v4()` API. The regression tests exercise Xcode project ID generation.
- Router 58 uses URL/URLSearchParams for query parsing and no longer depends on
  `query-string`. The old decoder override and `query-string` patch were removed.
- The app-owned SQLite connection facade is patched into pinned
  `expo-sqlite@58.0.15`. Its JNI methods remain available in SDK 58; installation
  fails if the patch cannot be applied.

## Remaining upstream advisories

The October 31, 2026 upgrade audit reports 31 findings: 29 moderate and 2 high,
with no critical findings. Affected underlying packages include `esbuild`, `glob`,
`minimatch`, `node-forge`, and `zod`; counts include transitive dependents.
These are separate from passing application tests and Expo compatibility checks.
Run `npm audit` for current dependency paths and remediation details.
Do not use `npm audit fix --force`: suggested major changes can downgrade Expo
or Drizzle to incompatible versions. Review compatible updates separately.

## Validation

```bash
npm ci
npm run check
npx expo install --check
npx expo-doctor
npm audit
```

`npm run check` runs TypeScript, lint, regression tests, and production exports
for every platform in order, stopping at the first failure. Each step also remains
available separately through its npm script or `npx expo export --platform all`.

The tests cover normal and malformed Router query strings, a large malformed
query with a subprocess deadline, and Xcode's UUID integration. Production export
checks Android/iOS JavaScript bundling and web server-output bundling. It does not
replace launching a native build on an Android or iOS device.
