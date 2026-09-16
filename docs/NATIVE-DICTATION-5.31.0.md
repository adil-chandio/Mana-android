# Maya 5.31.0 (102) — foreground voice input and interaction reliability

## Implemented

### Same-composer dictation

The Mic action opens explicit input consent with Urdu/Hindi/English language choices. On-device-only is the default for every new consent dialog. It uses Android's on-device recognizer where available and never silently switches to another service. If the owner explicitly unchecks on-device-only, Android's installed default recognition service is used; it may process microphone audio remotely over internet/mobile data. There is no fallback ladder, forced Google selection, model download request, paid API configuration, audio file or audio-to-Chat/Fish path in this adapter.

Recognition service availability is checked before requesting missing microphone permission. Native readiness also checks the original assistant's state. Wake/auto-listen/proactive/other active owners are not automatically disabled or commandeered. Main Maya is required; compatibility launchers do not start Main or request microphone permission for this feature.

Flow: explicit consent → 1.5-second local readiness ceiling → selected recognizer (20-second total start/listen/result ceiling) → transcript review → explicit Use transcript → separate Send. Partial results never enter the draft or model context. Only a valid final transcript up to 2,000 characters is accepted; no silent truncation/transliteration. Agent's existing shorter goal limit still applies at Send.

Replacing a nonempty different draft needs confirmation and checks that both draft and transcript are unchanged. Use transcript never grants Direct consent, starts Agent execution, sends, applies code or plays Fish. Missing permission exposes a separate Allow microphone action; granting it never starts recognition. The owner returns and starts Voice again.

### Ownership and cancellation

A native-only identity-based microphone lease prevents legacy Main listening from taking over while composer dictation owns the mic. Stale release tokens cannot release a newer owner. No lease is exposed through the JS bridge or persisted. Main local readiness also detects the composer lease and foreground transition.

STOP, mode/task/settings changes, background/exit, obscured touches, focus loss while recording, errors and deadlines cancel/destroy only the owned recognizer and reject stale callbacks. Reviewed text may stay visible while a local replacement-confirmation dialog has focus; actual pause/background cancels/discards it. Duplicate/late partial/final/error/readiness events cannot overwrite a newer session or accepted transcript. Partial text is discarded on timeout/cancellation. This does not erase any audio already processed by a system recognition service.

### Permissions on use, not on text startup

Main startup no longer requests mic, contacts, call and notification permissions as a bundle. Existing feature-specific permission requests remain. The recognition-service manifest query is package visibility only, not a permission grant or service activation. Existing saved wake configuration and grants are not rewritten; the wake service already refuses startup without microphone permission.

### Reading without forced jumps

If the owner scrolls back while a Direct request is pending, a new accepted reply exposes a Latest action in the workspace header instead of forcing a jump. Explicit submission or tapping Latest follows the new content. New conversation/background clearing resets this local presentation state. Native tests cover both following and not-following cases; physical scrolling/IME behaviour still needs device verification.

## Validation boundaries

Local network-denied npm, source/privacy checks and version/asset synchronization are required, followed by matching CI native compilation/tests and development APK verification before delivery. Dictation controller tests use synthetic readiness/recognition events and clocks. Main UI tests use fake recognition ports; they do not record audio. Android adapter checks cover old-Android on-device refusal and compatibility routing; they are not real-service/device recognition proof.

No live microphone, provider, Fish, model, research or phone-action test was run by the coding agent. Exact saved Fish output and its accepted reference remain unchanged; speech recognition is a distinct input capability, not another TTS voice. Chat OFF, identity/Worker/model/budgets, preview isolation, and existing ephemeral background/exit policy remain.

## Whole-project completion audit

The expanded roadmap must not be labelled complete merely because this build compiles:

| Area | Status after implementation in this release |
| --- | --- |
| Permanent shared Direct/Agent/Builder workspace | Implemented; regression-tested in preceding releases and retained |
| Dedicated Settings / host-theme leak repair | Implemented in100; retained |
| Exact Direct context review / local failed-attempt recovery | Implemented in101; retained |
| Bounded public WIKI/REPO research / explicit plan approval / expiry | Implemented; broader arbitrary-web research is not |
| Static single-file Builder / comparison / confirmed apply / preview / local Undo | Implemented; not a multi-file IDE or execution environment |
| Unified foreground voice-to-composer | Implemented here; real recognition availability/accuracy and physical phone UX remain unverified |
| Just-in-time startup permission cleanup / non-jumping replies | Implemented here; device validation remains |
| Consented saved conversations, encrypted project persistence, backup/delete/import/export | Not implemented; current workspace remains ephemeral |
| Full native rewrite of every original settings category | Not implemented; original saved settings remain in the dedicated host |
| Broad internet/media/video analysis and GitHub write workflows | Not implemented in the unified workspace; require additional supported tool/data/authorization work |
| Reviewed cross-app phone execution adapters | Not implemented in the unified workspace; no banking/payment/password/OTP authority |
| Trusted in-app update enrollment / Stable release | Inactive; existing development artifact delivery is not update-trust enrollment |
| Physical TECNO keyboard/TalkBack/microphone/installation verification | Not performed by the agent |

These are real remaining implementation/validation items, not dummy disabled buttons and not all solvable by permission grants alone. No unlimited-free or flawless/full-project completion claim. Install development updates in place; do not uninstall or Clear Data.
