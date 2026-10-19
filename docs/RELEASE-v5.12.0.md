# MAYA v5.12.0 — WAQT 4-A: ONBOARDING + MEGA DOCTOR + PRIVACY DOCS

**Date:** 2026-10-19
**Chunk:** WAQT 4 (Manzil 2) ka wo hissa jo bina Play account ke banta hai

## 🌅 Onboarding wizard (`34-onboard.js`)

- **Pehli dafa** app khule to 5-step wizard: naam → ijazaat (mic/notif/battery/
  accessibility — asle buttons) → optional keys → awaaz → tayyar
- Sirf APK + `onboarded=false` par — tests/jsdom kabhi block nahi
- Har step **skip-able**; LAB → "🌅 ONBOARDING DOBARA" se kabhi phir
- Naya bridge: `micPerm()` + `requestMicPerm()`

## 🩺 MEGA DOCTOR

- Ek report mein SAB: versions (web+native+WebView) · **masked** keys ·
  awaaz/dimaag status · services (mic/notif/battery/a11y/wake) · NTFY/cloud ·
  UI selfTest · console errors · kul misra
- Masle par yehi report copy kar ke bhejein — keys masked, safe hai
- LAB → "🩺 MEGA DOCTOR"

## 📜 Privacy docs (Play Store prep)

- `docs/PRIVACY-POLICY.md` — user-friendly policy (kya kahan, kya kabhi nahi)
- `docs/DATA-SAFETY.md` — Play Console Data Safety form ka ready draft

## 🛠️ Session note (git rewind recovery)

Ek snapshot-restore ne local git HEAD rewind kar diya tha (documented
failure mode) — origin par saara history safe tha; `git reset --mixed
origin/...` se recovery + `npm install` (css-tree) se tests wapas.

## Version

- versionName `5.12.0` · versionCode **79**
- Tests: **1078/1078** (build-sync 13 · invariants 27 · css · settings 72 · voice 296 · brain 155 · cloud 29 · **onboard 20** · lab 466)
