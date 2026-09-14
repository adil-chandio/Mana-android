# Maya 5.27.0 (98): permanent main workspace

## Why this replaces 96/97

The owner rejected the second-workspace experience, not only a separately labelled Agent tab. In 97, `openMainChat()` still constructed a new native surface, hid the original Maya WebView and offered a Back to Maya Home control. This revision creates the conversation once in MainActivity.onCreate. Main Maya IS that workspace from startup. Direct/Agent changes route the same composer without replacing the root, hiding the conversation, navigating the WebView or launching an Activity. The compatibility URI only focuses the existing composer. Back confirms app exit/clearing, not a return to another Maya page.

Checks/Privacy are inline expandable utilities; they never hide the conversation/composer. Original settings expand within the embedded component and collapse on resume. Native conversation data does not enter that WebView.

## Original orb and voice boundary

The original trusted WebView, saved settings and orb DOM/CSS are retained as an embedded component within the conversation. A fixed, exact-origin-checked mount script hides legacy Home/Chat navigation and duplicate message inputs in this host only. Browser/PWA presentation remains unchanged. The component is invisible until its trusted mount confirms success; a failed mount must not expose an accidental second conversation.

**Deliberate input change:** in the permanent host, tapping the original orb focuses the shared native composer. Its legacy `startListening` listener is intercepted so it cannot run voice/AI into a hidden second chat. The UI labels this clearly; it does not pretend to provide unified voice dictation. Existing selected-Fish Sunao, trusted preparation, BOLI.last restoration, credentials/reference and engine remain unchanged. No automatic microphone/playback, new speech provider, voice substitution or settings rewrite. Original voice settings remain explicitly accessible inline. Saved wake/background configuration is not silently changed; real wake/voice-to-composer integration is not claimed here.

## Agent tasks in the same screen

- Public research retains the existing reviewed 1–3 WIKI/REPO plan, once/expiry limits, fixed endpoints, explicit source/explanation consent, cancellation and exact browser handoff boundaries.
- A task-type selector under Agent mode adds **Build static page**; it does not navigate or create another composer.
- One Builder project per local conversation, counted within the shared maximum of three task cards. Its memory-only file is `index.html`, editable up to 8,000 characters. Larger text is refused for preview rather than silently shortened.
- Paste a complete small HTML document into the shared Agent/Build composer, or submit a natural-language request up to 400 characters. No automatic request/preview on type selection or manual document submission.
- Optional AI uses the unchanged signed service/model and 256-token output budget. It is a **tiny single-file prototype**, not a complete website/full IDE. Proposal consent includes only the current request and shown code (at most 1,000 characters), never the Direct conversation/history. Larger existing code remains editable/previewable locally; AI refuses it without truncation. The backend's existing quota/OFF/readiness enforcement is unchanged.
- AI output is displayed as an unverified proposal. Applying it to the editor requires separate confirmation; rendering requires another explicit confirmation. No automatic code application or execution.
- Subsequent shared-composer Build requests target the same project, appear as labelled Builder follow-ups in the timeline and require fresh consent for current code. Direct model context still includes only completed Direct turns. New project creation requires explicit conversation clearing; nothing evicts a project silently.

## Static preview isolation

The preview is a separate unprivileged WebView INSIDE the task card, not an external browser or another app screen. It never receives the original bridge/settings/keys:

- JavaScript, DOM/database storage, file/content access, file-URL privileges, popups, automatic media and network/image loads disabled.
- Every resource request intercepted with 403; all navigation blocked; no downloads, file chooser or permission grant.
- CSP denies default/connect/frame/form/base resources and permits only inline styles/data images.
- Synthetic preview origin, no native JS bridge, no shared source-to-action parser.
- Edits destroy the old preview and revoke pending consent/proposals. Global STOP is enabled for a live preview and destroys it; mode/utility changes also close it while retaining the code. Background/exit destroys preview and clears owned goals/code/proposals/draft/history. No filesystem export or project persistence.

This is **static HTML/CSS**, not JavaScript execution, a terminal, package installation, server hosting or a full development environment. Rendering a preview is not correctness verification. Cross-app adapters, GitHub writes, arbitrary-web research, Vision, persistent projects and a larger Builder model budget remain unfinished/separately scoped.

## Verification

Native tests target startup ownership, unchanged root/component identity across mode changes, no additional Activity launch, inline utilities, confirmed app exit, background clearing, existing signed-text/Fish/research contracts, and Builder consent/application/preview isolation, follow-up context, code bounds, OFF, STOP, expiry and late callbacks. JS tests mount the real orb DOM idempotently, reject synthetic navigation/legacy voice dispatch, preserve settings form values, and check duplicate inputs/navigation are hidden only in the host. Full web tests run with network denied.

This document is not a test-pass or physical-phone claim. Exact CI/test/artifact results are recorded separately after verification. No assistant live AI/Fish/research test, backend deployment, permission activation, key replacement, Stable promotion or updater activation is included.
