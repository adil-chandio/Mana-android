# 🛡️ FIX v5.11.0 — "WAKE MAZBOOT" (Phase 1: robustness)

> **Forensic ka Phase 1.** Phase 0 (v5.10.3) ne wake ko **ZINDA** kiya; Phase 1 usay
> **MAZBOOT** karta hai — shor, race, mic-errors, murda HAAL aur Activity ki maut ke
> khilaf. Naya feature koi nahi; har badlaav forensic ke ek flaw ka ilaj hai.
>
> **Version:** 5.11.0 · **versionCode:** 75 · **Tests:** 1193 → **1234/1234** (+41 locks, Section 32)
> **Plan:** `docs/FORENSIC-WAKE-WORD.md` §7 PHASE 1 + §15 Phase 1 (1.1–1.12)
> **Ek parcha (aam zubaan):** [`REPORT-v5.11.0-aam-zubaan.md`](REPORT-v5.11.0-aam-zubaan.md)

---

## 1. Maqsad (ek line mein)

Wake **chalti** to hai (Phase 0), magar in halat mein **chup-chaap band** ho jati thi:
murda HAAL (F02), ghalat farsh (F15/F42), mic read-error par CPU spin (F16), gate band
hone ki race (F17), Activity marne par recognizer ka badal jana (F13), lambi session ka
disconnect (F14), adhoora error-hisab (F19), foreground service ka jhoot (F29), mic
ijazat ke baghair hammer (F35), aur app wapsi par dono taraf ka HAAL alag (F41).

## 2. Bara badlaav — `WakeState.kt` (naya file)

Halat ka **EK ghar**. Pehle wake ki halat char jagah bikhri thi (`haal`, `pausedByApp`,
`lastBolAt`, aur JS ki apni `SUKOON.haal`) aur **kisi ki koi mudat nahi thi**: JS ka ek
`KHALI` call kho jaye (WebView reload, screen off, JS exception) to Kotlin mein `APP_SUN`
ya `BOL_RAHI` **hamesha ke liye** phans jata → wake par daimi pabandi, aur panel
"HAAL: KHALI" likh kar jhoot bolta.

| Cheez | Ab |
|---|---|
| `haal` + `owner` + `since` | har halat ka **maalik** aur **umar** |
| `PAUSE_EXP_MS` 8s | sulah ki mudat (magar **andhi azad nahi** — `appMicBusy()` guard) |
| `APP_SUN_EXP_MS` 30s | app ka mic 30s se zyada nahi maana jata |
| `BOL_EXP_MS` 20s | bolna 20s se zyada nahi maana jata |
| `HB_MS` 10s × `HB_MISS` 3 | JS ke 3 heartbeat gayab = JS murda → **khud KHALI** |
| `selfFixes` + `lastFixWhy` | khud-sudhaar **chup-chaap nahi** — panel par ginti + wajah |
| `errStreak` / `errTotal` | "is session" aur "KUL" nakami alag (F19) |

`WakeWordService.haal` / `pausedByApp` / `pausedAt` / `lastBolAt` ab isi ke **paiche**
(delegate) hain — purane naam barqarar, is liye poora code, panel aur purane tests
bina toote naye ghar se jude hain.

## 3. Badlaav ka hisab (forensic ke 1.1–1.12)

| # | Flaw | Kya kiya | File |
|---|---|---|---|
| 1.1 | F02 | `WakeState` — halat ka ek ghar + mudat; `haalBlock()` **pehle** expiry dekhta hai, phir pabandi | `WakeState.kt`, `WakeWordService.kt` |
| 1.2 | F02/F06 | HAAL **level-triggered**: JS `sunEnd`/`bolEnd` par FORCE-send (dedup bypass), boot par `SUKOON.resync()`, har 10s heartbeat → naye bridge `wakeBeat`/`wakeResync` | `index.html`, `MainActivity.kt` |
| 1.3 | F15 | Gate: **800ms calibration** (kam az kam 3 saaf frame), farsh **dono taraf** adapt (neeche 0.10, upar 0.005), clamp **20..50dB**, chokhat par **absolute cap 72dB** | `WakeWordService.kt` |
| 1.4 | F16 | Gate loop: `n<0` par **5-strike → mic tazaa**; `n==0` par **8ms sleep** (100% CPU spin khatam); pehre ki **90s umar** | `WakeWordService.kt` |
| 1.5 | F17 | `stopGate()`: `join(250)` + effects release; exit path ab **WAJAH** dekhta hai (`voice` → recognizer, `stop` → kuch nahi, `life`/`blocked`/`read` → `restart(200)`) | `WakeWordService.kt` |
| 1.6 | F13 | Wake ka **apna** `makeWakeRecognizer()` (service context): yaad kiya hua → on-device (API 33+) → fehrist ka pehla qabil → default. Jo **chala** usay prefs mein yaad; 4 lagatar nakami par bhool jao (self-healing). `wakeRecognizerKind` alag | `WakeWordService.kt` |
| 1.7 | F14 | Wake intent mein session shaping: `COMPLETE_SILENCE_LENGTH=700ms`, `MINIMUM_LENGTH=300ms` (MAX_RESULTS=6, PARTIAL=false pehle se the) | `WakeWordService.kt` |
| 1.8 | F19 | `errStreak` ab har **kamyab session** (`onReadyForSpeech`/`onResults`) par saaf; `errTotal` KUL ginti; panel "IS SESSION" aur "KUL" alag | `WakeWordService.kt`, `index.html` |
| 1.9 | F29/F35 | `startAsForeground()` ka catch ab **bolta hai**: `record("fgs",…)` + `alive=false` + notification "wake beemar". Mic ijazat na ho to **loop shuru hi nahi**; ijazat milte hi watchdog/kick khud shuru | `WakeWordService.kt` |
| 1.10 | F35 | `onError(9)` → circuit + notification par **"Ijazat do"** button → `MainActivity.handleOpenRequest()` → app-info screen | `WakeWordService.kt`, `MainActivity.kt` |
| 1.11 | F42 | Calibration window ke dauran **na trigger na farsh latch**; `read()==0/negative` frame farsh ko chhoota hi nahi; adhoora calibration **report** hota hai | `WakeWordService.kt` |
| 1.12 | F41 | `MainActivity.onResume/onPause` (pehle **the hi nahi**): resume par WebView wapas + `handleOpenRequest` + JS `SUKOON.resync()` + `__wakeHealth()`; pause par WebView background — **`pauseTimers()` nahi** (warna heartbeat/reports mar jate). Naya `listening` flag: sehat ka darwaza mic par hamla nahi karta jab recognizer chal raha ho | `MainActivity.kt`, `index.html` |

**Panel (KAAN) ki nayi lines:** `🧭 WAKE STATE` (owner · umar · heartbeat · JS beats),
`🎧 PEHRA` (gate · mic sun raha · farsh · chokhat · calibration · pehre ki ginti),
`🔧 khud-sudhaar N dafa (aakhri wajah)`, `⛔ wake RUKI (ijazat)`, `⚠️ foreground service
nahi bani`, aur `wake ka recognizer` / `app ka recognizer` **alag alag**.

## 4. ⚖️ Imaandari — jo plan se **alag** kiya, aur kyun

1. **Forensic ka "har recognizer candidate par ek chhoti test session" wala idea JAAN
   BOOJH kar nahi kiya.** Do recognizer ek sath mic par = wahi `error 8` / mic jang jo
   Phase 0 mein mari thi. Is ke bajaye saboot **asal session** se aata hai: pehla
   `onReadyForSpeech` = candidate qabil → prefs mein yaad. Nateeja wahi (jo chale wahi
   yaad), khatra kam.
2. **Sulah (`pausedByApp`) ki 8s mudat ANDHI nahi.** Plan mein 8s expiry thi; maine usay
   `appMicBusy()` guard ke sath lagaya (F05 ka sabaq: andha release = mic jang). Warna
   lambi SUNO session (10-20s) ke beech wake ka pehra mic par hamla kar deta.
3. **`pauseTimers()` istemal nahi kiya** (F41 mein "WebView ko explicit background" ke
   liye): wo **global** JS timers band karta hai — heartbeat aur wake reports dono mar
   jate. Sirf `webView.onPause()` (safe background) istemal hua.
4. **Boot toast ka sach:** v5.10.3 ka toast `MainActivity.onCreate` mein tha (Kotlin),
   JS mein nahi. v5.11.0 mein **JS side ka** toast bhi add hua — kyunki APK aur
   web-asset ka version alag ho sakta hai; ab dono ek line mein dikhte hain
   (`native: 5.11.0-native`).
5. **Jo ABHI bhi adhoora hai:** screen-off / app-swipe par wake ka **AMAL** (Phase 3),
   reboot auto-on F26 (Phase 3), offline wake (Phase 4), APK auto-update F43 (Phase 2.5
   — aap ke faislay ka intezar: GitHub ya apna server), aur `MicKit.db()` ka dBFS par
   jaana (Phase 2, F21) — is liye aaj ke dB numbers **motay tor par** dB hain, kalibratd
   dBFS nahi.

## 5. 🧪 Test-locks — Section 32 (+41)

`tools/test-lab-engine.js` Section 32 mein har Phase-1 badlaav ka **wiring-level** lock
hai (declaration par nahi). Teen purane locks **JAAN BOOJH kar sudhare** gaye — wo
purane (buggy) rawaiye ko lock kar rahe the:

| Purana lock | Kyun badla |
|---|---|
| `rec.release() → MicKit.release() → actuallyStart` (140 chars) | F17: exit ab **wajah** dekhta hai; har exit par recognizer hamla nahi karta |
| `over > 14.0` | F15: chokhat ab farsh se banti hai (`over > TRIG_STEP`) + cap 72dB |
| `while (gateOn && running)` | F16: loop mein pehre ki **90s umar** bhi hai |

Version locks bhi v5.11.0/vc75 par le gaye (gradle · package.json · sw.js · appVersion ·
Kotlin toast · JS toast = **chhe** jagah).

**Kul tests: 1234/1234** (101 ui + 294 css + 155 voice + 684 lab).

## 6. ✅ Acceptance criteria — device par (TECNO KL4, Android 14)

1. **Shor wala kamra (TV chalu):** 10 dafa "Maya" → **≥8 wake**; log mein farsh **≤50dB**
   aur chokhat **≤72dB** dikhe.
2. **Khamosh kamra, 1 ghanta TV:** **≤1 false wake**; farsh calibration ki line aaye
   (`farsh NdB chokhat MdB frame 3`).
3. **Mic kisi aur app ko de kar 30s:** log mein read-error + **auto-recovery**; CPU spike
   nahi (pehle 100% spin).
4. **Screen off 30 minute:** wake chalu; panel par `wake ka recognizer` wahi jo pehle tha
   (Activity marne par badalna band).
5. **WebView reload ke foran baad:** wake chalu — panel par `heartbeat N (aakhri Xs pehle)`.
6. **SUNO → bolna → chhodna:** wake ~1s mein wapas (Phase 0 ka natija barqarar), aur
   `🔧 khud-sudhaar` **0 ya bahut kam** (barh raha ho to JS ka HAAL bhejna toota hai).
7. **Mic ijazat wapas le kar wake ON:** switch khud OFF + notification par **"Ijazat do"**;
   ijazat wapas dete hi **≤45s** mein wake khud shuru (app dobara khole baghair).
8. **App ko recent se swipe → 1 minute baad kholein:** `🧭 WAKE STATE` mein JS aur Kotlin
   ka haal **ek jaisa** (MISMATCH nahi).

## 7. 🚦 CI / build

* **CI run [33689569785](https://github.com/adil-chandio/Mana-android/actions/runs/33689569785) — ✅ SUCCESS (pehli koshish)**
  · commit `71cc015` · Kotlin compile **clean** (`WakeState.kt` + `WakeWordService` + `MainActivity`)
* **APK:** artifact `MAYA-APK` — **3,211,753 bytes** (v5.10.3 ke 3,200,895 se **+10,858 bytes**)
* **Download:** https://github.com/adil-chandio/Mana-android/actions/runs/33689569785
* ⚠️ CI ki annotations sirf **cache/deprecation** ki thin (Node 20 → 24, `setup-java@v4`,
  gradle cache 400) — build se koi talluq nahi, pichli runs mein bhi wahi thin.

---

## 📱 RELEASE REPORT — v5.11.0 "WAKE MAZBOOT"  *(Qanoon 9 / HISSA M ka farma)*

> 📄 Ek parcha (tick ✅ lagane layak): [`REPORT-v5.11.0-aam-zubaan.md`](REPORT-v5.11.0-aam-zubaan.md)

### 1. Kya naya hua — aam zubaan mein (code ke naam ke bagair)

| # | Aap ko kya farq dikhega | Pehle | Ab |
|---|---|---|---|
| 1 | Wake **apni halat bhoolti nahi** — jo rukawat thi wo **khud khatam** hoti hai (8/20/30 second ki mudat) | Ek khabar kho jaye to wake **hamesha** ke liye band | Mudat khatam → khud wapas, aur panel par **"khud-sudhaar N dafa"** |
| 2 | App **10 second mein ek dafa** zindagi ka saboot bhejti hai | Sirf halat badalne par khabar jati thi | 3 saboot gayab = Kotlin khud samajh jata hai ke app so gayi |
| 3 | **Shor wale kamre mein** wake behtar sunegi | Farsh **pehli awaaz** par jam jata (62dB) → chokhat 76dB → chillane par bhi na khulti | Pehle **0.8 second** khamoshi ka farsh naapa jata hai (20–50dB ke andar), chokhat kabhi **72dB** se upar nahi |
| 4 | Shor **barhne** par false-wake nahi | Farsh sirf neeche ja sakta tha | Farsh dono taraf seekhta hai (neeche jaldi, upar dheere) |
| 5 | **Battery/garmi** par lagam | Mic read-error par processor **100% ghoomta** rehta | 5 koshish → mic tazaa; khali read par 8ms sukoon; pehre ki **90 second** umar |
| 6 | Maya ke **bolte waqt** mic ki larai nahi | Pehra band hone ke bawajood wake ka mic turant khul jata | Pehra **wajah** dekh kar band hota hai: awaaz par mic, sulah par khamoshi |
| 7 | Wake ka **apna** kaan — app band hone par bhi wahi | App mari to wake chupke se **kamzor kaan** par chali jati | Wake ka apna selection + **yaad**: jo chala wahi agli dafa pehle |
| 8 | Wake ka kaan **khud theek** hota hai | Ek hi nakam kaan bar bar azmaya jata | 4 lagatar nakami → bhool kar **agla** kaan azmaya jata hai |
| 9 | Lambi wake session par **disconnect kam** | Wake ki session bina kisi hadd ke lambi khinchti | 0.7s khamoshi = session khatam; 0.3s = kam az kam bolna |
| 10 | Panel ka hisab **poora sach** | "lagatar 15 nakami" jabke mic sirf 7 dafa chala tha | **"IS SESSION"** aur **"KUL"** alag |
| 11 | Mic ki ijazat na ho to **khabar + seedha darwaza** | Wake chup-chaap har 1.2s nakam hoti rehti, notification "sun rahi hai" ka **jhoot** kehti | Wake **rukti** hai, notification **"⚠️ wake beemar"** + **"Ijazat do"** button; ijazat milte hi **khud** shuru |
| 12 | App wapas aane par **haal mil jata hai** | App wapsi par dono taraf ka haal alag reh sakta tha (wake chup-chaap band) | Wapsi par: haal tazaa + **sehat ka nazar** (toast/log) + WebView background (battery), **heartbeat zinda** |

### 2. Kaise parakhna hai — ✅ PASS aur ❌ FAIL ke nishan

| # | Kya karen | ✅ PASS | ❌ FAIL |
|---|---|---|---|
| **M0** | Purani APK ke upar v5.11.0 install karen | Toast `MAYA v5.11.0 • 🛡️ WAKE MAZBOOT…` + panel par `native: 5.11.0-native` | Purana toast / version 5.10.x |
| **M1** | WAKE switch ON → LAB → 👂 WAKE WORD KA HAAL | Nayi lines: `🧭 WAKE STATE` + `🎧 PEHRA` + `farsh NdB · chokhat MdB` | Ye lines **na** hon = purani APK |
| **M2** | Khamosh kamre mein 1 minute chhod den | Log mein `farsh … chokhat … frame 3` (calibration poora) | `frame 1 (calibration adhoora)` bar bar |
| **M3** | TV chalu karke **"ہے مایا"** kahein (10 dafa) | **≥8** SUNO; farsh ≤50dB | ≤5 SUNO, ya farsh 62dB jaisa |
| **M4** | SUNO ke baad bolna khatam → chhod dein → **"ہے مایا"** | ~1 second mein wake wapas (Phase 0 barqarar) | 60 second murda |
| **M5** | 1 ghanta TV chalu, koi na bole | **≤1** false wake | Bar bar khud SUNO khul jaye |
| **M6** | Mic ijazat wapas le kar WAKE ON | Switch khud OFF + notification **⚠️ wake beemar** + **"Ijazat do"** | Switch ON dikhe, notification "sun rahi hai" kahe |
| **M7** | **"Ijazat do"** dabayen → ijazat dein → wapas app mein aayen | App-info screen khulti hai; ijazat ke baad **≤45s** mein wake khud chalu (app dobara khole baghair) | Screen na khule, ya wake khud shuru na ho |
| **M8** | Screen 30 minute band → **"ہے مایا"** | Wake chalu; panel par `wake ka recognizer:` wahi (badla nahi) | `default` par gir jaye, ya wake murda |
| **M9** | App recent se swipe → 1 minute baad kholein | `🧭 WAKE STATE` mein JS aur Kotlin ka haal **ek jaisa**; `heartbeat N` barh raha ho | MISMATCH, ya `heartbeat 0 (ab tak koi nahi)` |
| **M10** | Airplane mode 5 minute | Circuit open + `💡 ILAJ`; **KUL nakami** barhe magar **IS SESSION** streak reset hota rahe | Chup-chaap khamoshi, ya "lagatar 40" jaisa adhoora sach |
| **M11** | 12 minute chalu chhod dein | Log mein `error 3/8` **na** aaye | Har 12 minute par mic clash |
| **M12** | Panel par `🔧 khud-sudhaar` dekhein | **0 ya 1-2** (kabhi kabhi) | Barh ta rahe = JS ka haal bhejna toota (mujhe batayen) |

### 3. Kya abhi bhi adhoora hai (imaandari)

1. **Screen band / app swipe ke baad wake ka AMAL** (khud jawab dena, khud app kholna) → **Phase 3**.
2. **Phone restart ke baad wake khud ON** nahi hoti → **Phase 3** (F26).
3. **Bina internet wake** → **Phase 4** (offline engine).
4. **APK khud-ba-khud update** → **Phase 2.5**; aap ka faisla chahiye: **GitHub** ya **apna server**.
5. **dB ka paimana mota hai** (dBFS calibration Phase 2 mein) — is liye farsh/chokhat ke
   numbers **andaza** hain, laboratory-grade nahi.
6. **Wake DOCTOR v2** (ek button → poora copy-paste forensic) → **Phase 2**.

### 4. Agar kaam na kare — ye bhejein

1. **LAB → 👂 WAKE WORD KA HAAL** ka **poora photo** (nayi lines: `🧭 WAKE STATE`, `🎧 PEHRA`,
   `🔧 khud-sudhaar`, `delivery`).
2. **Aakhri 5–10 wake waqiaat** (log ki lines ya photo).
3. `farsh` aur `chokhat` ke **numbers**, aur `calibration adhoora` likha aaya ya nahi.
4. **HAAL (JS)** aur **HAAL (Kotlin)** dono, aur `MISMATCH` line aayi ya nahi.
5. **Phone ka model + Android version**.
6. **Video** — kaam karne aur na karne ki dono.

### 5. Version ki pehchaan

* Boot par toast: **`MAYA v5.11.0 • 🛡️ WAKE MAZBOOT — farsh calibration + haal ki mudat + heartbeat`**
* App ki detail mein version: **5.11.0** (versionCode 75)
* Panel ki **nayi** lines: `🧭 WAKE STATE` · `🎧 PEHRA` · `wake ka recognizer` / `app ka recognizer`
* Notification beemar hone par: **⚠️ MAYA wake beemar** + **"Ijazat do"** button
* In mein se ek bhi na ho → APK **purani** hai
