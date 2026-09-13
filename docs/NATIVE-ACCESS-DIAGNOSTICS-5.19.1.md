# Native access-check usability repair — 5.19.1 (89)

## Observed, not inferred

Owner screenshots at 14:15, 14:19 and 14:36 show `This screen was left; local
chat was cleared.` One also shows no displayed public key and a disabled Check
button. They do NOT establish native access/replay success, failure, or a model
response. Repeating screenshot instructions did not resolve the uncertainty.

Two confirmed implementation problems: v88 tied empty-check enablement to the
non-persistent displayed-public-key field; and `onStop` overwrote the common status
label even after a diagnostic had finished. Overlay-filtered touches are an
additional possible explanation for an unresponsive button, NOT a confirmed
cause on this phone. This patch exposes blocked touches without disabling safety.

## Changes

- Empty access/replay Check moves near the top, with its own report and STOP.
- Check is enabled while idle even without displaying/copying the public key.
  Explicit Check signs using the EXISTING Keystore identity. Missing identity
  returns KEY_REQUIRED; no silent key creation, replacement or registration.
- Starting a check immediately records an attempt and SIGNING state. It progresses
  through FIRST_REQUEST and REPLAY_REQUEST; final output includes fixed error code,
  HTTP status and capped local duration. PASS is recorded only for the validated
  two-request result, with replay-stage HTTP 409. No inference is involved.
- Last diagnostic has separate storage/display from conversation status. On exit,
  an in-flight check becomes LEFT_SCREEN; STOP and deadlines have distinct results.
  An idle exit no longer destroys the completed diagnostic. On a cold restore,
  an unfinished RUNNING record becomes INTERRUPTED, never resumed or marked PASS.
- Only one bounded, versioned record of fixed enum/code/count/status/duration is
  kept in dedicated local preferences, best effort. No chat text, JWK, private key,
  signature, nonce, request/response body, URL or provider details are stored there.
  The UI discloses this metadata retention. It is historical diagnostics, NOT an
  authentication/authorization flag; no send decision trusts it.
- Copy check report explicitly copies only fixed metadata plus APK version and
  a boolean obscured-touch observation. Clear check report clears that metadata,
  without changing keys, Cloudflare or chat. No background clipboard access.
- Shared synchronized ticket ownership fences stale callbacks/new attempts and
  Activity instances. Storage failures degrade to memory-only diagnostics.
- Obscured/partially obscured touches show an overlay warning and remain blocked.
  No overlay permissions, agent tools or touch-filter bypass is introduced.

Chat, draft and consent still clear on backgrounding/recreation. No automatic key
read/create/check/send on screen opening; only safe diagnostic metadata is read.
No network/protocol/model/backend, Keystore alias, browser identity, Fish selection,
voice algorithm, Agent permissions or signing identity changes.

## Verification and remaining boundary

Ten JVM diagnostic tests cover persistence, interrupted restore, stale callbacks,
redaction/bounds, corrupt storage, monotonic stages, clear, storage failure,
sequence wrap and premature/invalid PASS prevention. Existing protocol/transport/
conversation tests still gate the debug APK. Static integration assertions cover
unconditional-idle Check, top placement, report wiring and retained touch guards.
The fourteen existing web regression scripts passed with network blocked.
Android rendering, overlays and real native auth still require phone evidence;
unit/static tests cannot establish those results.

Version 89 is an in-place development update over 88. Same application ID and
public development signer; not a Stable release or secure-updater activation.
Do not uninstall/clear data. No Worker upload is needed: consumed uploader parent
pin is unchanged and must reject this unrelated native push before API access.
After successful build, owner installs the exact new artifact, presses Check once,
then uses Copy check report. No further screenshot-timing workaround, public-key
re-enrollment or Cloudflare change should be requested for this diagnostic step.
