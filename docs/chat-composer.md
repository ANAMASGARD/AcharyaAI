# Chat composer controls

The composer shows a circular animated voice control while the text draft is
empty (including whitespace). Entering text replaces it with the pink send arrow.
Voice conversation remains disconnected; tapping it shows the existing unavailable
message. The separate blue microphone requests microphone permission for local sound-level
visualization. It uses Expo Audio's native PCM stream, immediately reduces each
buffer to an RMS level, and never stores or uploads audio. Quiet input (below
-45 dBFS) stays dotted; recent levels scroll right to left. This is amplitude
detection, not a speech classifier, so loud background sounds also create waves.
The stream stops on close, stop, tab navigation, or backgrounding. Reduced motion
disables horizontal travel. Native permission denial/start failure is shown inline;
the installed SDK's web stream is unavailable, so web shows an explicit limitation.
Neither control calls an STT service. The pink voice conversation control remains
disconnected.

Implementation: src/hooks/use-microphone-level.ts,
src/lib/microphone-level.ts, src/components/chat/voice-input-preview.tsx.
app.config.ts enables microphone permission for native builds (rebuild existing
custom binaries to apply it). Expo Go uses its own permission configuration.
Test on Android/iOS: quiet room, speech, background noise, permission denial,
close while permission is pending, Stop, tab change, and background/foreground.
No native device was connected during implementation.

The lavender plus opens Camera, Photos, and Files. `use-chat-attachments.ts` uses
Expo's installed image/document pickers and the existing account-scoped attachment
storage. Photos use the system picker; camera permission is requested only for
Camera. Photo, PDF, and Word files use the existing 10 MB validation, with up to
five draft attachments. Cancel leaves the draft untouched. Selection/storage
errors are shown in the composer. Files can be removed before sending.

Attachments are local: sending text moves the selected files into the local chat
message. No upload or AI processing occurs. Existing account cleanup removes the
owned files on sign-out. Missing restored files show a reselection hint.

The installed Expo UI universal exports do not include Menu. The community menu
uses `Host matchContents`, which was removed from Profile during its native crash
investigation. `chat-attachment-menu.tsx` therefore uses a small themed React
Native modal with explicit cancel, backdrop dismissal, and Android back handling.

Verification: `tests/chat-composer.test.cjs` checks empty/whitespace/text modes,
voice/send dispatch, and the presence of both attachment and microphone actions.
`npm run check` checks TypeScript, lint, tests, and all-platform exports. Physical
camera/gallery/document picking and native visual/keyboard behavior still require
device testing. Test picker cancellation, camera denial, oversized files, restart
restoration, attachment removal, and sign-out cleanup on a device.
