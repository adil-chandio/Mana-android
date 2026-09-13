# Guarded latest inheritance — one Chat-OFF upload, 2026-09-13

## Evidence and authorization

Owner approved the explicit correction: latest uploaded must equal the active
version, verified twice before POST; use strict latest inheritance only then;
compare full AI metadata afterward. No promotion, AI call, automatic retry or
settings change. Owner was asked to keep dashboard settings unchanged during the
attempt. These checks are observations, NOT an atomic lock.

Screenshot_20260913-104713.png from the prior commit
`d03108512ac8cc5e73f605813437b8bcc5b0e01f` / build
`bf7f7c74-af07-4ced-ba88-58a14fe383e7` established:

```
stage=version_upload
http_status=400
cf_code_state=numeric
cf_codes=10057
```

Cloudflare's official code names 10057 INVALID_INHERIT_BINDING_CODE:
https://github.com/cloudflare/workers-sdk/blob/164e4fb11c32ae4ad255998bcdc17dc5a3a74ec6/packages/deploy-helpers/src/deploy/helpers/error-codes.ts

An independent OPEN, unmerged Alchemy PR reports an August 15 live probe where
explicit UUID inheritance failed 400/10057 with only literal latest supported,
while latest succeeded when latest uploaded matched active. This is corroborating
third-party evidence, not an official Cloudflare guarantee or our full error text:
https://github.com/alchemy-run/alchemy/pull/1035
Head inspected: d0b1450090ed035cbd49fe569d7ebedaac182eee.

The prior SDK schema allowed a UUID, but schema permissiveness did not establish
live support. The original response message was intentionally not retained;
10057 alone cannot prove its exact sub-cause. Do not repeat the UUID request.

## Narrow change

- AI upload entry becomes `{ name: 'AI', type: 'inherit', version_id: 'latest' }`.
- Add two fixed GETs to `/versions?page=1&per_page=1`, with NO deployable filter.
  The public versions SDK states the first version is latest; workers-sdk's
  versions helper confirms the result.items envelope. Pagination is not ignored
  as it would be with deployable=true.
- Require one item with a valid UUID and exact equality to the observed active
  UUID. Missing/malformed/unexpected list shapes fail closed. Never choose a
  different version, change active traffic, or synthesize/strip an AI binding.
- First latest check runs after configuration validation. Second is immediately
  before the POST, after the active deployment and logging rechecks and local
  multipart construction. All previous guards remain.
- Full AI metadata (including opaque project) and normalized configuration must
  still match on readback. Active traffic and logging OFF are rechecked afterward.
- Latest mismatch causes LATEST_UPLOADED_NOT_ACTIVE_NO_UPLOAD_STARTED. Existing
  undeployed uploads therefore block this attempt instead of being inherited.
- A new upload after the final read is still possible: this is NOT compare-and-swap.
  Different inherited AI metadata is rejected on readback, without promotion or
  cleanup. Equal metadata cannot establish which version won an intervening race.
- Safe failure details gain fixed stages latest_preflight and latest_recheck;
  error-code projection/privacy/bounds remain unchanged.

Request order (11 operations maximum, only ONE POST):
1. GET deployments
2. GET script-settings
3. GET observed active version
4. GET latest uploaded version list
5. GET deployments recheck
6. GET script-settings recheck
7. GET latest uploaded version list recheck
8. POST versions?bindings_inherit=strict
9. GET uploaded version / compare metadata and config
10. GET deployments readback
11. GET script-settings readback

The receipt adds latestMatchedActiveBeforeUpload=true only if every check passes.
It is not a promise of atomic source pinning. Existing aiEnabled=false,
promoted=false, aiBindingInherited=true and aiBindingVerified=true remain.

## Artifact, source and scope

Unchanged Worker artifact: 83,087 bytes, SHA256
589b28829e2154c06232c167c02ce5cbc9df0e68fb839af31830e79b9502db70.
New tag: maya-diag-guarded-589b2882.
Parent pin: d03108512ac8cc5e73f605813437b8bcc5b0e01f, one direct parent, CI SHA=HEAD.

No Worker/browser/APK/Fish changes. Existing nine bindings, key/origin/DB, review
flags, pairing ON, Chat OFF, runtime/logging controls, snapshot bounds, safe
numeric error report, 60-second deadline and no-retry behavior remain.
No private project metadata, raw error messages or credentials are printed.
The model-response failure is separate and remains undiagnosed.

## Verification

326/326 build-side tests pass (313 existing with intentional fixture/assertion
updates for the two additional reads and latest token, 13 added cases including
both new API failure stages). Synthetic CLI verifies latest on the wire and the
exact added GET query. Tests cover malformed/empty/ambiguous lists, valid but
non-active latest, drift between reads, exact request order, an unpublished
candidate blocking a same-source repeat, last-read race detected on metadata
readback, 10057 rejection without fallback, old source refusal and a hanging
second latest read preventing any later POST. No live success is implied.

## Bounded continuation

One scoped commit/push on the existing Arena branch with skip-actions safeguards.
Observe exact-commit Cloudflare build and GitHub Actions read-only. No manual Retry.
On success review the receipt before separately approved promotion; on failure
review the safe error block and stop. A failed readback may leave an unpublished
version; do not remove it or turn Chat ON automatically.
