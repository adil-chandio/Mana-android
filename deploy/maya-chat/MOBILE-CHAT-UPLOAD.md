# Mobile chat v1 — guarded Chat-OFF candidate

Owner requested continued routine completion after explicitly confirming Chat
OFF and successful bounded live two-turn recall (Context: 4). This increment
improves mobile presentation and explains tab-memory context loss. It does not
repeat model tests, change persistence policy or expand capabilities.

## Artifact and scope

- Worker: 90,726 bytes.
- SHA256: d85ceb6a760b60a831072525e2388569e8338fe9ba45aed9450988661639c701
- Tag: maya-mobile-v1-d85ceb6a
- Required sole parent: f6e26dde0ccdb8911b1359f1755e76fb69f229d0
- Footer includes mobile chat v1; earlier timing/diagnostic/null markers retained.

Compact header, conversation-first layout, optional access/replay disclosure,
visible Refresh = new conversation notice, dynamic available-context note,
empty state, draft counter, larger mobile action controls, distinct message styles,
result/timing panel, keyboard disclosure and skip link. Consent/privacy/limits,
STOP uncertainty, fixed diagnostics, literal text rendering and key/DB unchanged.

Native beforeunload warning is attached only while draft/display messages exist.
It is best-effort, especially on mobile: no promise of preventing reload, browser
termination or lost history. No data saved by the warning. Current pagehide clears
chat even with persisted=true; idle visibility loss preserves it. Owner-approved
reload/clear still discards tab-local chat. No automatic send or key operation.

Only browser assets change in the runtime bundle. Model, parser, session timing,
server auth, signing, nonce/replay, quota, expiry, 256-token cap and timeout values
remain unchanged. No APK/Fish, Agent/device action, paid service, external asset,
new dependency, analytics, storage synchronization or CSP change.

## Tests and preservation

219 runtime + 91 legacy + 326 uploader tests pass (636 total). 24 local HTTPS
browser groups pass and seven axe states have zero reported checked violations.
Actual crypto/storage and bundled Worker, but all provider replies synthetic.
320–1280px layouts and a 320x400 short viewport tested; no physical keyboard claim.

New UI checks: Enter newline without requests, character count/maxlength, consent
retained, explicit optional check panel, no native warning on empty/cleared draft,
warning on nonempty draft, cancelled navigation preserving Context: 4/no request,
accepted reload discarding chat but preserving key. Existing STOP/deadline,
context exclusion, lifecycle, replay, quota, key invalidation, malformed output,
reasoning/privacy, nullable-only compatibility and inert text tests retained.

Both bundled artifact copies and recorded build input hashes verified before push.
Only six reviewed deploy files committed; local backend source/tests/reports remain
in the existing backend tree. Protected unrelated files preserved. Browser tools,
TLS fixtures and screenshots remain in external cache, not repository dependencies.

## Upload safety

Uploader logic unchanged; only source/artifact/tag/message pins advance. Two
latest=active preflight reads, strict literal latest AI inheritance, bounded full
opaque AI metadata readback, nine binding preservation, owner key/DB/origin,
acknowledgements, Chat OFF/pairing ON/logging OFF and active version readback
remain. Non-atomic reads are not a lock: dashboard settings/deploy/Retry must stay
untouched during upload. One POST maximum / 11 bounded API stages; no automatic
retry, promotion, cleanup or raw error-body logging.

One normal push to the fixed branch with [skip actions] and final skip-checks
trailer; observe exact commit's Cloudflare check and Actions without rerunning.
After success, owner promotes this Chat-OFF candidate to 100% and checks /chat's
new layout, refresh warning and mobile chat v1 marker. No model request or repeated
access/key test is required. Phone rendering/native warning still needs owner
evidence; prior live context success is not proof of this new UI on the phone.
