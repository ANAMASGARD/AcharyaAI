# Bring your own API keys

Open **Profile → App settings → AI API keys** on Android or iOS.

- **Gnani:** save one key for 30-second classroom transcription, short chat voice
  messages, and reading AI replies aloud. Class transcripts retain their durable
  local queue, ordered segments and manual retries.
- **Gemini / OpenAI-compatible / Claude:** save a key and an accessible model ID.
  Saving selects that provider for the next chat request. Use **Use for chat**
  to switch between already saved providers. Tap **Chat model** for a searchable
  live model catalog, then tap a model to save it without re-entering the key.
  Gemini and Claude pagination is followed to completion. Descriptions come from
  provider metadata; when absent, owner/context information is shown. Catalog
  presence does not guarantee chat compatibility or billing access. Clearly
  non-generative Gemini models and retired Claude models remain visible but
  disabled. Custom endpoints without model listing can use manual ID entry.
- **Eye:** shows/hides typed input, or explicitly retrieves a saved key when the
  field is empty. Backgrounding or leaving this page discards the field and
  returns it to hidden. Saving clears the input but persists the encrypted key.
- **Saved status:** a green dot and checkmark mean the key is stored locally,
  not that API access has been verified. Privacy/billing details are collapsible.
- **Run locally:** future downloadable inference, still unavailable.

Chat sends text history (up to the last 30 messages, at most 60,000 characters)
to the selected provider. Provider replies are saved in local chat history.
Attachments are not processed: remove them before sending. No curriculum RAG or
automatic report generation is implied. Recorder reports are generated separately
when you tap Send, using the saved OpenAI key and GPT-6 Luna; see [class reports](class-reports.md). Chat replies arrive as one response, not
streaming tokens. Short voice messages automatically stop by 30 seconds; unlike
class recording they are transient and must be re-recorded after failure. Read
aloud uses Gnani Timbre v2.5 with Poorvi (Hinglish); up to 2,000 characters per
message. Use **Read latest reply aloud** in chat. Stop, navigation, backgrounding,
account change and starting recording end playback.

No Acharya AI proxy is required: `src/lib/ai/` calls the provider directly with
the user's credential. Default class recording no longer creates/finalizes
sessions on Neon. Clerk authentication remains. Legacy server routes remain in
the repository; account deletion cleans that backend when `EXPO_PUBLIC_API_URL`
is explicitly configured, so retain that setting for previously hosted data.

## Security boundary

Saving a key itself makes no network request and does not verify validity or model
access. A real AI request necessarily sends the credential and audio/text to the
selected provider over HTTPS, and provider billing applies. Never claim cloud
inference keeps credentials and content solely on-device.

Keys use the already-installed Expo SecureStore: Android Keystore-backed encrypted
preferences (excluded from Android backup by its config plugin), iOS Keychain
with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. Entries are separated by a SHA-256 account
namespace and provider within service `acharya.byok.v1`, separate from Clerk.
The active provider is stored in that same scoped service. No keys in plaintext
files, AsyncStorage, SQLite, public environment variables, logs or cloud sync.
The settings summary returns no key; explicit reveal and direct provider calls
read it into memory only as needed. JavaScript cannot guarantee memory zeroing.
A compromised device or malicious app build can still expose secrets.

Custom OpenAI-compatible base URLs require HTTPS and reject embedded credentials,
query parameters and fragments. They receive their configured key—use only trusted
endpoints. Native `expo/fetch` blocks redirects (`redirect: 'error'`) so credentials
are not forwarded, and omits cookies. Requests have a 45-second timeout, cancellable
account-scoped work, bounded response reads, and generic errors that do not echo
provider response bodies. Saving a replacement key preserves the previous value
if the secure write fails. Selection and key writes are separate secure writes;
retry save/select if selection fails after the key has saved.

Normal app updates, explicit sign-out, and session changes retain encrypted keys
under the same account-specific SecureStore names. Sign-out cancels pending AI
requests and clears local drafts; another signed-in account cannot read the old
account's keys. Explicit key removal and account deletion still erase credentials;
secure storage failures are reported for retry.
iOS Keychain can survive reinstall on the same device: remove keys before
uninstalling. Removing a key here does not revoke it at its issuer. Temporary
voice/read-aloud WAVs are deleted on normal completion/cancellation; process death
can leave an OS-purgeable cache file. Class audio remains until acknowledgement
or account cleanup. Web encrypted-key setup and native audio are unavailable.

## Verification

Run `npm run check` and `npx expo-doctor`. Tests mock provider requests and native
modules; they verify payloads/auth headers, selected-provider routing, key
isolation/reveal, API response validation, redirects/cancellation flags, errors,
retry classification, chunk identity and existing recorder durability.

On consented physical Android/iOS with disposable keys and billing enabled:

1. Reveal/hide a typed and saved key; leave/background the screen and verify it
   returns hidden. Restart and verify saved configuration persists.
2. Record 65 seconds: expect 30/30/5-second segments in order, text during capture,
   Stop flushing the remainder. Try invalid keys, offline/retry and interrupted
   recording.
3. Save each chat provider/model; send a prompt and confirm an actual reply. For
   a compatible service, verify its HTTPS base URL and offered model ID.
4. Record a short voice message, stop and confirm text in the composer. Read a
   short AI reply aloud; cancel and background during download/playback.
5. Switch accounts/sign out; verify keys do not carry over and late requests do
   not update the new account. Check native storage failure and permission denial.

Live provider calls and physical-device checks have not been performed in this
environment. Keys, model access and a compatible native build are required for
that verification. No credentials were supplied or used during development.

See [verified provider contracts and sources](byok-provider-research.md) and
[Expo SecureStore](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/).
