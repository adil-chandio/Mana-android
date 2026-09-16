# Exact-active AI inheritance upload — 2026-09-13

## Authorization and evidence

Owner approved the proposed preservation fix, local tests and ONE Chat-OFF
version upload: "Han barho ache se ab kaam poora karo ...". This stage does not
include live promotion, an AI request, binding changes, automatic retries,
logging changes, quota resets, key re-registration or APK/Fish edits.

Original diagnostic upload commit 9d4260e failed before POST with
EXISTING_AI_BINDING_REQUIRED_NO_UPLOAD_STARTED. Subsequent read-only V1/V2/V3
checks completed. Owner Screenshot_20260913-100337.png established exactly one
extra AI field, `project`, with ai_type=ai. Its value was not disclosed. The
project field's internal meaning remains unknown; do not treat it as harmless,
delete it, recreate it, or claim this explains the earlier model response error.

## Why this approach does not need to guess the project value

Cloudflare's official VersionCreateParams.Metadata binding schema provides:

```
{ name: 'AI', type: 'inherit', version_id: '<observed-active-version-UUID>' }
```

`version_id` explicitly selects the source version. Omission defaults to latest,
which is NOT safe for this task. `bindings_inherit=strict` fails on unresolved
inheritance instead of silently dropping the binding. Pinned source:
https://github.com/cloudflare/cloudflare-typescript/blob/faaaf89ed8064a9fb54de538ec3e89487f1302b0/src/resources/workers/scripts/versions.ts

Public metadata docs also distinguish version creation from immediate deployment:
https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/

## Exact safety contract

- Read current single 100%-active deployment and logging OFF configuration.
- Require the same nine unique allowlisted bindings, valid key/origin/DB,
  pairing=true, literal Chat=false, and three literal true/false review flags.
- AI must have name=AI, type=ai, and only name/type plus optional observed project.
  Other root fields remain blocked. Project presence/absence is not normalized.
- Snapshot full AI JSON metadata in memory only, without interpreting project.
  Bounds: 16 KiB UTF-8 for the full snapshot, 512 nodes, maximum depth 8.
  Reject non-JSON/prototyped/accessor/symbol/hidden/cyclic/over-limit values,
  nonfinite numbers and negative zero. Canonicalize object-key order only;
  preserve array order, values, value types and missing-versus-null distinction.
- Recheck active deployment and logging OFF before POST.
- Replace ONLY the AI entry in upload metadata with the inherit request above.
  Project data is NOT submitted as configuration. No latest fallback, no AI
  recreation, no renaming and no AI/settings/DB API is called.
- ONE Versions POST with strict inheritance; still nine API operations maximum.
- Read the uploaded version, validate all bindings/config again, and compare the
  full detached AI snapshot including all nested project data. Also compare the
  existing normalized configuration and recheck active deployment/logging OFF.
- Receipt includes aiBindingInherited=true and aiBindingVerified=true only after
  those checks succeed, along with aiEnabled=false and promoted=false.
- No AI metadata/name/value appears in receipt or build output. Local synthetic
  tests use canaries; the old read-only name diagnostic is not the active command.
- If POST fails or readback differs, stop with a fixed error. A version may exist;
  no retry, rollback, deletion, deployment, model call or success receipt.
- The existing 60-second upload deadline, bounded JSON body reader, API path and
  redirect controls, managed CI credentials and source/artifact guards remain.

## Artifact and source

Worker artifact unchanged: 83,087 bytes, SHA256
`589b28829e2154c06232c167c02ce5cbc9df0e68fb839af31830e79b9502db70`.
UI marker remains validation diagnostic v1; strict model acceptance unchanged.
Build tag: `maya-diag-inherit-589b2882`.

Upload source must match Workers CI HEAD, with exactly one direct parent:
`fb1796f3f67b65842587ba6be1dc95d6461d6113`.
The configured command returns to `npm run check && node upload-version.mjs`.
No Cloudflare build configuration or workflow edit is needed.

At turn start the sandbox Git pointer/index had reverted to the original checkout
while worktree files and the remote latest commit were intact. All 216 files were
hashed first; fetched remote fb1796f matched tracked files except four known dirty
paths. Only the existing branch pointer/index were restored, without updating any
worktree bytes. This was a local correction, not a push or Cloudflare operation.

## Verification

278/278 local build-side tests passed (242 existing, 36 added). Existing pipeline
assertions now require the guarded uploader. Provider fixtures resolve inherited
AI metadata instead of incorrectly echoing upload metadata as a version response.
Added tests cover JSON snapshot bounds/privacy/canonicalization, exact source UUID,
strict one-POST behavior, no project in multipart/receipt, nested metadata drift,
missing/null distinction, unresolved inheritance, unsupported readback, active
snapshot detachment and no retry/fallback/promotion. The actual synthetic CLI
asserts the exact inherit request and private-data-free receipt.

196/196 unchanged runtime tests passed. No new browser or live-model compatibility
claim; Worker/browser bytes were not changed in this fix.

## Bounded continuation

Stage only nine deploy paths (uploader, upload tests, package.json, two pipeline
regression files, README, this report, snapshot helper and helper tests). Verify
[skip actions] plus final skip-checks trailer, then one normal push on the existing
Arena branch. Observe exact-commit Cloudflare status and GitHub Actions read-only.
A green build must be paired with the successful receipt in the owner build log
before treating a candidate version as verified. No manual Retry on uncertainty.
Promotion remains a separate owner action after the receipt is reviewed. The
first failed model response is still undiagnosed until an approved live test of
the diagnostic Worker; this upload does not itself prove a usable model reply.
