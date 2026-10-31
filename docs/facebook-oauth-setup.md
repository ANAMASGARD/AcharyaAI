# Facebook sign-in setup

Research checked on 13 October 2026. The setup path and verified implementation status are recorded below; ordinary-user publishing remains pending.

## Credentials and CLI boundary

Clerk development instances use shared Facebook credentials. Production requires a Meta app's **App ID** and **App Secret**. Meta app registration and credential retrieval are documented as dashboard operations. No official `gcloud`-equivalent CLI for provisioning a Facebook Login app was identified in this research; third-party Facebook/Meta CLIs should not be treated as a replacement for developer registration or ownership verification. [Clerk Facebook setup](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/facebook)

## Meta dashboard steps

1. Open [Meta My Apps](https://developers.facebook.com/apps/) with the owner's registered developer account and create an app named **Acharya AI**.
2. Select **Authenticate and request data from users with Facebook Login**. Complete app details and the business portfolio step as offered by Meta.
3. Under **Use cases**, customize Facebook Login and add the **email** permission.
4. Open Facebook Login **Settings**. Set **Valid OAuth Redirect URIs** to the exact callback displayed by the production Clerk Facebook connection.
5. Open **App settings → Basic** to obtain the App ID and App Secret. Store the secret privately outside Git, chat, and mobile/public environment variables.

These steps follow [Clerk's current provider setup guide](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/facebook).

## Acharya callback and storage contracts

The expected provider callback for this project's production Clerk domain is:

```text
https://clerk.superacharya.com/v1/oauth_callback
```

Verify it against the actual Clerk Facebook connection before saving it in Meta. The installed app's return URL `acharyaapp:///` belongs in **Clerk's native redirect allowlist**. It is a separate hop from Meta's HTTPS callback. This is the project's existing browser SSO architecture, not a requirement to install Meta's native SDK. Clerk supports browser-based social authentication through `useSSO()` and `startSSOFlow()`, with a provider strategy and explicit redirect URL. [Clerk Expo SSO reference](https://clerk.com/docs/reference/expo/native-hooks/use-sso), [Expo Clerk guide](https://docs.expo.dev/guides/using-clerk/)

Use `oauth_facebook` for Facebook and activate the returned Clerk session before entering authenticated screens. Handle cancelled browser sessions without presenting them as failures; incomplete signups/session tasks need an appropriate continuation. `createdSessionId`, `setActive`, and `authSessionResult` are part of Clerk's SSO result. [Clerk SSO reference](https://clerk.com/docs/reference/expo/native-hooks/use-sso)

Clerk must receive the provider credentials to perform the exchange. If the owner requests a backup, use the existing private deployment secret mechanism, not a plaintext Neon SQL row or client-visible Data API. No App Secret belongs in `EXPO_PUBLIC_*` or in the APK/AAB.

## Production and verification limits

Meta's app-specific dashboard must establish publishing eligibility for the intended users. Review its outstanding publishing, permission/access-level, privacy policy, data deletion, business verification, and app-review requirements before claiming public availability. This research could not independently establish which of these requirements applies to Acharya: official Meta documentation requests returned HTTP 429 or inaccessible-page errors. See the primary [release documentation](https://developers.facebook.com/docs/development/release/) and [access-level documentation](https://developers.facebook.com/docs/graph-api/overview/access-levels/) when accessible. No unconditional claim about mandatory business verification or automatic public email access is made here.

After configuration, test production Account Portal login, then sign-in and sign-up on an installed native build, including cancellation and return to the app. A test with an app administrator alone does not establish eligibility for ordinary users. Failed callbacks can be investigated in Clerk Application Logs using `oauth_callback.failed`. [Clerk Facebook testing guidance](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/facebook)

Expo recommends a development build for custom OAuth redirects; Expo Go cannot test an app-owned custom scheme reliably. [Expo OAuth guide](https://docs.expo.dev/guides/authentication/)

## Current implementation status

- Meta app **Acharya AI** (`1658567065891712`) was created after owner-approved terms and password confirmation. Its domain `superacharya.com` and HTTPS Clerk callback were saved and read back. Email and public_profile permissions are Ready for testing.
- Development and production Clerk Facebook connections are enabled and authenticatable. Production App ID matches the Meta app and a secret is configured; values were verified without printing secrets.
- Credentials are backed up in `/home/linux/.local/share/acharya/facebook-oauth-production.json` with owner-only permissions. The App Secret is not in Git, client code, public variables, or a database table.
- Native sign-in and sign-up screens include a Facebook icon button using the shared Clerk SSO hook. Google and Facebook have independent public availability flags; email remains available. Web prebuilt Clerk components render enabled providers automatically.
- Development and the production build script enable `EXPO_PUBLIC_FACEBOOK_AUTH_ENABLED=true`.
- Meta's app is **unpublished**. Its dashboard lists missing app icon, privacy policy URL, user data deletion instructions, and category. Business verification and App Review were also listed during creation; these requirements are not complete. Administrator/test-account availability does not prove ordinary-user access.
- `npm run check` passed TypeScript, lint, 147 tests, and Android/iOS/web exports before production flag enablement. TypeScript, lint and nine targeted OAuth tests passed again afterward.
- A localhost production-key test is blocked by Clerk's production-domain restriction. Account Portal immediately redirects due an existing Google session; that is not Facebook login proof.
- Signed APK/AAB rebuilt successfully (6m 11s), signature verified, both Facebook labels present in their JS bundles, and known server-secret scans passed. Updated APK installed successfully on USB-authorized Pixel 8a; package version 1.0.2/code 3, activity launched. Owner completed Facebook login/consent in the installed Pixel 8a app and reported returning into Acharya successfully. Clerk production independently confirms a verified oauth_facebook external account and a newly created active session. This proves the tested owner-account login; separate new-user sign-up, cancellation/session restoration on-device, and ordinary-user publishing remain unverified.
