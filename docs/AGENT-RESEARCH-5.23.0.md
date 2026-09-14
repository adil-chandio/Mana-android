# 5.23.0 (94) — bounded public research Agent

## What this actually adds

The owner selected Option 1 (review/edit/approve a bounded plan once), then explicitly asked implementation to continue without another app-choice question. Browser selection is therefore in the APK, not a blocking chat question. This release advances beyond the offline lab:

1. Separate native **Maya Agent** launcher. Goal/plan/results start blank; no incoming intent data, startup request, automatic permission prompt or key creation.
2. Optional AI **proposal** from the existing signed text endpoint, after per-use disclosure of the exact typed goal and destination. Fixed instructions plus goal only, no history/screens/private app data. Existing saved APK key, fixed Qwen model/endpoint, shared quota and Chat OFF gate are preserved. No deployment, repinning or server switch. Text capability is reused for a proposal, not server-side tools; native Chat replies themselves still never execute anything.
3. A strict editable 1–3-line read-only plan: `WIKI exact article title` or `REPO owner/repository`. Unknown commands, markdown, arbitrary URLs, credentials in URL syntax, namespace prefixes, extra path/query components, oversized inputs and duplicate request URLs reject. AI output is untrusted; a valid proposal is never approval and never runs automatically. Unsupported proposals are rejected without repair, retry or model fallback.
4. Explicit browser choice: Chrome, Brave or Edge; no default. This choice is bound to approval. Three narrow package-visibility entries, **no new permission**. Public-source fetches occur in Maya, not inside the browser.
5. Review discloses each source and provider; approval expires after 60 seconds. Run is separate and one-use. Up to three GETs execute sequentially with 600ms pacing, a 45-second total deadline and no retry. Edits/browser changes invalidate approval. Before/post request validation, callback identity/step fencing and readback of bounded typed responses prevent results or duplicate callbacks from adding actions.
6. Numbered public excerpts/metadata and source URLs are displayed. Wikipedia attribution/license notice is included; excerpts are explicitly shortened. GitHub integration is **public repository metadata only**, not authenticated repository editing, cloning or issue posting.
7. Optional separate AI explanation requires new visible consent to share goal (≤200 chars) and up to 430 chars of each displayed public source. Excerpts are untrusted data; explanation is plain text, never a new plan/action. Prompt stays inside the unchanged signed-text message limit. Citations/answers may be wrong; compare against numbered sources. This is not exhaustive deep research.
8. Source links can be manually opened after confirmation in the selected installed browser. Exact package/exported component checked and bound; no chooser, fallback or installer. Browser handoff is **launch requested, page unverified**—no Accessibility/screen reading, clicking, login or form filling. Browser's own cookies/account/redirects remain its responsibility and are disclosed. Leaving clears this workspace.

The prior offline approval lab remains available from the Agent; it no longer needs another launcher icon. Native Chat Info navigates to the real research workspace only after its existing confirmed private-session clearing. Selected Fish voice, keys, backend and legacy voice/action paths are unchanged.

## Network and lifecycle limits

- Wikipedia PCS `GET https://en.wikipedia.org/api/rest_v1/page/summary/{encoded_title}`. Main-namespace, English, standard (not disambiguation) response, plain extract only. No images/HTML/provider-supplied URLs followed. HTTP redirects are deliberately rejected; missing/renamed/ambiguous articles can require owner editing and fresh approval.
- GitHub `GET https://api.github.com/repos/{owner}/{repository}`, fixed API version 2026-03-10. No token, ambient authenticator, cookies, private resources, mutations, pagination or hidden follow-ups. Return must identify the approved repository and `private: false`.
- Public calls: one exchange guard, no redirects/retries/cache/auth fallback, 10-second call timeout, ≤65,536 response bytes, strict UTF-8, JSON depth ≤12 / token preflight ≤2048, typed bounded excerpt/metadata ≤1400 chars. Failures halt; partial validated sources are visible but not represented as a completed plan. Provider rate/capacity remains outside Maya's control.
- AI requests: unchanged NativeChatIdentity/Protocol/Transport; saved-key signing only, fresh read-only native/legacy readiness, 1.5-second local check, 20-second total local deadline, fixed redacted failures. No alternate endpoint/model or paid fallback. One background worker with zero queued work bounds stalled/cancelled jobs. New request attempts when occupied fail rather than pile up.
- STOP, touch during a fetch run, focus loss/pause, editing and exit cancel local work. Old callbacks cannot restore cleared data or create a new action. No auto-resume. STOP cannot guarantee remote abort or refund.
- Memory only: no preferences/history/disk for goal/plan/excerpts/replies. Disabled view-state restore/autofill; keyboard no-learning hint is not a guarantee about third-party keyboards, other accessibility tools, screenshots or compromised devices. Use nonsensitive public research topics. Fixed report copy is explicit and excludes content/URLs/keys.

## Evidence, not guarantees

New pure policy/runner, fake-HTTP and Robolectric Activity tests plus `node tools/test-research-boundary.cjs`. Test ports are injected by tests, not exposed through intents, debug preferences or production bypasses. No assistant-run live Fish, model or research API test. The runtime integrations are implemented, but their actual phone/provider success and model proposal quality are not established by mocks. CI evidence is recorded separately after completion.

Official API design references reviewed (documentation only, not live feature probes):
- https://www.mediawiki.org/wiki/Page_Content_Service — stable `/page/summary`, plain extract/namespace metadata.
- https://www.mediawiki.org/wiki/Extension:TextExtracts — directs new Wikimedia features to PCS; initial draft Action API approach was replaced before build.
- https://docs.github.com/en/rest/repos/repos?apiVersion=2026-03-10#get-a-repository — public repository metadata/versioned REST API. No auth token is supplied by Maya.

## Still materially unfinished

Full cross-app device execution/adapters, private screen/Vision handling, persistent history, arbitrary-web multi-hop deep research, authenticated GitHub writes, and the larger LMArena-like product UI remain unfinished. Sensitive sends/deletes/installs require separate explicit authorization; banking/payment/password/OTP automation stays excluded. Accessibility/capture activation, production updater trust/Stable, N2–N5 and Hermes are not silently enabled. This feature is substantial progress, **not a claim the whole project is completed**.
