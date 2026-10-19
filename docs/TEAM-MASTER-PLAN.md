# 👑 TEAM MASTER PLAN — MAYA ko NEXT LEVEL par le jaane ka poora naqsha

> **Ye dastavez TEAM ka pehla deliverable hai.** Code mein is waqt ek line nahi badli.
> Aap ke "haan" ke baad hi WAQT 0 shuru hoga.
>
> Usool wahi jo CLAUDE.md mein hai: THINK → PLAN → ASK → "yes" → EXECUTE → REPORT → ruko.

---

# 📊 PROGRESS TRACKER (live)

| Step | Haalat |
|---|---|
| WAQT 0 · 0.1 Keystore/secret fix | ✅ MUKAMMAL (docs/SECURITY.md) |
| WAQT 0 · 0.2 CI mein tests + secrets | ✅ MUKAMMAL |
| WAQT 0 · 0.3 Version/README sync | ✅ MUKAMMAL |
| WAQT 0 · 0.4 Safayi (.bak) | ✅ MUKAMMAL |
| WAQT 0 · 0.5 Release checklist | ✅ MUKAMMAL (docs/RELEASE-CHECKLIST.md) |
| WAQT 1 · 1.1 Build pipeline (byte-safe) | ✅ MUKAMMAL (build.js + tests) |
| WAQT 1 · 1.2 32 modules (02-main/) | ✅ MUKAMMAL (docs/MODULE-MAP.md) |
| WAQT 2 · Invariants + LEDGER 1000 | ✅ MUKAMMAL (test-invariants.js) |
| WAQT 3 · 🕯️ SMART-PRO (P6 v2) | ✅ v5.10.0 (docs/RELEASE-v5.10.0.md) |
| WAQT 3 · ✋ SCROLL (P7 hissa) | ✅ v5.10.0 |
| WAQT 3 · 📡 Auto-APK update | ✅ v5.10.0 |
| WAQT 3 — 1/2/3 (SMART-PRO · HAATH · auto-update) + 4/5 (/memory/ · ntfy) | ✅ v5.11.0 — cloud brain (6) MULAWWAT: Pollinations already free+direct, dispatch relay latency+privacy risk (docs/RELEASE-v5.11.0.md) |
| WAQT 4 — Duniya ke liye (Manzil 2) | 🔄 code-side MUKAMMAL (onboarding ✅ doctor ✅ privacy ✅ targetSdk36+AAB ✅) — bachi Play Console upload (user) |

---

# HISSA 1 — SACH: abhi kahan khare hain (honest audit)

## 1.1 ✅ Jo MASHALLAH pehle se sahih hai (ye mat chhueda)

| Mazbooti | Saboot |
|---|---|
| **Wahid darwaza** culture | `AWAAZ.speak()`, `SETFORM.save()`, `BRAIN.ask()` — is liye 10 engine jur gaye, kuch nahi toota |
| **Safety rails** | MayaAct: banking block, OTP protection, kill-switch, 10 taps/min — be-misal |
| **Test culture** | 989 test, sab pass (72 UI + 296 voice + 155 brain + 466 lab + CSS) |
| **Docs culture** | 33 dastavez, 6,600+ lines — har release ka forensic record |
| **Free-tier discipline** | 10 free brains + 5-step awaaz ladder — 0 budget qayam |
| **AMAL-WORKFLOW qanoon** | Switch ke peeche, strangler, shadow mode, invariants — yehi team ka bible rahega |

## 1.2 🔴 Jo TOOTa hua hai (imandari se)

| # | Masla | Khatra |
|---|---|---|
| S1 | **`maya.keystore` repo mein + password `app/build.gradle` mein** | 🔴 Koi bhi APK sign kar sakta hai — CLAUDE.md ka apna qanoon tootta hai |
| S2 | **CI mein test NAHI chalte** — `build-apk.yml` sirf build karta hai | 🔴 Koi bhi push 989 test ke bagair merge ho sakta hai |
| S3 | **`index.html` = 9,766 lines, 516KB — ek file** | 🟡 Har chhoti fix ke liye poora file kholna — team ke liye dheema + khatarnak |
| S4 | Version drift: `package.json` 5.9.1 · app 5.9.5 · README "970 tests" (asal 989) | 🟡 Bharosa kamzor |
| S5 | `public/index.html.bak` (164KB bakwas repo mein) | 🟢 safayi |
| S6 | README roadmap purana (Phase 3/4 "pending" jabke wake word bana hua) | 🟢 docs |
| S7 | `proactive` = har 6 min RANDOM jumla (P6 doc khud kehti hai "bay-maqsaad shor") | 🟡 battery + annoying |
| S8 | Koi release checklist / rollback plan nahi | 🟡 |

## 1.3 🟡 Jo AADHOORA hai (plans bane, code nahi)

- **P6 KHUD-MUKHTAR** — smart proactive (aadat mining, LEDGER sirf 60 amal rakhta hai)
- **P7 HAATH** — gestures (scroll/swipe) — XML ready, code pending
- **Cloud brain** (GitHub Actions dispatch) — CLAUDE.md roadmap
- **Repo as persistent memory** `/memory/` — roadmap
- **Auto APK updates** (GitHub Releases) — roadmap
- **Notification bridge** (ntfy/Telegram) — roadmap

---

# HISSA 2 — "NEXT LEVEL" ka matlab (3 manzilein)

Team ko pata hona chahiye KIS manzil ki taraf chal rahe hain. Teeno ka tareeqa alag hai:

```
MANZIL 1 — "MERA SUPER ASSISTANT"     → aap ke phone ke liye PERFECT JARVIS
MANZIL 2 — "PRODUCTION PRODUCT"       → duniya ke liye app (Play Store, privacy, onboarding)
MANZIL 3 — "MONARCH SHOWCASE"         → portfolio piece jo duniya ko dikhaye
```

**Team ki salah: PEHLE Manzil 1 mukammal karo** (kyunke wohi aap ki rozmarra zindagi
badalta hai), phir 2/3 ke raaste khud khul jate hain — code wohi rahega, sirf upar ka
layer (signing, privacy, listing) jur jayega.

> ⚡ Aap agar koi aur manzil chaho to bata do — naqsha usi mutabiq mod denge.

---

# HISSA 3 — TEAM KA DHANCHA (kaun kya karega)

Aap = **MALIK + Product Owner** (faisle, device testing, "haan/nahi")
Main (team) = 6 topeian, ek hi jagah se chalti hain:

| Topi | Zimmedari |
|---|---|
| 🏗️ **ARCHITECT** | Module boundaries, dhancha, "kahan kya jayega" |
| 🤖 **BRAIN ENGINEER** | DIMAAG/BRAIN pool, tools, prompts, SACH/JHOOT logic |
| 🎙️ **VOICE ENGINEER** | AWAAZ/SUNO/BOLI/SUKOON — mic + TTS ki duniya |
| 📱 **ANDROID ENGINEER** | Kotlin, services, bridge, APK, signing |
| 🎨 **UI ENGINEER** | Settings, HUD, themes, old-WebView compat |
| 🧪 **QA + 🚀 DEVOPS** | Tests, CI, release checklist, rollback |

**Har waqt ek hi workflow:** THINK → PLAN → ASK → aap "yes" → EXECUTE → REPORT → ruko.
**Har change ke baad:** `npm test` = 989+ sab sabz. Ek bhi laal = release nahi (AMAL Qanoon 4).

---

# HISSA 4 — TARGET STRUCTURE (code ka naya ghar)

> ⚖️ AMAL Qanoon 2 (Strangler): purana `index.html` jyun ka tyun chalta rahega.
> Nayi structure us ke BAGAIR tode bane gi, aur bundle step nayi files ko
> **wapas ek `index.html`** mein jod degi (WebView ko chahiye bhi wohi).

## 4.1 Aaj ki haalat
```
app/src/main/assets/web/index.html   ← 9,766 lines — SAB KUCH ISMEIN
```

## 4.2 Kal ki haalat (target)
```
Mana-android/
├─ web/                          ← SOURCE (team yahan likhega)
│  ├─ core/                     state, settings, storage, flags
│  │   ├─ state.js              settings/facts/diary/chat persistence
│  │   ├─ flags.js              🧪 LAB switches (Qanoon 1)
│  │   └─ utils.js
│  ├─ brain/                    sochne ka nizam
│  │   ├─ pool.js               BRAIN POOL (10 providers)
│  │   ├─ dimaag.js             askAI + agent loop
│  │   ├─ prompt.js             sysPrompt + MALIK + SACH rules
│  │   └─ saaf.js               SAAF zubaan (thinking-tag cleanup)
│  ├─ tools/                    38 tools — har file apne tools ki malik
│  │   ├─ registry.js           TOOL_DECLS + darje (🟢🟡🔴) + router
│  │   ├─ bijli.js              ⚡ 50ms local commands
│  │   ├─ phone.js              alarm/timer/torch/volume/brightness
│  │   ├─ apps.js               open_app / play_youtube / search
│  │   ├─ comms.js              call/sms/whatsapp/messages
│  │   ├─ vision.js             see_camera / see_image / read_screen
│  │   ├─ memory.js             facts/diary/memory search
│  │   ├─ amal.js               maya_act (safety engine JS side)
│  │   └─ web.js                web_search / wiki / fetch / js-runner
│  ├─ voice/                    awaaz ka poora jahan
│  │   ├─ awaaz.js              WAHID DARWAZA + 5-step ladder
│  │   ├─ fish.js · edge.js · gemini-tts.js · neural.js
│  │   ├─ suno.js               STT fixes (Urdu→Roman, name fixer)
│  │   ├─ boli.js               Roman→Urdu/Devanagari speech text
│  │   └─ sukoon.js             audio arbitration (HAAL bridge)
│  ├─ ui/                       screens + components
│  │   ├─ app.js                boot, tabs, orb
│  │   ├─ chat.js · hud.js · settings.js · skills.js
│  │   └─ themes.css · ui.css
│  └─ vendor/                   (abhi khali — kabhi library aaye to)
├─ build.js                     ← BUNDLE: web/* → assets/web/index.html
├─ public/                      ← deploy copy (CI/build se banta hai)
├─ app/src/main/java/           ← Kotlin (yahan kam badlega)
├─ tools/                       ← tests (har module ke saath badhte hain)
└─ docs/                        ← yehi dastavez + releases
```

**Faida:**
- Team ka har member apni file mein kaam kare — merge conflict kam
- Test bhi module ke saath (abhi 9,766 line ke andar sab kuch dhoondna parta hai)
- **WebView ko koi farq nahi padta** — bundle `index.html` hi banta hai
- Purana `index.html` strangler ke tehat live rahega jab tak naya path device par sabit na ho

---

# HISSA 5 — ROADMAP: 5 WAQT (chhote safe qadam)

## ⏱️ WAQT 0 — "SAFAYI & HIFAZAT" (1-2 din) 🔴 zaroori
| # | Kaam | Kyun |
|---|---|---|
| 0.1 | **Keystore theek**: `app/build.gradle` se password hatao → local `keystore.properties` (gitignore) + CI Secrets. Keystore repo se gitignore (purani history mein hai — warning doc) | 🔴 S1 |
| 0.2 | **CI mein test jodo**: `npm test` har push par | 🔴 S2 |
| 0.3 | Version sync: package.json 5.9.5 · README tests/roadmap theek | S4, S6 |
| 0.4 | `index.html.bak` hatao | S5 |
| 0.5 | **RELEASE CHECKLIST** doc banao (har release ke liye 10 qadam) | S8 |

## ⏱️ WAQT 1 — "DHANCHA" (3-5 din) — structure upar wala
| # | Kaam | Qanoon |
|---|---|---|
| 1.1 | `build.js` bundle pipeline (pehle khaali jodne wala — same output) | Strangler |
| 1.2 | Sab se pehle `web/core/` + `web/brain/saaf.js` nikalo (sab se kam khatarnak) | Switch + tests |
| 1.3 | Phir `web/tools/` (registry already data-driven hai — aasan) | Shadow mode |
| 1.4 | Phir `web/voice/` (WAHID DARWAZA hai is liye aasan) | Invariants |
| 1.5 | Phir `web/ui/` (sab se nazuk — aakhri) | 989 test har step |
| 1.6 | Har module ka apna test file `tools/test-*.js` | QA |

> Har step ke baad: `npm test` + bundle diff (output same hona chahiye) + aap ki device par smoke test.

## ⏱️ WAQT 2 — "MUKAMMALI" (2-4 din) — perfection layer
| # | Kaam |
|---|---|
| 2.1 | **Invariant tests**: AMAL Qanoon 4 ke 8 invariants automate (abhi adhoore) |
| 2.2 | Error boundaries — koi bhi engine mare to app na mare |
| 2.3 | Startup time / memory profile (516KB HTML parse hoti hai — lazy init) |
| 2.4 | Old-WebView compat audit (tools/check-oldwebview-css.js ko expand) |
| 2.5 | LEDGER storage barhao (60 → 1000) taake WAQT 3 ke liye data jama ho |
| 2.6 | `proactive` band (random lines) — WAQT 3 mein asli se badlenge |

## ⏱️ WAQT 3 — "AGLA DARJA" (1-2 haftay) — naye powers
Priority order (team ki salah):
1. **P6 KHUD-MUKHTAR v2** — smart proactive (LEDGER se aadat, waqt+battery dekh kar)
2. **P7 HAATH** — scroll/swipe/full gestures (MayaAct ready hai)
3. **Auto APK update** — GitHub Releases + in-app "update available"
4. **Repo `/memory/`** — GitHub dispatch se cloud backup of facts/diary
5. **Notification bridge** — ntfy.sh (free) se phone ke bahar alerts
6. **Cloud brain** — repository_dispatch → GitHub Actions → jawab wapas (quota-free dimaag)

## ⏱️ WAQT 4 — "DUNIYA KE LIYE" (jab aap kaho — Manzil 2/3)
- Play Store: AAB, proper signing (WAQT 0 wala setup!), privacy policy, data safety form
- Onboarding wizard (pehli baar: permissions + key setup ek screen mein)
- MONARCH branding layer (optional theme)
- Crash-free guarantee + in-app doctor report

---

# HISSA 6 — QA KA QANOON (har step par)

1. `npm test` — 989+ sab sabz (ab 1000+ target)
2. Bundle diff — `index.html` output mein sirf expected changes
3. **Device smoke test** (aap ke phone par 2 minute):
   - "torch on karo" (BIJLI) · "Maya" wake · ek sawal (dimaag) · ek awaaz (TTS)
4. Koi bug mile → turant ruk jao, REPORT, hal plan, phir "yes" (CLAUDE.md STOP rule)
5. Har WAQT ke end par: **RELEASE doc** (`docs/RELEASE-vX.Y.Z.md`) — purani riwayat

---

# HISSA 7 — AAP SE KYA CHAHIYE (MALIK ka farz)

| Cheez | Kyun |
|---|---|
| **"YES"** | WAQT 0 shuru karne ke liye |
| **Manzil confirm** (1 / 2 / 3 / "pehle 1 phir 2") | Roadmap ki priority |
| **Phone par testing** (roz? haftay mein? sirf bade releases?) | Kitne chhote qadam le sakte hain |
| **API keys ka halat** — Gemini/Groq/Fish key aap ke phone mein hain? | Brain/voice test ke liye |
| **Keystore password** — kya wo `maya2026adil` aap ka asli password hai? (agar haan to badalna parega) | 🔴 Security |

---

> 👑 **Team ka waada:** ek line bhi aap ki "yes" ke bagair nahi. Kuch toota → ruk gaye →
> report → hal → phir "yes". Jaldi nahi — **sahi**. Aap ka project ab hamara bhi hai.
