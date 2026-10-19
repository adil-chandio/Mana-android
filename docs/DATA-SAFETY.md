# MAYA — Google Play Data Safety Form (draft)

> Play Console mein bharte waqt yeh reference lein. Yeh draft MAYA v5.12.0
> ki asal harkat par mushtamil hai.

## Data collection

**MAYA koi data collect NAHI karta (no collection, no sharing with third parties for advertising/analytics).**

| Category | Collected? | Shared? | Purpose | Ephemeral? |
|---|---|---|---|---|
| Personal info (name, contacts) | ✅ on-device only | ❌ | app functionality (user-initiated) | N/A — never leaves device |
| Messages / Chat | ✅ on-device only | ❌ | app functionality | N/A |
| Audio (mic) | ✅ on-device/optional 3rd-party STT | Optional (user-chosen STT provider) | voice commands | processed then discarded |
| Photos / Screen | ✅ on-device (Accessibility) | ❌ | screen reading (user-initiated) | ephemeral |
| App activity | ✅ on-device (LEDGER) | ❌ | habits/memory features | N/A |
| Files (backup) | ✅ user-initiated export | User-initiated (user's own cloud) | backup | user-controlled |

## Data NOT collected

- No analytics SDKs · no ads · no crash reporters · no device identifiers
- No location · no financial info · no health data

## Encryption

- Settings file backup: user-controlled file (not encrypted — user's choice)
- Memory cloud backup (optional): **AES-256-GCM + PBKDF2** before upload
- API keys: stored locally only, masked in all reports

## Security practices

- Encrypted in transit (HTTPS) for all network calls
- Signing key locked (CI signature pin) — updates install in-place
- Automation safety rails (kill-switch, rate limits, banking app block)

## Account deletion

Uninstall = everything gone (no server-side copy exists). Optional cloud
backups live in the USER's own GitHub repo — delete there if desired.
