# MAYA v5.10.1 — Video Review Fixes

**Date:** 2026-10-19
**Basis:** User screen recording (2:43 min, 18 frames reviewed) of v5.10.0 in daily use.

## 🔴 Found in recording → fixed

| # | Finding (frame) | Fix |
|---|---|---|
| 1 | **Wake word: `suna 10 · JAAGI 0`** — recognizer ran on `hi-IN` while Settings showed `ur-PK` (stale `wake_lang` pref) + errStreak noise (err 7 NO_MATCH × 41) | `saveSettings()` now syncs `wake_lang` on EVERY settings save (not just wake toggle). Kotlin WakeWordService: language fallback chain (`settings zubaan → hi-IN → en-IN`) on ERROR 11/12 (LANGUAGE_NOT_SUPPORTED), auto-reset when text arrives. KAAN DOCTOR now shows "Wake zubaan" so the active language is visible. |
| 2 | Wake matcher too strict on leading fillers | `KAAN.FILLER` expanded (ji/haan/ok/okay/namaste/arre/suniye… — max 1 filler word before wake; safety "Maya ke bagair kuch nahi" unchanged) |
| 3 | **NAZAR: "Screen nahi parh saki — AutoSend accessibility service band hai"** with no easy recovery (user was lost in Android settings) | Error text now includes exact Settings path; LAB test button auto-offers `openSetting("accessibility")` (new Kotlin branch → `ACTION_ACCESSIBILITY_SETTINGS`) |
| 4 | **UI CHECK header stale "v5.9.5"** (app is 5.10.x) | Header now reads version dynamically (`UPDATE_CHECK.VER`) |
| 5 | **⚠ badge showed ⚠1** from benign WebView noise ("Ignored attempt to cancel a touchstart event with cancelable=false") | `__consoleErr` filters Chrome's cancelable=false noise — badge = real errors only |
| 6 | **Top-right overlap**: `#wakeDot` ("MAYA SUN RAHI") covered the "APK • QUOTA!" status pill | `#wakeDot` moved below the header (top 26px → 58px) |
| 7 | NAAP status "0 turn naape ja chuke" vs BASELINE "aakhri 2 turn" (session vs disk — confusing) | Label clarified: "turn (is session mein naape)" |

## ✅ Confirmed working in the recording (no action)

- v5.10.0 installed & running, greeting + Fish "Indian Baby Girl [hi]" voice (`fish × 2` turns)
- APP UPDATE CHECK: "Aap ke paas sab se naya version hai (5.10.0)" ✓
- UI CHECK: 247 visible / 0 invisible; sliders (pitch 1.05, rate 1.4, radius 18, font 1) all real
- NAAP baseline: dimaag 2.9s (Groq) + awaaz 2.9s (fish) = kul 7.9s, nakaam 0
- AWAAZ DOCTOR key check (masked `…gomIFg`), settings toggles, TRUST MODE user-enabled

## 📋 User actions (device)

1. **Accessibility ON (one-time):** Settings → Accessibility → MAYA AutoSend → ON (if already ON, OFF→ON once to refresh)
2. **Controlled wake test:** screen off/on home, quiet room, say "Maya" clearly once → open 🩺 KAAN DOCTOR → "WAKE WORD KA HAAL" and check `suna / JAAGI` + "Wake zubaan"

## Version

- versionName `5.10.1` · versionCode **76**
- Tests: **1018/1018 green** (build-sync 13 · invariants 16 · css · settings 72 · voice 296 · brain 155 · lab 466)
