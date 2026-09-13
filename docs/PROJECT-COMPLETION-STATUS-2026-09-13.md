# Project completion status and next authorization boundary

Updated after owner voice confirmation at 17:42, 2026-09-13 (Asia/Karachi).
Current delivered source: bed4ff98e8d63d56a2a376084590bf4f0d894017,
APK 5.21.0 (92), 150/150 JVM tests; exact artifact in
backend/signed-chat/NATIVE-SUNAO-92-RESULT.md.

## Accepted, not to repeat unnecessarily

- Native APK identity/access/exact replay: prior owner phone PASS.
- Native real text reply and same-screen jheel-74 recall / Context 4: phone PASS.
- Native 91 draft/consent preserved across internal tabs, leave confirmation,
  and clearing on reopen: owner screenshot sequence PASS.
- Native 92 Fish local setup: screenshot READY; owner explicitly confirms hearing
  the same selected voice. Bounded voice verification PASS by owner report.
- Explicit consent, no automatic requests/retries, cancellation/late-callback
  protections and bounded validation: automated coverage. Physical all-case STOP,
  OS behavior, latency and hardware backing are not inferred from unit tests.

The earlier nadi-62/repeated-OK semantic error remains recorded; no all-answer
accuracy guarantee. Selected-voice confirmation does not establish precise timing
or universal speaker consistency. The whole long-term project is NOT complete.

## Next: separate Agent, not raw text wired to legacy actions

Read-only source review: app/src/main/java/com/maya/ai/MayaAct.kt is a legacy
bridge queue admitting tap/type/swipe/back, with target-label checks, rate/attempt
limits and a stop notification. It does not supply the new separate native Agent's
editable plan, plan-scoped app authorization, immutable approval binding, evidence
review and bounded execution lifecycle. Its mere presence is not authorization
to use it or proof of general autonomous phone control. No live actions were run.

Owner subsequently selected **Option 1**: approve an editable bounded plan once,
then execute only its permitted steps in explicitly selected apps. Do not re-ask
this decision. Implementation is proceeding; first disclosed increment is the
local-only Agent lab (5.22.0/93 candidate), not full external phone control or an
AI planner. See docs/AGENT-LAB-5.22.0.md for the implementation and limitations.

Either mode must stop on mismatch/uncertainty, expiry, user intervention or STOP.
No unrestricted device control. Sending messages, deleting content, installs and
new permissions need separate explicit review/confirmation; banking, payments,
passwords and OTP handling must not be automated. External screen/web content is
untrusted data, never authority to add actions or widen scope. Screen/context
transmission to a model needs a separate visible disclosure/approval, not reuse of
text-chat consent. No credentials requested in chat and no hidden capture.

This decision authorizes implementation boundaries, NOT immediate phone actions
or an OS permission toggle. Build/test work can continue independently once that
boundary is selected; enabling Accessibility/capture and physical action tests
remain owner-controlled when the corresponding reviewed UI exists.

## Other explicit unfinished boundaries

- Web/deep research, image/video analysis, GitHub integrations and persistent
  history need their own concrete capabilities, data handling and bounded service
  design; existing text-only endpoint is not proof they exist.
- Production updater signing/trust/Stable activation and N2–N5 remain gated.
- Hermes installation/activation remains unapproved; it is not silently added.
- No free/unlimited, zero-latency, perfect-answer or zero-flaw guarantee.

Server Chat remains at the owner's last explicit OFF setting. Do not alter the
consumed Cloudflare uploader pin to activate new backend scope, replace keys,
change the selected Fish reference or generate another APK just for a receipt.
