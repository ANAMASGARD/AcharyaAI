# UI parity review — 11 October 2026

## Evidence and limits

Compared the destination presentation modules with the current working files in
`/home/linux/Downloads/acharya-app` and reviewed the supplied screenshot references.
This is a source/layout audit, not a completed device screenshot comparison.
`adb devices` lists no connected device. No authenticated native runtime was
available. The development web server on port 8084 and browser automation daemon
were stopped at the user's request; no replacement server was started.

The five-tab dock preserves the original 64-point height, 50-point indicator,
16-point horizontal inset, source colors, labels, icons, and spring configuration.
Native navigation retains horizontal paging and on-drag keyboard dismissal. Web
retains the existing tap-navigation fallback. Do not interpret export success as
proof of native swipe arbitration or visual parity.

## Screen audit

| Screens | Source/layout review |
| --- | --- |
| Home | Greeting, activity, feed/groups and source component styling retained; dock clearance responds to bottom inset. |
| Calendar | Grid, empty state, session cards and reflection/notes presentation retained; sheet exit distance responds to window height. |
| Recorder | Form, selectors, timer, transcript/report presentation retained; topic form now keyboard-aware. Preview remains explicitly local. |
| Chat | Header, bubbles, composer and history retained; corrected keyboard-open composer offset; responsive drawer/dialog dimensions; Back dismisses nested dialog first. |
| Profile | Summary/menu styling retained; current Clerk identity; keyboard avoidance and pending-state protection added to name editor. |
| Language; teaching classes | Source selection layouts retained. |
| Account/security | Existing intentional browser-based Clerk management adaptation; native account view remains excluded. |
| Verify paper; generate paper | Source input/result layouts retained; curriculum sheet exit distance responds to window height; processing remains disconnected. |
| Community feed; create post; post detail | Source cards/image strips retained; creation and comment forms now keyboard-aware with handled taps. |
| Groups; create group; join group; group detail; group chat | Source presentation retained; create/join forms now keyboard-aware; group chat keyboard avoidance enabled on Android as well as iOS. |

Core Animated recorder starting dots now honor reduced motion. Existing Reanimated
motion keeps its original timing/springs and the library's system reduced-motion
behavior. Home, Calendar, Recorder, and Profile keep at least their original bottom
padding and increase it when a larger safe area would otherwise cover content.

## Remaining runtime verification

All 18 content routes and the protected development `ui-gallery` still need phone
inspection: compare reference spacing/fonts, swipe through all five tabs, scroll
vertically during paging, open/close every sheet, rename/delete a chat with Android
Back, focus the last input on narrow/landscape screens, and test larger text and
reduced motion. Verify keyboard changes on both Android and iOS. Live Clerk name
and photo mutations require an authenticated session. Backend error banners and
endless loading from the reference screenshots are intentionally excluded.
