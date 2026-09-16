# AI connection routing repair — 5.38.0 (109)

## Reported obstruction

The owner's screenshot shows a typed Direct attempt blocked locally by saved Wake ON while the owner separately confirms Cloudflare ENABLE_CHAT=false. The local block prevented transmission, and clearing it alone could not enable the server.108 Talk used an existing configured voice-AI account, whereas typed Send still defaulted to Cloudflare. That split was confusing and the repeated large local-failure cards were unhelpful.

## New default and explicit route ownership

- Default composer mode is **Chat**, using the same eligible saved-AI selection policy as Talk. The visible **AI connection** control identifies this choice. No connection is probed or microphone started on opening the app.
- On manual Send, a fixed trusted-document function reads only AI configuration into native memory. Typed draft/context never enter that function or JavaScript. Fish setup, input language and microphone permission are not requirements for reading typed-chat configuration.
- Before the first Send for a temporary conversation/provider/model/key, the native dialog displays the exact candidate messages, provider, model and existing token allowance. Old Cloudflare Remember consent is not reused for the saved-account route.
- After consent, runtime Wake pauses without changing the saved Wake switch. Actual native microphone/service/player/HTTP/action state and fixed local JS readiness are checked. Configuration is read again and its provider/model/key/budget fingerprint must match the review. Changed/stale/cancelled/obscured reviews cannot send.
- The native worker constructs the request and parses the reply. It reuses the existing no-cookie/no-cache/no-redirect/no-auth-fallback/no-retry, one-exchange OkHttp client and20-second operation owner. No alternate provider, keyless fallback, discovery, tool call or output truncation.
- Successful replies enter the same native typed conversation and existing explicit saved-work format. Talk rows remain separately excluded from typed context unless deliberately copied by the owner. Typed replies do not autoplay; optional Sunao remains explicit and uses the exact saved Fish voice.
- Permission is temporary and tied to a hash of the exact configured route/model/key/budget. It is cleared by Settings/mode/route/STOP/background/restore boundaries rather than persisted as a broad new device grant. Config credentials are not retained in the review-dialog callback; only its fingerprint and reviewed native messages are captured there.

## Cloudflare OFF is not treated as connected

Cloudflare Direct is no longer the default. It requires explicit local selection through **Privacy & limits → Cloudflare Direct · advanced**, with an operator acknowledgement that server enablement/reviews were completed independently. The app does not deploy, enable or modify the Worker. The UI says server availability is unverified, not connected. An empty signed check still does not prove AI access.

Absent local opt-in, selecting/sending to the Cloudflare route yields one clear unavailable status without a request or an attempt card. A validated CHAT_NOT_ENABLED response revokes the local route-ready acknowledgement, preventing subsequent retry-card spam until explicit owner review. Changing back to saved AI preserves draft/context but does not send them or transfer consent.

The owner-reported server OFF flag, signed identity, Worker endpoint/model/256-token contract, shared browser quotas and development updater trust are unchanged. Saved-account requests retain the existing account's Gemini280 or other model400/1400 voice-route ceilings; those are not silently mistaken for the separate Cloudflare256-token contract. Configured keys/models/quotas are still not proof of live/free account eligibility.

## Local failure presentation

The attempt card is now attached only after the local readiness gate passes. Wake/busy/unavailable pre-dispatch failures therefore leave the original draft and a single wrapping status/recovery control, not repeated large cards. Legitimate dispatched/uncertain failures remain distinguishable and retain explicit restore/dismiss behavior. No hidden resend, no failure inserted into uploaded context, no silent eviction of the six-attempt cap.

AI connection opens an internal route explanation/recovery dialog with a direct path to the existing Voice & AI settings. Missing saved AI, local-host timeout, model/config changes, access/quota/model failures and invalid responses are reported separately. Labels no longer imply every Chat message uses an APK signing key or Cloudflare quotas.

## Saved preference versus actual ownership

The new native idle-readiness script omits only the saved Wake preference check. Native callers independently reject an actual Wake service, active microphone, speech output, unknown audio state, pending actions/requests and competing auto-listening/notification/proactive behavior. The old Cloudflare-specific script remains strict.

One-shot Mic and Sunao also use this actual-idle path, so a stopped Wake service with a saved ON preference alone cannot prevent the selected Fish voice from playing. Active capture/output is still blocked; no existing speaker is stolen to start Sunao. The original Fish body builder, reference/key, pronunciation conversion, free-model policy and output player are unchanged.

## Security and validation

`ConfiguredChatPolicy` validates exact configuration fields, allowed provider/model/token combinations, printable bounded credentials and fixed HTTPS targets. Native request construction applies existing Unicode/context/message/body limits. Strict JSON parsing rejects duplicate keys, trailing data, excessive nesting, malformed UTF-8, tool calls, nonterminal/truncated answers, reasoning traces and oversized text. Auth/quota/model/network failures never display raw provider bodies or credential-bearing URLs.

`ConfiguredChatTransport` uses the existing operation cancellation/remaining-deadline model and network exchange guard. STOP before dispatch prevents execution; late/expired responses cannot commit context. Already attempted remote processing may continue or count usage. No local deletion/refund guarantee.

## Checks and remaining acceptance

Added10 native policy/transport tests and7 native UI/route tests, plus3 Node configuration-selection tests. Existing Cloudflare tests explicitly select that route in their fixtures; former local-readiness card assertions now verify zero cards, preserved draft/context and inline recovery. Typed transport tests use fake calls; UI tests use a synthetic trusted settings document. No real mic, AI, Fish, deployment or phone action is exercised by these tests.

Exact-head CI/native count/APK/signature evidence is in the delivery receipt. This release records its own exact file scope/hash comparison before delivery.

Remaining: physical TECNO typing/voice/UI/latency/account-availability acceptance, full native original-settings migration, broader web/media/GitHub/phone tools and trusted updater activation. This is a routing repair, not a flawless/full-project or guaranteed free/instant inference claim. Install in place only; no uninstall or Clear Data.
