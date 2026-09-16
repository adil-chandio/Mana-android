# 5.22.0 (93): Option-1 local plan approval pilot

## Owner decision and actual scope

The owner selected Option 1: editable plan, one approval, then bounded permitted steps in explicitly selected apps. STOP/mismatch halt is required; send/delete/install require separate confirmation, while banking, payments, passwords and OTP are outside automation. Implementation approval does not silently grant OS permissions, screen/context upload, or live assistant-run actions.

This release implements the first explicitly disclosed **local test workspace**, not the full requested mobile Agent. It does not generate AI plans, research the internet, select/control external apps, inspect screens, request Accessibility/capture permissions or connect to the legacy action queue. External capabilities remain unimplemented, not merely a switch to enable. There is no model output/action bridge. Hermes, updater activation and backend repinning remain out of scope.

## Usable flow

- Separate `Maya Agent Lab` launcher entry; ignores inbound extras/data. Opening starts blank and makes no network request.
- Native Chat's Info page also offers `Open Agent workspace · local pilot` with explicit confirmation that leaving clears Chat and stops its owned audio/waiting. Chat cannot silently remain behind this navigation.
- Owner types 1–6 lines (source ≤1800 characters), or deliberately loads the local example. `SET text`, `EXPECT text`, `CLEAR` are the entire accepted grammar; per-step text 1–200 characters, no blank lines, ISO controls or surrogate code units. CLEAR clears only the visible local test field; it is not file/message deletion. No external target/package is accepted.
- Review displays the exact editable plan and fixed local target. Approval alone never executes; `Run approved local plan` consumes a one-use approval valid for <60 seconds. Editing the plan/target revokes approval. Stale dialogs cannot approve changed or abandoned sessions.
- Six steps maximum, 750 ms between steps, 30-second run deadline. Target availability and expected field contents are checked before every step, with readback after writes. Failures/mismatch stop without retries.
- Persistent on-screen STOP; a touch during execution, pause/focus loss or background/exit cancels. Old callbacks cannot revive a stopped/replaced run. STOP is local synchronous cancellation, not a general remote-abort guarantee.
- Plan/test data are memory-only: no preferences, instance-state restore, autofill, logging or screen upload. Stop/background exit clears contents and approval; resume never auto-runs. Input asks the keyboard not to learn, but this is not a guarantee about third-party keyboards, screenshots, accessibility tools or a compromised phone. Use nonsensitive test text.
- Fixed execution report lists outcome and verified step kinds, without plan/draft values. Copy is explicit and puts this redacted report in the system clipboard.

## Verification and limits

Added pure JVM state-machine tests and Robolectric activity tests, plus `node tools/test-agent-boundary.cjs` (static integration checks). These are local/fake-port tests, not physical phone, actual AI-planner or external-app execution evidence. CI result is recorded separately once complete. Existing Chat/Fish regression suites must remain green. No new dependency or permission is required, no speech/reference/key/AI model or endpoint is changed.

## Still pending for the owner's full project goal

Real AI planning and strict schema/policy compilation; explicit application selection and reviewed app-specific adapters; visible OS permission activation and separately consented screen/context handling; independent confirmations for sensitive side effects; external step evidence and uncertainty handling; bounded research/GitHub/Vision/history data flows. A local lab passing is not evidence that these capabilities exist. Native text chat and owner-confirmed selected Fish voice remain separate accepted work.
