> **CURRENT MODE: safe API error reporting + one Chat-OFF upload — 2026-09-13.**
> See [API-ERROR-ATTEMPT.md](API-ERROR-ATTEMPT.md). Preserves the exact-active AI
> inheritance policy and all prior guards. Only adds bounded failure reporting:
> fixed request stage, HTTP status and up to three integer API error codes.
> No raw messages, token/key/project values, automatic retry, promotion or AI call.
> Source must be the direct child of `d3426d1b7dd4a689badc22d9ef734de98665c198`.
> Worker artifact and candidate tag unchanged. 313 build-side tests passed.
> All earlier banners below are historical; do not Retry their builds.

> **CURRENT MODE: exact-active AI inheritance, Chat-OFF upload — 2026-09-13.**
> See [AI-INHERIT-UPLOAD.md](AI-INHERIT-UPLOAD.md). The `project` field is now
> observed, not guessed. AI is inherited from the exact active version UUID,
> never latest; full AI metadata must match on readback. Project values stay
> memory-only and are not submitted as configuration or printed.
> `npm run upload` now runs tests and the guarded version uploader, not a diagnostic.
> Source must be the direct child of `fb1796f3f67b65842587ba6be1dc95d6461d6113`.
> 278 build-side and 196 runtime tests passed. Worker artifact remains unchanged.
> One unpublished Chat-OFF version only; no promotion, AI call or automatic Retry.
> All earlier banners below are historical, including their mode and parent pins.

> **CURRENT MODE: targeted read-only field-name check V3 — 2026-09-13.**
> See [BINDING-NAME-READ-ONLY.md](BINDING-NAME-READ-ONLY.md). This deliberately
> permits one bounded extra schema-key NAME in the build log, never its value.
> No field guessing, binding acceptance change, upload, settings change or AI call.
> `npm run upload` still invokes tests and only the read-only diagnostic.
> Requires the direct child of `b2b8ceeb35effdd9c4be871f00dcacaa5a24a15d`.
> Marker: `MAYA_AI_BINDING_READ_ONLY_V3`. Green means read-only completion, not a
> fix or version receipt. Chat stays OFF. Earlier banners below are historical.

> **CURRENT MODE: read-only AI binding diagnostic V2 — 2026-09-13.**
> See [BINDING-RAW-READ-ONLY.md](BINDING-RAW-READ-ONLY.md). Adds only the fixed
> `raw` status to the previous diagnostic; no binding acceptance change.
> `npm run upload` still runs tests and the read-only checker, never an upload.
> Requires the direct child of `8474da9e1b4254dfe20c2df4df066a4b2d535025`.
> Marker: `MAYA_AI_BINDING_READ_ONLY_V2`. A green build is NOT a fix or version
> receipt. Chat stays OFF. All earlier banners below are historical.

> **CURRENT MODE: read-only AI binding diagnostic — 2026-09-13.**
> See [BINDING-READ-ONLY.md](BINDING-READ-ONLY.md). The configured `npm run upload`
> now runs tests and `diagnose-binding.mjs` ONLY. Despite the inherited command
> name, it does not upload, deploy, repair settings or invoke AI.
> Five bounded GETs, finite-state output, no raw response/unknown field names/values.
> Source must be the direct child of `9d4260e1e8de32ab864badb02f5e0c0d843a1392`.
> Chat OFF, pairing ON, logging OFF and stable active deployment remain required.
> Worker artifact and strict uploader are unchanged. A green build here means a
> read-only check completed, **NOT** that a version was uploaded or the issue fixed.
> All previous mode banners below are historical; do not run their commands.

> **Current mode: validation diagnostic v1, Chat-OFF upload — 2026-09-13.**
> See [VALIDATION-CYCLE.md](VALIDATION-CYCLE.md) for the approved limited cycle.
> This build only uploads one unpublished version; it never enables Chat/promotes.
> Artifact: 83,087 bytes, SHA256
> `589b28829e2154c06232c167c02ce5cbc9df0e68fb839af31830e79b9502db70`.
> Requires the direct successor of approved parent `96e98a6e764acd324b33365a3a61f98018b82496`.
> Deliberately preserves the existing standard AI binding and three reviewed text
> flags, exactly nine allowlisted bindings, while requiring ENABLE_CHAT=false.
> No missing binding is created, no value is enabled, no logging policy weakened.
> Local results: 161 build-side tests, 196 runtime tests, 18 local browser groups.
> Model output acceptance remains unchanged; diagnostics reveal only fixed categories.
>
> **Earlier banners and QWEN-UPLOAD.md below are historical**, not current artifact,
> source-parent, binding-policy or approval instructions. No blind Retry.

> **Current mode: approved Qwen AI-OFF upload only — 2026-09-13.**
> See [QWEN-UPLOAD.md](QWEN-UPLOAD.md) for exact scope, evidence and precautions.
> Artifact: 76,459 bytes, SHA256
> `df11a78f2355982c9efdd53ae8bafefd236544a429bdc9edf12183edfa9bf0f7`.
> Existing upload-only command and all config/logging protections are retained.
> New raw-Git gate permits only the direct successor of approved parent
> `8ef51c86572e770d7d7916724dcb2e8f61802438`; unrelated future commits cannot upload.
> 142 build-side tests passed locally. No logging PATCH, AI binding/call, key/DB
> write or live promotion. One invocation may upload at most one version;
> manual Retry of the same commit is NOT safe exactly-once delivery.
>
> **Everything below records historical phases**, not current artifact pins,
> commands, test counts, approval or live-Qwen evidence. Do not rerun old repair
> builds or infer a successful version receipt before the current build completes.

> **Current mode: AI-OFF version upload only — 2026-09-12.** The owner
> approved the logging-format compatibility fix and one upload-only build.
> `npm run upload` again runs tests followed by `upload-version.mjs`.
> It does **not** execute `repair-logging.mjs` or make any logging PATCH.
> It uploads at most one unpublished version and never promotes live traffic.
>
> **Evidence and correction:** diagnostic build
> `8f501026-9997-4a84-b95f-8b60f172d0ec` returned `observability:null`,
> `logpush:false`, and `tail_consumers:null`. The later, explicitly approved
> logging-OFF PATCH was acknowledged by Cloudflare, but repair build
> `aa2e7340-79d1-485e-ba40-a237b9032ae3` read the same null representation
> and refused to call it explicit-OFF. Its active deployment was unchanged.
> That was a verifier/serialization mismatch, not a successful Worker upload.
>
> Cloudflare's own `normalizeObservability` in the pinned source below treats
> null observability as disabled global/log/trace enable flags. Defaults such
> as `persist:true` or `invocation_logs:true` do not themselves enable a
> disabled channel. This differs from newly created Workers being configured
> with logging enabled by their creation flow.
>
> https://github.com/cloudflare/workers-sdk/blob/164e4fb11c32ae4ad255998bcdc17dc5a3a74ec6/packages/deploy-helpers/src/deploy/helpers/config-diffs.ts
>
> `logging-policy.mjs` recognizes that null representation, or a validated
> explicit global OFF object. It still requires an explicit false Logpush flag
> and present null/empty standard tail list; streaming-tail consumers must be
> absent, null or empty. Empty-list null serialization was observed after the
> accepted `tail_consumers:[]` PATCH. Missing observability, booleans supplied
> as strings, malformed objects/lists, unexpected fields, nonempty exports,
> true channel overrides and nonempty streaming tails remain blocked.
> Enabled flags are checked independently of sampling rates or persistence.
> No request changes settings to make the guard pass.
>
> This is configuration-normalization evidence, not a blanket assertion about
> all Cloudflare audit logs, platform data retention or future configuration.
> Logging is checked before and after upload; any drift stops the uploader.
> The three review acknowledgements and inference activation remain closed.
>
> The historical diagnostic uses a frozen `legacyCheckLogging` predicate so
> its `previous_guard` field remains comparable to the earlier screenshots.
> The active uploader uses only the new policy, with no legacy fallback.
> Historical repair remains source-parent-gated and is not called by the
> dashboard command. All earlier notes below are historical, not instructions
> to run another repair or promote a version.
>
> Local verification: **136/136 build-side tests**, including the observed
> null response through the full upload path, logging drift, enabled channel
> overrides, streaming tails, malformed data and all historical tests. The
> Worker artifact is unchanged: 74,788 bytes, SHA256
> `8105db539ef8d49415e6c37addfcabe282e7edcb1c5d7889c17ac8294752fd29`.
> Actual upload success still requires the Cloudflare build receipt and
> separate operator review; do not promote or retry blindly.

> **Current mode: approved logging-OFF repair only — 2026-09-12.**
> The owner's successful diagnostic showed `observability=null`,
> `global_enabled=missing`, `logpush=false`, and `tail_consumers=null`.
> The original guard remains unchanged; null is not reclassified as OFF.
>
> The owner explicitly approved saving logging settings as OFF and verifying
> the readback. `npm run upload` now runs tests and **`repair-logging.mjs`**.
> This is NOT a Worker version upload or live promotion. Do not change the
> dashboard command to `wrangler deploy` or invoke `upload-version.mjs`.
>
> The repair reads the active deployment and current script settings, accepts
> only the observed null state or an already-explicitly-OFF configuration,
> rechecks the active deployment, and sends **at most one PATCH** to this
> existing Worker's `/script-settings` endpoint. The fixed JSON contains only:
> `logpush:false`, `tail_consumers:[]`, `observability.enabled:false`, and
> explicit `false` log/trace/invocation/persistence flags with empty export
> destination lists. It does not patch tags, bindings, variables, keys,
> compatibility, routes, subdomains, databases, versions, source, billing or AI.
> Unexpected nonempty streaming-tail consumers stop it before any write;
> undocumented streaming-tail mutation fields are not sent.
>
> A separate GET must return **explicit** OFF values and empty lists; null or
> incomplete readback is reported as **not verified**, even after an accepted
> PATCH. The active deployment ID/traffic selection is checked again, without
> writing a deployment or attempting rollback. Only whitelisted state labels,
> boolean result flags, a fixed request-stage label and HTTP status are logged.
> There is no raw response, destination identifier, tail service, API token,
> Git author data, browser key, conversation or other secret output.
>
> Gates: same artifact/Workers-CI/account/branch/acknowledgement checks; the
> checkout SHA must match the CI SHA and have exactly one parent, the approved
> diagnostic commit `98bd0d37e2ca06c9d4d23139c31ac1d88697157e`. This prevents
> unrelated future pushes from silently reapplying this repair. Git parent
> headers are read with `git cat-file` so shallow clones are supported.
> Bound: 30 seconds for API work, 64 KiB per reply, at most six API requests,
> no redirects, retries, alternate endpoint fallback, rollback or enable step.
> Already-explicit OFF skips PATCH. Manual retries of the same approved commit
> could reapply an OFF request if the previous outcome was uncertain: **do not
> retry blindly**. This is not a durable exactly-once transaction.
>
> Successful repair marker: `LOGGING_OFF_VERIFIED_NO_UPLOAD_NO_DEPLOY_NO_AI_CALL`.
> Failure marker: `REPAIR_STOPPED_NO_UPLOAD_NO_DEPLOY_NO_AI_CALL`.
> `patch_attempted` / `patch_acknowledged` distinguish an uncertain request
> from an accepted write; acceptance alone is not an OFF verification.
> The uploader and Worker artifact remain unchanged. Restoring upload mode,
> any live promotion, or AI enablement requires a separate reviewed step.
>
> Local verification: 102/102 build-side tests (32 repair + 25 diagnostic +
> 45 original uploader), plus the unchanged signed-Chat 102/102 tests. The
> original uploader and 74,788-byte Worker checksum are unchanged.
>
> API contract checked: https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/settings/methods/edit/
>
> **Earlier diagnostic and upload notes below are historical, not the active
> command for this approved repair.**

> **Temporary read-only diagnostic mode — 2026-09-12.** The owner approved a
> diagnostic after build `68862bd8-acef-4fc4-9bb4-9c0fdbd8ad6f` stopped with
> `LOGGING_MUST_BE_OFF_NO_UPLOAD_STARTED`. That run passed its 45 tests in
> Cloudflare, then stopped before any version POST. The screenshots do not
> establish which API logging field failed the guard.
>
> **`npm run upload` now runs tests and `diagnose-logging.mjs`, NOT the uploader.**
> It makes exactly one GET to the existing Worker's script-settings endpoint and
> emits fixed ON/OFF/missing/null/shape labels only. It never fetches bindings,
> sends Worker source, modifies settings, uploads versions, promotes traffic or
> calls AI. Even when the original logging guard passes, it only reports.
> The original uploader and its safety rules remain unchanged for inspection;
> restoring the upload command requires a reviewed follow-up change.
>
> Look for `MAYA_LOGGING_DIAGNOSTIC_V1` through
> `READ_ONLY_COMPLETE_NO_UPLOAD_NO_DEPLOY_NO_AI_CALL` in the build log.
> A green diagnostic build is **not** a Worker upload/deployment receipt.
> Missing or null values are reported, **not interpreted as disabled**.
> No API token, raw response, destination name, tail service, key, conversation
> or identifier is emitted. Same CI/branch/acknowledgement/artifact gates;
> 30-second overall deadline, 64-KiB response cap, no redirects or retries.
>
> Local verification: 70/70 build-side tests (25 diagnostic + 45 original
> uploader), plus the unchanged signed-Chat 102/102 tests. No real API was
> called during local tests. The existing Worker bundle checksum is unchanged.
>
> The earlier upload instructions below are historical and remain paused while
> this diagnostic command is active. Keep AI/logging settings unchanged and
> do not press Promote, Deploy or Retry based on a green diagnostic alone.

# Maya phone-friendly Worker upload — manual promotion only

Prepared 2026-09-11 after explicit user approval to prepare/push the GitHub connection setup. **No Cloudflare account connection, version upload, active deployment or AI activation has been performed by this preparation.** This package bypasses the large mobile code editor. It does not require a PC, Termux, APK update, a new Worker/origin/database/key, or a token pasted into chat.

## Why this directory exists

The phone repeatedly lagged/reloaded when pasting the 74,788-byte standalone Worker. Cloudflare Workers Builds supports connecting an existing Worker to a GitHub repository. This directory is a self-contained, dependency-free, build-side uploader plus the **exact already-tested** signed-Chat candidate.

The uploader uses the documented **Version Upload API**, not the immediate Script Upload/Deployments API. Its only write is one `POST .../workers/scripts/maya-chat/versions?bindings_inherit=strict`. It never calls a deployment, settings, database, account-plan, route, subdomain or billing mutation endpoint. It does not invoke AI or access the phone.

### Safety before a version upload

- Only inside Cloudflare Workers Builds, on `arena/01a089f7-mana-android`, with explicit build acknowledgement `MAYA_UPLOAD_APPROVED=diagnostic-only-v1`.
- Exact pinned artifact SHA256 **8105db539ef8d49415e6c37addfcabe282e7edcb1c5d7889c17ac8294752fd29**, 74,788 bytes. Not a shortened/reimplemented Worker.
- Read the **active deployment**, not a possibly stale unpublished version. Require one version at 100% traffic.
- Require global Observability off, no Logpush or Tail consumers. Do not change these settings in the script.
- Read the active version's resources. Require existing `DB` D1 ID, valid public P-256 JWK, final `https://maya-chat.<existing-subdomain>.workers.dev` origin, `PAIRING_ENABLED=true`, and `ENABLE_CHAT=false`. Preserve these exact values in memory in the uploaded version. No manual D1 ID copying/provisioning needed.
- Reject unexpected bindings (including AI/secrets), duplicate names, enabled review flags and unreviewed runtime configuration rather than silently dropping or replacing them. Accept both the current `database_id` and documented legacy `id` D1 field; reject contradictory IDs.
- Recheck active deployment/logging before upload. After upload, read back the new version's configuration, and confirm the active deployment/logging have not changed. On drift, stop; do not force, roll back or delete anything.
- 60s whole-operation deadline, byte-bounded API replies, no redirects or retries. A failed/timed-out POST may have created an unpublished version: inspect history before considering another attempt.
- Nothing reads/exports a browser private key. Public settings stay in build memory/API multipart, not source files, receipts or logs. API errors are reported as generic codes, never raw responses, token values or exceptions.

**Important limitation:** configuration is copied from a snapshot. If the owner later changes/revokes a key or changes bindings/settings, an older unpublished version must NOT be promoted blindly, as it could restore old configuration. Review current configuration against the intended candidate or build a fresh candidate. Pre/postflight checks reduce drift risk but cannot make a later human promotion atomic. Preview URLs, if already enabled on the account, may expose an unpublished static page; signature origin checks and AI-OFF remain in force. Never create/register a key on a preview URL.

## Guided phone connection (pause at the final save screen)

Cloudflare → **Workers & Pages → maya-chat → Settings → Builds → GitHub/Connect**.

1. Authorize the official Cloudflare Git integration for **only `adil-chandio/Mana-android`**, not all repositories. Do not create a new Worker or Pages project.
2. Use these settings; do not accept the default `main` branch, root directory or `npx wrangler deploy` command:

| Field | Value |
| --- | --- |
| Repository | `adil-chandio/Mana-android` |
| Production branch | `arena/01a089f7-mana-android` |
| Root directory | `deploy/maya-chat` |
| Build command | `npm run check` |
| Deploy command | `npm run upload` |
| Non-production builds | Disabled |
| Non-production deploy command, if mandatory | `npm run check` (no upload) |

3. Add this **build-only text variable**, not a Worker runtime variable:

   Key: `MAYA_UPLOAD_APPROVED`

   Value: `diagnostic-only-v1`

   Without it, the uploader makes no API requests, even if a build starts early.
4. Use Cloudflare's built-in, Cloudflare-held build token mechanism. Never copy a token/password/OTP into chat, source, an APK or GitHub. The script expects `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from that build environment. If unavailable, stop and review the official token/build settings; do not improvise a frontend or chat token transfer. A missing account ID is non-secret metadata, but the managed-token setup still needs checking. Review the permissions Cloudflare displays: its default build token can be broader than this script's narrow API actions. The official Git app also has repository permissions to review.
5. **Send the configuration screen for review before Save/Build/Deploy.** No card, paid upgrade, AI binding, provider review flag or new database is needed for this diagnostic package. Stop if an unexpected paid prompt, permission or resource appears.
6. Once the exact configuration is confirmed, allow the build. The script first runs its offline checks and then uploads **only a version**. Despite the dashboard's generic “Deploy command” label, it does not promote traffic.

`wrangler.jsonc` is only an identity marker for Workers Builds. Its main path deliberately does not exist: accidental direct `wrangler deploy` must fail before upload rather than wiping settings/bindings. **Do not fix that path** or use the older closed local candidate config. The supported command is `npm run upload`.

The preparation commit skips GitHub Actions so it does not build an APK. If Cloudflare also marks an initial build skipped, use its manual build/retry control after configuration review; do not remove safety checks or enable automatic live deployment to work around it.

## After a successful build — do not promote yet

The build prints only a small receipt: Worker name, new version ID, previous active version ID, source commit and artifact SHA; `promoted:false` and `aiEnabled:false`. No public registration value or credential is printed.

1. Show the successful build receipt/version screen. Do not use a preview hostname to register a key.
2. Review the candidate's binding/variable settings against the current active configuration: same DB/origin/owner key, pairing ON, Chat OFF, no AI; Logs/Traces still off.
3. Only after explicit confirmation, manually promote the intended version on the existing Worker using Cloudflare's Deployments controls. This retains the origin but still needs live verification; local tests cannot prove remote API behavior or account eligibility.
4. On the original Chrome/final origin, open `/chat`, run **Test access + replay (no AI)** once and inspect the result. Then do the unregistered Brave test and the separately confirmed public-registration removal/restoration test. Do not delete the private browser key or D1 database.
5. Keep AI OFF. Actual model/license/free-tier/privacy eligibility and any inference activation remain separate gates. No conversation has been sent to a real model by this setup.

## Verification recorded locally

- **45/45 uploader tests**, with synthetic mocked API envelopes, real P-256 public-key validation and multipart inspection. Checks cover exact source hash, CI/branch/approval/credentials gates, original config preservation, old/new D1 aliases, traffic split, logging, unexpected AI/secret bindings, strict public keys, runtime drift, one POST/no deploy, malformed/HTTP errors, timeouts/stream bounds, post-upload uncertainty, default-Wrangler guard and a local CLI refusal.
- Existing signed-Chat candidate **102/102 tests** rechecked locally during setup. Its earlier 17 browser groups and original pairing/Chat tests are recorded in the workspace's signed-chat report, not newly claimed as real Cloudflare API evidence.
- No account token was installed locally. No live version-upload API call or Git connection was made during tests. The browser/runtime Worker is unchanged; only these build-side deployment files are new.

Run with Node 22+:

```sh
cd deploy/maya-chat
npm ci --ignore-scripts
npm run check
sha256sum -c ARTIFACT.sha256
```

`npm run upload` intentionally refuses outside the approved Cloudflare build environment. Do not set fake CI flags with real credentials locally to bypass this restriction.

## Official references checked

- Existing Worker connection/custom upload-only builds: https://developers.cloudflare.com/workers/ci-cd/builds/
- Build commands, branches, managed token, build variables: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- Free build allowance and limits (not unlimited): https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/
- Version upload (not active deployment): https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/create/
- Multipart metadata: https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/
- Script-level logging settings: https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/settings/methods/get/
- Current version/deployment response field definitions, including D1 ID alias and latest-active ordering: https://github.com/cloudflare/cloudflare-typescript/tree/main/src/resources/workers/scripts

Cloudflare documents a 3,000 build-minute monthly Free allowance. This does not establish the current account's remaining allowance, permission eligibility, model quota or a no-cost guarantee under arbitrary paid-plan configuration. No paid fallback is authorized.
