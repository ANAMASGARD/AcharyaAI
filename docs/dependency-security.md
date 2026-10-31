# Dependency security

The app uses Expo SDK 57 with React Native 0.86.3. Keep native dependencies aligned
with `npx expo install --check`; use `npx expo install` when adding or updating them.

The audit repair restores the project's SDK 57 dependencies, removes the old
Expo 44 / React Native 0.72 dependency trees, and deduplicates native screens.
ESLint and TypeScript checks now work from a clean checkout.

## Security overrides

- Xcode's `uuid` dependency is pinned to **11.1.1**, a patched release that retains
  its CommonJS `v4()` API. The regression tests exercise Xcode project ID generation.
- `query-string` uses **decode-uri-component 0.5.0**, which fixes malformed-input
  denial of service. SDK 57 Router uses query-string 7.1.3, whose CommonJS import
  requires a one-line adjustment for the decoder's ESM default export. The patch
  in `patches/query-string+7.1.3.patch` applies automatically during `npm ci` and
  `npm install`. Installation fails if the patch cannot be applied.

Keep the decoder override and import patch together. Remove them when an
SDK-compatible Router release includes the fixed decoder and matching import.

## Remaining upstream advisories

As of October 11, 2026, `npm audit` reports **16 high findings**, with zero critical
or moderate findings. They originate from two packages and propagate to their
Expo/Metro tooling dependents, including patch-package:

| Package | Installed version | Advisory | Published patched version |
| --- | --- | --- | --- |
| braces | 3.0.3 | [Stack exhaustion from deeply nested patterns](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | None |
| node-forge | 1.4.0 | [RSA signature verification accepts extra nested elements](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | None |

The audit is still failing. Recheck these advisories when upstream publishes fixes.
Do not run `npm audit fix --force`: its current suggestions downgrade Expo or
React Native to incompatible versions and can recreate the broken dependency mix.

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
checks Android/iOS JavaScript bundling and web static rendering. It does not
replace launching a native build on an Android or iOS device.
