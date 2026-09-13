# Null compatibility v1 — Chat-OFF candidate upload, 2026-09-13

## Scope

After the diagnostic model request failed MESSAGE_TOOLS, the owner confirmed
Chat OFF. The assistant offered a message-level null-only compatibility fix;
the owner directed routine work to proceed without repeatedly asking permission,
while asking when necessary. The assistant stated it would handle local tests
and a Chat-OFF upload, without autonomously running a new model test.

This upload does not include promotion, Chat ON, inference, paid services, raw
provider logging, database/key changes, APK changes or Fish voice substitution.
No new live model response or guaranteed fix is claimed.

## Runtime delta

Only choices[0].message accepts null tool_calls/function_call as absence.
Nonempty tool arrays and non-null function calls (even empty objects/arrays)
remain rejected. Root/choice nulls remain rejected. Single completion, stop,
index, assistant role, content/marker/refusal/reasoning limits remain unchanged.
No model switch, token-budget increase, retry, quota reset or history change.

The observed MESSAGE_TOOLS category does not establish which value was returned.
The original provider body was not retained. This candidate may resolve a null
representation mismatch; actual/malformed calls still fail, and later validation
may uncover another issue. Tool execution is not implemented or enabled.

## Artifact and tests

83,208 bytes, SHA256:
`0c34518aa230f8fdc107a746337d51b2f47dfc0e6d4414e92f0ffdca131d5846`.
Tag: `maya-null-compat-0c34518a`.
Footer: `validation diagnostic v1` plus `null compatibility v1`.
Source parent: `535fd6f1138a4659515209f51d5b081d526d6b03`, direct single parent,
HEAD matching Workers CI SHA, exact branch and artifact gates retained.

- 91/91 legacy pairing/chat regression tests pass.
- 209/209 runtime tests.
- 300 frozen prior-parser field variants: exactly two intended single-field
  differences, only message tool_calls=null and message function_call=null.
- 64 tool/function combinations: absence-only acceptance, real/malformed refusal.
- Worker tests: final text only, one synthetic dispatch, replay/quota enforcement,
  private metadata/reasoning exclusion and real function request denial.
- 19 local HTTPS browser groups, six axe states with zero reported violations.
  Real browser crypto/storage and bundled Worker; all model outputs synthetic.
  New case checks nullable success, inert HTML-looking text, completed history,
  function-call refusal, no private data leakage and no automatic retry.
- 326/326 build-side uploader regressions after updating artifact/source/tag pins.

Backend source/tests/report remain in the existing local backend tree; only the
six explicitly reviewed deploy files are staged. Test tools and screenshots are
external-cache artifacts, not repository dependencies or phone/live evidence.

## Upload safety and continuation

Same tested guarded-latest uploader: latest uploaded must match active on both
preflight reads; strict latest AI inheritance; full bounded metadata/config
readback; key/DB/flags/pairing/logging protections; Chat OFF. Two reads are not an
atomic lock. Any detected mismatch stops without promotion, cleanup or retry.
One POST per invocation, at most 11 API operations. Safe stage/status/numeric code
reporting retained; no raw messages, key/project values or error body output.

One normal push with [skip actions] and final skip-checks trailer. Observe the
exact commit's Cloudflare check and GitHub Actions without rerunning the build.
After a successful receipt, owner-controlled Chat-OFF promotion and a bounded
registered-Chrome live check are the remaining steps; these have not occurred
for this candidate at preparation time. Do not call the old failure retrospectively
solved or expand model output acceptance beyond the explicit null-only delta.
