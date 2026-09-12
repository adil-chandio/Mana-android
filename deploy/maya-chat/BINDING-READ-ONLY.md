# Read-only AI binding diagnostic — 2026-09-13

## Authorization and evidence

Owner approved the explicit offer of a read-only binding check: fixed labels for
expected type and known extra-field categories; no raw values, key/token output,
upload, deployment, settings mutation or model call. This is NOT an authorization
to relax binding checks, retry the uploader or resume the Chrome model test.

Prior commit `9d4260e1e8de32ab864badb02f5e0c0d843a1392`, Cloudflare build
`db0b0dce-7a54-4fa6-b046-964f52d8f458`, failed. Owner screenshot
`Screenshot_20260913-033138.png` showed 161 tests passing followed by:

```
EXISTING_AI_BINDING_REQUIRED_NO_UPLOAD_STARTED
```

The code reaches this check for an existing binding named AI, when its type is
not `ai` or when additional own keys are present. This failure was before the
Versions POST. It does not prove a missing binding, bad owner setup, any specific
extra field, or the cause of the earlier model-response rejection. Standard
SDK documentation alone does not establish the actual returned representation.

## Pipeline isolation

`npm run upload` is retained as the Cloudflare-configured command name but is now
exactly `npm run check && node diagnose-binding.mjs`. The diagnostic only imports
shared validation/Git-reading utilities; it never calls `uploadOnly`. Importing
the historical uploader does not execute its guarded CLI entrypoint.

The historical uploader, its strict AI predicate and its old source-parent pin
are unchanged. The new diagnostic commit cannot pass that historical upload
source gate. Worker bundle/hash, backend, APK, workflows and lockfile stay unchanged.
The frozen bundle is still 83,087 bytes with SHA256
`589b28829e2154c06232c167c02ce5cbc9df0e68fb839af31830e79b9502db70`.

## Read contract

- Existing managed CI/account/branch/token approval guards and artifact pin apply.
- HEAD must match Workers CI SHA, with one direct parent:
  `9d4260e1e8de32ab864badb02f5e0c0d843a1392`.
- At most five GETs to the fixed account/worker path, sequentially:
  deployments, script-settings, active version, deployments, script-settings.
- Require one 100%-active version, matching version response ID, nine unique
  bindings, literal plain-text Chat=false and pairing=true, logging OFF at both
  observations, and unchanged active deployment at the second observation.
- No custom request URL, cookies, redirect following, retries, write method,
  inference/D1 endpoint, rollback, version creation or promotion exists here.
- Overall 30-second deadline; each body bounded to 1 MiB, strict UTF-8/JSON;
  cancellation covers hanging fetches/readers and late responses.
- Raw API responses remain memory-only. No version IDs, account IDs, origin,
  public key, binding values, unknown field names, error text or tokens in logs.
- Output is exactly 13 fixed keys with finite-state labels. Recognized optional
  fields are staging, gateway, namespace, account_id, id, text and remote.
  Staging/remote emit missing/null/true/false/other; the other fields emit shape
  only. Unknown names are collapsed to none/one/multiple. These are observations,
  not a declaration that any extra field is safe to preserve/drop.
- No raw failed model output is accessed. This only investigates build metadata.

## Local verification

205/205 build-side tests passed: 44 new diagnostic tests plus all 161 existing
regressions (one pipeline assertion deliberately changed to require read-only).
Coverage includes exact GET sequence, no input mutation, type-only and additional
field projections, private canaries, duplicate/missing/inherited fields, finite
labels, missing environment, artifact/source refusal, historical uploader source
refusal, Chat/pairing/logging gates, malformed version/bindings, deployment drift,
HTTP/envelope/UTF-8/JSON/size failures, hanging fetch/reader, late cancellation,
arbitrary error sanitization and actual synthetic CLI output.

No live read is represented by these tests. A successful Cloudflare build is a
read-only completion, NOT an uploaded version or a compatibility fix.

## Bounded continuation

One scoped commit/push on the existing Arena branch, with `[skip actions]` plus
last `skip-checks: true` trailer, triggers the configured read-only command.
Observe the exact commit's Cloudflare check and GitHub Actions without Retry.
Then read the `MAYA_AI_BINDING_READ_ONLY_V1` report from the owner build log.
If an unfamiliar category remains, stop and review instead of printing raw
fields or weakening checks. Any compatibility edit and subsequent upload need
review/approval; do not turn Chat ON or promote during this read-only stage.
