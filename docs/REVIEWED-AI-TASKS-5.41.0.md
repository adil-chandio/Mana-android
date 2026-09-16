# Reviewed AI tasks — 5.41.0 (112)

This slice follows the owner's authorization to proceed independently after cloning/studying Ruflo. It addresses the concrete integration gap where Chat/Talk could use a saved AI account but Agent planning, explanation and Builder proposals still depended on an OFF Cloudflare route. Wake111, Fish playback/reference, microphone ownership and containment code are frozen in this slice.

## User-visible change

Existing Agent/Builder controls remain in the same permanent workspace. Before sending a task to AI, they locally resolve the selected connection and show the **actual provider/model, task purpose,256-token ceiling and exact native prompt/data**. Research's recent-Chat excerpts remain optional and unchecked, displayed in the same review. There is no additional per-step phone authority or automatic source fetch/apply/preview.

The task's approved request uses:
- **Saved AI** by default, using the same eligible account/model selection as typed Chat. Cloudflare server Chat OFF does not block this saved-account request, and no request is sent to Cloudflare as a fallback.
- **Cloudflare** only if the owner explicitly selected that route and acknowledged its independent server setup. The server remains responsible for actual enablement. No Worker flag, model, identity, deployment or key is changed here.

The workspace supplies its Activity host to ResearchBackend; an application-only Context cannot silently borrow another MainActivity's settings/authority. This was necessary for the new configuration preflight to work in the actual main workspace, not just in a backend fixture.

## Native review contract

`AiTaskReview` holds purpose, route, provider/model label, connection fingerprint, exact allowed prompt hashes, creation time and a one-use state. It does not hold a key or raw prompt.

- Prepare performs no model request and does not grant execution.
- Explicit confirmation chooses one of the displayed candidate prompts and approves that exact hash.
- The approval expires after60 seconds and is consumed once. A different prompt, second use, revoked ticket, backward/expired clock, changed route or changed saved provider/model/key cannot dispatch.
- UI changes, STOP, Settings, fold/remove, stale/obscured dialog or task disposal revoke pending review and callbacks. Synchronous test ports and asynchronous production preflight are both handled without leaving a stale cancellation handle in the task.
- Native input/readiness checks are repeated before execution. Typed task data never enters the privileged JavaScript document; only the fixed configuration-read function is evaluated there.
- No automatic request retries, alternate provider/key/model, discovery, tools, phone actions or output execution.

## Purpose-aware shared transport

The configured transport uses the same existing native one-exchange/no-cookie/no-cache/no-redirect/no-auth-fallback client and cancellation owner as typed Chat. A caller can lower the output allowance but cannot increase the selected account's allowance.

Task purposes select fixed native system instructions:
- Research plan: exact WIKI/REPO grammar or UNSUPPORTED.
- Source explanation: only supplied excerpts, numbered attribution and uncertainty.
- Builder proposal: tiny complete static HTML/CSS, no scripts/remote resources or testing claims.

All three remain capped at256 output tokens. Ordinary Chat retains its existing Gemini280 / other model400 or1400 allowance; Talk and its payload are unchanged. A reasoning model may not produce a usable artifact within256 tokens; a rejected/truncated result is not silently accepted or retried with a higher budget. Larger Builder capacity requires an explicit separate capability change.

The signed Cloudflare adapter retains its existing fixed256-token server contract. Its actual availability is not inferred from a local acknowledgement. Connection/approval failures are distinguished from account limits and unavailable/invalid output; task statuses identify the reviewed provider.

## What does not change

Research remains1–3 exact public Wiki/repo metadata sources. Builder remains one local index.html up to8,000 characters, AI input code up to1,000, request up to400, separate proposal/apply/undo/static-preview controls. No new permission, raw WebView bridge, cross-app automation, native code execution, terminal, external folder access, implicit source read or quota activation was added.

Chat, Talk, Wake matching/handoff, native Fish stream, selected reference/key, input recognizers, snapshots and existing data are preserved. The main workspace factory changes only the research service's host binding. No sensitive native context is transferred to JavaScript.

## Verification

New review-policy tests cover prepare≠approve, exact prompt choice, one use, expiry, wrong prompt, revocation and redacted metadata. Backend tests execute a saved-account task with the owner-reported Cloudflare route OFF using a fake native transport, verify actual workspace host wiring, and test missing approval, key/route change, cancel and unreviewed Cloudflare denial. Transport tests verify purpose-specific instructions and budget reduction without changing default Chat payload behavior. Existing UI fakes now prepare metadata and require actual review-ticket approval before recording a model request.

Final build/native count/artifact verification is recorded in the delivery receipt. Tests are synthetic; no live model/Fish/Wake/device/phone action or deployment was run by the agent. No claim that the owner's current provider account/model/quota or physical voice behavior has been verified.

Ruflo provenance/adaptation is recorded in `docs/RUFLO-REFERENCE-AND-MAYA-ADAPTATION.md`. No Ruflo runtime, daemon, hooks, MCP server, copied agent swarm, model or dependency was installed into Maya.

## Remaining work

Canonical typed/Talk context, native credential/settings migration, robust provider capability qualification, deeper research/GitHub/media, safe reviewed phone adapters, multifile/runtime Builder, trusted updater and physical acceptance remain unfinished. This closes a task-AI routing/review slice, not the whole project. Install in place only; no uninstall or Clear Data.
