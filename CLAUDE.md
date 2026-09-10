# Project Maya — Context & Rules
## What Maya is
Personal Android AI assistant APK (voice, app launcher, WhatsApp send, screen vision). Built free with GitHub + Freebuff.
## Roadmap (one at a time, after all bugs fixed)
1. Accessibility Service → full device control (tap anywhere, type into any app)
2. GitHub Actions cloud brain → repository_dispatch trigger from phone
3. Repo as persistent memory → JSON/MD under /memory/
4. Auto APK updates via GitHub Releases (CI build on merge)
5. Notification bridge → Telegram bot or ntfy.sh when cloud tasks finish
## Hard rules
- Free tiers only, no paid API keys
- Never write API keys or tokens in code — GitHub Secrets only
- Never break existing working features; small safe increments only
- No root — Accessibility Service + standard Android APIs only
## Language
- Chat with me in Roman Hindi, short and simple
- Code, logs, commit messages: English only
## Workflow
For any code change use /think-plan-ask: THINK → PLAN → ASK → wait for my "yes" → EXECUTE → REPORT → wait again. STOP and explain on any unexpected break — never improvise big changes.

## Automation Safety & Stability Guardrails (HARD RULES)

### Safety
- Send / Pay / Delete / Buy / Logout buttons: ALWAYS ask confirmation first; proceed only after I say yes/haan
- Banking/UPI/finance apps (GPay, PhonePe, Paytm, bank apps): NEVER control or open
- Password / OTP / credit-card fields: never read, never type into, never log
- Verify target node text on screen BEFORE any tap — no blind coordinate tapping
- Screen reading only on explicit command, never background capture
- "Maya ruk jao" / "stop" cancels the current action instantly and returns to listening

### Stability (critical)
- Maya acts ONLY on explicit voice commands. NO scheduled, automatic, or self-started actions. Never act randomly in background.
- Every action bounded: max 3 verified attempts; if screen doesn't change, STOP and ask me — never retry infinitely
- Global rate limit: max 10 automated taps/types per minute
- Per-action timeout 5 seconds; stalled = abort + report
- Kill-switch: persistent notification button "STOP MAYA AUTOMATION" — tapping instantly disables the action queue
- If I touch the screen during automation (<1s ago), abort and wait — never fight my input
- AccessibilityService crash → show one-tap re-enable prompt; never silently auto-re-enable
- All gestures off the UI thread — no ANRs
- Maya ignores her own spoken replies as input (no self-trigger)
- Idle = zero actions, zero screenshots, no battery drain
