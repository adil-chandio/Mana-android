# Read-only AI binding diagnostic V2 — 2026-09-13

## Approved scope

Owner approved one additional read-only check for the fixed `raw` status after
V1 reported a correctly typed AI binding with one unrecognized extra own field.
No uploader retry, binding normalization, settings change, promotion or model
request is authorized by this check.

V1 commit: `8474da9e1b4254dfe20c2df4df066a4b2d535025`.
V1 Cloudflare build: `f9e75a72-8cbe-43a8-b248-2b9bbe48bcf1`, successful.
Owner screenshot `Screenshot_20260913-034820.png` showed:

```
ai_matches=one
ai_type=ai
extra_fields=one
unknown_fields=one
strict_ai_guard=blocked
READ_ONLY_COMPLETE_NO_UPLOAD_NO_DEPLOY_NO_AI_CALL
```

All optional fields recognized by V1 were missing. This does NOT establish that
`raw` is the extra field, its value, its semantics, or the cause of the earlier
model-response rejection.

## Public source motivating the additional label

Cloudflare's pinned upload-form source includes `raw: ai.raw` along with name,
type and staging in AI binding metadata:
https://github.com/cloudflare/workers-sdk/blob/164e4fb11c32ae4ad255998bcdc17dc5a3a74ec6/packages/deploy-helpers/src/deploy/helpers/create-worker-upload-form.ts

This establishes a field to inspect, not permission to preserve/drop it blindly.

## Narrow change from V1

- Add `raw` to the diagnostic-only recognized-key list.
- Emit only `raw=missing|null|true|false|other`; never print raw field contents.
- Keep extra-field count and strict name/type-only predicate unchanged. A present
  raw=false/null/true/other still causes the historical strict predicate to block.
- Keep unrecognized names collapsed to none/one/multiple, never serialize them.
- Change marker to `MAYA_AI_BINDING_READ_ONLY_V2` (14 labels; 16 total lines).
- Require one direct parent `8474da9e1b4254dfe20c2df4df066a4b2d535025`.
- Five GETs, 30-second total deadline, 1 MiB response limits, CI/source/artifact,
  Chat-OFF/pairing-ON/logging-OFF/active-deployment guards remain unchanged.
- Configured `npm run upload` still executes tests plus the read-only diagnostic.
  No package, transport, Worker bundle, strict uploader or model changes.

## Verification and continuation

216/216 local build-side tests passed (205 existing, 11 added). The actual CLI
is tested with synthetic raw=false input and must output only fixed labels with
no credentials or identifiers and exactly five GETs. New cases cover all raw
categories, nested private values, unknown names remaining unknown, inherited
raw ignored, and V1 source refusal. A green live build means a read-only check,
not an uploaded version or a fix.

One scoped push on the existing Arena branch, skip APK push workflows, observe
exact-commit checks without Retry. Read the V2 label block from the owner's log.
If the field or meaning is still unknown, stop and review; do not automatically
expand data logging, relax the guard, upload, promote or turn Chat ON.
