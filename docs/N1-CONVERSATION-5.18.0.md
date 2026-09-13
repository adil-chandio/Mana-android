# N0 + N1 first slice — 5.18.0 / code86

## Status

Approved by the user after code85 positive feedback. First implementation and CI verification are complete; **code86 phone acceptance FAILED: user reports typed and wake AI timeouts. Further N1 promotion is paused.** N0 full physical acceptance and the whole N1 roadmap are not declared complete. N2 updater activation, memory migrations, new phone skills and cloud jobs were not performed.

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


## Manual test delivery approved — 2026-09-11

The user approved offering the code86 manual test APK. The recorded artifact10187100137 was rechecked through GitHub API: present, not expired, ZIP5,672,701 bytes. A local download attempt failed with EOF at the redirected storage endpoint, so no attached APK or local binary inspection is claimed. Offer the exact verified artifact URL above, not another similarly named run or an older code. No new build/runtime change was made for delivery.

First phone checks: compatible in-place install and existing data/voice retention, typed Chat, one foreground wake question, an in-window follow-up, and silent expiry requiring wake again. Do not uninstall/clear data if installation fails. Collect owned timing/status only if needed; no full logs or keys. Installation and physical N1 acceptance remain pending until the user reports results. Updater activation and Stable remain on hold.


## Phone failure report — 2026-09-11: STOP N1 promotion

User provided two code86 screenshots and the privacy-limited Device Test Status:

- Typed record1: unknown route, timeout, no text/audio timing.
- Wake record2: unknown route, timeout; native speech-end→final163ms, no text/audio timing.
- Last AI turn2: timeout at15001ms; active no. Thinking/listening/speaking all no in the manual snapshot.
- Wake enabled, service present/foreground/mic permission yes. Native ready, reason none/code0, age936ms; audio KHALI, Fish active no, app mic paused no.
- Process-lifetime start attempts39 / ready callbacks36; current WebView starts14 / heard1 / wake match1 / errors11 / last error7.
- Screenshots show FRIDAY selected, the bare-wake acknowledgement and AI thinking followed by the timeout notice. Persona selection is not established as the cause.

Interpretation: at least one wake was matched and a recognized wake-origin input reached the AI turn. 163ms is the native end-to-final component, not full wake-to-answer latency. Both accepted typed and wake inputs failed before text-ready/Fish dispatch, so changing TTS identity or Fish latency is not indicated. Current false speaking/listening flags show terminal cleanup, not success. Recognition error7 is NO_MATCH; it does not explain the separate AI timeout or establish11 failed intentional wake trials. An unknown route here is an incomplete answer classification, not proof of an absent API key or a specific provider failure.

### Read-only source/controlled diagnosis

No runtime changes made for this report. Compared runtime code85 (`a00c48a`) and code86 (`33372b6`): overall AI budget remains15000ms; Gemini transport/model-discovery policy is unchanged by N1. Provider/phase/HTTP evidence is missing from the user-visible snapshot, although TURNS internally records a stage.

A controlled fixture loaded the production model resolver, Gemini generation and TURNS pipeline from **both** source revisions, with an eligible fake backup available. Using an accelerated40ms overall deadline:

| Injected condition | Both revisions' result | Fetch calls | Native bridge calls | Backup calls | Replies |
|---|---|---:|---:|---:|---:|
| Model discovery never returns headers | timeout / discovery-headers | 1 | 0 | 0 | 0 |
| Generation headers arrive but JSON body never settles | timeout / provider-body | 1 | 0 | 0 | 0 |

This reproduces a budget-starvation weakness: a single fetch/discovery/body can consume the entire turn budget, preventing the already-eligible backup from being attempted. With AbortController present, Gemini uses WebView fetch even when native HTTP bridges exist. These are structural observations and injected failures, **not proof of a real CORS issue, invalid key, quota refusal, network outage or the exact phone request that stalled**. The initial fixture attempt still used its stub resolver and was not valid evidence; the table uses the actual production resolver. No real API or user key was used.

### Targeted repair approved — 2026-09-11

Pause feature work. First expose only allowlisted provider/phase/HTTP/elapsed failure details and reproduce the shared typed/wake request path. Bound model discovery and provider attempts within the owned overall deadline so one pending request cannot silently starve an eligible fallback; evaluate the existing native transport consistently without weakening headers/cancellation or free-only policy. Do not merely increase15s or retry side-effect tools. Preserve selected Fish reference, text/speech independence, wake ownership and explicit STOP.

The user answered “Ok” and authorized this narrow repair. Add controlled regression coverage for slow discovery/headers/body, backup eligibility, cancellation and no duplicate tool actions, then verify a higher-code recovery candidate and actual phone results. Do not recommend uninstall/clear data, a code85 downgrade, another code86 reinstall, or further N1/Stable promotion as a fix.

Implementation follow-through: [5.18.1 / code87 AI-request repair](AI-REQUEST-REPAIR-5.18.1.md). This does not retroactively turn code86 phone acceptance into a success.
