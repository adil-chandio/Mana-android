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
