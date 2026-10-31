# Direct BYOK provider contracts

Verified 12 October 2026 against official documentation and installed Expo source. Documentation inspection does not prove credential access or physical-device operation. No paid requests were made.

## Gnani

The [complete index](https://docs.gnani.ai/llms.txt) was fetched before following its API pages.

- [STT REST](https://docs.gnani.ai/api/STT/speech-to-text.md): POST `https://api.vachana.ai/stt/v3`; `X-API-Key-ID` header; multipart `audio_file`, `language_code=en-IN`, `format=transcribe`. Success JSON includes `success: true`, `transcript: string`; only accept that combination. An empty string can represent an empty successful chunk. REST accepts at most 60 seconds; existing 30-second WAV chunks fit. The language table explicitly documents English–Hindi mixed audio and Latin output for `en-IN`.
- [TTS REST](https://docs.gnani.ai/api/TTS/tts-inference.md): POST `https://api.vachana.ai/api/v1/tts/inference`, same key header, JSON `{text, voice, model: 'timbre-v2.5', language, speed: 1, audio_config: {sample_rate: 24000, num_channels: 1, sample_width: 2, encoding: 'linear_pcm', container: 'wav'}}`. HTTP 200 returns binary WAV, not JSON or base64. The `auto` language value is supported here; do not copy it into STT.
- [Voice catalog](https://docs.gnani.ai/api/TTS/available-voices.md): `Kaveri` is an English voice, `Nalini` Hindi, `Poorvi` Hinglish. For explicitly mixed Hindi–English speech use `Poorvi` and `hi-en`; automatic script detection is documented for `language=auto`.

## Text providers

Keep model names editable because access and model availability depend on the user's account.

| Provider | REST contract | Documented default candidate |
| --- | --- | --- |
| OpenAI / compatible | POST `/v1/chat/completions`, bearer key, JSON `model`, `messages`; read `choices[0].message.content` | `gpt-4.1-mini` supports Chat Completions; custom endpoints require a model offered by that server. [Model reference](https://developers.openai.com/api/docs/models/gpt-4.1-mini) |
| Gemini | POST `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`, `x-goog-api-key`, JSON `contents` with user/model roles and `parts:[{text}]`; read textual candidate parts | `gemini-3.8-flash`. [API reference](https://ai.google.dev/api), [models](https://ai.google.dev/gemini-api/docs/models) |
| Claude | POST `https://api.anthropic.com/v1/messages`, `x-api-key`, `anthropic-version: 2023-06-01`, JSON `model`, `max_tokens`, user/assistant `messages`; `system` is top-level; concatenate response `content` blocks of type `text` | `claude-sonnet-5-5`; currently listed in API model enum. [Messages](https://platform.claude.com/docs/en/api/messages/create), [authentication](https://platform.claude.com/docs/en/api/overview) |

Gemini's current models page limits 2.5-family access to existing active users and recommends 3.8 Flash or 3.5 Flash-Lite for new projects. Claude's current reference marks Sonnet 4.5 deprecated with a November 30, 2026 end date. Avoid carrying those older defaults into a new integration. Claude supports the legacy `x-api-key` header; multi-workspace keys additionally require a workspace ID, so a plain key-only configuration should use a single-workspace key. Avoid optional sampling parameters in a generic Claude request: current models reject several old sampling controls. These observations are documented contracts, not live account validation.

## Installed native transport and playback

- `node_modules/expo/src/winter/fetch/fetch.ts` forwards `redirect` to native code. Set `redirect: 'error'` and `credentials: 'omit'` for provider calls.
- Android `node_modules/expo/android/src/main/java/expo/modules/fetch/NativeRequest.kt` disables both ordinary and SSL redirects when not following; `NativeResponse.kt` rejects redirect responses in error mode.
- iOS `node_modules/expo/ios/Fetch/NativeResponse.swift` supplies `nil` to redirect completion and emits `FetchRedirectException` for error mode. This is source evidence that redirects are blocked before credentials can be resent; device tests remain needed.
- Installed `expo-audio` `Audio.types.d.ts` allows a local file URI as `AudioSource`. `AudioModule.types.d.ts` exposes `replace({uri})`, `play()`, `pause()`, `remove()`. `useAudioPlayer` manages disposal automatically; manual `createAudioPlayer` requires removal. Write bounded binary WAV to an app cache file, then play the local URI, clean up on completion/cancellation, and do not disturb active recording audio focus. See [Expo Audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/).

## Privacy boundary

SecureStore protects keys at rest. A working cloud API request necessarily sends its key and the selected audio/text to that provider over HTTPS. Saving a key does not require a network call. Keep keys out of logs, persisted chat state, crash messages, URLs, and server requests. A custom HTTPS endpoint receives its configured key; make that destination explicit. Local downloadable inference remains a separate future feature.

## Live model catalogs

- [Gemini Models API](https://ai.google.dev/api/models): `GET /v1beta/models`,
  `pageSize` up to 1000, follow `nextPageToken` as `pageToken`; uses `displayName`,
  `description`, `inputTokenLimit` and `supportedGenerationMethods` metadata.
- [Claude List Models](https://platform.claude.com/docs/en/api/models/list):
  `GET /v1/models`, follow `last_id` as `after_id` while `has_more`; display names,
  model line, lifecycle and token limits are available in current metadata.
- [OpenAI List Models](https://developers.openai.com/api/reference/resources/models/methods/list):
  `GET /v1/models` returns `data` including ID and owner; does not provide a chat
  compatibility flag or descriptive synopsis. Compatible providers use their saved
  base URL. The UI does not invent per-model capabilities from an ID.

The catalog is fetched on explicit picker open using the saved key, never by
sending keys to a third-party catalog. Failed/looping pagination is reported as an
error rather than displaying a partial result as complete.
