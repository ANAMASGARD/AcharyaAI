# Google sign-in production setup

Google Cloud project: `acharya-ai-511511` (Acharya-AI).
Clerk app: `app_3Kd7B91lMniy1wtJIYFGksi3k1L`.
Clerk production instance: `ins_3Kd7POLAKVucgVPprZ1R2eBFFfL`.

## Google Auth Platform

1. Open <https://console.cloud.google.com/auth/clients?project=acharya-ai-511511> and select **Get started** if the platform is not configured.
2. Set the application name to **Acharya AI**, select the owner's support email, choose **External** for teachers outside a Google Workspace organization, and enter the owner's contact email. The owner must accept Google's policy acknowledgement.
3. Create a client with application type **Web application**, named **Acharya Clerk production**. Clerk performs the provider exchange even when the frontend is an Android app.
4. Add the HTTPS origins used by the web app: `https://superacharya.com` and `https://accounts.superacharya.com`.
5. Copy the **Authorized Redirect URI** from the production Clerk Google connection. For the configured production frontend domain, the expected value is `https://clerk.superacharya.com/v1/oauth_callback`; verify the displayed value before creating the client. The app's `acharyaapp:///` return URL belongs in Clerk's native redirect allowlist, not in Google's web-client redirects.
6. Download the client JSON to a private directory outside the repository. Never paste its secret into chat, a Git commit, or an `EXPO_PUBLIC_*` variable.

## Credential ingestion

Use the authenticated Clerk CLI to apply a narrow `connection_oauth_google` patch containing `enabled: true`, `authenticatable: true`, and the downloaded `client_id` and `client_secret`. Preview the patch privately with `--dry-run` before applying it. Preserve email-subaddress blocking. Read back the enabled/authenticatable flags without printing credentials.

The existing Acharya server credentials are supplied as Neon Function environment variables through private local deployment env files. There is no existing database API-key vault. Store any requested backup through that server-only deployment secret mechanism; do not add a plaintext SQL credential row or expose the Google secret through the Data API. Clerk needs the credentials itself to execute Google sign-in.

## Completion gates

- Register `acharyaapp:///` with Clerk (already registered in development and production).
- Test a new Google account signup and an existing account sign-in, including cancellation and the return to the app, in a signed native build.
- Confirm Google audience/publishing status supports the intended users. Testing status may require explicitly listed test users.
- Set the production app's `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED` flag only after the provider configuration and callback pass, then rebuild the installed app. `scripts/build-closed-testing.cjs` now enables this flag after production credentials and the web callback were configured. Native Google callback testing remains a separate gate.

Status (13 October 2026): the owner created the Web application client in `acharya-ai-511511`. The downloaded JSON was validated against the project, Clerk callback, and origins. Clerk production now has custom credentials with Google enabled/authenticatable and email-subaddress blocking retained. An owner-only local backup is stored outside the checkout; the existing private Neon deployment env supplies the backup to Neon Function variables `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`, confirmed in deployed metadata. No SQL credential table or mobile secret was added. With owner-approved Google consent, web login returned through Clerk successfully; the Backend API confirmed a Google-linked account and a newly created active session. This establishes eligibility for the tested account, not every Google account. The signed build script now enables the public Google feature flag. Native screens have labeled Google-icon controls, loading states, cancellation handling, and an Expo Go explanation. Physical-device callback testing remains pending.

Signed APK and AAB were rebuilt successfully in `releases/`. Their packaged JavaScript contains both final button labels and the Google logo reference. An archive scan of both artifacts found none of the five known local server-secret values. Typecheck, lint, and six OAuth-flow tests passed after the final UI changes. The updated combined Google/Facebook build was subsequently installed on a Pixel 8a. Native Facebook login was verified; the native Google return-to-app test remains pending.
