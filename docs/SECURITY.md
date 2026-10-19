# 🔒 SECURITY — MAYA signing & secrets ka nizam

> **Qanoon (CLAUDE.md):** "Never write API keys or tokens in code — GitHub Secrets only."
> Keystore ka password bhi wohi cheez hai. Ab code saaf hai.

---

## 1. Kya badla (WAQT 0 · 0.1)

| Pehle (🔴) | Ab (✅) |
|---|---|
| `app/build.gradle` mein `storePassword "maya2026adil"` likha tha | Password **`keystore.properties`** mein (gitignored) |
| `app/maya.keystore` git mein tracked tha | **Untracked** (`.gitignore` mein `*.keystore`) — file aap ke disk par hai |
| CI ko password ki zaroorat hi nahi thi (code mein tha) | CI **GitHub Secrets** se leta hai |

## 2. ⚠️ Zaroori baat: git history

Purani commits mein password **abhi bhi** maujood hai (history rewrite nahi kiya —
wo khatarnak hai aur shared repo todti hai). Is ka matlab:

- **Keystore password treat karo ke EXPOSED hai.** Jab fursat mile badal do:
  ```
  keytool -storepasswd -keystore app/maya.keystore
  ```
  (purana password `maya2026adil`, naya koi bhi mazboot)
- Agar app **Play Store** par kabhi jayegi to **NAYA keystore** banao
  (Play App Signing use karo) — purana keystore sirf sideload updates ke liye.
- Koi aur is repo ka purana code parh kar APK sign kar sakta hai — magar
  **phone par update** sirf usi signature ko qubool karta hai jo pehle installed
  tha, is liye aap ke phone ke liye khatra sirf tab hai jab aap unknown APK install karo.

## 3. Local setup (aap ke computer/CI ke bagair)

`keystore.properties` (repo root, gitignored) — yehi file banani hai:
```properties
storeFile=app/maya.keystore
storePassword=APNA_PASSWORD
keyAlias=maya
keyPassword=APNA_PASSWORD
```
Bina is file ke build **chalta rahega** (default debug signing) — sirf APK
ka signature alag hoga. Warning bhi aati hai build mein.

## 4. GitHub Secrets (CI ke liye)

Repository → Settings → Secrets and variables → Actions:

| Secret | Kya |
|---|---|
| `MAYA_KEYSTORE_BASE64` | `base64 -w0 app/maya.keystore` ka output |
| `MAYA_KEYSTORE_PASSWORD` | store password |
| `MAYA_KEY_ALIAS` | `maya` |
| `MAYA_KEY_PASSWORD` | key password |

Secrets na ho to CI **debug signing** se build karta hai — pipeline kabhi nahi toot-ti.

## 5. API keys (app ke andar)

- Gemini/Groq/Fish ki keys **app ke settings** mein user daalta hai → `localStorage`
  (phone ka private data). Wo kabhi repo mein nahi aati.
- Koi bhi naya feature jo key maange: **sirf settings field + localStorage**.
  Hard-code = qanoon ki khilaf-warzi = release band.

## 6. Reports

- Agar kabhi lage ke key/github token chat mein ya code mein chala gaya:
  **foran batao** — token revoke karo, phir history theek karenge.
