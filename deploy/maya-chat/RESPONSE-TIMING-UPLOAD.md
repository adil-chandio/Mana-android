# Response timing v1 — guarded Chat-OFF upload

## Authority and established evidence

Owner observed a usable real reply on the null-compatible candidate, then
explicitly confirmed Chat OFF. Owner requested continued thorough completion,
with autonomous routine work and owner involvement only where important. This
scoped candidate adds local timing/status clarity for follow-up acceptance.
No autonomous model request, promotion, paid service or APK/Fish modification.

The old MESSAGE_TOOLS failure's precise fields remain unknown. The successful
2+2 screenshot is not a speed measurement, a follow-up test, proof of remaining
quota or general quality. It is not being used to relax any response validation.

## Artifact / source pin

- Artifact: 84,399 bytes.
- SHA256: 6c61eb3163c5bf09c6fdbe5377135d5f9c0d9669df9b33a74b64d012a78db6aa
- Tag: maya-timing-v1-6c61eb31
- Required sole source parent: 06d9846b44538167ed0f965b1ee1f81317efb061
- Footer marker: response timing v1 (earlier diagnostic/null markers retained).

## Narrow delta

Client displays one local elapsed duration per finished/stopped text attempt,
including key access/signing, network, response reading and validation. This is
not model-only speed, provider completion/cancellation time, DOM paint time or
time to first token. It is tab-only state, never request/header/history/storage
telemetry. No recurring measurement timer or extra request is introduced.

Local deadline/duration clock is monotonic performance.now(); wire signing still
uses epoch Date.now(). Existing 20-second local / 12-second server deadlines,
expiry allowance and model/budget settings are unchanged. STOP/late completion
fences prevent stale timing from overwriting new results. Clear, new attempt,
preflight refusal, access check and reload remove stale measurements.

Removed obsolete static 'No live inference verified for this candidate' wording
and contradictory idle status after clearing a successful conversation. No model,
server parser/auth/quota, database, browser key, origin or capability change.

## Local verification

- 219 runtime Node tests pass, including 10 added timing/context tests.
- 91 legacy pairing/chat tests pass.
- 326 build-side uploader tests pass with new source/artifact/tag pins.
- 20 synthetic local HTTPS browser groups pass with actual browser crypto/storage
  and the bundled Worker. Six axe states have zero reported violations; tested
  widths 320–1280px fit. No external browser requests or runtime errors.
- Precise 1,234ms synthetic timing covers key/sign/network/body stages; tests cover
  STOP, deadline, network failure, malformed response, denial, resets, stale result
  isolation, epoch signing versus monotonic duration and unchanged wire/history.
- Follow-up test preserves exact completed history across an intervening failure;
  failed turns and timing metadata never enter subsequent signed context.
- Artifact copies/checksums and all build-input hashes are verified pre-push.

Tests are synthetic, not Cloudflare inference or phone latency evidence. Local
backend source/tests remain in the existing backend tree; only six reviewed deploy
files are committed. External-cache test tools/artifacts are not dependencies.

## Upload bounds and next owner step

Same guarded-latest uploader; only source/artifact/tag/message pins change.
Both latest=active checks, strict literal latest inheritance, full bounded opaque
AI metadata readback, owner key/DB/origin/acknowledgements, Chat OFF, pairing ON,
logging OFF and stable active deployment checks retained. Reads are not an atomic
lock: do not edit settings/deploy during upload. Detected mismatch stops without
promotion, cleanup or retry. One POST maximum and 11 bounded API stages.

One normal fixed-branch push, [skip actions], final skip-checks trailer; observe
that exact commit's Cloudflare build and GitHub Actions without Retry.

After successful upload, owner promotes this Chat-OFF candidate to 100%, verifies
response timing v1 on /chat, and can conduct ONE bounded two-turn synthetic
follow-up check. The owner manually enables Chat and explicitly sends each turn,
maximum two model requests/no retry; if the first fails, skip the second. Capture
reply/context/local wait; switch Chat OFF before reporting. No new real request
or promotion has occurred for this candidate at preparation time.
