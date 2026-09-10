# MAYA 5.17.1 recovery plan — diagnosis before implementation


Follow-up: Phase 1 was subsequently approved. Its implementation and validation status are recorded in [PHASE1-RECOVERY.md](PHASE1-RECOVERY.md); the diagnosis below is the pre-implementation baseline.
**Status: implementation paused; do not promote code 83 as a working/Stable release.**

The user installed the candidate and reports that tap-to-speak and typed chat no longer respond, with the UI stuck thinking. Their screenshot shows `VOICE_MISSING`, a thinking label, a retained native-mic hint, and inconsistent displayed version labels. This report overrides any interpretation of the earlier green build as end-to-end success.

This turn made no MAYA runtime, version, dependency, workflow or APK changes. It produced this diagnosis/plan, local controlled reproductions and an isolated Ruflo CLI installation. The pre-existing two local workflow modifications remain untouched. No deployment, new signing key or release was created.

## 1. What is established, and what is not

| Finding | Evidence / confidence | Consequence |
|---|---|---|
| New streaming path rejects an empty Fish voice ID while the buffered path permits it | Reproduced with production `FISH.block()` and an old/new bridge fixture; `public/index.html`, `FISH.block()` | **Introduced compatibility regression.** A legacy/default voice configuration now becomes `VOICE_MISSING`. |
| The voice picker still offers a selectable “Default awaaz (Fish khud chunta hai)” with value `""` | Production `fishFillVoices()` | UI and runtime policy contradict each other. Selecting this option cannot fix the streaming error. |
| Selected voice ID is empty at the point the error is generated | The screenshot's exact error corresponds to this guard, after its earlier checks | Does **not** prove settings were erased. Legacy default, failed persistence or an upgrade/migration path must be distinguished. Do not blame the user or invent their former voice identity. |
| Voice failure adds an ordinary AI bubble, and the Home mirror shows the latest AI bubble | Reproduced using production `reply()`, speech engine and Home bubble wrapper | A valid text answer can remain in chat/history while the Home answer card is replaced by the TTS error. This alone does not explain every typed-chat failure. |
| A planning exception after `thinking=true` leaves the flag set | Failure injection into production `askAI()` | No top-level `try/finally` turn cleanup. The mic entry point returns while `thinking` is true. |
| A provider promise that does not settle keeps the turn thinking | Controlled unresolved provider fixture; source has no overall turn deadline | A request can block mic entry indefinitely at the application-state level. The actual phone's stalled provider/request remains unidentified. |
| Gemini model discovery and generation use fetch without an AbortController/application deadline | `resolveModels()`, `geminiTry()`; source inspection | Per-request timeouts elsewhere in BRAIN do not bound this path or the entire multi-provider/tool chain. Browser/network behavior may eventually fail, but the app has no reliable turn deadline here. |
| Starting an AI turn while input remains active can produce both `listening=true` and `thinking=true` | Reproduced by invoking current input and turn entry points; Home text submission does not stop the mic first | The screenshot's mixed labels are consistent with unsynchronized state. A displayed mic hint is not proof that physical recognition is still active. |
| STOP does not invalidate an outstanding AI answer | Deferred provider fixture resolved after the current STOP flag/audio/mic effects | Old requests can still deliver a reply after cancellation. Clearing a UI flag is not request cancellation. |
| Some UI labels can disagree | Screenshot and independent status/mic/home rendering paths | One build label or “OK” badge is not a runtime-health check. Audit all visible version labels; do not infer two installed APKs from branding. |

**Not established:** the exact phone-side exception/network stall, whether the original Fish selection was named or provider-default, actual active microphone ownership at screenshot time, live Fish streaming success, or locked-screen wake reliability. No phone, emulator session, API key or private settings dump was accessed.

### Controlled reproduction record

Executed six assertions against production functions with fake DOM/bridge/network dependencies:

1. Empty Fish selection: old bridge `allowed`; streaming bridge `VOICE_MISSING`.
2. Successful text reply retained in history, but Home replaced by the voice error. `thinking` remained **false** in this isolated case: voice failure alone is not proof of the stuck-thinking cause.
3. Injected planning error: `thinking=true`; subsequent tap caused **zero** native listen calls.
4. Unsettled provider: `thinking=true`; subsequent tap caused **zero** native listen calls.
5. AI turn started while input active: thinking and listening both true; mic hint retained.
6. Deferred AI result after STOP: obsolete answer was still delivered.

Scratch reproducer/results: `/home/user/.cache/maya-tools/regression-5.17.1/`. These are failure-mechanism demonstrations, not recordings from the user's phone. No real network request, microphone, Fish synthesis or automation was executed by these reproductions. Cache files may not survive a restored sandbox; the cases above are the permanent specification for future regression tests.

## 2. What to retain

- User's installed data, API configuration, selected voice information, chat and memories. No uninstall, clear-data or silent settings reset.
- The prohibition on replacing the user's selected Fish voice with Edge, Android TTS, a different speaker or a paid model.
- Fixed endpoint/free-model checks, bounded audio size, explicit stopping and stale audio-callback rejection, subject to integration validation.
- Explicit automation confirmations and existing banking/password/OTP restrictions. Chat/voice recovery must not weaken action safety or replay side-effecting tools.
- Native Update Center verification/security checks. Its signing/bootstrap activation problem is separate from this runtime regression.

## 3. Recovery architecture — small, reviewable stages

### A. One conversation-turn owner

Introduce a small `TurnController` around existing handlers rather than rewriting the whole application at once.

```
IDLE -> LISTENING -> TRANSCRIBING -> THINKING -> TEXT_READY
  |          |              |           |           |
  +----------+--------------+-----------+-----------+
                   FAILED / CANCELLED -> IDLE
```

Each turn owns:

- Unique monotonically increasing turn ID.
- Input origin (Chat text, Home text, tap speech, explicit wake).
- Provider/model-discovery requests, tool continuations and retry timers.
- A single overall deadline and cancellation handle.
- Exactly one terminal transition.

Only the current turn may update status, display a response or launch its optional speech. A `finally` block must check turn identity before cleanup, so an old task cannot clear a newer task's state. New input must follow one explicit replace/queue policy; it must not create overlapping uncontrolled requests. STOP cancels work and invalidates callbacks, not just flags.

Ordinary conversation should use a finite overall request budget rather than multiplying full timeouts across providers. Final numerical budgets are to be chosen and tested explicitly; a deadline is a failure-recovery limit, not an “instant response” claim. Side-effecting tool actions keep their separate safety/confirmation limits and must never be automatically replayed.

### B. Text answers independent of speech success

```
AI result -> retain/render text answer -> TEXT_READY
                                  |
                                  +-> optional VoiceSession
                                      UNCONFIGURED / PREPARING / PLAYING
                                      FAILED / STOPPED / DONE
```

- A Fish configuration/network/playback error cannot erase, replace or block the answer.
- TTS status belongs to a dedicated notice attached to the answer, not a second ordinary assistant answer that overwrites the Home card.
- Unconfigured speech still allows typed chat and speech-to-text followed by a text response.
- Provide direct “Voice settings” and explicit “Retry voice” actions. Retry speech must not re-run the AI request or its tools.

### C. Explicit Fish selection compatibility

Treat these as separate states:

1. **Saved explicit reference ID:** preserve and validate the same ID/name; do not substitute a library entry.
2. **Legacy provider-default:** preserve that fact. It is not equivalent to knowing a stable voice ID. Explain the limitation and ask the user to confirm a named voice or explicitly opt into provider-default behavior if supported and tested.
3. **Unset/invalid configuration:** show setup guidance; keep chat usable.

Do not infer identity from a display name alone, fabricate an ID, silently choose the first library entry, or claim the old default speaker has been recovered. Resolve the UI's contradictory selectable blank “Default” entry. Validate the selected dropdown value after the relevant save/synchronization path, not before it. Test an upgrade using legacy saved settings, not only a fresh fixture with an explicit ID.

### D. One microphone owner and derived UI

Input owner: `NONE`, `WAKE`, or `TAP`. TTS preparation/playback and new text submissions must use explicit handoffs, not independent global flags.

- Chat and Home submission use the same input coordinator, with explicit differences only for reply preferences.
- Microphone hints clear on final result, error, cancel and new turn.
- One render function derives the main label, mic indicator, Home card and status badge from current state.
- Busy input must offer a visible stop/cancel action instead of silently ignoring taps.
- Keep multilingual whole-word wake matching; validate recognition and handoff on the actual device.

Android recognition is not a guaranteed hardware hotword engine. Foreground, background-with-Activity, screen-locked and Activity-destroyed behavior must be reported separately. Do not add automatic app launch or autonomous commands to hide this limitation.

### E. Observe only what is needed

Add a local, bounded diagnostic record containing turn ID, stage, duration, terminal reason and error class/status. Do not put keys, transcripts, contacts or audio in the new diagnostic record; no automatic upload.

Capture planning exceptions, promise rejections, timeout, cancellation and empty/invalid response handling. “JavaScript loaded” and “network available” are not equivalent to “current request healthy.”

## 4. Implementation order and stop gates

### Phase 1 — recover chat and cancellation first

- Add failing integrated tests for stuck thinking, thrown planning, never-settling provider, late response after STOP and consecutive submissions.
- Implement bounded turn ownership/cleanup and keep text usable regardless of voice configuration.
- Unify Home/Chat input and clear contradictory UI hints.
- **Stop and review** once these pass. Do not combine with new wake-engine/provider/voice changes.

### Phase 2 — compatible Fish setup and isolated speech UI

- Test named, empty, legacy-default, unknown and persisted selections across an upgrade.
- Remove the misleading Default-versus-required-ID contradiction without silently changing the voice.
- Make missing voice non-blocking for chat; preserve answer display when speech fails.
- Test retry without re-running AI/tool actions and selection persistence after restart.

### Phase 3 — streaming and microphone device validation

- Run real selected-voice streaming, cancellation, network interruption, incoming-call/audio-focus and repeated turn tests.
- Test at least five comparable typed and five spoken questions, recording text and actual playback-start timing separately.
- Test wake after silence, after a reply, after STOP, and under foreground/locked-screen conditions separately.
- Do not claim a speedup from mocked HTTP, `onStart`, a compiled APK or an analyzer score.

### Phase 4 — distribution only after acceptance

- New code must have a higher versionCode than distributed code 83; do not edit/relabel the existing artifact as fixed.
- Rebuild and verify identity/signature; test in-place installation and retained settings on the device. No forced downgrade/uninstall workaround.
- Signing/workflow access is still required for a configured updater bootstrap. The installed development APK has no pinned metadata trust key; no in-app delivery promise is possible until the first configured bootstrap is manually installed.
- Stable requires actual device approval. Existing draft PR/build success does not satisfy this gate.

## 5. Acceptance matrix

| Scenario | Required outcome |
|---|---|
| Typed question with blank/missing Fish ID | Text answer remains visible; voice setup notice only; next input works |
| Home text while tap mic is active | Input is handed off/stopped deliberately; no contradictory mic/thinking labels |
| BRAIN planning throws | Clear terminal error; busy state clears; mic/chat recover |
| Model discovery / fetch / JSON read never settles | Shared deadline cancels; no infinite thinking |
| STOP during AI or TTS | Work cancelled/invalidated; no later reply, speech, tool continuation or auto-retry |
| Rapid A then B submission | Only allowed current-turn output changes the UI; no old callback clears B |
| Explicit saved Fish voice | Same ID survives restart/upgrade; no hidden replacement |
| Legacy default | Clearly identified; no silent conversion to a different named speaker |
| Voice error after successful AI answer | Original answer remains on Home and in Chat/history |
| Bad/missing credentials / offline | Finite clear error; no logging of credentials or paid-model fallback |
| Wake recognition / tap / audio focus | One mic owner; cancellation and callbacks agree with actual device state |
| Signed updater delivery | Configured bootstrap and compatible higher-version release verified; otherwise accurately reported blocked |

## 6. Ruflo — installed tool, not a substitute for evidence

Completed the requested `gh repo clone ruvnet/ruflo` in a separate location. To keep the large external checkout and dependencies outside MAYA and snapshot patch limits, the checkout is stored under the workspace cache.

- Source: `/home/user/.cache/ruflo/source`
- Source commit: `9576a1032b0749ac12d08fd9d05b86d4bee893b5`
- Published CLI package: `ruflo@3.40.0`, resolving `@claude-flow/cli@3.40.0`
- Install prefix: `/home/user/.cache/ruflo/cli`
- Runtime: Node `v22.22.3`, npm `10.9.8`
- Installation: `npm install --prefix /home/user/.cache/ruflo/cli --ignore-scripts --omit=optional --no-audit --no-fund ruflo@3.40.0`
- Core CLI checks: `ruflo --version` -> `ruflo v3.40.0`; `ruflo --help` and `ruflo analyze --help` succeeded.
- A local-only `analyze code --type complexity` scan ran on a scratch extraction of MAYA's inline JavaScript. It reported one large file, 7,658 estimated non-comment lines and 173 detected named-function declarations. These are heuristic/regex-derived metrics, not exhaustive AST or bug proofs. Its `exec()`/`innerHTML` flags are leads, not established vulnerabilities.

The source was cloned; the runnable CLI was installed from npm as documented, not compiled from the source checkout. Lifecycle scripts and optional addons were intentionally not enabled; optional/native/embedding integrations are **not** verified. Commands ran from a scratch directory with an isolated HOME and without inherited GitHub/provider credentials. No `ruflo init`, hooks, daemon, autopilot, agent swarm, MCP registration or automatic edits were run in MAYA. No Claude/Codex host executable was present; no paid/provider-key provisioning was attempted.

Cache paths may need reinstallation after a sandbox restore. Nothing from this external installation was added to MAYA's dependencies or APK. Ruflo does not grant Android device access, supply the missing Fish identity, repair signing permissions or prove runtime correctness.

## Approval required

Proceed with **Phase 1 only** after the user approves this structure. Before Phase 2, ask whether their former Fish selection showed a named voice or “Default”; a cropped voice-selector screenshot without API-key fields is sufficient. Do not request secrets or a private full settings export.
