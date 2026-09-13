# Native Chat — first implementation increment

Date: 2026-09-13. Owner selected Option 2: secure Chat inside the APK, not a
browser-launch shortcut. This increment implements reusable native cryptographic
and conversation foundations. It does NOT yet expose a Chat screen, implement
native HTTP transport, authorize an APK key on the server or deliver an installable
feature update. Existing version remains 5.18.1 / 87 pending actual integration.

## Implemented

`app/src/main/java/com/maya/ai/chat/NativeChatProtocol.kt`:
- Fixed Worker origin and Chat/check paths; no configurable provider or URL.
- Exact RFC 7638 public JWK fingerprint and signed maya-text-chat-v1 canonical
  request fields, UTF-8 body hash and base64url transport encoding.
- Strict DER-to-P1363 ECDSA conversion: two positive minimally encoded integers,
  scalar range, exact sequence length/no trailing bytes, 64-byte signature.
- Same bounded alternating-role message shape, 2,000 per message / 6,000 total /
  12 messages / 16 KiB body. Invalid UTF-16 is explicitly rejected, not replaced
  silently during UTF-8 encoding. Model remains the fixed Qwen model.
- Redacted default string representations and fixed signing errors. No private
  keys, messages or raw provider error text logged.

`NativeChatIdentity.kt`:
- Independent AndroidKeyStore alias, EC P-256, SHA-256 signing, 24-byte SecureRandom
  nonce and epoch timestamp. No private key serialization or browser-key import.
- Key creation is a separate explicit operation; reads/signing never silently
  generate, replace or delete an identity. Existing invalid entries fail closed.
- Does not require biometric authentication per signature. Future native UI must
  enforce explicit Send and consent. Hardware backing/attestation NOT claimed;
  device Keystore behavior remains a phone acceptance requirement.
- No Activity/bridge registration yet, so this class is not called automatically.

`NativeChatConversation.kt`:
- Memory-only completed conversation; single-flight ownership and consent before
  preparing a turn. No persistent history, timers or network calls in the core.
- Monotonic 20-second transaction boundary checked before dispatch and completion;
  future transport/UI must schedule timeout/abort and marshal to one owner thread.
- STOP before dispatch versus remote-uncertain after dispatch; duplicate dispatch
  marker rejected. No refund, replay or automatic retry.
- Stale success/failure cannot overwrite a newer turn; failed/late turns excluded.
  Clear invalidates pending work. Context full/overlong prior reply blocks rather
  than trimming. Completion requires prior request-bound response validation in
  the future transport; accepting a plain string here is not a response validator.

## Tests added

17 JVM JUnit tests across protocol and conversation. Includes Unicode/escaping,
role/byte/context limits, wrong curve, malformed DER, signer call gating/privacy,
consent, single-flight, deadline, double dispatch, STOP uncertainty, stale results,
clear, history preservation and limits.

One JVM test generates 64 real JCA ECDSA signatures and invokes
`tools/test-native-chat-wire.cjs` with PUBLIC synthetic vectors in temporary files.
Node WebCrypto independently verifies fingerprints/canonical messages/signatures.
The actual committed bundled Worker runs in-process against a synthetic D1 interface and
a synthetic model: accepts signed empty check / denies replay, accepts one text
turn / denies replay, refuses body tampering and unknown key ID, preserves quota,
and refuses Chat OFF. Real network is blocked. No private test key is exported.

The fixture configures a synthetic JVM key as the fixture owner ONLY. This tests
wire compatibility; it does not authorize the native key in production, prove
simultaneous browser/APK identities, or recommend replacing the real browser key.

## Tooling / validation boundary

Sandbox has no JDK, Gradle, Kotlin compiler or Android SDK. Attempts to obtain a
JDK via public vendor/CDN/package routes failed due outbound connection errors.
No credential requested or extracted. Do not label native code compiled/tested
until the exact commit's native CI completes. Use the existing manual APK CI
workflow (configured Java/Gradle and runner Android/Node tools) for compilation/unit tests;
any generated version-87 APK is a CI artifact, NOT a feature update to install.
No protected existing workflow modifications are needed.

Push is a scoped native-source commit with skip-actions trailer, followed by one
explicit manual existing build-workflow dispatch. Existing Cloudflare uploader
pin is NOT advanced or rerun. This native commit cannot satisfy its sole-parent
source gate, which stops before Cloudflare API operations. An automatic Workers
Build check may therefore report the expected source-gate failure; no retry or
new Worker upload is authorized by that check.

## Next implementation, without repetitive approval prompts

1. Native bounded HTTPS transport and strict response validation (no redirects,
   cookie/auth-header forwarding, WebView, tools or fallback providers), cancellation
   and UI lifecycle wiring. Cross-check body/header/time budgets and no auto-send.
2. Independent native Activity/onboarding, explicit create/display PUBLIC key,
   text composer/consent/STOP/clear. No JS/device bridge, voice or background work.
   Review coexistence with old activity/wake service without silently changing
   saved Fish/wake settings. Do not claim a text activity stops other services.
3. Current server accepts ONE owner/browser key. Add a separately revocable APK
   public-key slot and strict tests without replacing that key, weakening Origin,
   creating anonymous access or increasing shared quota. Schema changes should not
   be needed just to add a second explicitly authorized verification identity.
4. Update guarded uploader binding-preservation policy deliberately before any
   backend deployment. Do not silently add a binding or reuse an old upload gate.
5. Only after tested native screen/transport and enrollment support: higher APK
   version, install-compatible build, owner-authorized key registration and bounded
   phone tests. Owner involvement is required for install/server authorization,
   not for every local test. No new live AI test in this foundation increment.

Agent/device actions, screenshots, persistent history, paid services, updater
activation and Fish integration are not enabled by this code. Existing APK
Chat/Fish/browser deployment and browser key remain unchanged.


### CI trigger clarification

The manual existing-workflow dispatch was refused with HTTP 403 (integration
permission), before any Actions run was created. Do not retry that API or request
credentials. Use the repository's already-configured push trigger for the next
real hardening commit (curve-point validation and runner-compatible fixture).
Existing protected workflow edits remain untouched. The interop fixture now mocks
the D1 interface instead of requiring node:sqlite; actual backend SQL tests remain
separate. It still invokes the actual bundled Worker and blocks all live network.
