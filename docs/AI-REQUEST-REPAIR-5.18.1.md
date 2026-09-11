# AI-request recovery — 5.18.1 / code87

## Status and authorization

The user approved the narrow AI-request repair with “Ok” after code86 typed/wake timeouts. N1 feature promotion remains paused. This is a development recovery candidate, not a physical acceptance or measured latency result. Code85's earlier positive basic-use feedback remains historical; do not downgrade installed code86.

[Code86 phone evidence and controlled comparison](N1-CONVERSATION-5.18.0.md#phone-failure-report--2026-09-11-stop-n1-promotion): wake reached the AI path at least once; 163ms was recognition end→final only. Both typed/wake turns timed out at approximately15s before text or Fish dispatch. Controlled code85 **and** code86 tests reproduced discovery/header/body budget starvation; that does not identify the phone's actual network/provider/key/quota cause.

## Narrow runtime changes

- **Overall AI deadline remains15,000ms.** Discovery is capped at1,500ms, individual HTTP requests at5,000ms, provider attempts at6,500ms, always clipped to remaining ownership time. These are guardrails, not claimed response times. One hung discovery can fall back to the existing static model list; one failed/stalled provider leaves time for the next already-eligible provider. Not every eligible provider is guaranteed a turn within15s.
- Provider attempts are children of existing **TURNS**, not a second conversation controller. Expiry aborts owned transport/permission work and invalidates callbacks before failover. STOP/replacement cancels both child and parent. Deadline checks reject expired callbacks even if timer delivery is delayed. Late results cannot execute tools, overwrite answers, cache discovered models, or change provider/model cooldown state.
- Android Gemini GET/JSON POST now prefers the existing **cancellable async native HTTP** bridge even when AbortController exists. No Kotlin bridge change. Compatible Authorization headers survive. Headers/options the fixed native bridge cannot represent stay on browser transport; old-browser XHR preserves custom headers without duplicate Authorization/Content-Type. Fetch header and JSON-body waits are both bounded; caller abort signals are honored.
- Native HTTP exposes a complete response only: `*-response` does **not** claim separate native header/body timing. Browser fetch can distinguish `*-headers` and `*-body`. Old browsers without AbortController use abortable XHR for supported requests; unsupported/custom fetch options still receive a logical deadline and late-result rejection, without claiming a physical fetch abort when unavailable.
- A tool/permission step marks the entire turn as **no failover/replay**. Once marked, confirmation and intended same-provider tool-result continuation retain the original whole-turn deadline instead of the shorter pre-tool attempt budget. Gemini cannot restart a model/plain-history retry after that step; pool providers cannot replay tool-free on400/422 or fail over after a tool-result failure. Existing deliberate multi-step tool-result continuation remains bounded. A clear action-stopped notice asks the user to inspect completed actions before retrying; cancellation cannot undo a tool already completed.
- Device Test Status adds fixed provider/phase/transport/HTTP/result/elapsed fields. At most12 request rows and12 attempt rows per turn,20 history turns, memory only. Latest active/completed turn is displayed; snapshot is read-only. No URL, key, raw response/error, prompt/transcript, model/voice ID, or tool arguments are added. HTTP0 means no HTTP response recorded, **not** “bad key”.
- Submitted input reporting returns to idle when its terminal AI turn finishes, without changing a newer active microphone owner. Failed-action timing is distinct from text-ready.

## Preserved scope

Selected Fish reference/model and speech code are unchanged; no Edge/device voice substitution. Text remains independent of Fish failure. Provider/key eligibility/order, existing paid/quota cooldown policy, settings/storage/signing/data, wake listener ownership, follow-up policy and550ms echo shield are retained. No updater trust/Stable/Release activation, new voice/provider, new feature, unrestricted automation or background retry was introduced.

## Controlled verification

Before runtime changes, the initial12-test regression suite passed3/12: stalled discovery, header/body waits, provider-level hangs, native selection/cancellation and diagnostics failed. After repair and expanded coverage:

- `npm test`: **1,208/1,208 checks** (1,176 existing +32 new), plus the old-WebView CSS check.
- New suite: production model resolver, stalled discovery/headers/body/provider promise; native GET/POST selection, Authorization and cancellation; browser/XHR/custom headers; malformed JSON and HTTP401/402/429/503; real eligibility (missing/paid-blocked/cooling keys); stale discovery/tool results; STOP/replacement/deadline rejection; real pending confirmation/lateYES; Gemini result continuation; pool400/422/503 no replay; bounded/read-only/redacted diagnostics; terminal input status; caller cancellation; timer cleanup.
- Two new integration cases run the repaired typed/wake fallback through the **actual reply/persona/Fish path**, retaining the selected fixture reference and text when Fish fails. Existing voice/wake/conversation suites remain green.
- Version identity and exact canonical/packaged web assets checked. Every inline script parsed; diff whitespace checked.
- All request tests use mocks/synthetic credentials, not real provider APIs. CI/JVM/APK checks are separate. No physical recognition/audibility/network success or typed/spoken latency sample is claimed.

Android build receipt: **pending**. Expected candidate: `com.maya.ai`,5.18.1/code87,minSdk26,existing development signer,updater trustfalse. Do not distribute until receipt is verified. Protected workflow edits were not included.

## Phone gate after a verified, consented manual delivery

Manual candidate delivery is not the requested secure in-app updater. Do not uninstall, clear storage, force a downgrade or reinstall code86. Verify a compatible higher-code in-place install; stop on signature/install conflict.

1. Confirm5.18.1/code87, saved settings and selected Fish voice retained.
2. First try one unique harmless typed question, then one foreground wake question. Check actual text and audible selected voice separately.
3. If either stalls/fails, capture **Device Test Status** immediately: request provider/phase/transport/HTTP/result/elapsed plus owned text/Fish markers. No keys, full logs or transcripts needed. Do not guess the cause from HTTP0.
4. If both work, collect five unique typed and five unique spoken questions and report provider-only median/worst from owned metrics. Cache/local results are separate; playing is not measured audible onset.
5. Recheck STOP during waiting/speech, replacement, SUNO→wake, silent follow-up expiry, wakeOFF, restart/data retention; locked-screen reliability remains a separate gate.

Only phone evidence can determine whether this candidate resolves the reported failure. N1 promotion and later stages stay paused until provider text works on the device.
