# Maya 5.32.0 (103) — actionable voice failures and bounded local host recovery

## Owner-reported problem

The owner supplied Screenshot_20260914-144301.png and Screenshot_20260914-144251.png. Both show the generic "Selected recognition service/language unavailable" card with only Discard voice input. The screenshots establish a real failed voice-input experience, not which recognition engine/language was selected, whether the microphone had started, which APK version was installed, or which Android error code occurred. Do not infer a missing Urdu model or a missing permission from these images. The displayed M/FRIDAY orb is the saved original persona; this release does not rewrite it or the accepted Fish output reference.

## Voice recovery implementation

- Separate fixed reasons for unavailable Android on-device engine, no installed system recognizer, unsupported language, currently unavailable language/model, service network error, and unknown recognition error. Permission and native-owner busy remain distinct. Provider/raw error text is never displayed or stored.
- The consent dialog checks only local service presence, before microphone permission or engine creation. An installed engine is explicitly **not** a guarantee of language/model support. No recognition-support probe, network test, audio recording, model download, app installation or settings change occurs just by opening it.
- Every new consent dialog defaults to on-device-only. If unavailable, the dialog explains how the owner can explicitly uncheck that option to try the installed default system recognizer, which may process audio remotely using internet/data. It never silently chooses that option or remembers it as the next default.
- The local error card identifies the selected mode and language and exposes **Choose voice options**, which opens consent again without starting anything. Cancel preserves the failure and typed draft. Use transcript/Send/Direct consent remain separate. Recovery is absent while listening or reviewing an accepted transcript.
- The welcome copy is hidden and the orb compacted while a voice input/error card is present, giving the actionable content priority. The dialog body scrolls for small screens/large font; physical rendering still needs device acceptance.
- Existing 1.5-second readiness / 20-second recognition ceilings, native mic lease, late-result fences, transcript validation, foreground-only policy and no automatic fallback/retry are retained.

## Additional roadmap implementation: bundled interface recovery

The trusted original WebView still supplies the original orb/saved settings inside the permanent workspace. It previously could remain invisible forever when mount or presentation acknowledgement failed.

- Native loading notice with an 8-second ceiling for the current load/mount or presentation attempt; missing/false/throwing acknowledgement becomes a fixed native failure notice rather than revealing unmounted legacy content.
- Current-load, mount-attempt, presentation-route and one-response fences reject stale/duplicate callbacks. Pause hides the host and revokes presentation; resume requires a fresh presentation acknowledgement. Destroy removes the deadline. Late load events cannot automatically clear a failure.
- Existing HTTPS asset-loader → packaged-file fallback is bounded to one per explicit load attempt. It is a bundled local asset fallback, not a recognizer/network/provider fallback. Main-frame errors are handled; subresource errors are not treated as permission to reload everything. HTTP errors fail locally.
- **Retry local interface** requires an explicit native confirmation. It stops/revokes current workspace-owned work/approvals and rechecks foreground/native microphone, HTTP, TTS, wake/Fish/audio and phone-action ownership before reloading the bundled URL. It refuses conflicting owners; it does not disable their saved settings. A blocked retry stops the requested workspace work but performs no host reload.
- The notice follows the original host into the dedicated Settings category and back; its Settings body can scroll. Native draft/completed conversation/project objects are not cleared by this internal retry. Actual background/exit still follows the existing ephemeral clearing policy.
- Retry does not resend requests, reopen approvals, create identity keys, clear app data, export credentials, inject conversation/code into privileged JS, install anything or activate trusted updates. Remote work already dispatched may continue or count against usage; local reload is not a remote cancellation guarantee. Normal existing startup behaviour of the saved original interface is not reconfigured.
- Shared local confirmation dialogs now revoke on dismiss/obscured touch as well as Cancel/navigation; stale positive buttons do not retain authority.

## Validation and limitations

Required: full network-denied npm/static checks, version/packaged-asset synchronization, native compilation/tests and verification of the exact-head development artifact. Native tests use fake ports, Android shadows, fixed synthetic transcripts and captured JS callbacks. They do not establish real recognition service availability, language accuracy, remote provider behaviour, physical microphone operation, IME/TalkBack geometry or installation on TECNO.

No live AI/Fish/research/browser/phone action or permission activation is performed by the coding agent. Saved Fish, Chat OFF, Worker/identity/endpoints/model/limits remain unchanged. Updates must be installed in place; no uninstall or Clear Data.

## Whole-project status after this implementation

This advances the existing voice flow and implements the missing bounded host error/retry UI. It does **not** complete the expanded project. Consented encrypted saved history/projects, data import/export/backup/deletion, full native settings-category migration, broader research/media/video/GitHub workflows, reviewed cross-app execution adapters, trusted updater enrollment and physical TECNO validation remain unfinished. Exact WIKI/REPO research and static single-file Builder still have their existing limits. No unlimited-free/flawless/full-project claim.
