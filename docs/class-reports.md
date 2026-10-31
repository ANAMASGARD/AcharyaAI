# Classroom reports

On Android/iOS, save Gnani and OpenAI keys in Profile → App settings → AI API keys.
Record a class and stop. Once all segments finish transcribing, tap **Send**.
The animated progress indicator shows Acharya AI analyzing the class and creating its summary;
**Cancel** keeps the transcript available. Failed segments must be retried first.
Silence-only recordings cannot generate a report.
After a report is ready, tap **+** beside **Report ready** to clear the form and
return to the top for a new class. This does not start capture or delete saved
session data; enter the new class details and tap Record.

Reports use **gpt-6-luna** through the saved OpenAI endpoint/key, independently of
the selected chat provider/model. New OpenAI configurations also default to this
model; existing explicit chat selections are preserved. A compatible endpoint
must support this model and Chat Completions JSON mode. No provider substitution
occurs if access is unavailable.

The two prompt templates are adapted from the old app's
`lib/prompts/teaching-analysis.ts` and `lib/prompts/class-notes.ts` in
`/home/linux/Downloads/acharya-app`. They produce:

- Evidence-based teaching feedback using the existing four reflection fields.
- Student notes covering concepts, definitions, methods, worked examples,
  diagrams where supported by the lesson, and a quick summary, in the transcript's
  language(s).

The adaptation treats transcript text as source data, requires honest handling
of missing evidence, and avoids assuming poor teaching from a short recording.
Any generated score is an estimate, not an objective teacher assessment.

The whole transcript is sent in both requests, without chat-history truncation.
There is a 240,000-character input limit, a 45-second deadline per request, bounded
response size, and an 8,192-token completion budget including reasoning tokens.
Truncated, refused, malformed or incomplete feedback is rejected. There are no
automatic paid retries; Send permits a manual retry after failure. If notes fail
after feedback succeeds, retry repeats both calls and may incur another charge.

The latest completed report is saved with its owner, session, source transcript,
model and timestamp in the existing account-scoped local draft store. It reopens
with the same recorder session and is cleared with local account data. The generated notes and reflection are also saved in SQLite for Calendar history.
Days with reports have dots and classes are listed chronologically. Storage failures
retain the generated result for a save-only retry while the recorder stays mounted.
Cloud report history and automatic vector indexing remain pending the native gate. Keys remain only in SecureStore.
Backgrounding, navigation, account changes and cancellation abort active work;
late results are ignored. Cancelling cannot undo a provider charge already made.

Verification: mocked provider and hook tests cover full input, defaults, response
validation, duplicate taps, retry, stale results, account isolation and lifecycle
cancellation. Physical-device interactions and credentialed GPT-6 Luna requests
still need verification.
