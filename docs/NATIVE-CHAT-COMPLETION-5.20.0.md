# Native Chat completion pass — 5.20.0 (91)

## Acceptance entering this pass

Owner screenshot `Screenshot_20260913-162550.png` showed the correct same-screen
`jheel-74` follow-up and Context 4 on APK 90. Basic native request/reply and this
bounded recall trial are PASS. Earlier signed empty/replay and local readiness
checks are also settled. The owner subsequently explicitly confirmed **Chat OFF**
and requested continued completion. No repeat of those settled live tests is
needed for this pass. The earlier repeated-OK answer remains a recorded semantic
failure; no claim that its exact cause was established or all model answers are
correct. None of this demonstrates persistence across leaving the screen.

## Product work

- Native **Chat / Checks / Info** tabs, all inside the same Activity. Chat opens
  first. Switching these tabs preserves draft, consent and completed history and
  performs no request/key read. This is not navigation to another app or WebView.
- Chat now puts the conversation/composer ahead of enrollment and diagnostics.
  Distinct plain-text reply cards, readable input, compact context/privacy note.
  Detailed limits and capability/privacy caveats live in Info, not above every
  reply. No fake Agent, browser, media or voice controls.
- Checks keeps explicit local readiness first, then existing signed empty/replay
  diagnostics and advanced public identity setup. Existing copied safe historical
  reports remain available. Opening Checks does not run any of them.
- STOP is outside the scroll area and available on every tab during owned work.
  Status and obscured-touch warning are shared across tabs. Tab buttons/confirmations
  retain obscured-touch protection; unknown busy state is not silently bypassed.
- Enter remains multiline, not Send. No focus/keyboard auto-popup on opening.
  Explicit Send and tab change hide the keyboard; no network side effect.
- Same fixed origin, private alias, consent/signing checks, bounded context,
  completed-only history, deadlines, no automatic retries or voice/tool dispatch.
  Existing server model/prompt/output validation and quota are unchanged.

## Lifecycle hardening

Previously, cleanup depended on onStop. onDestroy only cancelled the operation
and removed queued Handler messages; it did not independently invalidate the job
or visibility and clear history. Also, confirmed Back called finish and relied
on the later onStop callback to cancel work.

A single idempotent local cleanup now runs onStop, onDestroy, and IMMEDIATELY
when the owner confirms leaving. It invalidates visibility, cancels owned work,
fences callbacks, dismisses confirmation, and clears draft/consent/history. It
handles partial initialization defensively. Back cancellation does not clear the
conversation. No global legacy-service STOP, preference changes or remote-abort/
refund promise. This hardens exceptional lifecycle paths; it is not proof those
paths caused the old phone readiness or repeated-OK results.

## Automated coverage

Added thirteen Robolectric Activity tests, with Android resources and API 28:
opening with no transport, in-Activity tab preservation, Back cancel/confirmed
exit, STOP on another tab, stale result versus newer job, background clearing and
safe report retention, destroy-without-onStop fencing, explicit Clear/cancel,
public-key-confirmation cancellation, redacted diagnostic clipboard, saved-state/
recreation privacy, both obscured-touch flags, and fixed STOP placement across
compact measured sizes. Synthetic jobs are injected via test-only reflection;
no production injection or readiness-bypass API is added. No real key, provider,
model, audio, service action or HTTP request is used by these UI tests.

Robolectric 4.13 and resource-enabled unit tests are TEST dependencies/configuration
only; they are not packaged in the APK. Framework dependency resolution during
CI may use Maven; that is not app/provider traffic. All existing native tests
still gate assembleDebug. The new two-case offline native-key-slot follow-up
routing regression is included as source; it uses the exact bundled Worker,
in-memory SQL and a mock AI binding, not a live recall claim.

Before CI: fourteen existing web regression scripts pass with network blocked,
30 readiness JS/wiring cases pass, two offline follow-up cases pass, native static
boundary checks and version/packaged parity pass. New Android test execution and
exact artifact/signature evidence must be recorded in the post-build receipt.
A physical keyboard, Android task/overlay behavior and layout still need phone
observation; Robolectric is not the owner's TECNO device or Android Keystore.

## Scope protection / remaining boundaries

No MainActivity speech change, Fish selection/provider change, wake behavior
change, new permission, persistent chat store, uploader/trust/channel activation,
Worker/prompt/key/flag/DB change, or agent-run inference. Known protected dirty
workflow/README/old repair-note files and unrelated restored files are excluded.
The backend consumed-upload source pin is not advanced for APK builds.

The next owner step is an in-place development update and a SMALL **Chat-OFF**
UI/privacy check: type an unsent draft, switch tabs and back (draft stays), then
confirm leaving and reopen (draft gone). Do NOT press Send, access Check, create
another identity, enable Chat or repeat model recall. No uninstall/clear-data.

Text Chat software completion is not completion of the entire long-term Agent
roadmap. Selected-Fish live verification/native voice opt-in, real speech latency,
device automation permissions/actions, broader Agent scope and production updater
trust remain separate boundaries. The selected Hindi library reference must be
preserved exactly; no replacement voice or default can be inferred. Any native
reply-to-Fish feature must explicitly disclose that additional data destination
and require owner consent before audio/model traffic. No such traffic is started
by this text UI pass.
