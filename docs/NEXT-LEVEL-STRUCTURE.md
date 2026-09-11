# MAYA — Next-Level Structure

**Planning only. No runtime change, dependency install, version bump or APK release.**

## 1. Baseline and direction

After the code85 wake-recovery candidate, the user reports “chal rha ha ache se” and requests the next-level structure. Treat this as positive basic-use feedback, including the context of the requested wake trial—not a completed device matrix. Preserve this working baseline.

Established history:
- User reports fast typed Chat and playback using the voice they explicitly chose from Fish Audio Library.
- Code84 wake trial failed. Code85 addressed a reproduced cancelled-audition speech-exclusion leak and added honest native readiness/failure diagnostics.
- Recorded code85 CI: 54 native JVM tests; local validation: 1,152 checks plus CSS/syntax validation. These are previous receipts, not tests rerun for this planning document.
- Exact spoken latency, locked-screen behavior, full restart/data retention and all cancellation scenarios still require explicit acceptance.
- Secure Update Center implementation exists, but development trust is unconfigured and authorized workflow/signing activation remains blocked. An exposed legacy development signer is not made private by copying it into Secrets.

**Goal:** a responsive conversational assistant that remembers only what the user permits, performs bounded verifiable tasks, and updates safely. Not an unrestricted background agent or a cosmetic rewrite.

## 2. What remains unchanged

1. Selected Fish reference, voice identity and fixed free-model policy. No Edge/device/different-speaker substitution to improve timing.
2. Working typed Chat, stored settings, memories and chat history. No clear-data/uninstall migration shortcut.
3. Explicit wake enable/disable, microphone ownership, echo protection, generation-bound cancellation and independent text/speech errors.
4. Banking/finance apps remain prohibited. Password/OTP/card fields are never read, typed or logged.
5. No automatic screen capture, private-memory upload, paid fallback, silent installation or downloaded JavaScript hotpatch.
6. One approved implementation slice at a time. Existing engines must be reused and tested, not duplicated.

## 3. Architecture

```text
Typed input / tap mic / enabled wake
                  |
          Input and intent validation
                  |
      One owned session / turn coordinator
      (extend TURNS; preserve cancellation)
                  |
         +--------+---------+
         |                  |
   Conversational answer   Proposed phone task
         |                  |
   BRAIN / DIMAAG       Policy + confirmation gate
         |                  |
         |              AMAL / native tools
         |              Observe -> act -> verify
         |                  |
         +--------+---------+
                  |
       Text visible independently of audio
                  |
       AWAAZ / selected Fish output
       SUKOON arbitrates microphone ownership
                  |
       Optional bounded follow-up window
       -> idle / require wake again

Shared support: opt-in memory, read-only health/timing, explicit Update Center
```

Native services remain responsible for actual microphone/player/Android capability state. UI labels reflect native evidence, not optimistic timers. A model's statement that it completed an action is not execution evidence.

## 4. Delivery stages and acceptance gates

### N0 — Protect the working baseline

**Before feature work:** record a short device acceptance sheet: typed Home/Chat, tap, wake with a question, intended audible voice, SUNO completion/STOP followed by wake, wake OFF, restart retention, and offline recovery. Test locked screen separately; do not infer it from foreground success.

Keep source/version/signer/checksum receipts. A successor must have a version code greater than every installed/distributed candidate (currently at least greater than85). Preserve data-compatible upgrade paths. Android generally prevents downgrade: an old APK is not an automatic rollback strategy. Recovery normally means a higher-code corrective build and tested data compatibility.

**Gate:** core flows have no known blocking regression. Unknown device behaviors stay marked unknown. A failed baseline check pauses feature rollout.

### N1 — Smooth, measurable conversation — recommended next implementation

**Outcome:** “Maya” starts a useful exchange; short follow-ups do not require repeating the full context or tapping the mic, within the user's explicit follow-up window.

Small slices:
1. Correlate timing with the correct input/turn/audio generation. Extend the existing owner instead of adding a competing controller.
2. Separate wake detection, listening, finalizing recognition, thinking, preparing audio, playing, follow-up and idle states. Never show listening while output owns the microphone.
3. Reuse the existing 0/15-second follow-up behavior. With window0, require a new wake phrase; with a nonzero window, show when listening is intentionally open and close it on expiry/explicit stop.
4. Keep text visible as soon as ready. Reply speech can fail/retry independently, without another AI/tool call. Preserve the selected voice.
5. Remove only demonstrated redundant waits/requests. A short spoken-answer preference is opt-in; do not silently truncate requested explanations.

**Measurement:** five typed and five spoken trials with unique harmless tags, then a larger sample if results are noisy. Record speech-end→final, final→text shown, Fish request→playing and actual audible-start observations separately. Use same-clock monotonic durations or explicitly calibrated clock boundaries; never subtract unrelated Android and WebView clocks. Mark missing timings, cache/local answers, retries and failures separately. Report median/worst, not an invented guaranteed subsecond result.

**Gate:** no text-chat slowdown/regression; fewer measured avoidable pauses where found; current-owner-only results; correct follow-up expiry; no self-trigger or microphone contention. Spoken latency may still be limited by recognition/network/Fish availability.

**Not in this slice:** always-listening full duplex. While output intentionally owns the mic, spoken STOP cannot be promised. Explicit tap/notification STOP is the reliable cancellation path to validate. Speaking over MAYA needs a separate echo-cancellation/interruption design and phone tests; never achieve it by deleting the existing speech shield.

### N2 — Reliable in-app distribution

**Outcome:** explicit Check update → verified release details → download → Android install confirmation, with the independent recovery entry still usable if the WebView fails.

Do not build a second updater. Activate and test the existing native Update Center after authorized workflow/environment/signing access is available:
- Decide compatible APK signing versus a separately approved/tested migration; an unrelated new key will not normally update existing installs.
- Provision the separate pinned metadata signing trust through authorized maintainer tooling, never chat credentials or runtime key enrollment.
- Build a non-debuggable, signing-configured compatible bootstrap. Development trustfalse/debug artifacts are not eligible secure updates.
- Manually install that first compatible bootstrap once; then test an actual higher-code update through the app.
- Exercise metadata/signature/checksum/package/version rejection, interrupted downloads, installer refusal and data retention.

**Gate:** real bootstrap→higher-code upgrade passes. No unsigned fallback, silent install, automatic polling, bypass of verification, or casual downgrade promise. Stable additionally requires the device checklist and explicit approval.

**Dependency:** review activation prerequisites alongside N1 planning, but ship one change set at a time. Resolve this before sustained feature waves. If blocked, do not call artifact links “in-app updates”; agree explicitly before another manual test distribution.

### N3 — Useful memory under user control

**Outcome:** “Remember this” and “Forget this” work predictably; the user can inspect and correct what MAYA remembers.

Reuse existing memory/DIMAAG structures. Introduce a small versioned record schema: fact, source, timestamp, user approval and optional expiry. Distinguish session context, explicit durable facts and tentative preferences. Avoid saving everything merely because it was heard.

- Memory screen: inspect, edit, delete; confirm sensitive deletions as required.
- Local-first storage. A separately designed, explicitly requested encrypted backup/import can follow with migration and integrity checks.
- No private Git repository synchronization by default. Local-first does not mean cloud inference is local: disclose any selected context sent to the AI provider; exclude sensitive facts unless explicitly authorized for that request.
- Memory, web pages and retrieved text are data, never permission to run tools or override safety rules.

**Gate:** restart retention, forget/edit correctness, no credential storage in memory, bounded retrieval and recoverable schema migration. Existing facts cannot be silently wiped or uploaded.

### N4 — Safe, verifiable phone skills

**Outcome:** MAYA can handle supported multi-step tasks instead of merely claiming success.

Existing `AMAL`, `execTool`, `MayaAct` and accessibility code are starting points, not proof every action is safe or supported. Audit a capability table first: implemented, permission required, verified on this phone, unsupported. Start with a few harmless skills—open an allowed app, adjust a supported setting, prepare a draft.

Task lifecycle:

```text
Explicit user request -> validate allowed intent -> bounded plan
-> obtain required confirmation -> verify app/node -> execute one step
-> verify result -> continue or stop with an honest outcome
```

- For automation, require the explicit authorized voice request; ambiguous intent means clarify. Casual conversation does not execute tasks.
- Send/pay/delete/buy/logout require confirmation; banking/finance apps remain blocked even if a confirmation is offered.
- At most three verified attempts per action, five-second per-action deadline, global maximum ten automation taps/types per minute; bound total plan length/time too.
- Verify target nodes before taps. No blind coordinates, automatic re-enable of accessibility, background screenshots or fighting a recent user touch.
- Persistent automation STOP control; user touch during execution aborts it. Cancellation cannot undo an action already dispatched.
- Web/screen/tool text must not generate authorization. Revalidate both capability and confirmation immediately before execution.

**Gate:** cancellation, wrong-app/wrong-node, changed screen, low-confidence recognition, permission loss and partial failure tests pass. Confirm success from observed results, not generated prose. Start with one approved skill, not unrestricted “full phone control.”

### N5 — Explicit research and background jobs

**Outcome:** requested research/file tasks can show progress and report completion while interactive conversation remains responsive.

Only after the previous gates: user-triggered bounded jobs, cancellation, sanitized job status and optional completion notifications. No unsolicited action, private-history upload or permanent server requirement. GitHub Actions or similar free-tier runners, if chosen, have quotas/cold starts; they are not the real-time wake brain and do not guarantee instant execution.

Audit any existing cloud/agent integration before expanding it. Installed Ruflo CLI tooling is not proof of an autonomous system. No feature is advertised merely because a dependency is installed.

**Gate:** explicit consent, bounded work/cost, no leaked credentials, cancellation and real execution evidence. Notification permissions/OS limitations are respected.

## 5. Code organization — gradual, not a rewrite

| Responsibility | Existing foundation | Proposed work |
|---|---|---|
| Turn ownership | `TURNS`, `handleUserText`, `askAI` | Correlate input/output generations and events |
| Wake/input | `KAAN`, `WakeWordService`, `WakeStatus`, native recognition | Truthful stages and owned timing markers |
| Output/mic arbitration | `AWAAZ`, `FISH`, `SUKOON`, `FishStreamPlayer` | Preserve speaker, boundaries and terminal cleanup |
| Intent/tools | `BRAIN`, `AMAL`, `execTool`, native services | Audit capability/confirmation gates and verified outcomes |
| Memory | Existing memory UI and `DIMAAG` | Explicit durable records and safe migration |
| Distribution | Native `update/`, release tooling | Authorized trust activation and tested upgrade |

Extract small pure modules only where tests first establish behavior. Do not split the monolithic HTML and change execution semantics simultaneously. Any new web asset requires packaging/version-sync coverage, offline loading checks and old-WebView compatibility. Keep native/UI contracts versioned and tolerate missing older bridge APIs without falsely claiming success.

## 6. Release discipline

For each approved slice:

1. State the symptom/benefit and evidence; write regression/acceptance tests.
2. Implement the smallest change with explicit ownership and cancellation.
3. Run full local checks; sync assets; compile/test Android in CI when applicable.
4. Verify actual package/version/signature and record an immutable artifact receipt.
5. Install compatibly without data clearing; ask for the specific phone acceptance result.
6. Promote only after acceptance. Stop on regression; do not stack unrelated changes over it.

### Workspace reconciliation prerequisite

During this planning turn, the checked-out branch is still `arena/01a089f7-mana-android`, but Git HEAD reports `16363f3` while the working tree contains the code85 implementation and prior documentation as modified/untracked files. Previous receipts identify runtime `a00c48a` and documentation `6bddbfc`. This is a source-control state discrepancy, not evidence the running phone regressed.

Before any next code change/commit/push, reconcile the working tree with the recorded/remote branch history without deleting work, changing branches or staging unrelated files. Preserve all pre-existing changes, especially both workflow files. This planning turn does not reset, commit or push anything.

## 7. Recommended approval boundary

Approve **N0 acceptance and N1 timing/conversation design first**. N1 begins with correct per-turn measurements and ownership tests—not a large UI redesign, a new voice, a full-duplex microphone or a promised one-second spoken response.

N2 signing activation, N3 memory migration, N4 each new automation skill and N5 cloud execution require their own explicit approval. “Make it next-level” is not permission for irreversible actions, secret provisioning or unattended phone control.


## N0/N1 approval and first implementation

The user approved N0+N1. Before editing runtime code, the recorded remote branch HEAD `6bddbfc0b8fd459a4c77675ef2185a6d67ed6951` was fetched and verified. Branch/index reconciliation used a mixed reset only, with before/after hashes verifying every existing working file was unchanged. A later session refresh restored the old local Git base again; reconciliation was repeated without discarding files. Both pre-existing workflow edits remain excluded.

Code85 baseline local checks were rerun: **1,152 pass**, plus CSS/syntax and version/packaged-asset checks. Positive user feedback is retained; the full N0 physical checklist is not inferred complete. First N1 implementation and limitations: [N1-CONVERSATION-5.18.0.md](N1-CONVERSATION-5.18.0.md). Stages N2–N5 are not activated by this approval.
