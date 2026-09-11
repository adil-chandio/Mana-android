# N0 + N1 first slice — 5.18.0 / code86

## Status

Approved by the user after code85 positive feedback. First implementation and CI verification are complete; **physical acceptance remains a separate gate**. N0 full physical acceptance and the whole N1 roadmap are not declared complete. N2 updater activation, memory migrations, new phone skills and cloud jobs were not performed.

## Baseline protection

Reconciled the recorded remote source history without changing working-file bytes or switching branches. Reran the code85 baseline: **1,152 checks** plus CSS/syntax and asset/version checks passed. The user says it works well; no new phone measurements are available here. Existing workflow edits are protected and excluded from commits.

## Reproduced issue and behavior changes

A controlled test reproduced a silent follow-up microphone remaining open after its configured window, then accepting a late native result. The new input owner closes that session on expiry. Speech beginning within the window may complete, with an overall 30-second attempt limit. Explicit tap is independent of the follow-up window; bare wake with window0 still permits one explicit input. STOP/wake OFF closes follow-up authorization, not the selected voice setting.

New `listenOwned` callbacks echo a validated page/session nonce. Final/partial/error/ready/begin/end callbacks are accepted only for the current microphone owner. Late old callbacks cannot end a newer mic or execute its old text. JS callback-time deadline checks supplement timers; native recognition also has a generation-guarded 30-second deadline. Deadlines depend on scheduled event loops, not hard-real-time OS guarantees.

Older native bridges remain usable but lack the new ownership guarantee and native duration evidence. Browser recognition uses its recognizer-instance owner; no cross-clock duration is invented. Native wake final results carry a per-listener speech-end-to-final duration. This is not a new hotword recognizer or a claim of locked-screen/full-duplex support.

## Correctly scoped timing

`SESSION_TIME` is a bounded in-memory ring of at most20 accepted inputs. No transcript, voice ID/name, key, audio, URL, persistence or upload is added.

- Origin: typed, tap, wake, follow-up, explicit auto, or unknown.
- Route: provider, cache, local or unknown. These are not mixed into provider comparisons.
- Speech-end→final: computed entirely on the Android monotonic clock within one recognition listener. Missing/endless/backward/excessive markers become unknown.
- Input accepted→text shown / final received→text: computed on the WebView clock. This excludes recognition processing before delivery and any pre-handler work; it is not a full microphone-to-audible stopwatch measurement.
- Fish app dispatch→playing callback: generation-owned, not a measurement of actual audible output or exact socket-write time.
- Provider-only median/worst text and Fish-start summaries are per origin, for the retained window. Empty samples are unknown. Missing wake detections/failed recognition attempts are not included in accepted-input counts; record those failures separately during phone tests.
- Core local/BIJLI/owned AI replies pass their metric row explicitly through reply and persona speech wrappers. Unowned legacy/persona/utility replies, auditions and speech-only retries are excluded rather than attributed to an old input.
- The manual Device Test Status shows owned rows, current input phase and follow-up time. Older uncorrelated main-reply marker lines are replaced when the new module is available.

This first slice does **not** infer a speedup, tune STT silence thresholds, shorten user answers, switch provider/voice, reopen a mic over Fish output or introduce a second AI turn controller. Existing `TURNS` and audio generations remain the execution owners.

## Controlled tests

- `tools/test-conversation-session.cjs`:19 cases (expiry, bounded completion, window0, tap independence, stale callbacks, duration validation, privacy/bounded rows, cache classification and generation/epoch guards).
- `tools/test-conversation-integration.cjs`:5 cases exercising actual reply/persona/Fish pipeline, STOP, SUNO isolation, unowned reply exclusion and text preserved through Fish failure.
- `RecognitionTimingTest`:6 native policy tests (missing/zero/duplicate/backward/excessive/independent listener markers).
- Existing source-wiring assertions were updated for the explicit owner argument/helper extraction; existing voice-session fake timers now distinguish short handoffs from30-second limits.
- One existing Edge fixture failed its20ms wall-clock assumption once, then passed on rerun. Its wait is now completion-driven with a500ms fixture deadline; no Edge runtime behavior was changed.
- Verified aggregate: **1,176 local checks plus CSS/syntax pass**, **60/60 native JVM tests pass**. These are not phone/audio measurements.

## N0/N1 phone gate

Keep the user-reported working code85 until a verified candidate is explicitly chosen for manual testing. No automatic installation occurs. Never uninstall/clear data; Android rejection means stop.

For the new candidate, when approved for install:
1. Verify version/code, existing data, fast typed Home/Chat and the same audible selected Fish voice.
2. Test bare Maya and Maya+harmless question, window0 and15, silent expiry, sentence beginning near expiry, and a late callback after STOP/new input.
3. Check SUNO completion/STOP→wake, no self-trigger, permission/failure recovery. Screen-locked behavior is a separate test, not inferred from foreground.
4. Alternate five typed and five spoken questions with unique harmless tags. Record failures, cache/local classification and approximate audible timing; inspect the owned rows immediately. Never use side-effect commands as benchmarks.
5. If a regression appears, pause N1 promotion; do not layer memory/tools/cloud features onto it.

## Build receipt

Verified on 2026-09-11:

- Runtime source: `33372b6672b4d2f59b81355cb213917ada3e149b`.
- [CI run34569009494](https://github.com/adil-chandio/Mana-android/actions/runs/34569009494), job `103166915579`: successful Android build, **60 passed / zero failed / zero skipped**; actual APK identity/signature verification passed.
- Identity: `com.maya.ai`, **5.18.0 / code86 / minSdk26**, development/debug, update trust **false**.
- CI APK SHA-256: `25737b7224b92ed0566e3b47e147b23509921c1c4c8c346552d87b0649e9f426` (APK, not ZIP).
- Existing development signer SHA-256: `ba5f9e07a474cad5f8d8123c79e618f1a76976d7561d901d4df3f5a3da32d24a`.
- Artifact `MAYA-APK`, ID `10187100137`, ZIP size **5,672,701 bytes**, not expired at receipt. Archive URL: https://github.com/adil-chandio/Mana-android/actions/runs/34569009494/artifacts/10187100137 . This is an archive receipt, not a claim of delivery/installation or local binary inspection.
- A second run34569013396 for the same source also completed successfully; the receipt above is tied only to run34569009494.
- Full local suite, version-sync and diff checks passed. Protected workflow files were not staged or changed. Nonfatal CI action-deprecation/cache400 warnings remain.
- No live phone/audio/network measurements, Stable promotion, GitHub Release publication or automated installation were performed. Subsequent documentation commits do not alter this binary.

Updater trust remains false; signed bootstrap activation and a secure in-app upgrade remain N2 work requiring separate authorization. Per the approved structure, obtain agreement before another manual test distribution if updater activation is still blocked.
