# Maya workspace / Settings repair — 5.29.0 (100)

## Delivery scope

This starts the approved revised roadmap with the screenshot-blocking navigation/lifecycle repairs and bounded task improvements. It is not a claim that every future capability in the master structure is now implemented.

### Dedicated Settings, same conversation

- Workspace menu contains New conversation and Settings. Native Settings is a separate full-height destination inside the existing Activity, not another chat and not a small WebView inside the conversation.
- Settings home links to original Voice/appearance categories, Privacy/limits, and native Checks/identity. Original categories continue to use their saved controls; this is not yet a complete native rewrite of every settings category.
- While Settings is open, the conversation, orb welcome state and composer are hidden. Native status, speech status, obscured-touch warnings and active native STOP remain reachable.
- The original WebView is moved into a full-height settings host, outside the conversation ScrollView. CSS hides its orb while showing Settings and keeps original header/navigation/chat hidden. Returning restores that same WebView to its orb slot; the same conversation, draft, code and timeline objects remain.
- Category Back returns to Settings home; Back again returns to the workspace. No Activity launch, browser handoff, data persistence or automatic request. Settings navigation stops/revokes owned work, including previews; it does not erase the completed conversation/draft/code.
- Transient pause/resume keeps the selected Settings destination. Actual background/exit still clears owned ephemeral conversation/Builder data and returns to the workspace on next resume. Saved voice, identity and preferences are not cleared.

### Legacy UI leak: concrete cause and fences

`applyTheme()` replaced the entire HTML className, erasing native host/settings flags. It now removes only theme-prefixed class tokens and leaves host, route and compatibility state intact. Tests exercise the actual theme function after mounting, not just the initial mount.

Native-host CSS is activated before body paint when the existing bridge is present. Mounting checks the actual orb wrapper, so the early host flag cannot accidentally skip event-listener installation or create duplicate wrappers. Browser mode is unaffected.

Every native page start/fallback hides the WebView and invalidates mount readiness. Epoch-bound mount and settings-presentation callbacks verify the current trusted URL and requested presentation before making it visible. No private draft, chat history, code or credentials enter these scripts.

### Composer

Mode/tool selectors are on their own row, separate from Send/STOP. Spinner padding is explicit; captions are single-line. At narrow widths/large font the selector row can stack based on measured text needs. The message and actions share the lower row. No word splitting such as Research → Rese/arch. Fixed footer STOP remains independent and settings reserve space for it while an explicit check/speech operation is busy.

### Bounded task improvements

- Research approval has an actual 60-second expiry callback, not only a check when Run is tapped. The original start-time validation remains. STOP/replacement/start cancels the old timer; stale timer callbacks cannot revoke a newer approval. No automatic run, source request or approval renewal.
- Builder has one bounded, memory-only Undo last apply. It needs confirmation, restores only the preceding applied local code, destroys preview/proposal via the existing editor invalidation path, and sends/renders nothing. Subsequent owner edits revoke that undo rather than overwriting newer work. Exit clears it. No disk revision history or multi-file IDE is implied.

## Verification requirements

Network-denied npm suite, old-WebView CSS checks, actual host DOM/theme/mount tests, native static boundaries and version/asset sync run locally. Matching GitHub native compilation/Robolectric tests and APK identity must pass before delivery. Native coverage includes dedicated Settings/Back, pause versus actual background, original WebView ownership, hidden composer, small-width selectors, STOP geometry, expiry timers and local Undo.

These checks are not physical TECNO rendering/TalkBack/keyboard/installation or live-provider proof. The screenshots supplied by the owner are the observed 99 defects; no new phone screenshots are claimed.

## Unchanged / not activated

Saved exact Fish and Chat OFF, APK identity/Worker/model/256-token budget, existing research source limits, browser handoff consent, obscured-touch fences, static-preview isolation and current privacy retention policy remain. No providers, network tests, backend deployments, permissions, updater trust or remote write capability are activated.

## Remaining approved roadmap, not disguised as completed buttons

- Unified dictation with explicit recognition data path and microphone ownership.
- Message-attempt/context UI and broader accessibility/device validation.
- Full settings category/native-control migration and just-in-time startup-permission redesign.
- Consented conversation/project persistence, backup/deletion policy, safe import/export and actual diffs/revisions.
- Broader search/media/GitHub and bounded phone adapters, each with its own supported tools and authorization gates.
- Trusted in-app update enrollment/delivery, still inactive until explicitly configured.

Install this development release in place; do not uninstall or clear app data.
