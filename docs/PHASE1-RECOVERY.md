# Phase 1 — bounded chat turns and recovery

Date: 2026-09-10. Implements the approved Phase 1 of [the recovery plan](RECOVERY-PLAN-5.17.1.md).

**Development repair, not an install/update release.** Version metadata remains 5.17.1/83 during staged work. Do not distribute another code-83 artifact to the affected phone. A distributed successor must have a higher version code, pass the remaining voice/device gates, and retain the installed app's signing identity/data. The reported failure in the installed build is not superseded by passing mocks.

## Changed

- `TURNS` owns each `askAI` request: generation ID, one 15-second overall deadline, stage, cancellation signal, registered cleanup resources, and exactly one terminal record. The deadline includes discovery, generation, body reading, confirmation and model tool continuations; it is not restarted per provider. A confirmation can therefore close before its own 15-second timer.
- Planning/formatting failures unwind through `finally`. STOP, replacement input and a manual mic tap invalidate the owner. Old completion/finally handlers cannot reply, cache an answer, launch the next tool/provider step, or clear the new turn/microphone.
- Gemini discovery/generation/body reading use an owned abortable request. Older WebViews without `AbortController` use cancellable XHR/native HTTP, not an unabortable fetch.
- OpenAI-shaped providers use cancellable POST requests. Model-driven web search/wiki/page/prayer requests use cancellable GET instead of the blocking native GET bridge. Weather discovery and its follow-up request carry the same owner.
- Native HTTP registers the socket before starting I/O; cancellation before attachment is remembered. All exits disconnect in `finally`. A native scheduler separately aborts at the request deadline even if JS is suspended. Connect/read timeouts remain bounded, redirects are disabled, responses are capped at 8,000,000 characters, and exceptions do not return URLs/auth details to JS. Activity destruction cancels registered requests and the scheduler.
- Pending tool permission is closed on cancellation. The next tool is guarded, and `open_file` is rechecked after its lookup. AI code workers terminate on cancellation and release their blob URL; AI code is **not** run on the uninterruptible UI-thread fallback when workers are unavailable.
- Removed automatic cooldown retry timers. Failure is a separate status with explicit retry instructions; it is not sent to TTS or inserted as a model answer/history entry.
- Home/Chat typed submissions share input/audio cleanup and both use the typed-input flag. Browser STT callbacks are detached/invalidated on stop; inactive native callbacks are ignored. STOP also invokes the existing automation kill switch.
- Selected-voice failure is a separate status on both Home and Chat. The original text/history stays intact, including when Fish reports `VOICE_MISSING`.
- Diagnostic turn records contain only ID, coarse stage, result and elapsed milliseconds, bounded to the last 20 records in memory. No transcript, API URL/key or automatic diagnostic upload is added.

## Intentionally unchanged / limits

- Fish voice selection, saved voice IDs, missing/default-reference policy, free model and no-substitution policy are unchanged. **Blank/default Fish compatibility is still unresolved**, not silently assigned another voice. Phase 2 must address this before voice acceptance.
- No wake engine, recognizer tuning, streaming player or latency claim. JS input handoff guards are not proof of physical microphone/wake behavior.
- This is a chat-turn controller, not a rewrite of every app subsystem. Independent photo analysis, legacy standalone utility handlers, explicitly scheduled reminders and already-dispatched native/OS operations are not all owned by it. Cancellation stops the owned AI request/continuations; it cannot undo an action already performed. Check actual outcomes before retrying side-effecting commands.
- Provider model discovery after an in-turn model-404 no longer launches the old blocking discovery bridge. Cached/static fallback candidates remain; explicit non-turn discovery remains available.
- JavaScript deadlines require a running/resumed WebView; deadline checks reject stale results on resume. Native HTTP also has its own independent wall-time cancellation task. Actual socket cancellation timing on Android still needs device testing.
- No release/updater workflow activation, signing change, version bump, uninstall, data clearing, new API/provider, or Ruflo dependency in the app. The two pre-existing workflow edits are excluded from this change.

## Validation receipt

1. Added integrated regression tests **before** production edits. All six initial cases failed on the old source (injected planning exception, missing deadline/cancellation ownership, late A clearing B, active input overlap).
2. Expanded to **25/25** passing controlled behavioral tests in `tools/test-turn-recovery.cjs`. Real production functions run with fake transports/mic/worker; no paid/live API calls or phone access.
3. `npm test`: **1,097 checks pass** (72 settings + 310 voice + 155 brain + 466 lab + 56 updater + 13 existing session + 25 recovery), plus CSS compatibility validation.
4. All 3 inline scripts parse; packaged `public/index.html` and Android asset copy are identical; `node tools/sync-version.cjs --check` and `git diff --check` pass.
5. Added 3 JVM `CancelableRequestTest` cases: cancel before attach, cancel after attach/idempotent release, successful completion release. Native build/JVM execution is pending CI at this receipt; no Java/Android SDK is installed locally.
6. Existing auto-retry assertions were explicitly changed to the approved manual-retry/status policy. The voice bridge source guard now follows the extracted HTTP implementation, still verifying text decoding stays separate from raw-byte voice handling. No behavioral failure assertion was simply removed.

Commands:

```sh
npm test
node tools/sync-version.cjs --check
# On an Android/JDK build runner; assembleDebug also depends on native unit tests:
gradle testDebugUnitTest assembleDebug --no-daemon
```

## Before acceptance / distribution

- Obtain native compile/JVM result for this exact source revision.
- Complete Phase 2 saved/default Fish selection handling with user approval, then test the chosen voice on-device.
- On a higher-code, compatible, development candidate: typed Home/Chat with Fish available/unavailable; mic → AI → text → selected speech; STOP mid-request; immediate A→B; offline/timeout recovery; mic restart after error; old result suppression.
- Measure real latency and validate wake separately. Never infer either from these mocks or a green APK build.
- Distribution remains behind the existing signing/bootstrap/updater permission blockers and explicit device acceptance. No Stable promotion.
