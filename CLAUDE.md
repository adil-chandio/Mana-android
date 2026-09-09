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
