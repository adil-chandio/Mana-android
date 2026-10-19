# 🚨 "App not installed as package conflicts with an existing package"

## Masla kya hai

Phone par jo purani MAYA install hai wo **alag signing key** se bani hai
(purani/ghost key lineage — jab signature system stable nahi tha). Nayi APK
**hamesha ek hi key** (`docs/signing-cert-sha256.txt`, gate-locked) se banti
hai. Android signature match na hone par update **rokh deta hai** — ye OS
security hai, koi app isse bypass nahi kar sakti.

**Ye ek dafa ka masla hai** — key lineage switch. Uske baad hamesha smooth
(silent updates + backup + gate lock).

## Fix (2 minute)

1. **Purani MAYA kholen** → Settings → LAB → **📦 BACKUP** (agar button hai)
   — settings file save ho jayegi
2. MAYA **uninstall** karen (long-press → Uninstall)
3. **MAYA-latest.apk** install karen:
   https://github.com/adil-chandio/Mana-android/releases/download/latest/MAYA-latest.apk
4. Nayi MAYA khulegi → **onboarding wizard** → naam + keys
5. **📥 RESTORE** → purani settings wapas (step 1 ki file)

## Backup button nahi hai? (bahut purani version)

Ye settings dobara set karein (2 minute) — uske baad **📦 BACKUP** zaroor lein:

| Setting | Value |
|---|---|
| Gemini key | key 1 (Google AI Studio wali) |
| Brain | Muft neural (POLLINATIONS) LIVE |
| Fish (TTS voice) | Indian Baby Girl [hi] |
| TRUST MODE | ON |
| Wake door | 15 |
| Mic zoom | 0.8 |
| QAREEB | ON |
| Pitch / Rate | 1.05 / 1.4 |
| Radius / Font | 18 / 1 |

## Ye dobara kabhi nahi hoga

- Har build ek hi key (SIGNATURE LOCK gate — key badli to build hi RED)
- v5.13.1+ se **silent self-update** (bina install prompt ke)
- 📦 BACKUP/RESTORE — chahe kabhi bhi fresh install karo

## Note (Play Store ke liye)

Play App Signing apni key se re-sign karta hai (nayi apps ke liye lazmi) —
Play wale users ke liye bhi wahi rule: **📦 BACKUP → 📥 RESTORE**.
