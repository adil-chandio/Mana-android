# Native Sunao — 5.21.0 (92)

## Approval and scope

After native 91's tab-preservation/confirmed-exit clearing phone check passed,
the owner approved the specifically described optional Sunao feature: chosen
reply text goes to Fish, with the unchanged selected Fish voice. This is NOT
permission for autoplay, mic capture, Agent actions, new credentials, paid models
or autonomous live inference/synthesis. Last explicit server Chat state is OFF.
Settled native auth/replay/basic recall and 91 privacy tests are not repeated.

## Implemented path

1. Each completed assistant reply gets **Sunao · selected Fish**. User drafts and
   user messages do not. More than 2,000 reply characters is refused, not silently
   trimmed or split into more requests. No button is automatically clicked.
2. Every playback requires an explicit native confirmation describing Fish as
   the additional destination, current selected reference, quota and STOP limits.
   Speech consent is separate from the text-chat checkbox. The message must still
   belong to the current conversation. Old/dismissed confirmations are fenced by
   a generation counter, including background/leave-and-resume.
3. Existing **original Maya must already be open** to expose its trusted local
   settings. Use its Settings → OPEN PRIVATE TEXT CHAT entry. If absent, return
   MAIN_REQUIRED rather than launching a hidden privileged WebView/activity or
   copying credentials into another persistent store. Do this before a conversation
   because leaving native Chat still clears its local history.
4. Native MainActivity uses an explicit Kotlin method, NOT a new JavascriptInterface,
   to evaluate a fixed preparation function only in the trusted packaged document.
   Native and JS idle guards must pass. Current saved Fish reference/key, Fish ON,
   expected free model and existing cooldown are validated. No setting is changed.
5. Preparation uses existing FISH.body/headers and BOLI pronunciation conversion,
   neutral mood and unchanged configured rate/temperature. The exact selected
   reference is snapshotted and matched to the body; no name/gender/default guessing.
   Later selection changes do not retarget an in-flight clip. The converter's
   BOLI.last diagnostic is restored even on failure so a private native reply is
   not left in the original assistant's conversion-history slot.
6. Credentials/body exist only transiently for this request. Bounded schema and
   field/type/range validation; redacted toString/errors. No key, reference ID,
   reply or header in copied Fish reports, logs or persisted diagnostics. Existing
   APK Keystore identity and browser/server public-key slots are not involved.
7. A dedicated FishStreamPlayer uses **speakExclusive**: an existing speaker is
   never stopped to make room. Runtime audio/action guards are rechecked. If legacy
   playback later replaces this opted-in owner, it receives INTERRUPTED, not a
   stuck busy state. STOP releases only the native-owned player. Existing legacy
   stop/replacement semantics and networking otherwise remain unchanged.
8. Native Sunao uses a separate strict OkHttp path: fixed HTTPS Fish endpoint and
   s2.1-pro-free model; no redirects, ambient cookies/auth, disk cache, retries or
   second wire exchange (including implicit HTTP follow-up). The legacy streaming
   path remains its prior HttpURLConnection implementation. No voice substitution.
9. Existing streaming caps: 30-second startup, 180-second playback, nonseekable,
   no re-POST, 24 MB maximum audio. Native owner adds independent 210-second total
   ceiling. Setup deadline is 1.5 seconds with stale/duplicate callback guards.
   STOP, confirmed exit, onStop and onDestroy invalidate preparation and stop owned
   playback. Audio focus loss/headphone-unplug stops native playback without resume.

Readiness is a snapshot, not a global lock on every independent legacy service.
A READY setup result does not establish provider authorization, free availability,
speaker identity or successful audio. DONE/PLAYING are application playback states,
not physical hearing, identity or latency measurements. STOP cannot guarantee
remote synthesis abortion or refund. No automated retry after any failure.

## UI and owner verification

Checks now has:
- **Check saved Fish setup · no network**: fixed local result only; no synthesis.
- **Test saved Fish voice · short sample**: separately confirmed fixed nonsensitive
  sample, so voice can be checked with server Chat OFF and no new AI reply.
- **Copy Fish report**: version plus allowlisted state/hint, no sensitive contents.

Foreground tab changes keep playback ownership; leaving the Activity stops it.
Voice errors do not remove text replies, append conversation messages, invoke AI,
or disable future text use after the voice owner finishes/stops. Global STOP stays
outside scrolling content and covers whichever local operation is owned.

After build, the owner should update in place (no uninstall/clear-data), keep Chat
OFF, open original Maya then its native Chat entry, and run ONLY the local Fish
setup check first. If READY, one explicitly confirmed short sample is the bounded
physical voice check. On error copy its fixed report; do not repeat synthesis or
change the selected reference to make a test pass. No key/enrollment/model recall
retest. Actual same-voice audibility, focus/headphone behavior and timing remain
phone acceptance, not something mocks establish.

## Regression coverage and protection

New pure JVM tests cover preparation schemas, bounds, no consent/no settings read,
setup-only behavior, stale/duplicate callbacks, STOP, deadlines, foreign-owner
refusal, fixed errors/no retries, strict HTTP configuration/one exchange, and
redaction. Android UI tests cover reply-only/manual confirmation, sample separation,
STOP/exit cancellation, missing Main without hidden launch, safe copied reports
and stale confirmations. Robolectric player tests exercise exclusive ownership
without creating an ExoPlayer or sending audio.

Node exercises the actual existing FISH/BOLI builders in a network-blocked VM:
21 standalone cases, plus the exact Kotlin-generated quoted script when run from
JVM (22 cases). Checks the reference/model/temperature/rate, no settings mutation,
BOLI diagnostic restoration, missing/malformed config, cooldown, changed reference,
text limits and script injection resistance. Full existing web regressions pass
with network blocked. This is not live Fish/model execution.

No new runtime dependency or permission, no worker/model/prompt/schema/auth change,
no APK private-key mutation, no server flag change, no updater/Stable activation.
Original Fish reference/key/preferences and selected speaker are never replaced.
Consumed uploader source pin stays closed for native-only commits. Protected
workflow/README/old repair-note changes and unrelated restored files are excluded.
Exact CI result, final artifact and remaining phone evidence belong in a separate
post-build receipt; no untested-success claim here.
