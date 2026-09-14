# Fish conversation — 5.37.0 (108)

## Why this repair exists

The owner rejected107's review-only voice workflow: the requirement is to speak and receive replies in the already-selected Fish voice, not repeatedly press Use transcript, Send and Sunao.107's native wake invitation deliberately stopped the old spoken-command path before an AI answer was requested. Fish was not replaced by phone TTS, but the interaction regressed.108 adds an explicitly started conversational path rather than describing dictation as conversation.

## Owner flow

**Talk → review the existing AI route and session scope once → Continue → speak → AI text answer → saved Fish voice → next listening.**

No per-turn Send or Sunao in this session. Mic remains optional text dictation; Direct text Send and per-reply Sunao retain their existing independent permissions. The Talk button is on the permanent workspace; no new Activity, chat tab, root or external assistant. Wake invitation opens this Talk setup rather than a dictation checkbox dialog.

The session uses the existing installed speech-input service and saved input language. The input service may process audio remotely. This is not another output voice: output is exclusively Fish using FISH.body/FISH.headers and the saved reference, pronunciation conversion and existing fixed Fish model, through a dedicated strict FishStreamPlayer owner. No AWAAZ output ladder, device TTS, Edge or substitute Fish reference is used by Talk.

## AI route and consent

Fish TTS turns a text answer into speech; it is not the question-answering model. Talk reads the existing original voice-AI configuration locally, selects the first eligible configured keyed provider from that existing priority policy, and shows its provider/model/token allowance before Start. It does not invoke the signed Cloudflare Direct Chat endpoint. That separate server's Chat OFF setting, identity, endpoints and256-token contract are untouched.

The route is snapshot-bound for this session. No keyless service, automatic model discovery, new account, alternate key/provider, model repair/retry or paid fallback is used. OpenRouter must use an existing :free model. Existing voice-route token ceilings are preserved: Gemini280, other configured voice models BRAIN.budget400 or1400. The higher existing reasoning allowance is not silently reduced to the Direct endpoint's256-token limit, which could again consume the answer budget in reasoning. No existing provider/model/token policy is edited. Configured-account eligibility and remaining quota still require actual owner use; a saved key is not proof of a working/free entitlement.

Only the newly spoken voice conversation is shared: no native Direct messages, draft, encrypted snapshots, Builder code, saved facts/memories or old legacy history. Up to5 turns/5 minutes; input/output strings up to2,000 characters; candidate context up to6,000 characters; UTF-8 AI request body up to16,384 bytes; response text parse limited to65,536 characters. No autosave/cache write by this module, no automatic context eviction, and no silent truncation of replies. Explicit Stop/expiry/error clears the JS session context. Voice lines remain visible in the same native timeline until workspace clearing/background; they are excluded from Direct context and saved-work snapshots. Native timeline voice storage is capped separately.

## Runtime and failure boundaries

- One session-start approval covers automatic transcript transmission and Fish playback only within that foreground conversation. It grants no phone/tool authority.
- Recognition is owned by a unique input ID, bounded at20 seconds with up to15 seconds of silence from ready. Successful Fish completion waits600ms for echo before next input. No wake phrase is needed for follow-ups. No-match/error ends instead of restarting the microphone repeatedly.
- Model requests contain no tools/function declarations. Tool calls, reasoning traces, malformed/empty/oversized or truncated answers are rejected; strings are never executed. Local command/automation/memory handlers are not called.
- Native tokens, presentation/focus checks, fixed endpoint allowlisting, request IDs consumed once, per-session turn caps and same-owner cancellation independently fence the bridge. Talk POSTs use fixed-length streaming, no redirects, a15-second timeout and the smaller response ceiling. Application-level retries/failover are absent; already-started remote work/usage may continue after cancellation.
- Fish playback requires a validated answer event for the current turn and is started at most once per turn with an exclusive dedicated player. Old/duplicate audio events cannot rearm input. Background/focus loss/STOP cancels the Talk recorder, its requests and its Fish output; it does not stop another new session via an old callback.
- Runtime legacy Wake is paused at Start without changing its saved switch. No startup/background microphone resurrection;107's app-chime removal remains. Competing Auto Listen/Proactive/Speak notifications settings block startup with a fixed explanation; they are not silently changed.
- Preflight is local and bounded. Missing/unavailable AI, Fish, input language or busy state is shown separately. HTTP quota/access/model failures are fixed messages, not raw response text or credentials. If Fish fails after an answer, the text remains visible and no replacement voice is played.

## Verification plan/result location

Added20 controlled Node tests executing the real module with synthetic input/network/audio ports, plus7 protocol/native boundary tests and3 native workspace tests. Existing wake-invitation test now verifies Talk's local preflight/no hidden dispatch, not the intentionally removed dictation invitation.

Tests include full speech→AI→saved-Fish→follow-up, no per-turn buttons, no private-context/tool leakage, original model budgets, Gemini request shape, no keyless/paid fallback, stale review/results/audio, STOP, silence, output errors, quota failure and caps. Native tests cover strict review envelopes/endpoints, paired display events, output admission, the permanent timeline, no Direct context contamination and unowned-event denial. All transport/audio/mic behavior is synthetic in automated tests.

Exact-head Android build/native count/artifact/signer verification is recorded in the final delivery receipt. No developer live AI/Fish request, voice audition, phone test, installation, deployment, key change or quota activation was performed. Physical TECNO input accuracy, audible output, latency, large-font layout and service tones still need owner acceptance. There is no guaranteed subsecond answer or flawless/full-project claim.

Install in place; do not uninstall or Clear Data. Trusted updater activation, silent background keyword spotting and broader native-settings/web/media/GitHub/phone workflows remain separate unfinished work.
