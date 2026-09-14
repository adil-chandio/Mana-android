# Maya 5.35.0 (106) — quiet composer, explicit remembered permission, actionable Wake block

## Owner-reported issue

Screenshot_20260914-154138.png shows a typed `hi` attempt blocked by the fixed local readiness reason **WAKE_ENABLED**. This establishes a local saved-Wake policy block, not a Fish output failure or server response. Screenshot_20260914-154130.png shows the repeated inline Cloudflare consent checkbox and the temporary-chat clearing notice after leaving. The compact orb's persona tag also overlaps its initial. The screenshots do not establish the installed APK version, successful model dispatch, or physical correctness of this repair.

## Direct sending permission

- The **Allow this Direct conversation → Cloudflare AI** checkbox is removed from the composer/view hierarchy. Send becomes enabled for a nonblank draft while idle; it does **not** thereby gain authorization.
- The first manual Direct Send without an existing grant opens a disclosure/review dialog with the exact validated candidate Direct messages, destination, provider-processing warning and separate **Allow & Send** action. Cancel/dismiss does not create a turn, attempt, key, network request or remembered grant.
- An **unchecked-by-default Remember permission for my manual Direct Sends on this device** option lets the owner deliberately avoid the first-Send dialog in later newly typed conversations after background/restart. Without selecting it, the grant is temporary for the current conversation, just as before, but no persistent checkbox occupies the composer.
- Remember stores only a small fixed, versioned text-Send policy record tied to the configured Worker origin/path/model. It contains no messages, keys, audio, history or approvals. The atomic, bounded record lives in **noBackupFilesDir**, not Android cloud backup/device transfer. Absent, malformed, future/different-contract or unreadable records grant nothing. Saving failure does not pretend to remember or dispatch a request.
- Remember is **not** server Chat ON, an automatic Send queue, background work, microphone permission, Fish autoplay, Agent/tool approval, paid service authorization, history persistence or a widened budget. Each future request still needs a fresh owner Send gesture and passes all existing local readiness, identity, signing, context and server gates. Wake remains a blocking condition until the owner changes it.
- Opening an explicitly saved conversation resets temporary consent and requires a fresh first-Send review **even when Remember is enabled**, because restored history is newly introduced context. Nothing automatically sends on restore.
- Settings → **Privacy & limits** displays the current policy and retains **Revoke Direct consent**. Revoke stops owned local waiting, clears temporary and remembered grants and preserves draft/messages/saved work. A disk failure is reported honestly, revokes locally and instructs retry before app restart. Already dispatched remote work/usage may continue; revocation is not provider deletion or refund.
- Consent is bound to the exact draft and candidate context, current route, mode, foreground and confirmation generation. Editing, navigation, pause/background, obscured touches, duplicate/stale positive callbacks or an intervening revoke cannot cause delayed sending or persistence from an old dialog.
- The previous CheckBox field remains only as an unattached, non-state-saving in-memory grant holder for the existing workspace migration; it is neither a visible control nor a hidden view receiving owner input.

## Wake / readiness recovery

The safety gate is deliberately **not bypassed**, and no saved Wake/voice setting is silently changed.

- A readiness-blocked attempt now shows a short, fully wrapping actionable reason, for example: **Not sent · Wake is ON. Open Voice settings, turn Wake OFF yourself, then return and tap Send.**
- **Open Voice settings** navigates internally to the existing dedicated Voice & appearance screen. It keeps the same draft/conversation and makes no setting change, Activity handoff or resend. Other readiness reasons can route to the local Checks screen instead.
- **Why Send was blocked** retains the fixed reason code, full reason/timing and local-only outcome in a separate read-only detail dialog. Failed attempts remain excluded from uploaded context. Restore draft still copies only; it never resends.
- The identical verbose readiness result is not repeated above its completed attempt card. This suppression is limited to the matching local-readiness failure; remote/uncertain errors are not globally hidden.
- Wake instructions no longer refer to a confusing separate “original Maya”; they identify Settings → Voice & appearance. If the owner turns Wake off, a later Send still rechecks service/audio/other auto-voice owners and may correctly report a different remaining blocker. There is no forced disable-all or automatic retry.

## Other screenshot cleanup

- Empty background/return cycles no longer leave an unnecessary cleared-chat banner. When actual temporary content was cleared, a short truthful notice remains and disappears when the owner starts typing again. This does not change the active-workspace clearing policy or automatically save anything.
- The persona tag is hidden only in the tiny compact orb, avoiding its overlap with the M initial. The regular orb and saved persona/Fish selection remain unchanged. This is a narrow old-WebView-compatible CSS rule, not physical rendering proof.

## Verification and limits

Required: network-denied npm/static/version/packaged-asset checks, exact-head Android CI/native tests and development artifact verification. Added tests use synthetic permission stores, local Android shadow files and a synthetic Wake-on fixture that blocks before signing/network. They test first-Send consent, unchecked defaults, no composer checkbox, cancelled/stale/edited/obscured/background consent, remembered and temporary scopes, revoke, saved-work fresh review, no Wake bypass or automatic setting change, internal settings navigation, duplicate-banner suppression and bounded record contents.

No live AI, Fish, microphone, provider, phone action, permission grant, Wake setting change on the owner's device, deployment or trusted-updater enrollment was performed by the agent. Saved Fish, Chat OFF, Worker/identity/model/limits remain. Install in place; do not uninstall or Clear Data.

This is a repair of the reported interaction, not completion of the expanded project. Full native settings migration, broader web/media/video/GitHub workflows, reviewed cross-app execution, multifile/runtime Builder, trusted updates and physical TECNO acceptance remain unfinished or separately gated.
