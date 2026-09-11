# 5.17.3 / code85 — wake recovery after phone feedback

Date: 2026-09-10. User explicitly approved the targeted repair after supplying code84 Device Test Status screenshots. **Development candidate; the user now reports it works well. Detailed device acceptance remains incomplete.**

## Evidence and limits

Code84: user reports typed Chat responds in under one second and their personally selected Fish voice plays. No recorded stopwatch samples, exact voice ID, complete retention/restart or locked-screen acceptance is available. Initial no-tap wake trial failed. The screenshots show wake enabled, zero observed starts/heard/matches/errors, speaking/preparing yes and no current native Fish playing event. Native startup failures, suppressed listening and normal pending synthesis could not be distinguished from that snapshot. [Detailed feedback](PHASE3-DEVICE-TEST.md).

Controlled regression reproduced **before** implementation: start a Fish SUNO audition, call the actual central `AWAAZ.stop()`. Resources/button were released but `speaking` remained true and the `BOL_RAHI` exclusion persisted. `__wakeHeard` refuses commands while speaking; native recognition honors the associated audio exclusion. This is a demonstrated bug, **not proof that it alone caused the user's phone failure**.

## Changes

- Central STOP releases cancelled output's speaking state and calls the existing echo-tail cleanup for `BOL_RAHI`. It does not call an old completion callback or start another AI/tool turn. An `APP_SUN` owner is preserved; a new utterance cancels the old tail before it can release that new owner.
- Existing Fish completion/error/timeout/interruption callbacks retain their generation guards. No blindly clearing `speaking` based on a missing playing event. Live/pending Fish protection and the selected/free model remain intact.
- Native fixed-field `WakeStatus` tracks stopped/requested/foreground/starting/ready/blocked/retry/error/unknown, sanitized reason/error, monotonic state age and process-lifetime start/ready counters. READY originates only in a guarded `onReadyForSpeech`, not `startListening` invocation or a timer. Old readiness is unknown after 35s; a request without startup confirmation becomes unknown/error after its bounded window.
- `wakeStatus()` adds service presence, foreground state, mic permission and existing audio-ownership booleans/enum. No transcript, voice ID/name, key, raw exception, audio, URL or network/upload. Snapshot counters do not replace actual detection tests.
- Native state changes notify JavaScript to **read current native state**, so an old queued notification cannot repaint an obsolete ready payload. The badge uses MIC READY only with recent native ready/service/foreground/permission evidence. Timers only expire readiness, never manufacture it. No polling is added.
- Wake-start acceptance returns a boolean, not a claim that the mic is ready. Permission/start/foreground failures are surfaced; foreground promotion failure stops this service rather than continuing recognition. Failure reasons survive `onDestroy` for diagnosis.
- Mic permission prompts run on the Activity UI thread. Wake activation and delayed boot start no longer automatically open a battery-settings Activity during microphone acquisition. Explicit settings controls remain available; no OS restrictions are bypassed.
- Wake OFF fences queued recognition/startup and delayed start-request diagnostics. Delayed boot start rechecks the saved switch. Restart backoff, voice language/provider choices, microphone arbitration and no-offline-command behavior remain otherwise unchanged.

## Scope held unchanged

Typed Chat/AI routing, selected Fish reference and player, provider model, manifest/package/minSdk26, signing configuration and updater trust. Existing native/JS bounded transport limits remain; no measured speedup, guaranteed always-on/locked-screen behavior, silent install, automatic voice substitution or Stable release.

## Controlled validation

- New `tools/test-wake-recovery.cjs`: **20 checks** — STOP regression, echo tail, tap-mic ownership, old versus new utterance, all terminal paths, pending stream safety, missing/stale/contradictory readiness, wake OFF, rejected startup, fresh native reads, privacy and wiring.
- Full local `npm test`: **1,152 checks pass** (1,132 previous + 20) plus CSS/syntax validation on synced version85 assets. Native CI receipt follows separately.
- New `WakeStatusTest`: **12 JVM policy tests**, in addition to the previous 42. Android compilation/CI is a separate gate. These tests do not run an actual Android microphone/service.
- `tools/sync-version.cjs --check` must verify version85 and exact packaged web assets. Two pre-existing local workflow edits remain excluded from commits.

## Phone test — one safe foreground trial first

1. Install only the verified **5.17.3/code85** artifact over the existing app. Do not uninstall/clear data; stop if Android rejects it. Verify chats/settings and the same selected voice; no reselection should be required if the ID is saved.
2. With MAYA visible, finish/STOP any SUNO audio. Do not disable echo/self-trigger protections. Check typed Chat still works.
3. Enable wake (OFF then ON once if already enabled). Allow the Android mic permission explicitly if asked; after allowing, retry the switch explicitly. Wait for **MIC READY**, not just the enabled switch. No battery exemption is needed as a substitute for a foreground test.
4. Without tapping the mic, say **“Maya, Pakistan ka darul-hukumat kya hai?”** Record whether it reacts, whether text arrives, then whether the same selected voice speaks. Do not use side-effect commands to test.
5. If no ready/reaction, open Settings > SHOW DEVICE TEST STATUS again (manual refresh). Share the **Native wake / Reason / Code**, service/foreground/permission, native audio state/Fish active/app mic paused and start/ready counter lines. This snapshot excludes keys and chat. Do not share full Doctor/KAAN logs.
6. If blocked by legitimate pending/playing audio, wait or use explicit STOP; never force the mic open over output. If permission/start rejection is reported, share that reason rather than bypassing Android safeguards.

Only after this passes: SUNO STOP→wake, completion→wake, no self-trigger, wake OFF during startup, tap-mic priority, failure/retry and foreground versus locked-screen checks; then five typed/five spoken unique-tag latency trials per [Phase 3 protocol](PHASE3-DEVICE-TEST.md). Missing timing markers are unknown; a native READY/playing event does not prove recognition or audible output. The wake path still does not emit the tap path's speech-end marker, so do not misattribute it.

## Build/delivery receipt

**CI passed; code85 artifact offered for manual in-place testing. Phone wake acceptance remains pending.**

- Runtime source: `a00c48a0d52bb7f8d91c2cae35eda674295d3270`.
- [CI run 34470774866](https://github.com/adil-chandio/Mana-android/actions/runs/34470774866), job `102849909714`: successful compilation, **54/54 native JVM tests**, zero failed/skipped; actual APK identity/signature verification passed.
- [Download MAYA-APK ZIP](https://github.com/adil-chandio/Mana-android/actions/runs/34470774866/artifacts/10149471250), artifact `10149471250`, API ZIP size **5,668,023 bytes**, not expired at receipt. GitHub login may be required. Extract `app-debug.apk`, then update the existing app.
- CI identity: **com.maya.ai / 5.17.3 / code85 / minSdk26**, development/debug, update trust **false**.
- APK SHA-256 from CI: `c95134f29feb2307da918fbcd4fae0534ff005442cf61db317dbcddfd8184afc` (APK, not ZIP).
- Development signer SHA-256: `ba5f9e07a474cad5f8d8123c79e618f1a76976d7561d901d4df3f5a3da32d24a`, same as the previous candidates. Actual phone install/data retention still must be checked.
- Sandbox download attempt reached the redirected storage endpoint but returned EOF. No local binary inspection/attached APK is claimed; the receipt is from CI and the verified artifact link is the delivery path.
- Local version85 full suite: **1,152 checks plus CSS/syntax validation pass**; version-sync and diff checks pass. No actual microphone/voice latency measurement in the sandbox.
- Non-fatal action deprecation/cache400 warnings remain; the two pre-existing workflow edits were neither altered nor staged.

Subsequent documentation-only commits do not change this binary. Draft PR7 stays unmerged, production signing/bootstrap is not activated, and Stable stays on hold. Do not reinstall code84/83 for this repair. A distributed successor to installed code85 must have a higher version code.


## Subsequent user feedback and next planning request

After the code85 delivery and requested foreground wake trial, the user reported “Ok chal rha ha ache se” and requested a next-level structure. Record this as positive basic-use feedback, not a measured latency result or proof of all locked-screen/STOP/restart cases. No new failure was reported in that message. Preserve code85 as the user-reported working baseline while completing the remaining acceptance sheet.

The next deliverable is [NEXT-LEVEL-STRUCTURE.md](NEXT-LEVEL-STRUCTURE.md): planning only, with separate approval gates. No runtime or APK change was made for that request.
