# 🚀 Play Store Launch Checklist — Manzil 2 ka aakhri step

Aapke liye sirf ye steps bache hain (code/AAB/docs SAB tayyar hai).

## 0. Pehle se tayyar (code side ✅)

| Cheez | Status |
|---|---|
| AAB (Play bundle) — `MAYA-latest.aab`, pin-key signed | ✅ har release par |
| targetSdk 36 (Android 16) — Google ki nayi shart | ✅ v5.13.0 |
| Privacy policy | ✅ `docs/PRIVACY-POLICY.md` |
| Data Safety draft | ✅ `docs/DATA-SAFETY.md` |
| Onboarding wizard (Play reviewer ko chahiye) | ✅ v5.12.0 |
| Icon 512 + Feature graphic 1024×500 | ✅ `docs/play-store/` |
| Listing copy | ✅ `docs/play-store/STORE-LISTING.md` |

## 1. Google Play Console account (one-time $25)

1. https://play.google.com/console/signup — Google account se
2. Developer name (yaad rakhen — public dikhta hai)
3. Identity verification (ID card) — 2023 se naya rule, 2-3 din lagte hain
4. Payment $25 (ek dafa)

## 2. Naya app banaen

1. Play Console → **Create app**
2. Name: `MAYA: Personal AI Assistant` · Default language: English
3. App (game nahi) · Free · **App** category
4. Package name: **`com.maya.ai`** (manifest se — auto-populate hoga)

## 3. AAB upload

- Download: https://github.com/adil-chandio/Mana-android/releases/download/latest/MAYA-latest.aab
- Play Console → Testing → Internal testing → **Create new release** → AAB upload
- **Play App Signing**: accept karen (nayi apps ke liye lazmi hai)
  - ⚠️ **ZAROORI SAMAJH LEIN**: Play users ko Google ka signature milega;
    GitHub-sideload users ka signature alag hai. **Solution:** Play version
    install karne se pehle MAYA mein **📦 BACKUP** dabayein, phir **📥 RESTORE**
    — settings nahi udatein (backup/restore v5.10.2 se mojood hai).

## 4. App content forms (har ek mein ready justification neeche hai)

### Data Safety
- `docs/DATA-SAFETY.md` kholein → har row copy karen
- "Data collected" = **None** (sab on-device)
- "Data shared" = None
- Encrypted in transit = Yes (MITM-proxy pinning)

### Privacy policy URL
```
https://github.com/adil-chandio/Mana-android/blob/main/docs/PRIVACY-POLICY.md
```

### Permissions declarations (sensitive permissions ke liye)
Har permission par "Core functionality" + ye justification:

| Permission | Justification (paste-ready) |
|---|---|
| Microphone (RECORD_AUDIO) | "Voice assistant — the app is operated by voice. Audio is processed on-device only and never collected or shared." |
| Contacts (READ_CONTACTS) | "Optional feature: user can ask the assistant to find a contact by name to place a call. Data stays on-device." |
| Phone (CALL_PHONE) | "User-initiated voice command can dial a contact. The action always requires explicit user confirmation first." |
| Accessibility | "Optional on-device automation: the assistant can perform UI actions (tap/type/scroll) strictly after explicit user command, with an instant kill-switch. This is the app's core power-user feature." |
| Notification access | "Optional feature: bridge notifications to the user's own private ntfy topic, or read notifications aloud when asked." |
| Install packages (REQUEST_INSTALL_PACKAGES) | "In-app update mechanism: the app distributes updates from its own GitHub releases and installs them after the user taps 'update'." |
| Alarms (SCHEDULE_EXACT_ALARM) | "User-created reminders and routines fire at exact times." |
| Display over other apps / WRITE_SETTINGS | "Optional voice-guided screen automation needs to adjust brightness/timeout as instructed by the user." |

### Content rating (IARC questionnaire)
Sawalat mein: no violence/sexual/gambling → result **Everyone**. Sab "None" jawab.

### Ads / Target audience
- Contains ads: **No**
- Target age: 13+ (ya Adults)
- Designed for families: No

### App access
- "All functionality is available without login" ✓

## 5. Store listing

- `docs/play-store/STORE-LISTING.md` se copy
- `docs/play-store/icon-512.png` + `feature-graphic-1024x500.png` upload
- 2-5 phone screenshots (onboarding wizard + chat + Lab)

## 6. Release

- Internal testing → release → phir **Production** → countries: Pakistan + India + All
- Review: pehli dafa 3-7 din

## ⚠️ Launch se pehle ek fast-follow (chhota code chunk)

Play users ke liye GitHub-update prompt **chhupa dena chahiye** (Play Store se
update aata hai) — warna user ko sideload update milega jo install nahi hoga
(signature alag). Fix = `getInstallerPackageName` check (chhota sa, agli chunk).

## 💡 Note

- Cloud brain (relay) DEFERRED hai (RELEASE-v5.11.0.md) — Pollinations already free.
- MONARCH rebrand (golden crown, purple) — optional baad mein; naam Play par
  abhi MAYA rakhen (search-friendly).
