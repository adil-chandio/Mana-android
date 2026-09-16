# Cloudflare parked + reviewed native browser navigation — 5.42.0 (113)

## Owner direction and exact scope

The owner explicitly asked to put Cloudflare aside and build the Android APK/automation independently. Normal typed Chat and task-AI now ignore historical Cloudflare route preferences and use the existing saved AI account. The Cloudflare selector, signed access/identity UI are not exposed in normal navigation. Old server files, identities, review markers and keys are not deleted, deployed or enabled. Historical protocol/internal diagnostic code is retained, not presented as a working connection. ResearchBackend no longer signs/dispatches a Cloudflare task request.

This release also implements a **first supported external-app adapter**, not unrestricted/full Android control: reviewed public-page OPEN/SCROLL plans in explicitly selected Chrome, Brave or Edge. It does not enable raw AutoSend, tap/type, screen dumps, message sending, installs, deletion, payments or banking control. Those are not claimed complete.

## Native navigation workflow

Agent → Browser navigation adds a task in the same workspace. It contains:

- Explicit browser selection.
- An editable bounded plan. A supplied manual plan is used as data; a non-plan goal shows a clearly labelled example, not a fabricated solution.
- Optional AI proposal through the reviewed native task-AI gateway. Only the goal/instructions are sent, never screen data. AI output is parsed as a proposal, not executed.
- Separate Android Accessibility/STOP-notification setup controls. They warn that opening Android settings leaves Maya and clears unsaved temporary workspace. No permission is enabled automatically and no task starts on return.
- Separate Review and Run controls. The review binds browser/package/plan digest and expires after60 seconds; a run consumes the grant once.
- Latest process-local execution report and owned STOP.

Supported grammar:

```
OPEN https://en.wikipedia.org/wiki/Android
SCROLL DOWN
SCROLL UP
```

First line is one approved public HTTPS URL, followed by up to5 SCROLL UP/DOWN steps. Destinations are English Wikipedia article paths or Android documentation paths on developer.android.com. URL credentials, custom ports, query strings, fragments, encoded/traversal paths, other origins, login/special Wiki paths and other action verbs are refused.

## Runtime enforcement

A new system-bound BrowserNavigationService owns only an explicitly approved immutable plan. The old AutoSend service remains disabled. The new service is not exported to JavaScript and cannot be started as a model tool.

- No event inspection while idle; no persistent approval or process-restart replay.
- Run requires the service connection, enabled STOP notifications, an unlocked interactive screen and a one-use unexpired grant.
- OPEN uses a package-specific ACTION_VIEW Intent; no resolver-based arbitrary app selection.
- A fresh observation of the selected browser and approved origin is required before advancing. OPEN verification means browser/origin observed, not proof of page correctness or content loading.
- SCROLL uses AccessibilityNodeInfo ACTION_SCROLL_FORWARD/BACKWARD, not coordinate gestures. The service recaptures/validates the current scope before the effect, rejects password-node presence, and requires a unique visible scrollable target.
- Traversal is bounded to128 nodes/depth20, with node cleanup. Only the known browser address-bar routing value and structural flags are read; page text/input values are not dumped, logged, returned to the model or uploaded.
- Each effect is issued once. A corresponding scroll event after the action timestamp is required to advance; no event/ambiguous target yields an uncertain stop, not a retry or success claim.
- Scope changes, reported user touch, keyguard/screen-off, unavailable notification/service, STOP or bounded timeout halt further actions. Runtime is capped at60 seconds and individual observation waits at10 seconds.
- A persistent notification supplies STOP and an explicit return-to-Maya link. The stop receiver is non-exported and bound to the current run ID. No automatic Activity return or task resume.

Android/OEM accessibility-event and address-bar behavior must be physically qualified. A browser with inaccessible/changed address metadata or multiple scroll targets can correctly refuse the task. Tests do not establish that every supported browser/version will work, or that Android always reports every physical user intervention. Broader irreversible actions remain unavailable until stronger reviewed adapters and device evidence exist.

## Expected external handoff versus arbitrary background

Pressing Run explicitly permits this small service-owned navigation plan to continue in the selected external browser. Native task lifecycle distinguishes that handoff from ordinary pause: the approved plan is not accidentally cancelled merely because its OPEN leaves Maya.

The existing temporary-workspace rule remains: leaving clears unsaved Chat/other task state. The review warns to save work first. Only this approved navigation plan remains in service memory until completion/cancellation/deadline; results are a fixed process-local report, not a restored conversation or durable project history. Ordinary STOP/removal still cancels owned work. Process death never resumes the plan.

This is not an assertion that Android can provide unlimited/background/root control. Accessibility is an owner-granted OS capability with app-enforced scope, not a blanket permission for arbitrary model actions.

## Cloudflare and preserved features

- Chat/Talk/task AI use saved-account configuration only. Old Cloudflare preference values are preserved but ignored for normal task routing.
- No Worker deployment, server deletion, Chat enablement, key replacement, paid fallback or new model service.
- Wake/Fish/input implementation files remain unchanged from112; exact selected Fish output is preserved.
- Legacy phone/scheduler/notification/media APIs stay quarantined. No old trust-mode flag can enable this new plan runner.
- Existing task AI256-token cap, Builder local/static limits, native data review and encrypted saved work remain.

## Verification and remaining work

Pure tests cover plan/URL/action rejection, one-use grants, expiry, no action before scope observation, event-confirmed steps, no duplicate/retry, stale timestamps, reentrant STOP, touch/scope/password/availability failures. API28/34 service tests check system binding, old AutoSend isolation, non-exported STOP and inert idle events. Native workspace tests check the new task remains in the permanent surface and cannot Run before setup/review, and that Cloudflare UI is parked. Existing transport tests verify old CF preferences do not re-enable that task route.

Final exact-head build/test/artifact evidence is in the delivery receipt. No real Accessibility permission, notification permission, external browser run, screen read, AI/Fish call or provider deployment was performed by the coding agent. This is a verified-code development candidate, not physical-phone certification or full-project completion.

Still required: device qualification, additional reviewed app adapters, stronger capability/foreground observation, canonical typed/Talk memory, native credential migration, richer project/GitHub/media features and trusted updates. In-place update only; never uninstall or Clear Data. Enabling setup/executing a navigation task remains an explicit action in the APK.
