# Approved validation diagnostic cycle — 2026-09-13

## Scope approved by the owner

After one real Qwen response failed the existing text-only validator, the owner
showed ENABLE_CHAT=false again and approved local privacy-safe diagnostics. After
reviewing those tests, the owner separately approved this limited cycle:

1. Upload and manually promote a diagnostic candidate with Chat OFF, preserving the
   current key/origin/DB/AI binding/review flags and logging OFF.
2. Guide ONE non-sensitive synthetic request from the registered Chrome browser to
   obtain a rejection category, then turn Chat OFF again. No automatic repeat.

The build in this commit performs **only the unpublished upload**. It never promotes,
changes settings, enables Chat, calls a model, clears quota, modifies D1, deletes a
key, changes billing, or builds/installs an APK. Subsequent manual steps must use
this exact build's receipt and current configuration, not an older candidate.

## Pinned artifact and source gate

- Existing Worker: `maya-chat`; existing branch `arena/01a089f7-mana-android`.
- Diagnostic: Qwen validation v1, same model and output acceptance policy as before.
- Artifact: **83,087 bytes**, SHA256
  `589b28829e2154c06232c167c02ce5cbc9df0e68fb839af31830e79b9502db70`.
- Exact copy of the locally tested `backend/signed-chat/worker-upload.mjs`.
- New source gate: raw Git HEAD must match Workers CI's commit and have exactly one
  parent, `96e98a6e764acd324b33365a3a61f98018b82496`. Earlier builds and unrelated
  future descendants cannot invoke this upload path. No weakening of CI/branch,
  artifact or source checks; raw Git reads remain bounded and sanitized.
- Dashboard commands unchanged: `npm run check`, then `npm run upload`, with root
  `deploy/maya-chat`. Existing acknowledgement remains necessary. No token change,
  nonproduction build, Wrangler default deployment or package dependency added.

## Deliberately reviewed preservation change

The old uploader required no AI binding and absent/false review acknowledgements.
That is no longer the owner's observed configuration. The new guard requires
**exactly nine bindings**, with unique, allowlisted names:

- Existing DB: `DB`, type d1, same valid ID (legacy/current ID aliases checked).
- Existing AI: `AI`, type ai, **name/type only**. Unknown extra options, staging,
  gateway, namespace, account overrides, secrets and alternative types are refused.
- Existing APP_ORIGIN, OWNER_PUBLIC_JWK, PAIRING_ENABLED and ENABLE_CHAT text vars.
- All three existing review text vars: FREE_PLAN_CONFIRMED, MODEL_REVIEW_CONFIRMED,
  LIVE_AUTH_CHECKS_CONFIRMED. Each must be literal `true` or `false` and is copied
  exactly. Missing fields or malformed/boolean/coerced values fail closed.

PAIRING_ENABLED must still be literal `true`, ENABLE_CHAT literal `false`.
Preserving an AI binding/acknowledgements is NOT permission for the uploader to
perform inference or enable Chat. It does not create missing bindings or change
values to pass the guard. The currently active version is read, not a historical
restored-key version. Before/after configuration equality is still mandatory.

Logging policy unchanged: previously reviewed disabled-null serialization and
explicit OFF shapes only; active/malformed/unknown channels or tails refuse upload.
No logging repair/PATCH. Single active deployment at 100% required; traffic is read
and compared, never mutated. Same reviewed runtime, key validation and origin rules.

At most one Versions POST per invocation, with strict binding inheritance. A
successful response alone is not enough: read back the uploaded config, active
deployment and logging. Uncertain POST or drift stops without retry/rollback/delete.
This is NOT durable exactly-once delivery: manually rebuilding this same commit
could repeat an upload. Do not Retry merely to obtain logs.

## Diagnostic behavior and evidence

The first real request returned INVALID_MODEL_RESPONSE. Its raw output was not
retained, so its specific cause remains UNKNOWN. Public schema/fixture speculation
is not diagnosis. The new parser reports only its first failed condition, selected
from 26 fixed codes. No raw field names, provider strings, model answer/reasoning,
metadata, token counts or private data are printed or returned as diagnostics.

Categories distinguish envelope/response-style, choices/index, finish reason class,
message/role/tools/refusal, reasoning type/size and final content type/empty/size/
markers. Separate reasoning is still discarded; malformed, truncated, tool or inline
reasoning outputs remain rejected. The request model, prompt, token cap and timeouts
are unchanged. No schema relaxation, stripping workaround or paid fallback.

Only an already-authorized request that reached the model and parser may receive
an optional fixed `validationReason` in its error. Client allowlist and textContent
rendering reject arbitrary values; diagnostic data never enters conversation history
or a later signed request. Nonce/quota reservations remain consumed and remote
outcome uncertain after failure/STOP. No background or additional inference.

Local verification before this upload:

- **196/196 runtime Node tests**, including all 26 categories, no-leak canaries,
  error spoofing, old error compatibility, history exclusion and lifecycle reset.
- Frozen prior-parser comparison agrees on **300 field variants**; acceptance policy
  unchanged. This is regression evidence, not proof over every provider response.
- **18/18 local HTTPS browser groups**, five axe states with zero reported violations;
  synthetic provider only, no external page requests or runtime errors.
- **161/161 build-side tests**: previous 142 updated to the approved current config,
  plus 19 preservation/AI/acknowledgement/source tests. Both direct and CLI synthetic
  upload tests execute exactly nine API operations and only one version POST.
- Editable runtime/tests are preserved in Arena's workspace; the Git upload package
  is self-contained and does not require those untracked paths in Cloudflare CI.

## Git and manual continuation

Commit only the exact upload-package files. Preserve protected dirty workflows,
APK/Fish, root README and all other source. No force push, branch change, unrelated
staging or incidental second commit. Verify `[skip actions]` and final `skip-checks`
trailer after co-author attribution in the stored commit before the one normal push;
observe actual GitHub Actions and Cloudflare status rather than assuming a skip.

On Cloudflare success, obtain the new version ID from the upload receipt. Keep Chat
OFF, review the correct candidate in the promotion confirmation, then manually apply.
The approved later diagnostic request is ONE new signed synthetic text request and
will consume quota. It cannot recover the old response retrospectively and might
fail differently. Turn Chat OFF afterward and examine the safe category before any
compatibility repair or additional test. If no reply/error is observed, retain
uncertainty and do not resend. No new key/DB repair is authorized or needed.
