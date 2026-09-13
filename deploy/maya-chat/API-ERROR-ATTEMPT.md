# Safe API failure reporting + one Chat-OFF attempt — 2026-09-13

## Owner scope and existing evidence

Owner approved the explicit offer: safe request-stage/HTTP-status/numeric-API-code
reporting, tests, then ONE controlled Chat-OFF upload attempt. No automatic retry,
live promotion, binding policy change, settings mutation or AI call is included.

The previous attempt was commit d3426d1b7dd4a689badc22d9ef734de98665c198,
Cloudflare build 4fe89a82-b1d2-4a55-98ae-749a7cdc70e0. It failed after entering
the upload stage with CLOUDFLARE_API_ERROR_VERSION_MAY_EXIST_NOT_PROMOTED.
That old report does not distinguish a failed POST from a later readback failure;
the prior HTTP status/body were not retained and cannot be recovered here.

Owner Screenshot_20260913-103631.png showed active version prefix 03ef19b1 at
100% traffic and no new inheritance candidate in the latest displayed Version
History. The failed build was listed separately. This is no evidence of a
successful upload and is not an independent API-wide proof of version absence.
Do not re-run the old build or claim the root cause is known.

## What changes

- Pin the new upload source to the direct successor of
  d3426d1b7dd4a689badc22d9ef734de98665c198; CI SHA must match HEAD.
- Label the existing nine requests explicitly, without adding/reordering calls:
  active_deployment, logging_preflight, source_version, active_recheck,
  logging_recheck, version_upload, uploaded_version, active_readback,
  logging_readback.
- On API failure, record only the fixed stage, integer HTTP status 100..599
  (otherwise unavailable), code-list state and at most three numeric error codes.
- Codes come ONLY from top-level errors[].code on success=false envelopes.
  Each must be an integer 0..999999. Reject the whole list if malformed, mixed,
  string-valued or longer than three; no coercion or truncation.
- Never output error messages, nested error-chain content, raw bodies, URLs,
  headers, identifiers, key/token data, project data or arbitrary property names.
- Non-2xx JSON error bodies are read with a 64 KiB bound; normal 2xx bodies retain
  the existing 1 MiB bound. UTF-8/JSON errors stay generic. No partial code output.
  Both success:false and non-2xx responses still fail, never become accepted.
- Private WeakMap links immutable diagnostic snapshots to actual upload failures.
  Arbitrary error properties cannot spoof a report. Clear request status after
  each successful API read, so later local guard failures are not mislabelled as
  HTTP failures. Network/deadline failures have unavailable status where unknown.
- CLI prints a five-line safe block followed by the original fixed failure code:

```
MAYA_UPLOAD_API_FAILURE_V1
stage=<fixed stage>
http_status=<integer or unavailable>
cf_code_state=<numeric|none|withheld|unavailable>
cf_codes=<up to three integers, or none>
```

These are diagnostic observations, not an automatic root-cause interpretation.
No failure details are printed on successful uploads.

## What does NOT change

Worker artifact: 83,087 bytes, SHA256
589b28829e2154c06232c167c02ce5cbc9df0e68fb839af31830e79b9502db70.
Tag remains maya-diag-inherit-589b2882. Model acceptance, browser UI and runtime
logging remain unchanged. No model calls are made by this build.

AI still inherits strictly from the observed active version UUID, never latest.
Full bounded AI metadata including opaque project data must match on readback.
All existing key/DB/nine-binding/flags/Chat-OFF/pairing-ON/logging-OFF/runtime,
artifact/source, active-deployment, one-POST and no-promotion guards are retained.
Existing 60-second overall deadline and response cancellation remain in force.
Successful receipt still requires every verification; uncertain outcomes never
trigger a retry, fallback, rollback or deletion. This is one POST per invocation,
not a durable exactly-once guarantee against manually rerunning a build.

## Local verification

313/313 build-side tests passed (278 existing, 35 added). Added coverage includes
all nine failure stages, HTTP200 success:false, bounded code validation, canary
privacy, immutable/spoof-resistant reports, HTML/bad JSON/UTF-8, 64 KiB error-body
cancellation, unavailable network status, stable deadline snapshots, no stale
status on local checks, source refusal and an actual CLI with a synthetic rejected
POST. That CLI must make exactly six calls including one POST, print exactly the
safe block plus fixed error, and print no private values or success receipt.

The existing suite still covers exact-active AI inheritance/readback, one POST,
no settings/deployment/AI writes, deadlines, malformed metadata and all guards.

## Continuation

One scoped normal push on the existing Arena branch, with [skip actions] and
final skip-checks: true trailer. Observe exact-commit Cloudflare and GitHub Actions
checks read-only. On failure obtain only the new safe block from the owner's log;
stop, do not Retry. On success review the upload receipt before any separately
approved promotion. The old model response failure remains undiagnosed.
