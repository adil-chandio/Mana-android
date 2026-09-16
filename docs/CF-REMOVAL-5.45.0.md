# Cloudflare Removal — 5.45.0 (116)

Owner order (2026-09-16): remove Cloudflare from the APK completely — this reverses
the earlier "parked with config intact" preserve. Git history is the only backup of
the removed code; nothing was migrated elsewhere.

## What was removed from the APK

- Signed Cloudflare Worker transport: `NativeChatTransport.execute(signed)`, the
  `SignedRequest` type, `ORIGIN`/`CHAT_PATH`/`CHECK_PATH`/`MODEL` constants, the
  ECDSA sign path (`NativeChatProtocol.sign`, `derToP1363`, `publicJwk`,
  `fingerprint`) and the server envelope parser (`NativeChatResponse.parse`).
- `NativeChatIdentity.kt` (AndroidKeyStore signing identity, Cloudflare-only).
- `NativeAccessDiagnostic.kt` (Cloudflare access/replay check diagnostic) and the
  checks-page "APK access + replay" panel, "APK identity" panel, check/key buttons.
- `DirectSendPermission.kt` + `AndroidDirectSendPermission.kt` (remembered manual
  Direct-send grant, Cloudflare-path-only) and the consent checkbox machinery.
- `AiTaskReview.Route` (route selection), `ResearchBackend.route()` /
  `signedTransport`, `TextFailure.CHAT_OFF`, the `useConfiguredChat` /
  `cloudflareReviewed` flags — saved AI account is now the only route, no selection.
- All Cloudflare strings, preferences (`text_route`, `cloudflare_reviewed`,
  `maya_connections` reads), and the parked-route UI.

## What stayed (deliberately)

- `NativeChatTransport` keeps the shared bounded HTTP plumbing (`client`,
  `AttemptGuard`, `oneExchange`, `Operation`) used by the saved-AI transport.
- `NativeChatProtocol` keeps message/body/hash/validation helpers;
  `NativeChatResponse` keeps `Result` + the strict `Json` parser.
- `ConfiguredChatPolicy` / `ConfiguredChatTransport` (saved-AI route) unchanged.
- `backend/` + `deploy/` (Cloudflare Worker server sources) remain in the repo as
  inert history. They are server code, never compiled into the APK. Say the word
  and they go too (git history still keeps them).
- Historical `docs/*.md` keep their past-tense Cloudflare mentions as history.

## Behavior notes

- Chat Send now always uses the reviewed saved-AI account (Allow & Send dialog per
  provider/model). The old remembered Cloudflare grant is gone; nothing inherits it.
- Old stored preferences (`text_route`, `cloudflare_reviewed`) are never read again.
  Stored bytes were left untouched (no silent data wipe).
- Touch-obscuring protection (`touchWarning`, `consumeTouch`) is unchanged.

## Verification

- `node tools/test-native-chat-boundary.cjs` asserts the deleted files are absent
  and no Cloudflare/signed-request/route symbol remains in the chat/agent sources.
- JVM suite: transport/protocol/response tests rewritten for the remaining shared
  pieces; surface tests converted to the saved-AI-only flow.
- Full CI (`npm test` + Gradle) must be green before install; no on-device proof.
