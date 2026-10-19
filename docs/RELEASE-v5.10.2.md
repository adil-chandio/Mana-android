# MAYA v5.10.2 — UPDATE-SAFE APK (settings kabhi na udein)

**Date:** 2026-10-19
**User problem:** "har naye APK par settings dobara karni parti hain" — because every
CI build signed with a FRESH random debug keystore (ephemeral runner) → Android
signature mismatch → forced UNINSTALL → all settings/keys wiped.

## 🔴 Root cause → permanent fix

| Layer | Fix |
|---|---|
| **CI signature** | `actions/cache` pins `~/.android/debug.keystore` (key `maya-debug-keystore-v1`) in **both** workflows (build-apk.yml + release-apk.yml). Every future APK shares ONE signature → installs as a true **UPDATE** (SharedPreferences + keys survive). |
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
