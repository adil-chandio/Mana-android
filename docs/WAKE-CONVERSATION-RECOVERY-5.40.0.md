# Wake conversation recovery — 5.40.0 (111)

## Regression being repaired

The owner reports that voice/Wake conversation no longer works as before. The106 source forwarded a recognized `Maya + question` into the answer flow.107/108 changed native-host Wake to an input/Talk setup invitation, losing the question;110 additionally denied the old unowned listening route. Passing component/containment tests did not validate the interaction the owner expected. This repair targets that integration failure, not another UI redesign or a Fish reference reset.

## Existing Wake control now starts an actual conversation scope

In Voice settings, **Start Wake / Wake ON** opens one native review of the existing AI account/model and saved Fish conversation scope, then returns to the same workspace. No microphone or AI request starts before that approval and any required OS microphone permission. A saved ON preference alone is not claimed to be an active microphone.

After approval:

1. The existing protected Fish conversation is created in `wake-waiting`, without sending a model request or opening a second recognizer.
2. Native Wake captures the phrase while the app is foreground. Actual `onReadyForSpeech` changes the native status to Wake ready.
3. `Maya + question` is matched/stripped by a bounded native prefix parser. The question is delivered directly into that same approved Fish session—no second Talk/Send/Sunao dialog.
4. Bare `Maya` opens one following-sentence capture.
5. The wake recognizer is released before the AI request or normal conversation microphone takes ownership.
6. The answer uses the existing configured AI and the same saved Fish body/reference/player. After successful output, normal follow-up listening continues without repeating Maya.

This does not restore the old tool executor, raw device control, AutoSend or arbitrary HTTP bridge. Recognition output is only conversational input; phone actions remain unavailable.

## Ownership and startup recovery

- Native-only callbacks link Wake service, Main and the existing Fish session. No new JavaScript bridge export or caller-supplied approval was added.
- A wake match is claimed once, before stopping its service and forwarding the question. Wrong/late/duplicate session events cannot submit again.
- The actual service object is bound to the current Wake owner. An old service's destruction cannot cancel a newer session, and normal service shutdown after a claimed question cannot cancel its answer.
- Missing microphone-ready callback is bounded by an8-second startup check. Unexpected listener stop ends the waiting session with a visible reason.
- Silence/no-match recognition results no longer count as technical failures that permanently stop Wake after three quiet periods. Silence retains bounded backoff; technical errors retain the consecutive-error stop and the overall session ceiling.
- When Wake must fall back from an unavailable on-device language model, subsequent Main recognition reuses that runtime preference instead of immediately returning to the rejected on-device preference. This is input-recognition behavior, not a change to Fish output. Full shared input-service settings migration remains unfinished.

## Boundaries unchanged

Foreground only; background/STOP/expiry cancels this owner. Existing5-minute/5-turn conversation limits, approved provider/model/key snapshot, no tools, no automatic provider/key fallback, no retries of AI/Fish requests, strict Fish-only output, and separate typed Chat context remain. No fresh review per spoken turn within the approved scope. Quiet background, native capability quarantine and the reduced permission set remain intact.

Fish reference/key/persona, Worker endpoint/signing identity/model budgets, saved work and owner-reported Cloudflare Chat OFF were not changed. No app-data deletion, uninstall, voice audition, service/permission activation on the owner's phone or live AI/Fish request was performed by the agent.

## Verification

New native tests cover prefix/command preservation, bare wake, wrong/mid-sentence words, bounded alternatives, silence classification, actual native once-only delivery into the approved session, and old-service cancellation fencing. Node tests execute Wake waiting→question→AI→saved Fish→follow-up with fake transports, plus bare wake, duplicate/unowned/cancelled input, silence waiting and session expiry.

Existing historical wake assertions are adjusted to the native owner boundary rather than treating a `SAFE MODE` comment or the previous single error counter as proof. Android build/test/artifact results are recorded in the final delivery receipt.

These tests do not prove the owner's installed speech-service accuracy, actual audible output, network/account/model availability or latency. This is an in-place recovery candidate with verified code paths, not a claimed physical-phone PASS or full-project completion. Do not change the saved Fish voice or clear app data to diagnose a remaining failure.
