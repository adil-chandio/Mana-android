# 5.18.0 / code86 — N1 conversation foundation (development)

Preserves the user-reported working code85 Chat/wake baseline, selected Fish reference, fixed free model, native Fish player, signing identity and unconfigured updater trust.

Adds bounded, in-memory per-input timing: typed/tap/wake/follow-up origins, cache/local/provider classification, native same-clock speech-end-to-final duration, WebView text delivery and selected-Fish dispatch-to-playing events. Timing is attached only to explicit input/reply/audio owners; auditions, retries and unowned legacy replies cannot borrow a previous sample. Missing markers are unknown, not zero. Provider-only median/worst summaries are limited to the last20 accepted inputs and do not prove audible latency.

Fixes a reproduced follow-up expiry bug: a silent mic can no longer outlive its window and accept a late command. Speech begun within the window gets bounded completion; all explicit recognition attempts have 30-second native/JS deadlines. New native callbacks echo a validated page/session owner so an old result/error/partial cannot steal a new mic session. Explicit tap and bare wake with window0 remain available. No full-duplex microphone, weakened echo shield or partial-transcript commands.

Development test build only; phone acceptance and measured speed remain pending. In-app updates still need separately authorized signing/bootstrap activation. No silent update, downgrade, data clearing, production release or paid/different-speaker fallback. See docs/N1-CONVERSATION-5.18.0.md.
