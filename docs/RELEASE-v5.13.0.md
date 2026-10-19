# MAYA v5.13.0 — WAQT 4-B: PLAY STORE READY (targetSdk 36 + AAB pipeline)

**Date:** 2026-10-19
**Chunk:** Play Store submission ka poora code-side — user ko sirf account + upload bacha hai

## 🎯 Kyun zaroori tha

Google Play **Aug 31, 2026** se nayi apps ko **targetSdk 36 (Android 16)**
maangta hai — 34 ke saath submission seedha reject.

## 📦 Changes

- **targetSdk/compileSdk 34 → 36** (Play requirement) · `suppressUnsupportedCompileSdk`
- **Edge-to-edge safety** (targetSdk 35+ par content system bars ke neeche chala
  jata tha): WebView insets padding — status bar, nav bar **aur keyboard (IME)**
  ke liye — chat box kabhi keyboard ke neeche nahi
- **Predictive-back opt-out** (`enableOnBackInvokedCallback="false"`) — back
  button bilkul waisa hi jaisa tha (WebView goBack)
- **Release buildType ab BHI sign hota hai** (secrets na hon to same stable pin
  key) — unsigned AAB Play reject karta hai
- **AAB pipeline** (dono workflows): `bundleRelease` + AAB ka signature BHI pin
  se check (APK+AAB ka certificate ek hona lazmi) + `MAYA-latest.aab` release par
- **lintVital off** — release bundle kabhi lint ke peeche na ruke
- Play listing kit: `docs/play-store/` (listing copy, icon 512, feature 1024×500,
  launch checklist with paste-ready permission justifications)
- BootReceiver note: Android 15+ mic-FGS boot autostart restricted — try/catch
  se safe (wake word app kholne par wapas); Fast-follow: Play users ke liye
  GitHub-update prompt hide (installer-package check)

## Version

- versionName `5.13.0` · versionCode **80**
- Tests: **1078/1078** green
- Downloads: `MAYA-latest.apk` (phone) + **`MAYA-latest.aab`** (Play Console)

## ⚠️ Signature domains (documented, backup/restore se solved)

Play App Signing nayi apps ke liye lazmi → Play users Google-signed install
karenge; GitHub sideload pin-signed. Switch karne se pehle 📦 BACKUP → 📥 RESTORE
— settings safe (v5.10.2 feature).
