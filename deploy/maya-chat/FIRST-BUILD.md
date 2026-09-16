# First connected build — AI OFF, no promotion

On 2026-09-12 the owner confirmed the existing `maya-chat` Worker is
connected to `adil-chandio/Mana-android`, branch
`arena/01a089f7-mana-android`, through the Cloudflare dashboard in Edge.

The reviewed build configuration is:

- Root: `deploy/maya-chat`
- Build: `npm run check`
- Upload: `npm run upload`
- Non-production builds: disabled
- Build acknowledgement: `MAYA_UPLOAD_APPROVED=diagnostic-only-v1`

The owner explicitly approved one Worker-only push to trigger the first
connected build. This documentation-only change provides that push event.
The uploader, its guards and the 74,788-byte Worker artifact are unchanged.
The uploader's 45 local tests and artifact SHA256 verification passed again.

This is NOT a record of a successful remote upload or active deployment.
Inspect the Cloudflare build result and, if present, the unpublished-version
receipt before any manual promotion. Do not enable AI, register Edge/Brave,
change the saved Chrome key, or retry an uncertain version upload blindly.

The Cloudflare-created token's displayed permissions were broader than this
uploader requires. They have not been narrowed or independently audited by
this agent; no token value belongs in source, build output or chat.

This trigger uses GitHub's `skip-checks` commit trailer to avoid starting the
unrelated APK workflow, not a generic `[skip ci]` instruction. No workflow,
APK, Fish, runtime binding, quota or live traffic configuration is changed.
