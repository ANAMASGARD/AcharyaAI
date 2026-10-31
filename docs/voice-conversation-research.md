# Live voice implementation references

- OpenAI WebRTC: native audio and a data channel connect to a Realtime session; the permanent API key remains server-side. https://developers.openai.com/api/docs/guides/voice-webrtc
- Realtime call creation and server hang-up: https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/create and https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/hangup
- Semantic VAD is not a guarantee of silence through a long demo. Practice disables automatic responses and requests student answers/feedback explicitly. https://developers.openai.com/api/docs/guides/realtime-vad
- GPT-Realtime-2 speech-to-speech model: https://developers.openai.com/api/docs/models/gpt-realtime-2
- Native SDK57 dependency baseline, used as reference rather than importing a browser transport: https://github.com/openai/openai-agents-js/tree/main/examples/realtime-react-native
- Native WebRTC microphone/peer connection/lifecycle APIs: https://github.com/react-native-webrtc/react-native-webrtc/tree/master/Documentation

This feature uses the existing OpenAI server SDK and an app-owned native transport. It does not add Agents SDK browser assumptions. A native rebuild is necessary; Expo Go is insufficient. Expo SDK58 is not changed.

## Data and lifecycle

The server authorizes chat and selected context, creates a ten-minute app session and provider call, and stores the provider call ID for cleanup. The device talks directly to OpenAI over WebRTC. No audio files are retained. Final captions are client-reported, private conversation records; they are not trusted provider receipts, verified citations, or audited billing data. Interrupted assistant output is replaced with an interruption marker rather than saving text the teacher may never have heard.

The app ends on navigation, backgrounding, track termination and connection loss. Reconnect is explicit and closes any previous account session. Ten minutes is an app lifecycle cutoff, not a guaranteed provider-side billing ceiling. Provider termination failures remain retryable. There is no unattended server worker. No paid tests were run; the separately authorized $5 test allowance remains unused.
