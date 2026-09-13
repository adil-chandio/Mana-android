# Targeted binding field-name check V3 — 2026-09-13

## Scope and evidence

V2 commit `b2b8ceeb35effdd9c4be871f00dcacaa5a24a15d`, Cloudflare build
`491a3478-0bb0-401b-a4a2-27e5ad5673bb`, completed successfully. Owner screenshot
`Screenshot_20260913-035842.png` showed raw=missing, extra_fields=one,
unknown_fields=one and strict_ai_guard=blocked. Thus the proposed raw-field
explanation was NOT confirmed. The original upload had stopped before any POST.

Assistant offered a read-only check revealing only that extra property NAME,
not its value, and asked permission. Owner directed: "To Bhai poora ache se sahi
se kaam kar na perfectly correctly accurately Kya Hogya". Work proceeds only
with that targeted read-only check, not an uploader fix, deployment, binding
change or model test. The earlier fixed-label-only diagnostic was insufficient;
this deliberately changes the disclosure contract and does not hide that fact.

## Disclosure contract

The original 14-key finite-state `projectBinding` remains unchanged. A separate
projection adds two keys to the report:

- `extra_field_name_status`: unavailable / none / ambiguous / withheld / name_only
- `extra_field_name`: `-` unless one eligible schema key may be disclosed

Eligibility: exactly one own AI binding of type ai, exactly one own extra key
beyond name/type, and that key is not in the previous known diagnostic list.
The name must match `[a-z][A-Za-z_]{0,47}` and must not contain password, secret,
token, credential, authorization, private or cookie (case insensitive). This
rejects control characters, URLs, digits/IDs, punctuation, long identifiers and
credential-labelled names. It is an output-format limit, not a proof that any
possible schema name is non-sensitive. One eligible schema name will appear in
the owner's Cloudflare BUILD log under this narrow disclosure scope.

Never read that extra property's value for this projection; no value, nested
key, unknown-name list, encoding, hash or truncated substitute is emitted.
If ineligible, print only a fixed status and stop for review. The Worker
runtime logging configuration is not changed.

## Unchanged protections

Five sequential GETs only, no retry or mutation; bounded 30-second deadline and
1 MiB response bodies. CI/account/token/artifact checks, Chat OFF, pairing ON,
logging OFF and unchanged active deployment checks are retained. The new parent
pin is `b2b8ceeb35effdd9c4be871f00dcacaa5a24a15d`; the old V2 source is refused.
No token extraction, inference, DB mutation, upload, promotion or rollback.

`npm run upload` still invokes tests and only the read-only entrypoint. The
historical uploader, all model acceptance rules and Worker artifact are unchanged.
The artifact is 83,087 bytes, SHA256
`589b28829e2154c06232c167c02ce5cbc9df0e68fb839af31830e79b9502db70`.

## Local verification and next boundary

242/242 build-side tests pass: 216 existing plus 26 new tests. Coverage adds
single-name disclosure independent of any value, nested private canaries,
no mutation, unsafe-name withholding, known/missing/duplicate/multiple/inherited
cases, old-source refusal and actual synthetic CLI output. All prior transport,
source, auth, logging, drift, deadline and no-upload regressions remain active.
Marker is `MAYA_AI_BINDING_READ_ONLY_V3` (16 fields, 18 total report lines).

One scoped push on the existing branch; verify skip-message trailers and observe
exact-commit Cloudflare/GitHub checks without Retry. Review the actual field name
against public upstream code/documentation before proposing any compatibility
change. A green diagnostic build is not a fix, upload or successful model reply.
If the name is withheld or remains unreviewed, stop rather than expanding access
or weakening binding validation automatically. APK/Fish remain untouched.
