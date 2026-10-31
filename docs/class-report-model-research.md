# Class report model contract

Verified 12 October 2026 against official OpenAI documentation. No credentialed
request or physical-device test was performed.

- The exact public API identifier is `gpt-6-luna`. Its model page confirms text
  input/output, Chat Completions, and structured output support. Reasoning levels
  are `none`, `low`, `medium` (default), `high`, `xhigh`, and `max`.
  [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna).
- Existing text-only requests can use `POST https://api.openai.com/v1/chat/completions`
  with this model. The GPT-6 migration guide says to omit `temperature`, `top_p`,
  `top_logprobs`, and Chat Completions `logprobs` when reasoning is enabled. Tool
  calling is unnecessary for a transcript summary; Luna Chat Completions function
  calling requires `reasoning_effort: "none"`.
  [GPT-6 guidance](https://developers.openai.com/api/docs/guides/latest-model).
- Use `max_completion_tokens` for an output bound; it includes reasoning tokens.
  `response_format: { type: "json_object" }` is supported JSON mode and requires
  an explicit JSON instruction in a system/user message. It guarantees JSON
  syntax, not the app's schema; validate the parsed report before saving it.
  The API recommends `json_schema` for schema adherence where supported.
  [Chat Completions reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create).

Implementation recommendation: use the verified `gpt-6-luna` ID for this milestone,
omit optional sampling controls, retain bounded timeouts/cancellation, and reject
truncated or malformed report responses. Documentation support does not establish
that a user's API key has model access or billing enabled. Custom compatible
endpoints need their own model support; do not silently substitute a different
provider when the requested OpenAI model is unavailable.
