# MAYA Update Center — protocol 1 / bootstrap 5.17.0 (82)

## Status and scope

Implemented in this checkout: native update UI and recovery launcher, explicit Stable/Beta discovery, signed metadata policy, bounded downloads/cancellation, APK checks, Android installer handoff, local build feedback, version/asset synchronization, publisher tooling and CI tests.

**Source pushed; secure release not activated:** source changes are on `arena/01a089f7-mana-android` and the existing APK build workflow successfully compiled and verified a development APK with all 25 native JVM tests passing. A real push confirmed that this connection can push source, but GitHub rejects changes to `.github/workflows/` without `workflows` permission. Secrets and their public-key API return HTTP 403, and the `maya-release` environment is absent. No signing secret was provisioned, no APK was published, and no release workflow was dispatched. Reconnect GitHub with the required permissions; do not put credentials in chat.

**Workflow activation is pending.** Proposed workflows are reviewable in `docs/workflows/`; updated `.github/workflows/` files remain local in Arena until authorized. The remote workflow files are unchanged. Do **not** use the old remote release workflow as the secure updater publisher. Proposal wiring tests do not prove remote activation.

The sandbox does not have Java/Gradle/Android SDK. Attempts to obtain the toolchain were blocked by network access to its download hosts. The JS/release tests ran locally; the added Android JVM tests and development APK build have now run successfully on GitHub CI (evidence below). The configured, non-debuggable bootstrap release has NOT been built. A successful device installation is still an acceptance gate, not a claim made by this patch.

The voice/wake/automation issues documented in the audit are **not fixed** by this updater. Downloads and installation are explicit actions; no startup checks, notification polling, background downloading, silent installation, hot JS updates or forced upgrades are added.

## Verified build evidence — 2026-09-10

- Source commit: `524623b3ec4d850f30f949939e4362003fb6a63e`.
- [Successful Android CI run 34450793433](https://github.com/adil-chandio/Mana-android/actions/runs/34450793433).
- Native result, from the CI annotation: **25 tests, 25 passed, 0 failed, 0 skipped**. These are JVM policy/transport tests, not phone tests.
- Local JS/protocol/publisher/provisioning checks: **1045** (72 + 296 + 155 + 466 + 56), plus CSS. Provisioning tests mock GitHub and do not set production secrets.
- CI ran `aapt dump badging` against the actual APK, checked package `com.maya.ai`, version **5.17.0 (82)**, minSdk **26**, and the development/debug flag. `apksigner verify --verbose --print-certs` succeeded before artifact upload.
- APK SHA-256: `91e850cc6152472827154b34c379764fc9c881bf8244ae8f612706f883e6f418`.
- APK signer certificate SHA-256: `ba5f9e07a474cad5f8d8123c79e618f1a76976d7561d901d4df3f5a3da32d24a` (legacy/public development identity, not independently checked against the phone).
- [Download MAYA-APK development artifact](https://github.com/adil-chandio/Mana-android/actions/runs/34450793433/artifacts/10141501387). GitHub may require login; this is a temporary Actions ZIP containing `app-debug.apk`, not a GitHub Release asset. The ZIP has a different checksum from the APK inside it.
- CI explicitly reported **update trust configured=false**. This artifact cannot check/download/install signed in-app updates. It is NOT the configured bootstrap release, and it is not a voice/wake fix.

The sandbox could read CI status/annotations but its network could not download the artifact/log storage redirects. Binary identity/signature evidence above comes from CI, not a locally inspected APK. No device installation, settings-retention test, signed-release publication or production trust provisioning was performed. Cache/Node-action deprecation warnings did not fail the build; workflow modernization remains pending authorized activation.

## Architecture

- `release/version.json`: versionName/versionCode/minSdk source of truth.
- `public/`: editable web source; `npm run version:sync` copies the packaged assets and updates visible version labels, package version and service-worker cache. `npm test` rejects drift.
- `update/UpdatePolicy.kt`: pure JVM RSA verification, protocol validation, version/SDK eligibility and URL policy.
- `update/UpdateRepository.kt`: explicit public GitHub Releases lookup, limited redirects/bytes/time, cancellation and checksum download. No GitHub token is present on the phone.
- `update/ApkVerifier.kt`: checksum, actual package/version/minSdk, non-debuggable flag and signer comparison with installed app and signed metadata. Android's installer also verifies APK signatures.
- `update/UpdateActivity.kt`: native UI. Separate **MAYA Updates** launcher entry works without initializing the WebView. The existing settings screen has a navigation-only bridge button.
- `update/UpdateFileProvider.kt`: separate identity/authority exposing only `cache/updates/` with temporary read grants.
- `tools/update-release.cjs`: APK inspection via aapt/apksigner, manifest validation and metadata signing.
- `tools/setup-update-trust.cjs`: explicit, one-time environment-secret provisioning. Not executed by this session.

## Security model and IMPORTANT legacy signing limitation

There are two different signing identities:

1. **Android APK signer**: Android requires compatibility with the installed app. The repository's existing `app/maya.keystore` and password are public. Copying that identity into Secrets does NOT make it private again. Debug builds keep it solely for existing development compatibility; Update Center refuses debug APK candidates. Release builds never silently use it.
2. **Update metadata signer**: a separate RSA key (3072+ bits) held in the protected GitHub `maya-release` environment. Its SPKI public key is compiled into the bootstrap APK. Downloaded metadata must verify against that pinned key. No runtime key enrollment, certificate bypass or unsigned fallback exists.

Signed metadata adds protection to this updater's path, but cannot prevent someone from creating an APK with the already-exposed Android key and persuading a user to sideload it outside this updater. A compromised installed app can also bypass its own UI. **APK signing-key rotation/data migration is a separate, unresolved rollout decision.** This implementation intentionally requires the same current signer; it does not claim to support Android signing-lineage rotation.

Before distributing the bootstrap, decide whether to temporarily retain compatibility with that exposed identity (with this explicit limitation), or perform a separately tested migration. A fresh unrelated APK key will NOT normally update the existing installation. Never advise uninstall/data clearing as an automatic fix.

Metadata signer rotation is not supported in protocol 1. Do not replace its secret after bootstrap installations. Losing it requires a deliberate manually distributed trusted recovery/bootstrap strategy.

## One-time activation (authorized maintainer)

1. Reconnect GitHub with repository workflow publishing and environment-secret administration permissions. Review `docs/workflows/`, copy those two files into `.github/workflows/`, and push the authorized workflow changes on this same session branch. Create the **maya-release** environment; restrict deployment branches and add required reviewers to protect release secrets. Use only trusted workflow code. The session work remains on `arena/01a089f7-mana-android`.
2. With those permissions, run `node tools/setup-update-trust.cjs --create-once`. It first checks environment access and refuses to overwrite an existing signing secret. It generates a 3072-bit RSA key in memory, sends the private PEM to `gh secret set` through stdin, and prints only the public fingerprint. No secret is written to Git or logs.
3. Configure the chosen **compatible Android signing identity** as environment secrets, without changing it blindly:
   - `MAYA_APK_KEYSTORE_B64`: base64 keystore.
   - `MAYA_APK_STORE_PASSWORD`.
   - `MAYA_APK_KEY_ALIAS`.
   - `MAYA_APK_KEY_PASSWORD`.
   - `MAYA_UPDATE_SIGNING_KEY` is supplied by step 2.
4. Set environment variable `MAYA_EXPECTED_APK_CERT_SHA256` to the lowercase 64-character SHA-256 signer certificate digest independently checked against the installed app. This is public identity data, not a password. The publisher rejects a different signer.
5. Review/bump `release/version.json`, `release/notes.md`, and `release/tests.json`. Run `npm run version:sync` and commit the resulting asset/version changes together. Code 82 was selected above the known pending branch code 81; recheck ALL distributed builds before publishing.
6. Run **Release MAYA APK** on the approved source ref, channel **beta**. Tests execute first. The workflow derives the pinned public key from the secret, builds a non-debuggable signed release, verifies it, signs metadata, uploads all files to a draft, then publishes. It never overwrites assets. Stable requires the explicit device-approved input as well as your environment protection policy.
7. Manually install this FIRST configured bootstrap APK through the normal Android installer. The existing v5.9.5 has no update client and cannot gain one without an APK install. Verify signing compatibility and data retention on the actual phone first.
8. Future builds with a larger versionCode appear in Update Center after an explicit check. Build the next test release to exercise an actual upgrade from bootstrap; checking the same version is not an upgrade test.

Ordinary **Build MAYA APK** debug artifacts contain no pinned update key and intentionally show **trust not configured**. Do not call these artifacts a ready-to-use secure bootstrap. An enabled release build requires protected configuration; `preReleaseBuild` fails without it.

## Protocol

Every new release uses an immutable tag:

`v<versionName>-<channel>.<versionCode>` — for example `v5.17.0-beta.82`.

Required release assets:

- `MAYA.apk`: verified non-debuggable APK.
- `update.json`: UTF-8 JSON, at most 64 KiB.
- `update.sig`: binary RSA PKCS#1 v1.5 / SHA-256 signature of the **exact JSON bytes**, including the final newline.

Required manifest fields: schema (1), repository, packageName, versionName, versionCode, channel, tag, minSdk, apkUrl, apkSize, sha256, signerSha256, notes, tests[], commit. Publisher/client enforce matching tag, fixed repo/package/asset location, field limits, integer codes and 150 MiB APK maximum. SHA-256 alone is not authentication; metadata is signature-verified before parsing/use.

Client discovery is bounded to the latest 30 GitHub Releases, inspecting at most 5 newer matching-channel candidates sorted by numeric versionCode. Drafts, legacy tags and other channels are ignored. Invalid signed metadata fails visibly; it is not silently treated as a valid update or skipped to hide a trust failure. Prereleases use the list endpoint, NOT `/latest`. If this release window ever becomes insufficient, publish a new channel release or deliberately revise the protocol; the client reports the limited search.

All transfer URLs are HTTPS. Redirects are limited to GitHub and its explicit asset hosts, with no embedded credentials, fragments or nonstandard ports. No Authorization header is sent. Download limits, server-declared length, streamed byte count and SHA-256 are checked. Candidate identity/checksum are checked again before installation.

## Phone flow / lifecycle

- Settings → CHECK APP UPDATES, or launcher → MAYA Updates.
- Select Stable/Beta, then CHECK. 30-second manual recheck throttle; no polling.
- Read signed notes/checklist/size, then DOWNLOAD.
- Cancelling or leaving the screen cancels the current request. Version 1 supports retry, not download resume or continuation across rotation/process death.
- Temporary filenames are unique per download so cancellation cannot delete another download or overwrite a file handed to the installer.
- Tap INSTALL. The app blocks known pending MayaAct/AutoSend work and asks the user to finish calls/tasks first. It does not claim full cross-app call detection.
- If needed, Android opens **Install unknown apps** settings. Returning does NOT auto-install; tap INSTALL again.
- Installer receives only a read-only content URI. Cancelling does not uninstall or change app data.
- Installer handoff is NOT success. On the next native update-screen launch, installed versionCode must equal the pending verified version before showing the checklist / installed confirmation.
- PASS/FAIL is local. Diagnostic sharing is manual, previewed and excludes keys, URLs, chat, contacts and audio. Device/version/channel/error class are included. No telemetry endpoint exists.
- Files handed to Android are retained briefly; old abandoned cache files are cleaned after 24 hours on explicit screen opening. The app does not clear its general cache/data.

Normal in-place updates retain existing app data, but data migrations still require explicit testing. This release does not migrate the existing memory/settings schema.

## Recovery / channels

Beta and Stable share the application ID/signing identity, not separate installed apps. A global increasing versionCode is required across both channels. Changing channel never forces a downgrade. Stable promotion needs a new versionCode if the Beta code was already published; copy the tested code and rebuild with the next code.

A bad release can be withdrawn from discovery. A recovery release normally reuses known-good code with a NEW, HIGHER versionCode. Android generally does not allow an ordinary downgrade. Data rollback is a separate concern; avoid destructive migrations. The native recovery entry helps with WebView failures but cannot recover every native startup/signature/OS failure.

## Verification and acceptance

Automated:

- `npm ci --ignore-scripts && npm test`: existing JS/CSS suites + real crypto/protocol tests, native-button behavior, version/assets and workflow wiring.
- `gradle testDebugUnitTest`: production Kotlin policy/HTTP/download tests, using real RSA signatures and fake HTTP, including corruption, redirects, cancellation and channel selection.
- `gradle assembleDebug`: depends on `testDebugUnitTest`, verifies the actual development APK with aapt/apksigner, and emits CI test/signature/checksum annotations; updater disabled without a trust key.
- Configured release workflow: `gradle testDebugUnitTest assembleRelease`, followed by aapt/apksigner identity/signature verification and manifest signing.

Device acceptance (still required): Android 8+ compatibility, both entry points, signed Beta discovery, offline/rate-limit errors, cancellation/rotation, insufficient space, wrong signer/hash rejection, Android source-permission round trip, cancel installer, real upgrade with data retention, after-upgrade checklist, and native recovery while the WebView UI is unavailable. Record the exact build and result. Never equate source-pattern checks or mocked JVM tests with real-device installation success.
