# 🩹 v5.10.3 — "WAKE ZINDA" (Phase 0 + native instrument)

| | |
|---|---|
| **Version** | 5.10.3 · versionCode **74** |
| **Kis liye** | `docs/FORENSIC-WAKE-WORD.md` ke **Phase 0** (10 badlaav) + **Phase 2 ka instrument hissa** (F25/F27/F04) |
| **Mareez** | TECNO KL4 · Android 14 · `suna 0 · JAAGI 0 · nakami 8 · mic chala 7 · err 11 lagatar 15 · roka 67 · HAAL: KHALI` |
| **Tests** | **1185/1185** (101 ui + 294 css + 155 voice + **635** lab) — pehle 1153, **+32 naye locks** |
| **Kya NAHI kiya** | Koi naya feature nahi, koi nayi dependency nahi, koi UI redesign nahi, aur **user ka wake switch kabhi khud off nahi kiya** (P9 ka wada barqarar) |

---

## 1. Teen zanjeerein jo is release mein kaati gayin

### ⛓️ Zanjeer A — "sulah livelock": wake har SUNO ke baad **60 second murda**

**Wajah (F01):** `MainActivity.listen()` wake service ko `pauseForApp()` se rokta tha
(`MainActivity.kt:363`), magar **`resumeFromApp()` poori codebase mein kahin CALL nahi hoti thi** —
sirf 60 second ka stale-watchdog bachata tha. Us dauran har 700ms ek skip-report WebView par
thonsi jati thi (`roka 67` ≈ 47 second × 1.4 report/second) — aur wo spam KAAN ke 40-entry log ko
bhar kar **asal tareekh mita deta tha**.

**Ilaj:**

| Kahan | Kya |
|---|---|
| `MainActivity.stopRecognizer()` | `appMicOn = false` + `WakeWordService.resumeFromApp()` |
| `MainActivity.listen()` → `onError` | wahi (mic nakam ho to bhi wake wapas) |
| `MainActivity.listen()` → `onResults` | wahi (nateeja milte hi wake wapas) |
| `MainActivity.onDestroy()` | wahi (Activity marte hi wake azad) |
| `WakeWordService.watchdog()` | stale-pause **60s → 10s** (`STALE_PAUSE_MS`), **aur** `MainActivity.appMicBusy()` se poochh kar — blind release ab mic-jang paida nahi karta |
| `WakeWordService.restart()/actuallyStart()/startGate()` | blocked poll **700ms → 3000ms** (`BLOCKED_POLL_MS`) + `reportSkip()` rate-limit (**15s**, chalti ginti `x N` ke sath) + darwaza khulte hi `skipReset()` |

**Natija:** SUNO ke baad wake **≤1.5s** mein wapas (60s nahi), aur ek pause cycle mein skip reports
**67 → ≤4**.

### ⛓️ Zanjeer B — "error-11 storm": har 1.2 second cloud par hamla

**Wajah (F09/F10/F35):** `onError` ke `when` mein 10..15 codes **`else -> 1200L`** par girte the.
`ERROR_SERVER_DISCONNECTED (11)` par service har 1.2 second nayi cloud session khol rahi thi —
**lagatar 15 dafa**. Hamari retry policy ilaj nahi, beemari ka hissa thi (AOSP ka
`ERROR_TOO_MANY_REQUESTS (10)` isi pattern se aata hai). Aur **koi alert nahi**: `__wakeErr` sirf
"recognition unavailable" par chalta tha, is liye wake chup-chaap marti rahi.

**Ilaj:**

```kotlin
val base = when (error) {
    6, 7 -> 700L
    1, 2 -> 3000L
    4    -> 1500L
    10   -> 5000L      /* TOO_MANY_REQUESTS — thoka hum ne hai */
    11   -> 1500L      /* SERVER_DISCONNECTED */
    12, 13 -> 8000L    /* LANGUAGE not supported / unavailable */
    else -> 1200L
}
val stepped = if (error == 6 || error == 7) base + (errStreak.coerceAtMost(8) * 350L)
              else base * (1L shl (errStreak - 1).coerceAtMost(4))   /* x1,x2,x4,x8,x16 */
val back = stepped.coerceAtMost(30000L)                              /* 30s cap */
if (errStreak >= 3) resetRecognizer()      /* connection khud mar chuka hota hai */
if (errStreak == 5) { report("dead", …); evalToApp("__wakeErr(code)") }   /* CIRCUIT OPEN */
```

* **error 9** (mic permission) → hammer band: `report("dead")` + alert + 60s sukoon (F35).
* **error 8** ka purana mercy rawaiya **barqarar** (na `stopSelf`, na switch haath mein).
* ⚠ `settings.wakeWord` ko **kahin haath nahi lagaya** — circuit open par sirf khabar dete hain.

### ⛓️ Zanjeer C — wake ki zubaan galat thi (F12) + settings service tak pohanchti hi nahi thin (F38)

| Flaw | Pehle | Ab |
|---|---|---|
| **F12** | `setPrefString('wake_lang', settings.stt)` → `ur-PK`. Hamara **apna KAAN DOCTOR** kehta tha ke Urdu decoder "مایا" ko "ہے" parh leta hai — magar code wahi kar raha tha | Nayi setting **`wakeLang`** (default **`en-IN`**), LAB mein apna select `👂 WAKE KI ZUBAAN` (en-IN / hi-IN / ur-PK), aur Kotlin ka default bhi `en-IN`. STT/TTS apni jagah Urdu rahenge — **wake aur baat-cheet ki zubaan ab alag hain** |
| **F38** | `wake_lang`/`mic_zoom`/`mic_near`/`sukoon` **sirf wake-toggle par** Kotlin ko jate the. Settings badlo → service purani qeematon par chalti rehti → *sahih fix bhi "kaam nahi kiya" lagta* | **`pushNativePrefs()`** — `saveSettings()` ke andar, yaani **har settings-badlaav par** native prefs tazaa |
| **F39** | `wakeService(on)` ka **jawab phenk diya jata tha**: mic ki ijazat na hone par Kotlin `false` lotata tha, magar JS phir bhi "👂 Wake word ON" toast kar ke switch ON dikha deta — **switch jhoot bolta tha** | Jawab parha jata hai: `false` ho to switch wapas OFF, `hudRefresh()`, aur saaf toast *"⚠️ Wake ON nahi hui — mic ki ijazat chahiye"* |
| **F18** | 12-minute watchdog `resetRecognizer(); actuallyStart()` **gate chalu chhod kar** karta tha → mic do hathon mein → har 12 min guaranteed `error 3/8/11` | `if (!gateOn) actuallyStart()` — gate khuli ho to sirf recognizer fresh hota hai |
| **F11** | `KAAN.ERRNAME` mein **10..15 maujood hi nahi** → panel `aakhri err 11 — ?` chhapta tha | Poori AOSP fehrist 1..15 + naya **`ERRFIX`** (har code ka **ilaj**, sirf naam nahi) |

---

## 2. 🔬 NATIVE INSTRUMENT — "instrument mareez ke sath na mare" (F25/F27/F04)

Ye is release ka **dusra adha** hai. Forensic ne pakda tha ke hum apne hi diagnostic se andhe the:

* `report()` = `MainActivity.instance ?: return` → WebView marte hi **saari** reports zaya.
* Saare counters (`suna`/`nakami`/`mic chala`) **JS mein** rehte the → UI mare to counters bhi gaye.
* Is liye **`suna 0` ambiguous tha**: recognizer behra tha, YA usne suna magar report raste mein giri.
* Panel ka `HAAL: KHALI` **JS** ka haal tha, jabke Kotlin mein `pausedByApp = true` phansa tha —
  instrument ne humein galat raaste par bheja.

**Ab:**

| Naya | Kahan | Kya karta hai |
|---|---|---|
| `record(kind, payload)` | `WakeWordService` companion | **Har waqia PEHLE Kotlin ke ring buffer (60) mein** darj hota hai, phir UI ko bheja jata hai. Native counters: `nHeard, nErr, nStart, nSkip, nErr8, nLastErr, nDead, nLastWakeAt, heardOffline` |
| `drainEvents()` + `wakeEvents()` bridge | companion / `MayaBridge` | App khulte hi poora buffer JS ko (`KAAN.flushNative()`, boot par 2.2s + panel khulne par) — **UI ke mare hue daur ke waqiat bhi** mil jate hain |
| `evalPublicOk(js): Boolean` | `MainActivity` | **F27:** maujood `webViewAlive` flag ko ab asal mein check karta hai (pehle flag tha, istemal nahi). Delivery ka hisab: `sent` / `dropped` |
| `stateBits()` + `wakeState()` bridge | service / `MayaBridge` | **F04:** Kotlin ka **poora sach** ek JSON mein — `haal, pausedByApp, pausedFor, block, gate, alive, uptime, lang, using, floor, starts, errStreak, lastErr, nHeard…, heardOffline, sent, dropped` |
| Panel ki nayi lines | `KAAN.report()` | `HAAL (JS)` **aur** `HAAL (Kotlin)` dono · **`⚠️ MISMATCH`** line jab dono alag hon (yehi line is poore bug ko 2 second mein pakad leti) · `service: ZINDA/MURDA` · `wake zubaan + recognizer + gate + farsh` · `KOTLIN ginti` · `delivery: bheje N · GIRE N` · `☠️ CIRCUIT OPEN` + `💡 ILAJ` |

---

## 3. Test-locks — **+32**, aur ek naya usool

> **F01 ka sabaq:** purana test `resumeFromApp()` ke *likhe hone* ko check karta tha — is liye
> 1153/1153 GREEN tha aur wake phir bhi murda thi. **Ab har lock WIRING par hai, declaration par nahi.**

Section 30 (`tools/test-lab-engine.js`) ke locks:

* `resumeFromApp()` **≥4 call sites**, aur specifically `stopRecognizer()` / `onError` / `onResults`
  ke **andar** (slice-based, na ke sirf file-wide grep).
* `reportSkip()` ≥4 jagah · `restart(700)` **kahin nahi bacha** · `skipReset()` ≥3.
* Backoff table mein `10 -> 5000L`, `11 -> 1500L`, `12, 13 -> 8000L` · escalation `1L shl …` ·
  `coerceAtMost(30000L)` · `errStreak >= 3` par `resetRecognizer()` · `errStreak == 5` par
  `report("dead")` + `__wakeErr`, aur us block mein **`stopSelf()` nahi**.
* `error == 9` → `restart(60000)`.
* `ERRNAME` 10..15 + `ERRFIX` ka panel mein istemal.
* `wakeLang:"en-IN"` DEFAULTS mein · `id="sWakeLang"` HTML mein · `key: "wakeLang"` registry mein ·
  Kotlin default `getString("wake_lang", "en-IN")`.
* `if (!gateOn) actuallyStart()` (F18).
* `record()/evBuf/drainEvents()` · `record("heard", payload)` · `evalPublicOk` + `!webViewAlive` ·
  `wakeState()`/`wakeEvents()`/`stateBits()` · panel mein `HAAL (Kotlin)` + `MISMATCH` +
  `flushNative` · `heardOffline` dono taraf.
* `pushNativePrefs()` definition + `saveSettings()` se call + ≥3 occurrences.
* `wakeService(on) !== false` + `Wake ON nahi hui` + switch-OFF fallback.
* `appMicBusy()` + `appMicOn = true/false` (≥3).
* Version bump **paanchon** jagah: `versionCode 74`, `versionName "5.10.3"`, `package.json`,
  `sw.js` (`maya-v5.10.3`), `appVersion()` (`5.10.3-native`) + boot toast.
* `public/` mirror tazaa (`pushNativePrefs` + `sWakeLang` + `HAAL (Kotlin)` public copy mein bhi).
* Regression guards: `haalBlock()` ≥5 darwaze, SUKOON/HAAL nizam barqarar, ERR-8 mercy barqarar.

**4 purane asserts sudhare** (wo buggy behaviour ko lock karte the):

| Purana assert | Kyun badla |
|---|---|
| `setPrefString('wake_lang', settings.stt` ✅ kehta tha | wahi **bug** tha (F12) → ab `settings.wakeLang` + `!settings.stt` |
| `pausedAt > 60000` ✅ kehta tha | 60s = wake ek minute murda (F05) → ab `STALE_PAUSE_MS` + `appMicBusy()` |
| `WS.indexOf('8 -> {')` | `onError` ka `when` ab `if (error == 8)` block hai |
| `MainActivity.instance != null` + `HAAL        : ` + version 5.10.2 | delivery ab `evalPublicOk` se, panel ab `HAAL (JS)`/`HAAL (Kotlin)`, version 5.10.3 |

---

## 4. Files

| File | Badlaav |
|---|---|
| `app/src/main/java/com/maya/ai/WakeWordService.kt` | 493 → **699 lines**: native instrument (companion), `reportSkip/skipReset`, naya backoff, watchdog guards, `stateBits()`, `wakeLangNow()`, `resetRecognizer()` par `Throwable` guard |
| `app/src/main/java/com/maya/ai/MainActivity.kt` | `appMicOn`/`appMicBusy()`, `resumeFromApp()` wiring (4 jagah), `evalPublicOk()`, `wakeState()`/`wakeEvents()` bridge, version strings |
| `app/src/main/assets/web/index.html` | `ERRNAME` 1..15 + `ERRFIX`, `DEFAULTS.wakeLang`, `sWakeLang` select + `SET_FIELDS`, `pushNativePrefs()`, `setWakeService()` ka jawab, `KAAN.flushNative()`, panel ki nayi lines, DOCTOR ka naya mashwara, boot flush |
| `public/*` | `npm run build` se mirror |
| `tools/test-lab-engine.js` | Section 30 (+32 locks) + 4 purane asserts sudhare |
| `app/build.gradle`, `package.json`, `sw.js` ×2 | v5.10.3 / vc74 |
| `docs/FORENSIC-WAKE-WORD.md` | §17 AUTO-UPDATE (design + channel A/B) |

---

## 5. Device par kaise parakhna hai (TECNO KL4)

| Test | Qadam | PASS |
|---|---|---|
| **T1 — sulah round-trip** | SUNO dabao → 3s bolo → chhodo → LAB → KAAN | `pehra shuru` **≤1.5s**; `roka gaya` ≤4; `HAAL (Kotlin)` = KHALI, koi `MISMATCH` nahi |
| **T2 — wake 10/10** | 1 metre, khamosh kamra, normal awaaz mein 10 dafa "Maya" | `suna` ≥9 aur `JAAGI` ≥9 (dono JS **aur** KOTLIN ginti mein) |
| **T5 — offline** | Airplane mode ON, 5 minute chhod do | `nakami` barhe magar backoff ≥10s ho, ek **toast** aaye, aur panel par `☠️ CIRCUIT OPEN` + `💡 ILAJ` |
| **T6 — zubaan** | Settings STT = `ur-PK` rakho, wake switch ko **haath na lagao** | Panel: `wake zubaan: en-IN` (F12 + F38 dono ka imtihaan) |
| **T7 — 12-min watchdog** | 15 minute chalu chhodo | log mein `error 3/8` **zero** (F18) |
| **T9 — screen off** | Screen band kar ke "Maya" | `KOTLIN ginti: suna` barhe **chahe UI mare ho** — aur `delivery: GIRE N` dikhae (F25 ka saboot; poori native action Phase 3 mein) |
| **T10 — instrument** | KAAN panel kholo | `HAAL (JS)`, `HAAL (Kotlin)`, `service`, `wake zubaan`, `delivery` — paanchon lines nazar aayen; err 11 ka **naam** likha ho, `?` nahi |

> **E1/E2/E3** (forensic ke teen zero-code experiments) ab bhi qabil-e-istamal hain — sirf ab unka
> natija **Kotlin ginti** mein bhi nazar aayega, is liye ambiguity khatam.

---

## 6. Kya jaan boojh kar **nahi** kiya

* ❌ `EXTRA_PREFER_OFFLINE` — is device par on-device pack nahi (`ondevice: nahi`), ye error 13 deta.
* ❌ Boot autostart wapas chalu karna (F26) — wo **Phase 3** ka kaam hai (native action-path ke sath).
* ❌ Wake ka faisla Kotlin mein lana (F33) — Phase 3.
* ❌ `speakLocal()`/`launchApp()` wire karna (F28) — Phase 3 (haal=BOL_RAHI ke sath, warna self-wake loop).
* ❌ VAD floor calibration (F15), gate timeout/read-error (F16), `WakeState` single-source (F02) — Phase 1.
* ❌ Local KWS engine (Phase 4).
* ❌ User ka wake switch khud off karna — **kabhi nahi** (P9 ka wada).

---

## 7. CI

* Branch: `arena/01a062e9-mana-android`
* Workflow: `.github/workflows/build-apk.yml` (badla nahi gaya — permission effective nahi)
* Tests local: **1185/1185** ✅
* CI status: ✅ **GREEN** — run [`33679657338`](https://github.com/adil-chandio/Mana-android/actions/runs/33679657338)
  (commit `99c80f5`) — **pehli hi koshish mein** saare steps pass:
  `Code checkout · Java 17 · Gradle 8.7 · APK BUILD · APK upload`
* Artifact: **MAYA-APK · 3,200,895 bytes** (v5.10.2 se +8.5 KB — sirf code, koi naya asset/dependency nahi)
* Download: <https://github.com/adil-chandio/Mana-android/actions/runs/33679657338> → **MAYA-APK** → `app-debug.apk` install karein
* Saboot ke liye: boot par toast `MAYA v5.10.3 • 👂 WAKE ZINDA: SUNO ke baad foran wapas + err-11 hammer band`

---

## 📱 RELEASE REPORT — v5.10.3 "WAKE ZINDA"  *(Qanoon 9 / HISSA M ka farma)*

> 📄 **Ek parcha (phone mein rakhne layak, tick ✅ lagane layak):** [`REPORT-v5.10.3-aam-zubaan.md`](REPORT-v5.10.3-aam-zubaan.md) — neeche wala poora hisab usi ki tafseel hai.

### 1. Kya naya hua — aam zubaan mein (code ke naam ke bagair)

| # | Aap ko kya farq dikhega | Pehle | Ab |
|---|---|---|---|
| 1 | **"Maya" bolne par jawab** | 🎤 SUNO dabane ke baad **1 poore minute** tak wake bekaar — aap "Maya" bolte rehte, kuch na hota | SUNO khatam hone ke **~1 second** baad wake wapas chalu |
| 2 | **Wake kis zubaan mein sunti hai** | Urdu decoder "مایا" ko "ہے" jaisa parh leta tha → wake chup rehti | Wake ab **English (India)** se sunti hai. ⚠ Aap ki baat-cheet (STT) aur Maya ki awaaz (TTS) **Urdu hi rahengi** — sirf wake ki pehchan badli hai. LAB mein badalne ka apna switch bhi hai |
| 3 | **Settings ka asar** | Zubaan / mic zoom badalne ke baad wake **purani** settings par chalti rehti thi (wake OFF-ON karna parta tha) | Har **SAVE** ke baad foran lagu — OFF-ON karne ki zaroorat nahi |
| 4 | **Wake switch ka sach** | Mic ki ijazat na hone par bhi switch **ON** dikhta aur "Wake word ON" ka toast aata — switch jhoot bolta tha | Switch khud **OFF** ho jata hai + saaf message: *"⚠️ Wake ON nahi hui — mic ki ijazat chahiye"* |
| 5 | **Internet/service tootne par** | Har **1.2 second** nayi koshish (battery + data zaya), aur aap ko **koi khabar tak nahi** | Koshishen dheere-dheere sust (30 second tak ka waqfa), 5 nakami par **toast** + panel par `☠️ CIRCUIT OPEN` aur uska **💡 ILAJ** |
| 6 | **KAAN panel (LAB)** | `aakhri err 11 — ?` (naam nahi) aur `HAAL: KHALI` (jo **jhoot** tha) | Error ka **naam + ilaj** · `HAAL (JS)` aur `HAAL (Kotlin)` **dono** · beech mein farq ho to `⚠️ MISMATCH` · `service: ZINDA/MURDA` · wake ki zubaan · kitni reports UI tak pohanchin aur kitni **girin** |
| 7 | **Log ki tareekh** | Ek hi line **67 dafa** — asal waqiat mit jate the | Wahi line ab **ginti ke sath** (`x 67`) aur sirf har 15 second — poori tareekh nazar aati hai |
| 8 | **Screen band / app band ke waqt** | Wake suni hui baat **chupke zaya** ho jati, koi nishaan nahi | Ab **darj** hoti hai: panel par `GIRE N` aur `heardOffline` nazar aata hai *(poora ilaj — yaani screen band mein bhi amal hona — Phase 3 mein)* |

### 2. Kaise check karein — har cheez ka apna test

> ⚙️ Pehle nayi APK install karein (neeche Hissa 5 dekhein ke lag gayi ya nahi).

| Test | Kadam | ✅ PASS ka nishaan | ❌ FAIL ka nishaan |
|---|---|---|---|
| **T0 — APK lagi?** | App kholo | Boot par toast: **"MAYA v5.10.3 • 👂 WAKE ZINDA…"** | Purana toast (v5.10.2) → APK update nahi hui |
| **T1 — SUNO ke baad wake** | 1) 🎤 SUNO dabao 2) 3 second bolo 3) chhor do 4) **turant** "Maya" bolo | ~1 second mein 👂 chime / "Ji Boss?" | 1 minute tak kuch na ho, phir achanak chale |
| **T2 — wake 10 dafa** | 1 metre door, khamosh kamra, aam awaaz mein 10 dafa "Maya" | Kam az kam **8-9 dafa** jaage | 3 se kam dafa jaage |
| **T3 — zubaan** | 1) Settings → STT = **اردو Urdu** 2) SAVE 3) wake switch ko **haath mat lagao** 4) LAB → WAKE WORD KA HAAL | Line: **`wake zubaan : en-IN`** | `wake zubaan : ur-PK` (yaani purani APK ya fix nahi chala) |
| **T4 — internet band** | 1) Airplane mode ON 2) 5 minute chhodo 3) panel kholo | `nakami` barhe **magar** dheere (waqfa 10-30s), ek **toast** aaye, panel par `☠️ CIRCUIT OPEN` + `💡 ILAJ` | Har 1-2 second nayi koshish, koi toast nahi |
| **T5 — ijazat** | 1) Phone Settings → Apps → MAYA → Microphone **OFF** 2) app mein wake ON karo | Switch **khud OFF** reh jaye + toast *"mic ki ijazat chahiye"* | Switch ON dikhe aur toast "Wake word ON" aaye |
| **T6 — panel ka naya chehra** | LAB → 🩺 KAAN DOCTOR aur WAKE WORD KA HAAL kholo | Nayi lines nazar aayen: `HAAL (Kotlin)`, `service`, `wake zubaan`, `delivery: bheje N · GIRE N` | Sirf purani lines hon (`HAAL :`, `roka gaya`) → purani APK |
| **T7 — tareekh saaf** | Wake ON chhod kar 5 minute baat karo, phir panel kholo | Log mein **mixed** waqiat hon (voice/mic/err/suna) | Log mein sirf ek hi line bar bar (`sulah: app ka mic`) |
| **T8 — 12 minute** | App chalu chhod kar 15 minute ruk jao, phir panel kholo | `nakami` mein **3 ya 8** wale error na barhein | `err 3` / `err 8` bar bar |

### 3. Kya abhi bhi adhoora hai (imaandari)

| Adhoora | Kyun | Kab |
|---|---|---|
| **Screen band / app swipe ke baad wake ka AMAL** nahi hota (sunti hai, magar chime nahi, app nahi khulti) | Wake ka faisla abhi bhi app ki screen (WebView) ke andar hota hai, jise Android band kar sakta hai. Is release ne isay **chhupaya nahi — napa jane laiq banaya** (`heardOffline`/`GIRE N`) | **Phase 3** (v5.12.0) — wake ka dimaag native mein |
| **Phone restart ke baad wake khud chalu nahi hoti** | Boot ka rasta jaan boojh kar band kiya gaya tha (purana "black screen" dar) | **Phase 3** |
| **Tez shor mein wake ko chillana parta hai** (`farsh 62dB` wala masla) | Awaaz-naapne ka farsh (noise floor) pehli hi sample par atak jata hai | **Phase 1** (v5.11.0) |
| **Airplane mode mein wake kabhi nahi chalegi** | Wake abhi **online** recognizer se hoti hai | **Phase 4** (v6.0.0) — local/offline engine |
| **APK khud update nahi hoti** | Update ka koi channel hi nahi (har bar manual install) | **Phase 2.5** — design tayyar hai, aap ke channel ke faislay ka intezar |

### 4. Agar kaam na kare — ye bhejein (3 cheezein)

1. **LAB → 👂 WAKE WORD KA HAAL** ka **poora text** copy kar ke paste karein (ab is mein Kotlin ka
   sach bhi hota hai — `HAAL (Kotlin)`, `service`, `delivery`).
2. **LAB → 🩺 KAAN DOCTOR** ki report (phone ki asli fehrist).
3. Ek line mein: **phone ka naam + Android version**, aur **aap kya kar rahe the** (misal:
   "SUNO dabaya, phir Maya bola, kuch nahi hua").

> Bas. In teen se agla faisla **andaze se nahi, saboot se** hoga — yehi is release ka doosra adha tha.

### 5. Version ki pehchaan (nayi APK lagi ya nahi?)

| Nishaan | Kahan |
|---|---|
| Boot toast: **"MAYA v5.10.3 • 👂 WAKE ZINDA: SUNO ke baad foran wapas + err-11 hammer band"** | App khulte hi |
| Panel mein nayi line **`HAAL (Kotlin): …`** | LAB → 👂 WAKE WORD KA HAAL |
| LAB mein naya select **`👂 WAKE KI ZUBAAN`** (English India / Hindi / Urdu) | LAB, "MIC KA ZOOM" ke upar |
| Error ka **naam** likha ho (`11 — server se connection toota`), `?` nahi | LAB → panel |

Agar in mein se **ek bhi nishaan nahi** mila → APK purani hai, naye fix ka imtihaan bekaar jayega.
