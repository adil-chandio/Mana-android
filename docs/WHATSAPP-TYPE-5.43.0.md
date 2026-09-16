# WhatsApp reviewed type — second supported adapter — 5.43.0 (114)

## Owner direction and exact scope

The owner asked to keep building the APK/automation forward without stopping. This release
adds a **second supported external-app adapter**, not unrestricted/full Android control:
reviewed WhatsApp chat OPEN plus one TYPE of explicitly reviewed text in WhatsApp only.
**Maya never presses SEND** — the owner checks the chat on screen and sends it by hand.
It does not enable raw tap/type, clicks, screen dumps, message sending, installs, deletion,
payments or banking control. Those are not claimed complete.

This release also fixes the red CI on the 5.42.0 navigation slice: the reviewed-navigation
service test failed on emulated API 28 because `ContextCompat.registerReceiver` takes the
5-arg framework path on API 26+, which Robolectric does not shadow below API 33. Receiver
registration is now platform-level (explicit `RECEIVER_NOT_EXPORTED` on API 33+, plain
below) in both reviewed services. Real-device behavior is unchanged.

## WhatsApp type workflow

Agent → WhatsApp type adds a task in the same workspace. It contains:

- A digits-only recipient field (7–15 digits, country code + number). No contact access,
  no contact picker, no names: the chat is addressed by an explicit `wa.me` URL only.
- An editable message (1–5 non-empty lines, ≤200 characters each, ≤800 total).
- Optional AI message draft through the reviewed native task-AI gateway. Only the goal
  text is sent; **the recipient number is never sent to AI**. AI output is parsed as a
  text draft, not executed, and a plan-shaped goal is never treated as an AI solution.
- Separate Android Accessibility/STOP-notification setup controls. They warn that opening
  Android settings leaves Maya and clears unsaved temporary workspace. No permission is
  enabled automatically and no task starts on return.
- Separate Review and Run controls. The review binds digits/message digest and expires
  after 60 seconds; a run consumes the grant once.
- Latest process-local execution report and owned STOP.

Supported grammar:

```
OPEN https://wa.me/923001234567
TYPE Salam
TYPE Kal milte hain
```

First line is one digits-only `wa.me` URL (no `+`, spaces, query, fragment, port or
credentials). Then one to five `TYPE` lines. TAP, SEND, CLICK, scroll, second OPEN and
any other verb are refused. Multi-line payloads are typed in ONE set-text effect.

## Runtime enforcement

A new system-bound WhatsAppTypeService owns only an explicitly approved immutable plan.
The old AutoSend service remains disabled. The new service is not exported to
JavaScript and cannot be started as a model tool.

- No event inspection while idle; no persistent approval or process-restart replay.
- Run requires the service connection, enabled STOP notifications, an unlocked
  interactive screen and a one-use unexpired grant.
- OPEN uses a WhatsApp-package ACTION_VIEW intent on the approved `wa.me` URL only.
  Chat identity is delegated to WhatsApp's own deterministic `wa.me` routing: the
  adapter verifies WhatsApp is foreground, never which chat title is shown. The owner
  sees the opened chat and is the only sender.
- TYPE requires exactly one visible editable EditText that is not a password field and
  transiently reads empty — an existing user draft is never overwritten. Field content
  is compared to empty only; it is never stored, logged, returned to the model or
  uploaded. Password-node presence anywhere fails the run closed.
- Traversal is bounded to 128 nodes/depth 20, with node cleanup. No chat text, contact
  names, input values or screenshots are collected.
- The effect is issued once. A content-changed event after the action timestamp is
  required to complete; no event/ambiguous target yields an uncertain stop, not a retry
  or success claim.
- Scope changes, reported user touch, keyguard/screen-off, unavailable
  notification/service, STOP or bounded timeout halt further actions. Runtime is capped
  at 60 seconds and individual observation waits at 10 seconds.
- A persistent notification supplies STOP and an explicit return-to-Maya link. The stop
  receiver is non-exported and bound to the current run ID. No automatic Activity
  return or task resume.

Android/OEM accessibility-event behavior and WhatsApp UI changes must be physically
qualified. A WhatsApp version with a changed message field, an expanded search field
(two editables) or a non-empty draft correctly refuses the task. Tests do not establish
that every WhatsApp version will work, or that Android always reports every physical
user intervention. Broader irreversible actions remain unavailable until stronger
reviewed adapters and device evidence exist.

## Expected external handoff versus arbitrary background

Pressing Run explicitly permits this small service-owned type plan to continue in
WhatsApp. Native task lifecycle distinguishes that handoff from ordinary pause: the
approved plan is not accidentally cancelled merely because its OPEN leaves Maya.

The existing temporary-workspace rule remains: leaving clears unsaved Chat/other task
state. The review warns to save work first. Only this approved type plan remains in
service memory until completion/cancellation/deadline; results are a fixed
process-local report, not a restored conversation or durable project history. Ordinary
STOP/removal still cancels owned work. Process death never resumes the plan.

## Cloudflare and preserved features

- Chat/Talk/task AI use saved-account configuration only. Cloudflare stays parked:
  no Worker deployment, server deletion, Chat enablement, key replacement, paid
  fallback or new model service.
- Wake/Fish/input implementation files remain unchanged from 112/113; exact selected
  Fish output is preserved.
- Legacy phone/scheduler/notification/media APIs stay quarantined. No old trust-mode
  flag can enable this new plan runner.
- Existing task AI 256-token cap, Builder local/static limits, native data review and
  encrypted saved work remain.

## Verification and remaining work

Pure tests cover plan/number/message rejection, one-use grants, expiry, no action
before scope observation, event-confirmed steps, no duplicate/retry, stale timestamps,
reentrant STOP, touch/scope/password/availability failures. API 28/34 service tests
check system binding, old AutoSend isolation, non-exported STOP and inert idle events
(including the API 28 receiver-registration fix on both services). Native workspace
tests check the new task remains in the permanent surface and cannot Run before
setup/review. Offline boundary checks lock the wa.me-only grammar, message-only AI
drafting, unique-editable typing, draft preservation and the never-SEND rule.

Final exact-head build/test/artifact evidence is in the CI run. No real Accessibility
permission, notification permission, WhatsApp run, screen read, AI/Fish call or
provider deployment was performed by the coding agent. This is a verified-code
development candidate, not physical-phone certification or full-project completion.

Still required: device qualification, additional reviewed app adapters, stronger
capability/foreground observation, canonical typed/Talk memory, native credential
migration, richer project/GitHub/media features and trusted updates. In-place update
only; never uninstall or Clear Data. Enabling setup/executing a WhatsApp task remains
an explicit action in the APK.
