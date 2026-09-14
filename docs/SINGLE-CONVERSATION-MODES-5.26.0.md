# Maya 5.26.0 (97): one conversation, two composer modes

## Correction to 96

96's main-hosted Chat/Agent tabs were rejected by the owner. This revision removes the separate Agent workspace and goal composer. MainActivity retains its native in-place host, guarded entry links, original WebView and saved voice. NativeChatActivity and the old ResearchActivity compatibility launcher now both use the same NativeChatWorkspace (the latter initially selects Agent mode). No new incoming intent data is accepted.

One persistent message box, Direct Chat / Agent mode radio controls and one chronological memory-only timeline are used. Checks/Info are utilities, not separate task conversations. Agent goals, editable strict plans, review/once-approval/Run controls, progress, source cards and explanations are attached to that timeline. Consent confirmations remain explicit dialogs over the conversation; no navigation to another task screen. STOP sits outside scrolling content and owns native Chat, Agent requests/runs and optional Fish playback.

## Workflow and honest bounds

- Direct Send uses the unchanged signed text-only transaction protocol and completed Direct history. Model replies never execute actions.
- Agent Send accepts a nonsensitive goal up to 400 characters or an already valid manual WIKI/REPO plan up to 450. It adds a local task card; AI proposal requires separate confirmation and never runs itself. A manual plan needs no AI request. The shared draft is not shortened on a mode switch or oversized Agent submission.
- Edit/review 1–3 exact English Wikipedia article titles or public GitHub repository names; explicitly select Chrome/Brave/Edge for optional later link handoff. Approval is once-only, expires at 60 seconds and is checked at Run. Reads retain the existing 45-second run deadline, 600ms pacing, fixed endpoints, byte/depth/token limits and no retries/cookies/auth/redirect following.
- Sources appear in the task card. Explanation requires separate consent for bounded goal/source excerpts and the same signed Chat backend/quota. Browser opening needs its own exact-package confirmation. Handoff is not browser page verification or browser control.
- Agent explanations offer manual Sunao through the existing selected-Fish consent/ownership path. No autoplay, replacement voice, speech-driven AI, key export or settings changes.
- Up to three Agent cards per local conversation. A fourth task is refused without discarding the draft or existing turns. Direct protocol context bounds are unchanged. Clear/exit is explicit; no silent history eviction.

## Cross-mode context is explicit, not cosmetic or hidden

The visible timeline interleaves completed Direct exchanges and Agent cards in submission order. Agent goals/plans/sources are NOT silently appended to Direct model history.

An AI-plan consent can show and optionally include the most recent two completed Direct messages, capped at 400 UTF-16 characters per message without splitting surrogate pairs. The checkbox starts unchecked. The current Agent goal plus fixed instructions and only the selected excerpts are sent, within the unchanged 2,000-character prompt limit. The earlier unsent draft and all other context are excluded.

A source card can place that exact displayed source in the shared composer after confirmation, selecting Direct Chat locally. Existing draft replacement needs another explicit confirmation; cancel keeps it. This sends nothing. Direct Send still requires Direct consent, and sends its existing completed Direct context plus the edited composer content. No automatic full cross-mode recall is claimed.

## Ownership and privacy

Mode changes stop/fence native work, revoke Agent approvals and stale consent dialogs, but preserve completed conversation, sources, draft and Direct consent. Switching utility pages revokes Agent work/approvals. As in the previous bounded runner UI, touch/intervention during public reads halts the run without automatic resume. Late callbacks cannot restore stopped/cleared cards. Background/exit/destruction clears the private timeline, cards, goals, excerpts, explanations, draft and consent; public identity/settings remain untouched. State saving and autofill remain disabled. Obscured dialog confirmations are rejected and fenced.

No private content is copied into the WebView, history, bridge or intents for navigation. Existing explicitly consented selected-text Fish preparation remains the documented exception: it uses the original trusted pronunciation conversion and restores BOLI.last in finally. No backend changes, deployment, permissions, provider test or Chat activation are part of this revision. Chat remains owner-controlled/OFF.

## Verification plan / evidence boundary

Native Robolectric tests cover one composer/no Agent tab, mixed ordering, no automatic context sharing, unchecked context opt-in, explicit source transfer/draft replacement, task/goal bounds, once approval/expiry, plan/browser mismatch, STOP/mode/exit/late-callback fences, overlays, browser component restrictions, MainActivity hosting and existing Fish/Direct privacy behavior. Existing research protocol/runner/HTTP tests remain.

Offline JS/static/version checks are run with network APIs denied. Native tests and the actual development APK are built in CI because this sandbox has no Java/Android SDK. CI results and exact artifact identity will be recorded separately; this document alone is not a passing-build or phone verification claim. No live AI/Fish/research request is used for verification.

Full cross-app execution adapters, arbitrary-web deep research, GitHub writes, Vision, persistent history, Stable/updater activation and unlimited/free/perfect claims remain outside this implemented capability.
