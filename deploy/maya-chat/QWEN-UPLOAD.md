# Approved Qwen AI-OFF upload — 2026-09-13

## Authorization and exact artifact

The owner approved safe Git preparation and **one unpublished AI-OFF version upload**
after the local Qwen result. No live promotion, inference activation/call, additional
logging repair, key/DB mutation, APK/Fish change, billing change or forced Git push.

- Worker: existing `maya-chat`, same origin, currently restored owner public key and DB.
- Branch: `arena/01a089f7-mana-android` only.
- Candidate model (not enabled): `@cf/qwen/qwen3-30b-a3b-fp8`.
- Artifact size: **76,459 bytes**.
- SHA256: `df11a78f2355982c9efdd53ae8bafefd236544a429bdc9edf12183edfa9bf0f7`.
- Exact byte-for-byte copy of the locally tested `backend/signed-chat/worker-upload.mjs`.
  Editable runtime source/tests remain in the Arena workspace; this package is
  self-contained and does not need those untracked source paths during the build.
- Previous artifact hash `8105db539ef8d49415e6c37addfcabe282e7edcb1c5d7889c17ac8294752fd29`
  is historical, no longer accepted by the active artifact guard in this commit.

## Build behavior

Dashboard commands remain `npm run check` and `npm run upload`, rooted at
`deploy/maya-chat`. The upload command still runs tests then `upload-version.mjs`.
No default Wrangler deployment, dependency install hooks or additional CI jobs.

Existing CI/branch/acknowledgement/account/artifact gates are retained. The existing
build acknowledgement `MAYA_UPLOAD_APPROVED=diagnostic-only-v1` is necessary but no
longer sufficient: a **new source-parent gate** requires the raw Git HEAD to equal
`WORKERS_CI_COMMIT_SHA` and have exactly one parent,
`8ef51c86572e770d7d7916724dcb2e8f61802438`. Git reads are bounded, shell-free and
sanitized. Raw `cat-file` parent headers support shallow Cloudflare clones.
Unrelated future descendants fail before any Cloudflare API request.

At most one Versions POST per invocation; never POST deployments, PATCH settings,
write D1, add AI binding, change variables, delete a version or retry. Existing
settings/configuration are checked before and after. Explicit Chat OFF, pairing ON,
valid origin/public key, exact existing DB, absent/false review acknowledgements,
no AI binding, reviewed runtime and logging-OFF policy are required. Restored active
configuration is read from the current deployment, not copied from an old version.
Canonical null observability is still validated by the previously reviewed policy;
active/malformed/unknown logging channels or tails block. No policy relaxation.

This is **not durable exactly-once delivery**: manually rebuilding this same approved
commit could upload again. Do not Retry blindly, especially on
`VERSION_MAY_EXIST_NOT_PROMOTED`. A failure after POST is uncertain, not proof of no
version. No rollback/delete/promotion is attempted automatically.

The success receipt includes version, previousActiveVersion, commit, artifact SHA,
`aiEnabled:false` and `promoted:false`, followed by
`Uploaded an AI-OFF version only. Active traffic was NOT changed.`
A build check alone is not a detailed receipt or live-Qwen evidence.

## Local verification before publication

- **142/142 build-side tests**: prior 136 plus 6 source-gate/Qwen artifact/real-CLI
  synthetic tests. Full mocked uploader executes 9 reads/writes total with exactly
  one version POST, preserving inherited settings and denying all other mutations.
- **156/156 signed-Chat Node tests**, including parser/reasoning/output boundaries,
  auth, replay, quota, timeouts, local STOP, no retries and unchanged source hashes.
- **17/17 local HTTPS browser groups**, 4 axe states with zero reported violations.
  Model replies were synthetic; no live AI was called.
- Prior local regression: 91 pairing/legacy Chat + 36 preview tests passed.
- Source/terms and limitations: `backend/signed-chat/QWEN-LOCAL.md` in workspace.
  Qwen final-choice parser differs from Llama. `/no_think` is only a soft prompt;
  the published Cloudflare schema does not document hard thinking disablement.
  Truncated, reasoning-only, inline-think or tool outputs fail closed. No latency,
  account quota availability or real provider shape/quality guarantee.

## Git and side-effect controls

The session's restored checkout initially pointed at the original base while the
remote session branch already had the prior upload commits. The existing branch
was fast-forwarded to the exact remote head and its index aligned **without writing
working files**; all 206 snapshotted working files were preserved. No branch switch,
new local branch, force push, merge overwrite or protected-file staging.

The publishing commit must contain GitHub's `[skip actions]` instruction and a final
`skip-checks: true` trailer after any attribution trailers. Inspect the STORED message
before push; a prior commit's automatic co-author trailer displaced skip-checks and
unexpectedly triggered APK Actions. Protected APK workflow source stays unchanged.
Actual checks/runs must be observed; never infer cancellation from a skip intention.

After push, observe the exact commit's Cloudflare build. Do not create incidental
receipt/docs commits that trigger more builds. Keep the owner on the existing live
AI-OFF version until receipt/configuration review and separate promotion approval.
AI activation/binding/review flags and real text tests remain separately gated.

Before staging, a second hash comparison confirmed **201 other pre-existing working
files unchanged**, including all local Qwen source/tests and protected APK/workflow
files. Only five existing upload-package files and this new receipt-plan document
are intended for the publishing commit. No new runtime source edits in this phase.
