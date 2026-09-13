# Native APK identity — guarded enrollment upload

## Owner authorization and live boundary

The owner supplied the APK public JWK after the 5.19.0 (88) delivery, reported
adding/deploying it as `APK_PUBLIC_JWK`, reiterated that Chat has long been false,
and supplied the 2026-09-13 14:00 settings screenshot. It shows APK_PUBLIC_JWK and
OWNER_PUBLIC_JWK separately, ENABLE_CHAT=false, pairing/review flags true,
Logs/Traces disabled and compatibility date 2026-09-11. Public values are truncated:
the screenshot cannot prove the exact keys, complete binding set or active/latest
version relationship. Managed API preflight must establish those conditions.

The previous attempt never opened the workspace because Arena's GitHub egress
refresh returned 502. No commit/push/upload was made during that failed attempt.
The connection now works. The previous native commit's Cloudflare check is marked
failure; its remote error text was not retrieved. Local tests confirm the prior
consumed source pin refused native-build commits before API access. Do not claim
the screenshot's red build indicator means the owner's variable save failed.

## Reviewed immutable inputs

- Required immediate sole parent: `e427b05bf15c07f0facd1ba824422ee308c60ece`.
- Exact Worker candidate (UNCHANGED from tested native build): 91,817 bytes.
- SHA-256: `23dab1613dd0bbce327a617c4b29611320726b0a831b8330a8b3f1d45eafa7db`.
- Tag: `maya-native-key-v1-23dab161`.
- Approved APK public-key fingerprint:
  `5FaZUK5cZuVFDEOUvAxqTvNME99OgM0YEPmpxxlpAfQ`.
- The supplied public point/encoding/import was validated in eight offline checks.
  No real private key or live native signature was obtained/used.

The public fingerprint is a build-side approval target, not an embedded Worker or
APK credential. The PUBLIC JWK is present only in uploader test data to exercise
the real CLI's immutable guard without a bypass switch. No private key is present;
tests otherwise use synthetic browser keys, DB/AI/configuration and mock APIs.

## Guard change for this operation

Generic preservation continues to validate nine bindings or ten with a distinct
APK slot. This specific upload now additionally REQUIRES ten bindings and the
owner-approved APK fingerprint, both before POST and on uploaded-version readback.
There is no environment override, auto-enrollment, slot creation, key replacement
or repair. Missing/different APK configuration fails closed with a fixed code.
The successful receipt adds `apkKeyVerified: true` only after full readback.

All existing protections remain: browser public key retained and distinct, same
DB/origin/review values, Chat OFF, pairing ON, logging OFF, full opaque AI metadata
preserved, two unfiltered latest=100%-active checks (second immediately before
POST), strict literal `latest` AI inheritance and complete config/active/logging
readback. Reads are NOT an atomic lock; owner must avoid concurrent dashboard
settings/deploy/Retry changes. Exactly one POST maximum across eleven bounded API
stages. No automatic retry, promotion, cleanup, D1 changes or live model calls.

## Validation and delivery sequence

337 uploader tests pass, including the actual CLI's sanitized POST-failure output,
correct-key enrollment, wrong/missing/duplicate key rejection, readback slot loss,
public JSON whitespace/member-order preservation and old-parent rejection.
The known Worker artifact hash remains exact. Backend regression results and live
check outcome will be recorded separately after observation, not inferred here.

Only uploader code/tests and this review note belong to this commit. APK/Fish,
voice/Agent permissions, Worker bytes and protected dirty workflows/README/repair
notes remain unchanged. Commit uses [skip actions] and a final skip-checks trailer:
no duplicate APK build is wanted. Managed Cloudflare Builds performs the guarded
upload; no managed credentials are extracted or emulated locally.

After successful upload/readback, owner manually promotes ONLY this tagged
candidate to 100%, with Chat still OFF. Then the owner uses the native APK's
explicit empty access/replay check (200 then 409, no AI). This proves native private
key possession/signing at that moment; a public JWK or screenshot cannot do so.
No old browser recall/visual acceptance tests or live model tests are requested by
this upload. Any later live inference remains small and owner-controlled.
