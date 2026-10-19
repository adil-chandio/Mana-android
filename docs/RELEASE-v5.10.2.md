# MAYA v5.10.2 — UPDATE-SAFE APK (settings kabhi na udein)

**Date:** 2026-10-19
**User problem:** "har naye APK par settings dobara karni parti hain" — because every
CI build signed with a FRESH random debug keystore (ephemeral runner) → Android
signature mismatch → forced UNINSTALL → all settings/keys wiped.

## 🔴 Root cause → permanent fix

| Layer | Fix |
|---|---|
| **CI signature** | `actions/cache` pins `~/.android/debug.keystore` (key `maya-debug-keystore-v2`) in **both** workflows (build-apk.yml + release-apk.yml). Every future APK shares ONE signature → installs as a true **UPDATE** (SharedPreferences + keys survive). |
| **Safety net** | LAB → **📦 SETTINGS BACKUP** (saari localStorage → `Download/maya-settings-YYYY-MM-DD.json`) + **📥 SETTINGS RESTORE** (newest backup file se sab wapas + auto-reload). New Kotlin: `saveTextToDownloads()` (MediaStore Downloads) + `readText(uri)`. |
| **User trust** | Update card + notification ab kehte hain: "Settings safe rahengi — update hai, uninstall nahi." |

## ⚠️ One-time note (v5.10.1 → v5.10.2)

v5.10.1 ki signing key ek ephemeral CI runner par gayab ho chuki thi — usko wapas
nahi laya ja sakta. **Is liye YE AAKHRI dafa uninstall+install karna padega.**
Uske baad: v5.10.2, 5.10.3, … sab seedha UPDATE — kabhi uninstall nahi, kabhi
settings loss nahi.

## Version

- versionName `5.10.2` · versionCode **77**
- Tests: **1022/1022 green** (build-sync 13 · invariants 20 · css · settings 72 · voice 296 · brain 155 · lab 466)
- Invariants nayi locks: CI keystore cache (dono workflows) + backup/restore zinda

## 🔒 SIGNATURE LOCK (baad mein add hua — do layer aur)

1. **Keystore ensure**: workflow khud `~/.android/debug.keystore` banata/cache se laata hai (AGP ke bharose nahi)
2. **Ground truth gate**: `apksigner verify --print-certs` se APK ke ASLI certificate ka SHA-256 pin (`docs/signing-cert-sha256.txt`) se match hota hai — mismatch/empty = build RED = APK "latest" par NAHI jayega
3. **Pin**: `6027458df57a00db54a8e29f8bc635c36813310782f8a4aa94a07de269ba0b07` (cache `maya-debug-keystore-v2`)

Result: signature kabhi khamoshi se nahi badalta; badalna ho to ek line ka jaan-boojh commit + user ko agle update par EK dafa batana.

## ✅ FINAL STATE (2026-10-19 16:53 UTC)

- PIN `6027458df57a…9ba0b07` — CI ne khud auto-pin kiya (bootstrap commit `81e7bd3`)
- Cache `maya-debug-keystore-v2` se key restore → pin match → "signature stable" (verification run 39288993952 GREEN)
- 2 lagatar green runs — system apne aap converge karta hai; key badli to build RED (kabhi surprise reinstall nahi)
