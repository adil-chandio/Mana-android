# Native local-readiness repair — 5.19.2 (90)

## Owner evidence and exact scope

Screenshots `Screenshot_20260913-154858.png` / `154859.png` show Context 0,
nonempty consented draft (`Mera code nadi-62 hai. Sirf OK likho.`), and the generic
original-assistant busy/not-ready error at 0.03 seconds. This branch exits BEFORE
the executor runs key signing/transport. It is not a Cloudflare/model failure or
a demonstrated recall failure. Previous empty native auth/replay PASS and first
native AI response `Theek` remain passed; no need to repeat them.

The generic v89 message cannot identify the exact failing phone predicate.
Code review confirmed TWO false-positive conditions:

1. `recognizer != null` was treated as microphone activity even though terminal
   onResults/onError can leave the object allocated after recognition ends.
2. `settings.convoMode` was treated as active/automatic work. In the existing app
   it changes response wording and voice pitch, not whether a task is active.

These are verified code defects, NOT proof either was the screenshot's exact
cause. Genuine enabled Wake/auto-listen, active output, pending work or an unknown
legacy UI can still properly block isolated native Chat.

## Repair

- Track recognition activity from start through guarded terminal callbacks and
  stop. Keep it busy if recognizer destruction fails. Existing generation guards
  prevent old callbacks from clearing a newer session. No recognition engine,
  language, timing, dispatch, voice selection or speech callback content changes.
- Remove only the unrelated conversation-style preference from readiness.
- Continue blocking actual/unknown audio, Fish output, Wake preference/service,
  queued/running actions, native HTTP, active recognition/TTS, untrusted local
  document, UI loading/unresponsiveness, auto-listen/proactive/notification speech,
  and owned legacy turn/input. No blanket READY fallback for malformed responses.
- Replace ambiguous boolean results with exact allowlisted local reason codes and
  fixed guidance. JavaScript evaluates only in the trusted packaged document and
  returns a fixed code, not text, settings dumps, user inputs or provider details.
- Add **Check local Send readiness · no network** plus **Copy readiness report**.
  It invokes no signer, transport, inference or device action. It works with server
  Chat OFF, and cannot enable Chat or change settings. Only its last fixed reason
  code is kept in dedicated local preferences; reports are historical, not auth.
- Send uses the SAME fresh gate, not a saved READY flag. The legacy UI callback has
  a 1.5-second local timeout with job/lifecycle/duplicate-callback fencing. Unknown
  or late state does not cause a dispatch. STOP/exit cancels a pending check.
- Remove Send's artificial dependence on displaying the PUBLIC key. An explicit,
  consented send still signs with the existing Keystore identity; if missing, it
  fails locally with KEY_REQUIRED before transport. No auto-create or rotation.

This is point-in-time readiness, not a global freeze of all independent services.
Native text has no route to voice/Agent execution. The owner remains in control
of stopping existing work or adjusting automatic-listening settings. No preference
is silently changed and the selected Fish voice is never substituted.

## Verification

Five new JVM tests exercise native predicates, active-session semantics, strict
WebView result decoding, saved-code sanitization, and run the actual fixed JS
script / recognizer wiring tests via Node. Thirty offline JS/wiring cases cover
style mode ON while idle, every blocked flag, missing/malformed state, active
ownership, no state mutation, safe errors and guarded terminal/start/stop hooks.
Existing native tests continue to gate assembleDebug. Static integration tests
assert every Send uses the gate and both Check/Send no longer depend on display
metadata. Fourteen existing web regression scripts passed with network blocked.
Build and physical phone results must be recorded separately, not inferred from
source/static tests.

## Repository and deployment protection

Restored workspace HEAD initially reported base `16363f3` while delivered files
were present. Read-only origin inspection confirmed latest delivered commit
`8119ac821c9da340d836f5db4ceca8b073455eeb`. After fetching the fixed session branch,
all remote-tracked working files matched except the four known protected dirty
workflow/README/repair-note files. No staged work existed. Only the SAME branch
ref and index were reconciled to that remote commit; every pre-existing working
file's bytes were verified unchanged. No checkout/reset/clean or other branch.

The new update retains package/development signer/Keystore alias/server origin,
protocol, quota, backend public keys and all existing permissions. This is not a
Stable release or updater activation. No uninstall/clear-data. The consumed Worker
upload pin remains unchanged and rejects this native build before API access.
No live AI request, server setting/key/DB change or backend upload is part of this
repair. The next phone step is ONLY the local readiness check with Chat OFF, then
copying its report; do not initiate another model test before resolving the gate.
