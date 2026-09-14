# Foreground voice repair — 5.36.0 (107)

Implementation following the owner's14 September voice-structure approval. This is a bounded foreground-input repair and legacy-wake containment release, NOT a completed silent background keyword engine or fully hands-free AI mode.

## User-visible behavior

- Main workspace → Mic retains one-shot input as default. A new **unchecked** “Keep foreground voice input open · up to5 minutes” choice grants temporary input permission for the selected language/service, not Send or Fish playback permission.
- Input remains transcript review → Use transcript → same composer → manual Send. Existing Direct Remember permission still has its original limited scope.
- The active voice session offers **Continue listening** without repeating “Maya” or the input consent dialog. After a separately confirmed, successfully completed Sunao, capture resumes after a600ms echo guard if the same foreground session is still authorized and idle. Text-only replies wait for Continue listening so a recognizer cannot race the owner's Sunao choice.
- Each input retains the20-second acquisition/recognition ceiling. In session mode, up to15 seconds of no-speech wait starts at actual recognizer-ready; speech onset cancels that silence timer, not the hard20-second ceiling. The5-minute input-grant ceiling is not renewed by a long reply or additional turns. A long engine startup can leave less than15 seconds under the independent hard ceiling.
- End voice session/STOP/Settings/mode change/background/input failure revoke the temporary session. Losing focus during capture or the echo handoff stops it. Existing reviewed text is not automatically sent or treated as an action. Expiry ends input authorization; it does not revoke an independently consented in-flight model request or promise a remote refund.
- New native recognition timing shows ready latency and, when available, same-clock end-of-speech→final transcript duration. These are not model-only/Fish/audible latency claims. Timing clears with input and is not persisted.

## Legacy Wake migration is explicit

The new input dialog has a separate **unchecked** “Turn legacy Wake OFF to use native voice input” option when the saved/native Wake state is active. Choosing it on Start changes only legacy Wake. It leaves Wake OFF after session end, does not change Fish/server Chat, and never starts input if the transition cannot be verified. Cancel or an obscured/stale dialog does not apply it.

Native preference write, trusted fixed-script settings update and service release must be verified. A partial write/failed verification produces a fixed error with no automatic microphone retry; it cannot claim a fully successful transition. The migration uses a300ms bounded release-check handoff, not a repeated polling/start loop. Normal readiness/identity/service gates remain intact. An explicitly confirmed input start waits up to1.5 seconds for foreground window focus rather than racing dialog dismissal; late focus after cancellation/background cannot start capture.

Wake's saved preference is no longer permission to capture at startup. Main onPause releases legacy capture and closes its old continuation window; returning does not restart it. The compatibility service is non-sticky, foreground-only, stops after3 consecutive recognizer errors and has a5-minute runtime ceiling. “Start Wake now” in Voice settings is an explicit foreground action, not a boot/background trigger.

In the permanent native host, wake recognition is now an **invitation to native input review**, not a command sent to legacy handleUserText/reply. The native invitation is presentation-epoch fenced, has no text arguments, stops the old recognizer and opens the existing Mic review dialog only if idle/visible. A spoken “Maya + command” is not automatically executed, sent, or inserted into the composer in this release. The owner begins bounded native input and reviews the resulting transcript instead.

Compatibility browser reply continuations also receive a one-use, generation-bound, five-minute-capped ticket. It allows a long owned reply to renew the old follow-up window without reviving a closed conversation, a new wake generation, a cancelled output, or an expired ticket. The native foreground input timer is separate and ready-anchored.

## Sound, privacy and authority

- Removed app-owned mic-start, wake two-tone and conversation-close chimes. Did NOT globally mute alarms, calls, notifications or media.
- A selected Android recognition service can still produce its own tones and may process audio remotely when the owner chooses system recognition. This release does not promise silent system ASR or use undocumented audio-muting hacks.
- No new wake model, dependency, paid service, provider fallback or voice reference was added. VAD remains disabled; it is not advertised as a keyword detector.
- Wake alternatives do not reach the hidden legacy conversation/history handler in the native host. No offline wake transcript is retained for later replay. Existing older owner history/settings are not erased.
- Native input uses existing AndroidDictationPort/composer lease/readiness. The new ForegroundVoiceSession holds only language, engine choice, phase and bounded timers—no transcript, key, provider transport, action authority, persistent preference or network code.
- Native host foreground truth is cached on trusted page lifecycle callbacks; bridge/service callers do not read WebView state off its UI thread. A late native invitation cannot survive a presentation change.
- Exact Fish output, persona, Worker contract, signed identity,256-token budget, Chat OFF and native snapshot/backup policies remain unchanged. No automatic Send, model request, Sunao, screen capture, phone action or permission grant.

## Verification

New automated coverage:
-12 ForegroundVoiceSession pure tests: no startup capture, selected-service reuse, review/wait states, long replies, echo deadline, cancellation, stale echo/expiry, duplicate completion, output error,5-minute ceiling, bad clock and recreation.
-4 NativeDictation tests: ready-anchored silence, speech onset vs hard deadline, duplicate ready, same-clock timings.
-7 Main native surface tests: unchecked session option, separate unchecked Wake-OFF choice/cancel, native-only wake invitation, background denial/preference preservation, explicit-start focus handoff and no deferred start after background, and actual workspace speech-completion→input handoff with synthetic ports/no model request.
-5 Node conversation tests: long reply continuation, closed/new/expired ticket refusal, native-host no-hidden-dispatch/no-heard-log, no input/wake chimes, source-level startup/retry/background guards.

Network-denied npm tests and native static integration checks are run locally. Android compilation and native JVM/Robolectric suite require exact-head CI; see final delivery receipt for the outcome. No physical microphone, Fish identity audition, provider, locked-screen or battery test was performed by this implementation session.

## Remaining acceptance and next work

1. Owner-approved TECNO tests of input readiness, system-service tones, first-word capture, recognition misses, input/output handoff and real latency.
2. Qualify a properly licensed local KWS/compatible capture pipeline before offering optional silent background Wake. Quiet background currently means no Maya capture, not an always-awake claim.
3. Full native original-settings migration and stronger unified legacy-host containment beyond the wake entry point.
4. Full hands-free auto-Send/auto-speak needs a new explicit session-level policy; it is not borrowed from106 Remember or the input-session checkbox.
5. Broader web/media/GitHub/phone adapters/trusted updater remain separate unfinished work with their existing approval and privacy boundaries.

Install in place only. Do not uninstall or Clear Data. This repair is not a claim of flawless/full-project completion, guaranteed subsecond response, invisible microphone access or a trusted-updater release.
