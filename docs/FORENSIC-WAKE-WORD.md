# 🔬 FORENSIC — WAKE WORD (👂 KAAN) KA POORA POST-MORTEM

| | |
|---|---|
| **Dastaavez** | `docs/FORENSIC-WAKE-WORD.md` |
| **Tareekh** | 2026-09-03 |
| **Branch** | `arena/01a062e9-mana-android` (HEAD `cdaf871`, v5.10.2, CI GREEN) |
| **Mareez** | TECNO KL4 · Android 14 (SDK 34) · WebView 152.0.7977.64 |
| **Mahol** | STT = `ur-PK` · wakeWord = ON · AiAi = NAHI · speech service = `com.google.android.tts` · default assistant = Google Go · online |
| **Alaamat** | `suna 0 · JAAGI 0 · nakami 8 · mic chala 7 · aakhri err 11 · roka 67 · HAAL: KHALI` |
| **Faisla** | Wake word **toota hua NAHI, bandh hua hai** — 3 zanjeerein (A: livelock, B: retry-storm, C: VAD floor) + **screen-off wake ka poora rasta hi band** (F25/F33/F26/F36) |
| **Flaws** | **42** (pass 1: F01–F24 · pass 2: F25–F42) — 8 🔴 critical · 12 🟠 high · 12 🟡 medium · 6 ⚪ low |
| **Plan** | **Structure v2**: Phase 0 `v5.10.3` → Phase 4 `v6.0.0` (§15) — har phase ke acceptance criteria + test-locks + device tests |
| **Hukm** | ⛔ IS DAURA MEIN KUCH BANANA NAHI — sirf research / forensic / structure |

> **PASS 2 KA TL;DR:** teen flaws F01 se bhi zyada bunyadi nikle — **(1)** `handleAll()` wake ka
> nateeja **phenk deta hai** jab WebView zinda na ho (`lastHeardOffline` ek dead variable hai), yani
> screen-band/jaib mein wake ka poora maqsad hi bekaar; **(2)** wake ka **dimaag JS mein** hai, is liye
> uski zindagi ek UI component ke haath mein hai jise Android kabhi bhi maar sakta hai; **(3)**
> `BootReceiver` **khokhla** hai (start-line commented) aur service ko marne ke baad zinda karne wala
> koi nahi — reboot ke baad wake tab tak OFF jab tak app na kholein. Sath mein **F38 pref-drift**:
> `wake_lang`/`mic_zoom`/`mic_near` sirf wake-toggle par Kotlin ko jate hain, yaani Settings badalne se
> service ko khabar hi nahi hoti — **ye fix ko “kaam nahi kiya” dikhane wala trap hai.**
>
> **TL;DR (pass 1, ek saans mein):** `pauseForApp()` ka **koi wapsi raasta nahi** — `resumeFromApp()`
> poori codebase mein ek jagah bhi call nahi hoti, is liye har SUNO tap ke baad wake **60 second
> tak murda** rehti hai aur us dauran har 700ms ek skip-report WebView par thonsi jati hai
> (67 dafa). Us ke baad jo recognizer chalta hai wo `ERROR_SERVER_DISCONNECTED (11)` par
> **har 1.2 second** dobara hamla karta hai (lagatar 15) — kyunke error 11 ke liye backoff
> escalation likhi hi nahi gayi, wake ki zubaan `ur-PK` hai (jismein "مایا" → "ہے" parha jata
> hai), aur VAD ka noise-floor **pehle sample par latch** ho jata hai (62 dB farsh → 76 dB
> chokhat → aap ko chillana parta hai). Aur panel ka "HAAL: KHALI" **jhoot bol raha tha** —
> wo JS ka haal dikhata hai, Kotlin ka `pausedByApp` nahi.

---

## 0. HUKM — kya karna tha, kya nahi

Aap ne kaha:

> *"ab Aage kuch NAHI banana ab ham dekhenge research Karke study Karke analyze Karke explore
> Karke deep down jaake detailed Study forensic Karke microscope lagake 10xthink lejake ache se
> bagair kisi kami galati ke flaws bareek se bareek ab structure banao pehle Dekho Kya ham galat
> kar rahe hen Kahan kar rahe hen q successful NAHI horahe konsi galatiyan flaws errors arhe hen
> Jo kaam kaharab kar rahe hen or unhen best behtreen kis Tarah se perfectly correctly accurately
> next level lejaya ja sakta ha"*

Is liye ye dastaavez **sirf** teen cheezein deti hai:

1. **Saboot** — har ilzaam ke sath file + line number + code ka tukra (andaza nahi).
2. **Flaw register** — F01..F24, severity ke sath, aur har ek ka *sahih* ilaj.
3. **Structure** — Phase 0 → Phase 3 ka plan, acceptance criteria, test-locks, aur device
   verification protocol.

**Koi code nahi badla gaya.** Working tree clean hai; ye sirf docs commit hai.

---

## 1. TAREEQA (microscope kaise lagaya)

| Qadam | Kya kiya | Natija |
|---|---|---|
| 1 | Aap ka paste kiya hua KAAN panel diagnostic parha | 6 alamaten nikleen (§2) |
| 2 | `WakeWordService.kt` — **493/493 lines** poori padhi | wake engine ka poora control-flow |
| 3 | `MicKit.kt` — **191/191 lines** poori padhi | VAD/mic layer, dB scale, fx |
| 4 | `MainActivity.kt` — `listen()` (340-420), `stopRecognizer()` (262), `setHaal()` (277), `micDoctor()` (1213), `makeRecognizer()` (1584), `instance` lifecycle (87/167) | app-side mic path |
| 5 | `index.html` — `SUKOON` (8189-8220), `KAAN` (8221-8348), `__wakeLog/__wakeHeard/__wakeErr` (8621-8692), `wake_lang` (9592), SUNO ke `sunStart/sunEnd` call sites (4373-4411, 1447-1481) | JS-side state machine |
| 6 | `grep -rn "resumeFromApp"` poori repo par | **0 external call sites** ← bara mujrim |
| 7 | AOSP `SpeechRecognizer.java` + developer.android.com se error codes 1..15 ki **qanooni** fehrist | §5 |
| 8 | Android 13+ par recognition service ki migration (Google app → `com.google.android.tts` APK) | §5.3 |

**Usool:** har flaw ke liye teen cheezein zaroori thin — (a) code ka exact tukra, (b) aap ke
diagnostic mein uska **nishaan**, (c) uski wajah se jo nuqsan hota hai. Jis daawe ka nishaan
diagnostic mein nahi mila, usay "mushtabah" (suspected) likha gaya hai, "saabit" nahi.

---

## 2. MAREEZ KA BAYAN — diagnostic ka lafz-ba-lafz matlab

Aap ka paste:

```
suna 0 · JAAGI 0 · nakami 8 · mic chala 7 (aakhri err 11 — ?)
err: 11|15
roka 67      →  "sulah: app ka mic"  (har ~700ms, 13+ second tak)
HAAL: KHALI
```

Har hindasa kya kehta hai:

| Hindasa | Code | Asal matlab |
|---|---|---|
| `suna 0` | `KAAN.heard` (`index.html:8285`) | Recognizer ne **ek bhi** nateeja nahi diya. Yani `onResults` kabhi nahi chala. |
| `JAAGI 0` | `KAAN.woke` | Wake word kabhi match nahi hua — `suna 0` ka seedha natija. |
| `nakami 8` | `KAAN.errs` | 8 dafa `onError` chala. |
| `mic chala 7` | `KAAN.starts` | 7 dafa `startListening()` hui. **7 start ↔ 8 error** = har session nakam. |
| `aakhri err 11 — ?` | `KAAN.ERRNAME[11]` = undefined | `ERRNAME` mein **10..15 maujood hi nahi** → panel "?" chhapta hai. Hum ne apna diagnostic adhoora ship kiya. |
| `err: 11\|15` | `WakeWordService.kt:319` `report("err", "$error|$errStreak")` | `ERROR_SERVER_DISCONNECTED`, **lagatar 15 dafa**. `errStreak` kabhi reset nahi hua (kyunke koi result aaya hi nahi). |
| `roka 67` | `KAAN.skips` (`index.html:8283`) | 67 dafa mic ka darwaza band mila. 67 × 0.7s ≈ **47 second** ka lagataar poll. |
| `"sulah: app ka mic"` | `WakeWordService.kt:85` (`haalBlock()` → `pausedByApp`) | Kotlin ka `pausedByApp` flag **true phansa hua** tha. |
| `HAAL: KHALI` | `index.html:8315` — `SUKOON.haal` | Ye **JS** ka haal hai. Kotlin mein `haal="KHALI"` tha *aur* `pausedByApp=true` — do alag darwaze, aur panel sirf ek dikhata hai. **Instrument ne jhoot bola.** |

### 2.1 Log ka timeline (jo sequence aap ne dekhi)

```
00:00:39  haal: APP_SUN            ← aap ne SUNO dabaya (tap-to-speak)
          gate: 50dB farsh 28dB    ← gate phir bhi chal raha tha (state flap)
00:00:44  sulah: app ka mic   ┐
00:00:44  sulah: app ka mic   │  67 dafa, har ~700ms
00:00:45  sulah: app ka mic   │  (restart(700) ka khud ko dohrana)
   ...    ...                 ┘
00:00:47  sulah: stale pause khud azad hua (60s)   ← WATCHDOG ne bachaya, aap ne nahi
00:00:47  sulah: service wapas — pehra phir se
00:00:47  pehra shuru
00:00:47  voice: awaaz 77dB farsh 62dB   ← gate tab khula jab aap NE CHILLAYA
00:00:47  pehra shuru (gate khula) → mic chala → err: 11
00:00:48  gate BAND → mic chala → err: 11
00:00:51  err: 11|15
```

Do **bilkul alag** masle is timeline mein saaf nazar aate hain:
`00:00:39 → 00:00:47` = **Zanjeer A** (livelock). `00:00:47 → aage` = **Zanjeer B** (error-11 storm).

---

## 3. DO ZANJEEREIN — root cause chains

### 3.1 ⛓️ ZANJEER A — "sulah livelock" (wake har SUNO ke baad 60s murda)

```
[aap SUNO dabate hain]
        │
        ├─(1) JS: SUKOON.sunStart() → haal KHALI→APP_SUN → bridge → applyHaal("APP_SUN")
        │                                                    └→ onHaal("APP_SUN") → hardPause()
        │
        └─(2) Kotlin: MayaBridge.listen(lang) → runOnUiThread { ... WakeWordService.pauseForApp() }
                                                     └→ pausedByApp = TRUE   (MainActivity.kt:363)
        │
   [app ka recognizer chalta hai / ya foran nakam hota hai]
        │
        ├─(3) JS: listening=false → SUKOON.sunEnd() → set("KHALI")
        │        ⚠ agar haal pehle hi KHALI tha (race) → set() NO-OP (index.html:8198)
        │          → bridge call NAHI → applyHaal NAHI → onHaal NAHI → softResume NAHI
        │
        └─(4) Kotlin: onError / onResults / onEndOfSpeech / stopRecognizer()
                 ⚠ in mein se KOI BHI resumeFromApp() call NAHI karta
        │
   [pausedByApp = true phansa hua]
        │
        ├─ haalBlock() har darwaze par "sulah: app ka mic" lotata hai (WS:85)
        ├─ restart(700) → skip report → restart(700) → …  (WS:391-397)  ← 1.4 report/sec
        ├─ KAAN.log (MAX 40) is kachre se bhar jata hai → asal tareekh MIT jati hai
        │
   [60 second baad]
        └─ watchdog: "stale pause khud azad hua" → resumeFromApp()  (WS:445-447)
              ⚠ bina ye dekhe ke app ka mic asal mein khali hai ya nahi
```

**Natija:** wake word har tap-to-speak ke baad **60 second** ke liye gayab. User ka tajurba:
*"Maya bolne par kuch nahi hota"* — aur 60s baad achanak chal parti hai, jo aur zyada confusing hai.

**Saboot:** `roka 67` (≈47s × 1.4/s), `"stale pause khud azad hua"` log line, aur
`grep -rn resumeFromApp` = **0 external call sites** (sirf definition WS:96 aur watchdog WS:447).

### 3.2 ⛓️ ZANJEER B — "error-11 storm" (recognizer kabhi kuch sunta hi nahi)

```
[gate khulta hai] → actuallyStart() → sr.startListening(lang = "ur-PK")
        │                                    │
        │                                    ├─ recognizer = MainActivity.instance?.makeRecognizer()
        │                                    │    └ is device par: on-device ✗ (koi pack nahi)
        │                                    │      googlequicksearchbox ✗ (app maujood nahi)
        │                                    │      → "default" = com.google.android.tts  (sab se kamzor)
        │                                    │      → context = ACTIVITY (service ka nahi!)
        │                                    │
        │                                    └─ intent mein NA silence-timeout, NA prefer-offline
        │                                       (app path mein 700ms silence HAI — asymmetry)
        │
   onError(11)  ← ERROR_SERVER_DISCONNECTED
        │
        ├─ errStreak++ → report("err","11|N")
        ├─ backoff = when(11) → **else -> 1200L**      (WS:329)  ← escalation NAHI
        │     (sirf 6/7 errStreak se barhte hain — WS:321)
        ├─ koi circuit-breaker NAHI
        ├─ koi toast / notification / UI state NAHI     (__wakeErr sirf WS:290-293 se, "recognition
        │                                                unavailable" par — error 11 par KABHI nahi)
        └─ restart(1200) → gate → startListening → onError(11) → …  **forever**
```

**Natija:** 7 start / 8 error / 15 lagatar 11 / `suna 0`. Wake engine zinda lagta hai (mic
chalta hai, gate khulta hai) magar **kaam zero**. Aur user ko koi khabar nahi — sirf LAB → KAAN
kholne par pata chalta hai, wo bhi "?" ke sath.

**Ye storm khud ko feed karta hai:** ek cloud recognition service ko har 1.2 second nayi session
dena usi ko todta hai (AOSP ke `ERROR_TOO_MANY_REQUESTS (10)` aur `ERROR_SERVER_DISCONNECTED (11)`
isi pattern par aate hain). Yani hamara retry policy **ilaj nahi, beemari ka hissa** hai.

### 3.3 ⛓️ ZANJEER C (chupi hui) — gate ka floor latch

```
gateThread shuru → floorDb = 0.0
   pehla 100ms frame: d = 62 dB (aap bol rahe hain / TV / Maya ki TTS ki goonj)
   → if (floorDb <= 0.0) floorDb = d        ← **62 dB par LATCH**
   → floor sirf NEECHE ja sakta hai (0.9/0.1 decay), UPAR kabhi nahi
   → chokhat = floorDb + 14 = 76 dB
   → aam baat 55-65 dB → gate KABHI NAHI khulta
   → jab khula: 77 dB (aap chillaye) — bilkul wahi jo log mein dikha
```

Aur ulta case: pehla frame bohot khamosh (25 dB) → chokhat 39 dB → kamre ki har sarsarahat gate
khol deti hai → har khulne par ek **cloud session** → error 6/7/11 → retry storm (Zanjeer B ko
feed). Yani floor ka latch **dono taraf** se nuqsaan deta hai: behraapan ya false-fire.

---

## 4. FLAW REGISTER — F01 … F24 *(pass 1 · logic layer)*

> ⚠️ Pass 2 ke 18 naye flaws (F25–F42 — platform, delivery pipeline, lifecycle) **§13** mein hain.
> Poora register: **42 flaws**. Revised plan: **§15 (Structure v2)** — §7 pass 1 ka plan hai, §15 usay supersede karta hai.

Severity: 🔴 critical (wake ko marta hai) · 🟠 high (aksar marta hai) · 🟡 medium (kabhi/mahol par) · ⚪ low (polish)

| # | Sev | Flaw (ek line) | Saboot (file:line) | Nishaan diagnostic mein |
|---|---|---|---|---|
| F01 | 🔴 | `resumeFromApp()` kabhi call nahi hoti | `MainActivity.kt:363` vs 262/389/390/393; `WS:96` | `roka 67`, stale-release line |
| F02 | 🔴 | HAAL **edge-triggered** hai, dono taraf dedup → race par hamesha ke liye phans | `index.html:8197-8199`; `WS:73-78`; `WS:459-471` | `HAAL: KHALI` + `pausedByApp=true` |
| F03 | 🟠 | Blocked halat mein 700ms poll + **har skip report** → bridge spam, log eviction | `WS:391-397`, `WS:233`, `WS:404`; `index.html:8223` | 67 skips, log 90% ek hi line |
| F04 | 🟠 | Panel JS ka haal dikhata hai, Kotlin ka `pausedByApp`/`haalBlock()` nahi | `index.html:8315`; `WS:80-87` | `HAAL: KHALI` (jhoot) |
| F05 | 🟡 | Stale-release 60s, bina app-mic check; itna lamba ke user haar maan jata hai | `WS:445-447` | release ke foran baad err 11 |
| F06 | 🟡 | WebView reload par HAAL **desync** — koi resync/heartbeat nahi | `index.html:8189-8199`; `WS:49` | (mushtabah — is run mein nahi) |
| F07 | ⚪ | `hardPause()` pendingGen barhata hai magar gate-exit dobara `actuallyStart()` post karta hai | `WS:281`, `WS:474-481` | gate+skip lines ka flap |
| F08 | ⚪ | `onCreate()` `pausedByApp` reset karta hai, companion `haal` nahi | `WS:123` vs `WS:49` | (mushtabah) |
| F09 | 🔴 | error 11 par **koi escalation nahi** — `else -> 1200L`, forever | `WS:320-329` | `err: 11\|15` |
| F10 | 🔴 | Koi circuit-breaker / user-visible alert nahi; wake chup-chaap marti hai | `WS:290-293` (sirf yahan `__wakeErr`); `index.html:8687` | user ko sirf LAB mein pata chala |
| F11 | 🟠 | `ERRNAME` mein 10..15 **maujood nahi** → panel "?" chhapta hai | `index.html:8303-8305` | `aakhri err 11 — ?` |
| F12 | 🟠 | Wake ki zubaan STT se bandhi hai → `ur-PK`; Urdu decoder "مایا" ko "ہے" parhta hai | `index.html:9592`; `WS:409-413`; `index.html:~8606` (apna hi doctor text) | `start: ur-PK\|N` |
| F13 | 🟠 | Wake recognizer **Activity context** se banta hai; Activity mari to selection chupke badal jati hai; `lastRecognizerKind` shared | `WS:299-304`; `MainActivity.kt:1582-1614`, `:167` | doctor "using" ambiguous |
| F14 | 🟠 | Wake intent mein silence/minimum-length/prefer-offline **kuch nahi**; app path mein 700ms hai | `WS:415-421` vs `MainActivity.kt:378` | lambi sessions → disconnect |
| F15 | 🔴 | `floorDb` pehle sample par **latch**, sirf neeche ja sakta hai | `WS:263-265` | `awaaz 77dB farsh 62dB` |
| F16 | 🟠 | Gate loop: `if (n <= 0) continue` → read-error par **100% CPU infinite spin**, koi timeout nahi | `WS:249-256` | (mushtabah — battery/heat) |
| F17 | 🟡 | `stopGate()` thread join nahi karta, AudioRecord release nahi karta; exit par `actuallyStart()` race | `WS:281-285` | mic contention |
| F18 | 🟡 | 12-min watchdog `resetRecognizer()+actuallyStart()` **gate chalu chhod kar** karta hai | `WS:437-441` | har 12 min guaranteed clash |
| F19 | ⚪ | `errStreak` sirf result/err8 par reset → panel ke "lagatar N" adhoore sach hain | `WS:317`, `330`, `343` | `11\|15` jabke starts=7 |
| F20 | 🟡 | `ns:✗` (NoiseSuppressor nahi) — budget Tecno par raw room audio, F15 ko aur bigarta hai | `MicKit.kt:97-101`; aap ka log `noise=✗` | `ns:✗` |
| F21 | ⚪ | `MicKit.db()` ka paimana man-gharant (`20·log10(rms)+10`) — na dBFS na dB SPL; thresholds port nahi hote | `MicKit.kt:126-133` | farsh 62 jaisi ajeeb qeematein |
| F22 | 🟡 | Wake matching: `WAKE` regex bohot dheela, confidence **phenk di jati hai**, koi phonetic/edit-distance nahi | `index.html:8229-8231`, `8264-8275`; `WS:365-378` (`handleAll` sirf text bhejta hai) | false wake / miss ka risk |
| F23 | 🟡 | `speaking||thinking||listening` par wake ignore → **barge-in nahi**; phir bhi cloud sessions jalti hain | `index.html:8632` | (mushtabah) |
| F24 | ⚪ | Counters sirf JS memory mein — reload par sab gayab; koi persisted history / per-code histogram nahi | `index.html:8221-8286` | forensic ke liye andhera |

### 4.1 F01 — 🔴 `resumeFromApp()` ka koi caller nahi (SAB SE BARA MUJRIM)

```kotlin
// MainActivity.kt:361-363  — pause TO hai
/* 🤝 P9 MIC SULAH — app ka tap-to-speak sab se pehle. … */
try { WakeWordService.pauseForApp() } catch (e: Exception) {}

// MainActivity.kt:262-264  — resume NAHI hai
private fun stopRecognizer() {
    try { recognizer?.destroy(); recognizer = null } catch (e: Exception) {}
}

// MainActivity.kt:389-393  — yahan bhi resume NAHI
override fun onEndOfSpeech() { evalAsync("window.__nativePartial && …") }
override fun onError(error: Int) { evalAsync("window.__nativeSpeechErr && …") }
override fun onResults(results: Bundle?) { … }
```

```
$ grep -rn "resumeFromApp" --include=*.kt --include=*.html --include=*.js .
./app/src/main/java/com/maya/ai/WakeWordService.kt:96:   fun resumeFromApp() {     ← definition
./app/src/main/java/com/maya/ai/WakeWordService.kt:447:      resumeFromApp()       ← 60s watchdog
./tools/test-lab-engine.js:1448: … /fun resumeFromApp\(\)/ …                       ← test sirf MAUJOODGI dekhta hai
```

> **Test-lab ka sabak:** hamara assert `pauseForApp` aur `resumeFromApp` dono ke *likhe hone*
> ko check karta hai — **call hone ko nahi**. Is liye 1153/1153 green tha aur wake phir bhi
> murda thi. Har naye fix ka test-lock **"wiring" par hona chahiye, "declaration" par nahi.**

**Sahih ilaj:** Kotlin-side symmetrical release — `stopRecognizer()`, `onError`, `onResults`,
`onEndOfSpeech`, aur `onDestroy` sab mein `WakeWordService.resumeFromApp()`; **aur** JS-side
`sunEnd()` ko force-send (dedup bypass) karna; **aur** watchdog ko 60s se 8-10s par lana with
app-mic check.

### 4.2 F02 — 🔴 Do darwaze, ek bhi source-of-truth nahi

`haalBlock()` (`WS:80-87`) paanch cheezein dekhta hai:

```kotlin
if (!s.sukoonOn()) return null                 // LAB escape hatch
if (haal == "BOL_RAHI") return "Maya bol rahi hai"
if (haal == "APP_SUN")  return "app ka mic chal raha hai"
if (pausedByApp)        return "sulah: app ka mic"      // ← doosra, ALAG flag
if (now - lastBolAt < ECHO_TAIL_MS) return "echo tail"
```

`haal` JS se aata hai (edge-triggered, dedup ke sath); `pausedByApp` Kotlin se set hota hai
(level, koi auto-release nahi). **Do alag state machines ek hi darwaze ko chala rahi hain**, aur
dono ka aapas mein koi mel nahi. Jab bhi inki raftaar mein race aati hai (JS ka KHALI pehle,
Kotlin ka pause baad mein), system us halat mein phans jata hai jise **koi bhi** edge clear nahi
kar sakti — sirf 60s ka watchdog.

**Sahih ilaj:** ek `WakeState` object (single source of truth) jismein `haal`, `pausedByApp`,
`pausedAt`, `owner` (`APP` / `WAKE` / `TTS` / `NONE`) ho; har mic-darwaza sirf usi se poochhe;
aur har state par **expiry** ho (`pausedByApp` 8s, `BOL_RAHI` 20s, `APP_SUN` 30s) taake koi bhi
edge kho jaye to system khud wapas KHALI par aa jaye. Sath mein `wakeState()` bridge getter —
taake panel **Kotlin ka sach** dikha sake (F04).

### 4.3 F09/F10 — 🔴 Retry policy beemari ko feed karti hai

```kotlin
// WS:320-329
val back = when (error) {
    6, 7 -> 700L + (errStreak.coerceAtMost(8) * 350L)   /* sirf ye do escalate hote hain */
    1, 2 -> 3000L
    4    -> 1500L
    8    -> { … restart(2000); return }
    else -> 1200L                                       /* ← 10,11,12,13,14,15 sab yahan */
}
```

Error 11 (server disconnected), 12/13 (language), 10 (too many requests) — sab **1.2s flat**.
Aur `errStreak` barhta rehta hai magar istemal nahi hota. Koi cap nahi, koi "wake beemar hai"
state nahi, koi alert nahi (`__wakeErr` sirf `startLoop()` mein "recognition unavailable" par
call hota hai — `WS:290-293`).

**Sahih ilaj:** (a) har code ka apna backoff, (b) `errStreak` se exponential escalation with cap
(misal: 11 → 1.2s, 2.4s, 5s, 10s, 30s, phir **circuit open**), (c) circuit open par ek
`report("dead", …)` + `__wakeErr(code)` + notification + KAAN panel par surkh state, (d) har
`errStreak >= 3` par `resetRecognizer()` (service ka connection khud mar chuka hota hai),
(e) 12/13 par **foran** zubaan badalna (ur-PK → en-IN) aur user ko batana.

### 4.4 F12 — 🟠 Wake ki zubaan galat hai (aur humein pehle se pata tha)

```js
// index.html:9592
window.MayaBridge.setPrefString('wake_lang', settings.stt || 'en-IN')
```

```
// index.html:~8606 — hamara APNA doctor text:
"Behtar natija: ⚙️ Settings mein STT 'English (India)' rakho — Urdu
 decoder "مایا" ko aksar "ہے" jaisa parh leta hai."
```

Hum ne doctor mein **likh diya** ke Urdu decoder wake word ko ghalat parhta hai, magar code mein
wake ki zubaan ko STT ke sath bandha chhod diya. Yani: user `ur-PK` chunta hai (kyunke wo Urdu
bolta hai — bilkul sahi) aur uski wake word chupke se toot jati hai.

**Sahih ilaj:** `wake_lang` ko `settings.stt` se **kaat** kar alag setting banana
(`settings.wakeLang`, default `en-IN`, options `en-IN` / `hi-IN` / `ur-PK`), aur KAAN panel +
doctor par dikhana ke wake kis zubaan mein sun rahi hai. Behtar: 12/13/7 ki soorat par
**do-zubaani koshish** (pehle en-IN, phir ur-PK) — kyunke "Maya" en-IN mein bhi Urdu naam hai.

### 4.5 F13 — 🟠 Wake recognizer Activity ke context se banta hai

```kotlin
// WS:299-304
private fun resetRecognizer() {
    try { sr?.destroy() } catch (e: Exception) {}
    sr = (MainActivity.instance?.makeRecognizer()
          ?: SpeechRecognizer.createSpeechRecognizer(this)).apply { … }
```

Teen nuqsan:

1. **Screen band / Activity destroy** → `MainActivity.instance = null` (`MainActivity.kt:167`) →
   wake chupke se `createSpeechRecognizer(service)` par gir jata hai = **doosri service
   selection**, doosra rawaiya. Yani wake ka behaviour is par depend karta hai ke Activity zinda
   hai ya nahi — jo background wake ke liye bilkul ulta hai.
2. `lastRecognizerKind` (`MainActivity.kt:1582`) **shared mutable** hai — app path aur wake path
   dono usay overwrite karte hain, is liye DOCTOR ka "🎯 Abhi chal raha hai" batata hi nahi ke
   wo kis ki baat kar raha hai.
3. Is device par `makeRecognizer()` ki seerhi ka natija: on-device ✗ (pack nahi) →
   googlequicksearchbox ✗ (app nahi) → `default`. Yani **sab se kamzor** rasta, aur wo bhi
   Activity context ke sath.

**Sahih ilaj:** wake ka apna `makeWakeRecognizer(ctx: Context)` — service context, explicit
component enumeration (`queryIntentServices(RecognitionService.SERVICE_INTERFACE)`) se **har**
candidate ko azmana (na ke sirf Google ko), aur har candidate ka naam `wakeRecognizerKind` mein
alag rakhna + DOCTOR mein dikhana. Sath mein: jis component se `suna > 0` mile, usay
SharedPreferences mein yaad rakhna (self-healing selection).

### 4.6 F15 — 🔴 VAD ka floor latch (chillane par bhi wake na khule)

```kotlin
// WS:263-268
if (floorDb <= 0.0) floorDb = d                                    // ← LATCH
if (d < floorDb) floorDb = floorDb * 0.9 + d * 0.1                 // ← sirf NEECHE
val over = d - floorDb
if (over > 14.0) { loud++; quiet = 0 } else { quiet++; if (quiet > 3) loud = 0 }
if (loud >= 3) { report("voice", "awaaz ${…}dB farsh ${…}dB"); break }
```

Floor **kabhi upar nahi jata** aur shuru mein jo mila wo latch. Do nuqsan:

* Farsh ooncha latch (62 dB) → chokhat 76 dB → sirf cheekh par wake. Aap ke log mein exactly yehi.
* Farsh neeche latch (25 dB) → chokhat 39 dB → har sarsarahat par gate → har gate par ek cloud
  session → error 6/7/11 storm.

**Sahih ilaj:** (a) gate khulne ke **pehle 800ms calibration** (khamoshi ka farsh napo — `MicKit.test()`
mein ye logic pehle se maujood hai, `MicKit.kt:153-171`, bas gate mein istemal nahi hua),
(b) floor ko **dono taraf** adapt karne dena (upar dheere: `+0.05`, neeche tez: `-0.1`),
(c) floor ko sane range mein clamp karna (misal 20..50 dB-is), (d) absolute fallback threshold
(agar `floor+14 > 72` to `72` istemal karo), (e) har gate run ke shuru mein floor reset
(abhi `floorDb = 0.0` sirf thread start par hota hai — theek hai, magar latch isi ki wajah se hai).

### 4.7 F16 — 🟠 Gate loop mein infinite CPU spin

```kotlin
// WS:249-256
while (gateOn && running) {
    val n = rec.read(buf, 0, buf.size)
    if (n <= 0) continue            // ← ERROR_DEAD_OBJECT(-6), ERROR_INVALID_OPERATION(-38) sab "continue"
```

Agar mic kisi aur app ne cheen liya, ya HAL mar gaya, ya AudioRecord dead ho gaya → `read()`
negative lotata rahega → thread **100% CPU** par ghoomta rahega, koi report nahi, koi recovery
nahi, wake chup-chaap murda. Aur koi **overall timeout** bhi nahi: gate usoolan hamesha chal sakta hai.

**Sahih ilaj:** (a) `n < 0` par counter, 5 consecutive par `report("gate","read error $n")` +
break + `MicKit.open()` se dobara koshish, (b) gate par max lifetime (misal 90s) → break →
`restart(300)`, (c) spin guard: `n == 0` par 5-10ms sleep.

### 4.8 F18 — 🟡 Watchdog khud clash paida karta hai

```kotlin
// WS:437-441
if (haalBlock() == null) {
    resetRecognizer()
    actuallyStart()          // ← gate chalu hai to MIC DO HATHON MEIN
}
```

`haalBlock()` sirf haal/pausedByApp dekhta hai — **gate ko nahi**. Aam halat mein gate hamesha
chal raha hota hai (yahi uska kaam hai), is liye har 12 minute par ye recognizer ko mic par
thons deta hai jabke `MicKit` ka AudioRecord mic pakde hue hai. Natija: guaranteed `error 3`
(AUDIO) ya `error 8` (BUSY) ya session torn → `error 11` — har 12 minute.

**Sahih ilaj:** `if (haalBlock() == null && !gateOn)`, aur gate chalu ho to sirf `resetRecognizer()`
(next session naye recognizer se khud chalegi).

### 4.9 F03 — 🟠 Skip spam ne hamari aankh phod di

```kotlin
// WS:391-397
val why = haalBlock()
if (why != null) {
    report("skip", why)     // ← har 700ms ek evaluateJavascript
    restart(700)
    return@postDelayed
}
```

`report()` → `evalToApp()` → `WebView.evaluateJavascript()` → JS `KAAN.push()` → `KAAN.log.unshift()`
with `MAX: 40` (`index.html:8223`). Yani:

* **~1.4 bridge calls/second** jab tak block hai (60s = ~85 calls) — background service se main
  thread + WebView par.
* **40-entry ring buffer** is ek line se bhar jata hai → `suna`, `wake`, `err`, `voice` ki asal
  tareekh **mit jati hai**. Aap ka log 90% "sulah: app ka mic" tha — hum andhe ho gaye.

**Sahih ilaj:** (a) blocked halat mein poll 700ms → **3000ms**, (b) skip report **rate-limited**
(har state-change par ek, phir har 15s par ek, aur ek counter `skipN` sath), (c) `KAAN.MAX` 40 →
250 aur **kind-wise quota** (misal `skip` max 12 entries) taake noise history ko na khaye,
(d) counters ko `localStorage` mein persist karna (F24).

### 4.10 F04 — 🟠 Panel ne jhoot bola

```js
// index.html:8315
L.push("  HAAL        : " + (typeof SUKOON !== "undefined" ? SUKOON.haal : "?") + …);
```

Ye **JS** ka haal hai. Kotlin mein `haal="KHALI"` tha *aur* `pausedByApp=true` — aur panel ne
"KHALI" dikha kar humein galat direction mein bhej diya (humne socha "haal theek hai, phir mic
kyun nahi khul raha?").

**Sahih ilaj:** `@JavascriptInterface fun wakeState(): String` — JSON mein Kotlin ka `haal`,
`pausedByApp`, `pausedAt` ki umar, `haalBlock()` ki wajah, `gateOn`, `running`, `starts`, `errs`,
`lastErr`, `errStreak`, `wakeRecognizerKind`, `floorDb`, `wake_lang`. Panel **dono** dikhaye:
`HAAL (JS): KHALI` aur `HAAL (Kotlin): KHALI · sulah: app ka mic (47s) · gate: BAND`.
Aur ek `MISMATCH ⚠️` line jab dono mein farq ho — wahi line is poore bug ko 2 second mein
pakad leti.

---

## 5. ANDROONI SACH — Android ke `SpeechRecognizer` error codes (qanooni fehrist)

Source: AOSP `frameworks/base/core/java/android/speech/SpeechRecognizer.java` +
developer.android.com/reference (API 34).

| Code | Naam | Matlab | Maya ke liye | Hamara backoff (WS:320-329) | ERRNAME (index.html:8303) |
|---|---|---|---|---|---|
| 1 | `ERROR_NETWORK_TIMEOUT` | Network operation timed out | offline/slow data | 3000ms | ✅ "network timeout" |
| 2 | `ERROR_NETWORK` | Other network errors | offline | 3000ms | ✅ "network" |
| 3 | `ERROR_AUDIO` | Audio recording error | **mic clash** (F17/F18) | 1200ms ⚠ | ✅ "audio" |
| 4 | `ERROR_SERVER` | Server sends error status | quota/server | 1500ms | ✅ "server" |
| 5 | `ERROR_CLIENT` | Other client side errors; API≤30 par unsupported language; **`cancel()` ke baad bhi** | hamara apna `sr.cancel()` | 1200ms ⚠ | ✅ "client" |
| 6 | `ERROR_SPEECH_TIMEOUT` | No speech input | gate ne ghalat khola (F15) | 700ms→3.5s ✅ | ✅ "koi awaaz nahi" |
| 7 | `ERROR_NO_MATCH` | No recognition result matched | **"Maya" decode nahi hui" (F12/F22)** | 700ms→3.5s ✅ | ✅ "samajh nahi aaya" |
| 8 | `ERROR_RECOGNIZER_BUSY` | RecognitionService busy | do recognizer (F01/F18) | 2000ms + err8 ✅ | ✅ "recognizer busy" |
| 9 | `ERROR_INSUFFICIENT_PERMISSIONS` | Mic permission nahi | permission revocation | 1200ms ⚠ | ✅ "permission nahi" |
| 10 | `ERROR_TOO_MANY_REQUESTS` | **Too many requests from the same client** | **hamara 1.2s hammer (F09)** | ❌ 1200ms flat | ❌ **missing → "?"** |
| 11 | `ERROR_SERVER_DISCONNECTED` | Server disconnected, e.g. **service/app crashed** | **aap ka case** | ❌ 1200ms flat | ❌ **missing → "?"** |
| 12 | `ERROR_LANGUAGE_NOT_SUPPORTED` | Zubaan is recognizer ko supported nahi (API 31+) | ur-PK + tts service | ❌ 1200ms flat | ❌ **missing** |
| 13 | `ERROR_LANGUAGE_UNAVAILABLE` | Zubaan supported hai magar **download nahi hui** (API 31+) | on-device pack nahi | ❌ 1200ms flat | ❌ **missing** |
| 14 | `ERROR_CANNOT_CHECK_SUPPORT` | Service support check ki ijazat nahi deti | — | ❌ | ❌ **missing** |
| 15 | `ERROR_CANNOT_LISTEN_TO_DOWNLOAD_EVENTS` | Model-download events support nahi (API 34) | — | ❌ | ❌ **missing** |

### 5.1 Error 11 ka asal matlab — aur is device par kyun

AOSP ki wording: *"Server has been disconnected, e.g. because the app has crashed."* Amal mein ye
tab aata hai jab **recognition service ka process/connection beech session mein toot jaye**. Is
device par teen mil kar ye kaam karte hain:

1. **Service kaun hai?** `voice_recognition_service` = `com.google.android.tts` ("Speech
   Recognition and Synthesis"). Android 13+ par Google ne recognition service ko Google app se
   nikaal kar is alag APK mein daal diya; aur **Google app (googlequicksearchbox) is device par
   hai hi nahi** — is liye `makeRecognizer()` ki pehli do seerhiyan (on-device, google) dono
   nakam, aur hum `default` par girte hain (F13). Ye service sab se kamzor rasta hai, khaas tor
   par **background service se bar bar short sessions** ke liye.
2. **Hamara hammer.** Har 1.2 second nayi session (F09). Service process ko bar bar uthana,
   connect karna, todna — OEM (Tecno) ke aggressive memory management ke sath mil kar process
   kill → `SERVER_DISCONNECTED`.
3. **Zubaan.** `ur-PK` (F12) — agar pack/service Urdu ko theek se serve nahi karti to session
   jaldi toot-ti hai; aur jab result aata bhi hai to "مایا" → "ہے" (hamara apna doctor text
   ye kehta hai), yani `suna > 0` ho bhi jaye to `JAAGI 0` rehta.

> **Ahem:** `suna 0` ka matlab hai ke `onResults` **ek dafa bhi** nahi chala. Yani masla
> "wake word match nahi ho raha" nahi — masla "recognizer kuch lotata hi nahi" hai. Matching
> (F22) abhi **test hi nahi hui**. Pehle Zanjeer A + B tootni chahiye, phir matching ka faisla.

### 5.2 `ns:✗` ka matlab

`NoiseSuppressor.isAvailable()` is device par false (ya create nakam) — `MicKit.kt:97-101`.
Iska matlab gate **raw room audio** par RMS chala raha hai: fan, traffic, TV — sab "awaaz".
F15 (floor latch) ke sath mil kar ye wake ko ya behra ya over-trigger karta hai (F20).

### 5.3 Kya ye device offline wake kar sakta hai?

* `AlwaysOnHotwordDetector` / SoundTrigger → **nahi** (default assistant Google Go hai, aur ye
  privileged + default-assistant-only API hai).
* `SpeechRecognizer.createOnDeviceSpeechRecognizer` → API 33+ ✅ magar `isOnDeviceRecognitionAvailable`
  = **false** (zubaan pack download nahi hui) → error 13 ka khatra.
* **Local KWS engine apne PCM par** → ✅ **yahi raasta hai** (§6.3) — humare paas `MicKit` already
  16 kHz mono PCM de raha hai.

---

## 6. ARCHITECTURE KA FAISLA — "next level" ka sahih shape

### 6.1 Jo shape abhi hai (aur kyun ghalat hai)

```
        ┌─────────────── foreground service ───────────────┐
mic ───▶│ MicKit AudioRecord (VAD gate)                    │
        │        │ voice detected                          │
        │        ▼                                         │
        │ SpeechRecognizer #2 ──── CLOUD ────▶ Google svc  │   ← network, quota, OEM kill,
        └──────────────────────────────────────────────────┘     error 10/11/12/13
        ┌─────────────── Activity (WebView) ───────────────┐
mic ───▶│ SpeechRecognizer #1 (tap-to-speak) ── CLOUD ──▶  │   ← DO MIC, DO RECOGNIZER,
        └──────────────────────────────────────────────────┘     EK HI SERVICE = JANG
```

* **Do recognizer ek hi service par** → error 8/11 ka buniyadi sabab. Hum ne is jang ko
  "SUKOON/HAAL arbitration" se *manage* kiya, *khatam* nahi kiya — aur management mein F01/F02
  jaisi race reh gayi.
* **Local kaam ke liye network** → "Maya" sunne ke liye har dafa ek cloud round-trip. Latency
  300ms-2s, quota, aur offline bilkul band.
* **Continuous mic** → battery, Android 14 ka mic indicator, OEM kill.
* **Wake word ka faisla ASR par** → jo cheez *keyword spotting* hai usay *dictation* se karwana:
  Urdu/English decoder "Maya" ko vocabulary-driven tarike se ghalat karte hain (F12/F22).

### 6.2 Options matrix (0-budget, offline, Urdu, CI-feasible)

| # | Option | Offline | APK size | Model size | Urdu "Maya" | CPU | License | CI (Maven) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Vosk** (grammar mode: `["maya","boss","[unk]"]`) | ✅ 100% | +~8MB (lib) | 40-50MB (runtime download) | ✅ Latin/Devanagari "maya" en/hi model se; Urdu model **nahi** | kam | Apache-2.0 | ✅ Maven Central | **sab se tez rasta** — grammar mode = built-in KWS |
| 2 | **Porcupine (Picovoice)** | ✅ | +~2MB | ~1MB + custom keyword | ✅ custom keyword phonetic training (console, free tier + AccessKey) | bohot kam | commercial (free tier) | ✅ Maven | **sab se behtar accuracy/CPU**, magar vendor + key management |
| 3 | **sherpa-onnx KWS** (zipformer) | ✅ | +~15MB (JNI) | 5-70MB | ⚠ English/Chinese models; Urdu nahi | darmiyani | Apache-2.0 | ✅ Maven Central | achha, magar integration effort zyada |
| 4 | **openWakeWord** (TFLite/ONNX port) | ✅ | +libs | ~2-20MB | ⚠ pretrained "Hey Maya" nahi; train karna parega | darmiyani | Apache/MIT | ⚠ | research-grade, hamare liye bhaari |
| 5 | `AlwaysOnHotwordDetector` / SoundTrigger | ✅ | 0 | 0 | ❌ | zero | AOSP | — | ❌ **default assistant + privileged chahiye** — device par Google Go hai |
| 6 | **Cloud ASR ko theek karo** (F01-F19) | ❌ | 0 | 0 | ⚠ (F12 fix ke baad behtar) | kam | — | — | ✅ **P0/P1 zaroori** — magar ye *manzil nahi, pul* hai |
| 7 | **Hybrid: apna PCM → local detector → (optional) ASR confirm** | ✅ | option 1/2 ke mutabiq | wahi | ✅ | kam | — | ✅ | 🏆 **recommended** |

### 6.3 🏆 Recommended shape (Phase 3 ka target)

```
                       ┌── EK mic, EK owner ──┐
mic ──▶ MicKit (16kHz PCM, hamara apna) ──▶ LOCAL DETECTOR (Vosk-grammar / Porcupine)
                                                    │ "Maya" (score ≥ threshold)
                                                    ├─▶ chime + DARWAZA open
                                                    └─▶ ab SIRF hukm ke liye ek ASR session
                                                         (app ka recognizer, foreground, user-initiated)
```

Fayde, seedhe hamare flaws ke hisaab se:

| Flaw jo mit jata hai | Kyun |
|---|---|
| F01/F02/F05/F06/F07/F08 (poori Zanjeer A) | Wake ke liye **doosra recognizer hi nahi** → koi mic sulah, koi pausedByApp, koi HAAL race |
| F09/F10/F13/F14/F19 (poori Zanjeer B) | Koi cloud session nahi → error 10/11/12/13 ka wajood hi nahi |
| F12/F22 | Matching hamare apne keyword model/grammar se — zubaan-decoder ka meraj nahi |
| F20/F21 | Detector ka apna score/threshold; dB paimana sirf pre-gate ke liye |
| offline | ✅ Airplane mode mein bhi wake chalegi (abhi internet zaroori hai — hamara doctor khud ye kehta hai) |
| battery | Ek AudioRecord + chhota model, bar bar cloud handshake nahi |

**Migration ka usool (bagair kuch tode):** LAB mein `wakeEngine: "asr" | "kws" | "auto"` flag.
`auto` = KWS agar model maujood/ready ho, warna ASR (yani aaj ka engine). Dono engines ek hi
`report(kind,payload)` contract istemal karein → KAAN panel, counters, DARWAZA, `__wakeHeard`
**unchanged** rahein. Is se Phase 0-2 ke fixes Phase 3 mein bhi kaam aate rahein ge, aur user
kabhi "wake band" walay daur mein nahi phansega.

---

## 7. STRUCTURE — Phase 0 → Phase 3 (ye plan hai, code nahi)

Har phase: **scope → files → acceptance criteria → test-locks → version**.

### 🩹 PHASE 0 — "wake ko wapas zinda karo" (hotfix, `v5.10.3`, versionCode 74)

**Maqsad:** sirf wo cheezein jo wake ko *murda* kar rahi hain. Koi naya feature nahi, koi naya
dependency nahi, koi UI redesign nahi.

| # | Flaw | Badlaav (file:line) |
|---|---|---|
| 0.1 | F01 | `MainActivity.stopRecognizer()` (262), `onError` (390), `onResults` (393), `onEndOfSpeech` (389), `onDestroy` → `WakeWordService.resumeFromApp()` |
| 0.2 | F05 | Stale-pause 60s → **10s**, aur release se pehle `MainActivity.instance?.recognizer != null` check → agar app ka recognizer zinda hai to release mat karo, sirf `pausedAt` refresh karo |
| 0.3 | F03 | `restart()` blocked-poll 700ms → **3000ms**; skip report **rate-limited** (state-change par 1, phir 15s par 1, sath `skipN` counter) |
| 0.4 | F09 | `onError` backoff table: 10/11/12/13 ke apne cases + `errStreak` se exponential (1.2 → 2.4 → 5 → 10 → 30s cap) + `errStreak>=3` par `resetRecognizer()` |
| 0.5 | F11 | `KAAN.ERRNAME` mein 10..15 add (AOSP naam + Roman-Urdu wazahat) |
| 0.6 | F12 | `wake_lang` ko `settings.stt` se kaatna: nayi setting `wakeLang` (default `en-IN`), migration: purana `wake_lang` pref sirf tab istemal ho jab user ne khud set kiya ho |
| 0.7 | F18 | watchdog: `if (haalBlock() == null && !gateOn)` |
| 0.8 | F10 | `errStreak >= 5` → `report("dead", code)` + `__wakeErr(code)` (toast + pushLog) — **user ka switch kabhi khud mat mitana** (P9 ka wada barqarar) |

**Acceptance criteria (device par, TECNO KL4):**
1. SUNO dabao → bolna khatam → **≤1.5s** mein `pehra shuru` (60s nahi).
2. `roka gaya` counter ek pause cycle mein **≤4** barhe (67 nahi).
3. Airplane mode ON → error 11/2 → **≤3** koshishon ke baad backoff ≥10s aur ek **toast** aaye.
4. STT `ur-PK` rakhte hue wake `en-IN` se sune → KAAN `start: en-IN|N` dikhaye.
5. 12 minute chalu chhodne ke baad log mein `error 3/8` **na** aaye (F18).
6. Panel `nakami … (aakhri: 11 — server disconnected)` dikhaye, "?" nahi.

**Test-locks (`tools/test-lab-engine.js`, +~14 asserts):**
* `resumeFromApp()` **call** hoti hai `stopRecognizer`/`onError`/`onResults`/`onEndOfSpeech` ke andar (declaration nahi — **wiring**).
* `pauseForApp()` ke qareeb koi unmatched release nahi (symmetry check).
* backoff table mein `10`, `11`, `12`, `13` ke cases maujood; `else -> 1200L` akela nahi.
* `ERRNAME` mein keys 1..15 poori.
* `wake_lang` ab `settings.stt` se direct assign **nahin** hota.
* watchdog mein `gateOn` guard maujood.
* blocked-poll `3000` aur skip rate-limit constant maujood.
* stale-pause threshold `10000` (60000 nahi).

**Version/bump:** `app/build.gradle` vc 74 / "5.10.3" · `package.json` · `sw.js` `maya-v5.10.3` ·
`public/` mirror (`npm run build`) · `docs/FIX-v5.10.3-wake-zinda.md` · README test-count.

---

### 🛡️ PHASE 1 — "wake ko mazboot karo" (robustness, `v5.11.0`, versionCode 75)

| # | Flaw | Badlaav |
|---|---|---|
| 1.1 | F02 | **`WakeState`** single source of truth: `haal`, `owner` (`NONE/APP/WAKE/TTS`), `since`, aur har state ki **expiry** (pausedByApp 8s, APP_SUN 30s, BOL_RAHI 20s). `haalBlock()` sirf isi se poochhe |
| 1.2 | F02/F06 | HAAL ko **level-triggered** banana: JS har `sunEnd/bolEnd` par force-send (dedup bypass) + boot par `SUKOON.resync()` + har 10s heartbeat (agar 3 heartbeat miss to Kotlin khud KHALI) |
| 1.3 | F15 | Gate: **800ms calibration** (khamoshi ka farsh, `MicKit.test()` wali logic reuse) + floor **dono taraf** adapt + clamp (20..50) + absolute cap (chokhat kabhi 72 dB se upar nahi) |
| 1.4 | F16 | Gate loop: `n<0` par 5-strike + break + reopen; `n==0` par 8ms sleep; gate par 90s max lifetime |
| 1.5 | F17 | `stopGate()`: `gateThread.join(250)` + `rec.release()` + exit path se `actuallyStart()` post **hatana** (uske bajaye `restart(200)`) |
| 1.6 | F13 | Wake ka apna `makeWakeRecognizer(serviceContext)`: **saare** RecognitionService candidates azmano (har ek par ek chhoti test session), jo chale usay prefs mein yaad rakho (self-healing); `wakeRecognizerKind` alag variable |
| 1.7 | F14 | Wake intent mein session shaping: `COMPLETE_SILENCE_LENGTH_MILLIS=700`, `MINIMUM_LENGTH_MILLIS=300`, `MAX_RESULTS=6`, `PARTIAL_RESULTS=false` |
| 1.8 | F19 | `errStreak` har nayi *successful session* (ya `onReadyForSpeech`) par reset; panel mein "is session" aur "total" alag |

**Acceptance criteria:**
1. Shor wale kamre mein (TV chalu) 10 "Maya" → **≥8** wake; farsh log mein ≤50 dB dikhe.
2. Khamosh kamre mein 1 ghanta TV → **≤1** false wake.
3. Mic kisi aur app ko de kar 30s → log mein `read error` + auto-recovery, CPU spike nahi (`adb shell top` mein service ≤5%).
4. Screen off 30 minute → wake chalu (Activity-destroy ke baad bhi `wakeRecognizerKind` = wahi jo chalta tha).
5. WebView reload ke foran baad wake chalu (resync/heartbeat).

**Test-locks:** `WakeState` expiry constants; `resync()`/heartbeat ka wajood; calibration window;
`n<0` strike logic; `gateOn` false hone par exit-path `actuallyStart()` na hona; wake intent ke
teen silence extras; `wakeRecognizerKind` variable.

---

### 🔭 PHASE 2 — "andhera khatam karo" (observability, `v5.11.1`)

| # | Flaw | Badlaav |
|---|---|---|
| 2.1 | F04 | `@JavascriptInterface fun wakeState(): String` (JSON) → KAAN panel **"HAAL (Kotlin)"** line + `MISMATCH ⚠️` line jab JS/Kotlin farq ho |
| 2.2 | F24 | `KAAN` counters + last-50 events `localStorage` mein persist; reload ke baad bhi history; `KAAN.log` MAX 40 → **250** with kind-wise quota (skip ≤12) |
| 2.3 | F10 | Wake "health" state: `SEHATMAND / BEEMAAR (retry) / MURDA (circuit open)` — HUD par chhota indicator + notification jab MURDA ho |
| 2.4 | F11+ | KAAN panel mein **per-error-code histogram** (`11×15, 7×3, …`) + last successful wake ka waqt + uptime |
| 2.5 | — | **WAKE DOCTOR v2**: ek button jo 60s ka structured self-test chalaye aur ek **copy-paste report** de (device, service candidates, har candidate ka natija, zubaan, floor/SNR, error histogram). Isi report se hum aage ka har forensic 5 minute mein kar sakenge |
| 2.6 | F21 | `MicKit.db()` ko **dBFS** par le jana (documented formula) + calibration note; thresholds ko dBFS mein express karna (misal `-38 dBFS floor`, `-24 dBFS trigger`) |

**Acceptance:** ek fresh install + 5 minute use ke baad user sirf "WAKE DOCTOR v2 → copy" daba
kar humein **poora** forensic de sake — bina adb, bina guess.

---

### 🚀 PHASE 3 — "engine badlo" (local KWS, `v6.0.0`)

**Scope (structure sirf — implementation Phase 0-2 ke baad, aap ke hukum par):**

1. **Spike (1 din, koi commit nahi):** Vosk grammar-mode aur Porcupine dono ka **sirf** detection
   spike — TECNO KL4 par latency, CPU, false-accept napo. Faisla numbers se, raaye se nahi.
2. **Model delivery:** APK mein bundle **nahi** (size). Runtime download + SHA-256 verify +
   `filesDir` unpack + "download nahi hua to ASR engine par wapas" (graceful).
3. **Engine abstraction:** `interface WakeEngine { fun start(); fun stop(); fun report(...) }`
   → `AsrWakeEngine` (aaj ka) + `KwsWakeEngine` (naya). LAB switch `wakeEngine: asr|kws|auto`.
4. **Audio ownership:** ek hi `MicKit` stream dono ko (KWS ko raw PCM, ASR engine ko gate) —
   **kabhi do AudioRecord nahi**.
5. **Contract barqarar:** `report("heard", …)` / `__wakeHeard` / DARWAZA / counters — sab wahi.
   Yani JS ka poora wake-faisla layer **unchanged**, sirf source badalta hai.
6. **Rollout:** `auto` default; 7 din tak ASR-fallback metrics compare; phir `kws` default.

**Acceptance:** airplane mode mein 10/10 wake; CPU ≤4%; ek ghante TV par ≤1 false; APK size
delta ≤10MB; ASR fallback 100% intact (purane devices par kuch na toote).

---

### 7.5 Phase-order ka logic (kyun isi tarteeb mein)

```
Phase 0  → wake ZINDA hoti hai (aaj hi natija dikhega)         [1 din]
Phase 1  → wake MAZBOOT hoti hai (shor, race, mic errors)       [2 din]
Phase 2  → wake NAZAR aati hai (agla har masla 5 min mein pakda jaye) [1 din]
Phase 3  → wake AZAD hoti hai (offline, local, no Google)       [3-5 din]
```

Phase 2 ko Phase 3 se pehle is liye: engine badalne ke baad agar natija ghalat nikla to hamare
paas **napne ka zariya** hona chahiye. Phase 0 ko sab se pehle is liye: wo 8 badlaav aaj ke
toote hue tajurbe ko theek karte hain, chahe Phase 3 kabhi ho ya na ho.

---

## 8. DEVICE VERIFICATION PROTOCOL (TECNO KL4 par, har phase ke baad)

> Har test **teen dafa** chalao (ek device fresh boot ke baad, ek 30 minute background ke baad,
> ek screen-off ke baad) — kyunke F13/F16 jaisi cheezein sirf khaas halat mein aati hain.

| Test | Qadam | Tawaqqu (PASS) |
|---|---|---|
| **T1 — Sulah round-trip** | SUNO dabao, 3 sec bolo, chhodo. LAB → KAAN kholo | `pehra shuru` **≤1.5s** ke andar; `roka gaya` ≤4 |
| **T2 — Wake 10/10** | 1 metre, khamosh kamra, 10 dafa "Maya" (normal awaaz) | `JAAGI` ≥9/10; `suna` ≥9 |
| **T3 — Shor** | TV/pankha chalu kar ke 10 dafa "Maya" | ≥7/10 wake; log mein `farsh` ≤50 dB |
| **T4 — False wake** | 10 minute TV/baatcheet, "Maya" na kahein | `JAAGI` ≤1 |
| **T5 — Offline** | Airplane mode ON, 5 minute chhodo | `dead`/circuit report + **toast**; battery drain normal; koi 1.2s hammer nahi (backoff ≥10s) |
| **T6 — Language** | Settings STT = `ur-PK` | KAAN `start: en-IN\|N` (wake apni zubaan mein) |
| **T7 — 12-min watchdog** | 15 minute chalu chhodo | log mein `error 3/8` **zero** |
| **T8 — Screen off** | 30 minute screen off, phir "Maya" | wake chalti hai; `wakeRecognizerKind` wahi |
| **T9 — Reload desync** | WebView reload (ya app kill + reopen) | ≤2s mein `pehra shuru`; koi `MISMATCH ⚠️` nahi |
| **T10 — Instrument** | KAAN panel kholo | `HAAL (JS)` aur `HAAL (Kotlin)` **dono**; error 11 ka naam likha ho, "?" nahi |

Har test ke baad **panel ka poora text copy kar ke save karo** (`docs/evidence/` mein) — agle
forensic ka raw material yehi hai.

---

## 9. KAMYABI KE HINDASE (numeric targets)

| Hindasa | Aaj | Phase 0 | Phase 1 | Phase 3 |
|---|---|---|---|---|
| Wake success (10 tries, quiet) | **0/10** | ≥6/10 | ≥9/10 | 10/10 (offline bhi) |
| Wake success (10 tries, noise) | 0/10 | ≥3/10 | ≥7/10 | ≥9/10 |
| False wake / hour (TV) | n/a (`suna 0`) | ≤3 | ≤1 | ≤1 |
| SUNO ke baad wake wapsi | **60s** | ≤1.5s | ≤1.0s | ≤0.3s |
| Skip reports per pause cycle | **67** | ≤4 | ≤2 | 0 (concept hi khatam) |
| Longest error-11 streak | **15** | ≤3 (phir circuit open) | ≤2 | 0 |
| Wake latency (bolna → chime) | ∞ | ≤2.0s | ≤1.2s | ≤0.4s |
| Service CPU (idle) | n/a | ≤3% | ≤3% | ≤4% |
| User ko khabar (jab wake mare) | **kabhi nahi** | toast + panel | + HUD | + HUD |

---

## 10. KYA NAHI KARNA (dead ends — dobara mat azmana)

1. ❌ **`EXTRA_PREFER_OFFLINE` blindly lagana** — is device par on-device pack **nahi**
   (`ondevice: nahi`), is liye ye error 13 dega. Pehle pack ka wajood check, phir flag.
2. ❌ **Blind intent try-chains** (`ACTION_ASSISTANT_SETTINGS` waghera) — v5.10.x ka sabaq:
   Android-Go/OEM par ye toot-te hain. Hamesha `resolveActivity`/`queryIntentServices` pehle.
3. ❌ **User ka `wakeWord` switch khud mitana** — P9 ka wada. Circuit open ho to *batao*, switch
   mat chhero.
4. ❌ **`catch (Exception)` API-33 methods par** — `NoSuchMethodError` ek `Error` hai; `Throwable`
   pakdo (v5.10.2 ka sabaq, `MainActivity.kt:1590-1597`).
5. ❌ **Do AudioRecord / do SpeechRecognizer ek saath** — isi se Zanjeer A/B banti hain. Phase 3
   ka poora point yehi hai ke wake ka apna recognizer **na** ho.
6. ❌ **40MB model APK mein bundle karna** — artifact size + install time; runtime download +
   verify + fallback.
7. ❌ **`.github/workflows/*` push karna** — `workflows` permission abhi effective nahi.
8. ❌ **`public/` ko haath se edit karna** — hamesha `npm run build` se mirror; warna web/APK
   diverge (aur tests pakad lete hain).
9. ❌ **edit_file emoji-escape context par** — exact-anchor python replace + `assert count==1`.
10. ❌ **Naye fix ka test-lock "declaration" par lagana** — F01 ka sabak: `resumeFromApp` *likhi*
    hui thi, is liye test green tha. Lock **wiring/call-site** par lagao.

---

## 11. RISK REGISTER

| Risk | Imkan | Asar | Mitigation |
|---|---|---|---|
| Phase 0 ke baad bhi error 11 (service hi kamzor) | **ooncha** | wake offline/beemar rahegi | F10 ka circuit + honest UI ("is phone par wake online hai, abhi beemar"); Phase 3 jaldi |
| `wakeLang=en-IN` se Urdu hukm ghalat sunna | darmiyani | wake ke baad ka command ur-PK hi rahega (wake aur command ki zubaan **alag** hoti hai) — user ko panel par dikhana |
| Vosk/Porcupine model download UX (40MB) | darmiyani | user install ke baad wake "band" samjhe | download-progress UI + ASR fallback (`auto`) + Wi-Fi-only default |
| Gate calibration (F15 fix) se sensitivity kam hona | darmiyani | quiet room mein wake slow | calibration ke baad 3-level sensitivity setting (LAB) |
| `WakeState` refactor se regression | ooncha | mic-larai wapas (v5.8.0 tak ka dard) | Phase 1 ke saath `sukoon` escape-hatch barqarar + T1-T9 poora chalana |
| Kotlin compile error (CI) | darmiyani | ek CI cycle zaya | har phase ke baad source-grep test-locks + local `npm test` (1153+ asserts) |
| Test-count/doc drift | kam | release doc jhoot bolta hai | har release par README + FIX doc + `package.json`/`sw.js`/`build.gradle` ek saath bump |

---

## 12. AGLE QADAM KI FEHRIST (pass 1 ka plan — **ab §15 Structure v2 dekhein**, jo isay supersede karta hai)

- [ ] **A.** Phase 0 implement karo (8 badlaav, `v5.10.3`, +~14 test-locks) → CI green → APK →
      T1/T5/T6/T7/T10 device par
- [ ] **B.** Phase 2 ko Phase 1 se pehle karo (agar aap chahte hain ke har agla masla khud
      pakda jaye) — order aap ka faisla
- [ ] **C.** Phase 1 (robustness) implement karo → T1-T4, T8, T9
- [ ] **D.** Phase 3 ka **spike** (Vosk grammar vs Porcupine) — sirf numbers, koi production code
      nahi; spike ki report `docs/WAKE-KWS-SPIKE.md` mein
- [ ] **E.** WAKE DOCTOR v2 ka report mujhe bhejo (Phase 2 ke baad) — main us par agla forensic
      5 minute mein kar dunga

**Mera mashwara (technical, faisla aap ka):** `A → C → B → D`. Ya agar aap chahte hain ke agla
har masla khud-ba-khud nazar aa jaye to `A → B → C → D`. Phase 0 har surat mein **pehle** —
wo aaj ke toote hue tajurbe ko theek karta hai aur baqi sab ka foundation hai.

---

## 13. 🔬 PASS 2 — doosra, gehra forensic (platform + delivery pipeline)

> Pass 1 ne **logic** dekha (state machine, retry, VAD). Pass 2 ne wo dekha jo pass 1 ke
> daaire se bahar tha: **Manifest/FGS contract, Android 14 ke qawaneen, service ka jaan-na,
> aur "wake sun liya gaya — phir kya?" ki poori delivery chain.**
> Natija: **17 naye flaws (F25–F41)**, jinmein se **3 pass 1 ke sab flaws se zyada bunyadi hain.**

### 13.1 Sab se pehle — jo theek nikla (credit where due)

| Cheez | Halat |
|---|---|
| `FOREGROUND_SERVICE_MICROPHONE` permission | ✅ declared |
| `android:foregroundServiceType="microphone"` | ✅ `WakeWordService` par laga |
| `startForeground(id, notif, FOREGROUND_SERVICE_TYPE_MICROPHONE)` API 34 guard | ✅ `WS:166-170` |
| `<queries>` package visibility (v5.10.1 ka fix) | ✅ poori fehrist, RecognitionService intent bhi |
| `BootReceiver` + `RECEIVE_BOOT_COMPLETED` | ✅ declared — ⚠ magar **andar se khokhla** (F26) |
| `wakeService(true)` se pehle RECORD_AUDIO check | ✅ `MainActivity.kt:547-551` — ⚠ magar JS uska jawab nahi padhta (F39) |
| Notification channel `IMPORTANCE_LOW` (wake) | ✅ sahih |

Yaani Manifest theek hai. **Masla Manifest ke baad shuru hota hai.**

### 13.2 🔴 F25 — "wake sun liya gaya… aur phir KUCH NAHI hua" (sab se bara flaw)

```kotlin
// WakeWordService.kt:365-377
private fun handleAll(list: List<String>) {
    …
    if (MainActivity.instance != null) {
        evalToApp("window.__wakeHeard && window.__wakeHeard('" + jsEsc(payload) + "')")
    } else {
        /* SAFE MODE: app band ho to KUCH NA KARO — v2.10.0 ka khud-app-kholna
           engine hi black screen ka mujrim nikla tha. */
        lastHeardOffline = payload          // ← ye variable KABHI PARA NAHI JATA
    }
}
```

```
$ grep -rn "lastHeardOffline" --include=*.kt .
WS:374:  lastHeardOffline = payload     ← likha
WS:377:  private var lastHeardOffline   ← declare
                                           (parha kahin nahi — DEAD VARIABLE)
```

**Matlab:** screen band ho, app swipe ho jaye, ya OEM Activity maar de → wake word **suni jati
hai, aur uska nateeja seedha kachre mein jata hai**. Na chime, na app khulti hai, na hukm chalta
hai. Aur notification abhi bhi kehti hai *"MAYA hamesha sun rahi hai 👂"*.

Ye wake word ka **asal maqsad** hi khatam kar deta hai: haath khali hon, phone jaib mein ho,
screen band ho — "Maya" bolo. Aaj wo halat 100% bekaar hai.

**Aur iska doosra, chhipa hua asar — hamara diagnostic jhoot bol sakta tha:**
`report()` bhi `evalToApp()` se jata hai, aur `evalToApp()` = `MainActivity.instance ?: return`
(`WS:182-187`). Yaani **KAAN ke saare counters (suna/JAAGI/nakami/mic chala) usi WebView mein
rehte hain jo mar sakti hai.** `suna 0` ka do matlab ho sakta hai:

1. recognizer ne kuch nahi suna (pass 1 ka faisla), **ya**
2. recognizer ne suna, magar WebView zinda nahi tha → counter kabhi barha hi nahi.

**Hum in dono mein farq nahi kar sakte** — kyunke counter aur mareez ek hi jaan hain. Is liye
F25 sirf feature ka bug nahi, **hamari poori forensic ki buniyaad par hamla** hai.

**Sahih ilaj:** counters + last-50 events **Kotlin side** ring buffer mein rakho
(`WakeWordService` ke companion mein), aur WebView zinda hone par bulk-flush karo. Phir
`suna` ka matlab **hamesha** sach hoga — chahe UI mara ho.

### 13.3 🔴 F33 — wake ka **dimaag** WebView mein hai (architecture ki asli ghalti)

Wake ka poora faisla JS mein hai: `__wakeHeard` (`index.html:8626-8685`) — regex matching
(`KAAN.SURE`/`WAKE`/`atStart`), `DARWAZA` ki timing, `SUNO.pick`, `handleUserText`, chime
(WebAudio), `setTimeout(startListening, 400)`.

```
mic → Kotlin (sirf PCM + ASR)  →  WebView JS (poora dimaag)  →  amal
                                    ↑
                        Android ise kabhi bhi maar sakta hai
                        (screen off, memory trim, OEM kill)
```

Yaani: **wake ki zindagi ka dar-o-madar ek UI component par hai** jise OS kabhi bhi band kar
sakta hai. Aur F41 ke mutabiq MainActivity mein `webView.onPause/onResume` ka koi intezam nahi,
is liye background mein JS timers **throttle** hote hain: `setTimeout(startListening, 400)` aur
WebAudio `chime()` screen-off halat mein der se ya kabhi nahi chalte.

**Natija:** screen-off wake teen jagah se toota hua hai — (1) Kotlin result phenk deta hai (F25),
(2) JS throttle hota hai (F41), (3) service marne ke baad koi restart nahi karta (F36).

**Sahih ilaj (Phase 3 ka dil):** wake ka **faisla Kotlin mein** ho. `SURE`/`WAKE`/`atStart`
regexes Kotlin mein port karna mamooli kaam hai (aur inka test-lock JS + Kotlin **dono** par
lagana chahiye taake drift na ho). Phir:

```
wake detect → Kotlin: chime (ToneGenerator/SoundPool) + DARWAZA open
            → WebView zinda? → JS ko hukm bhejo (aaj wala raasta)
            → WebView murda? → launchApp() + native TTS "Ji Boss?" + app ka mic kholo
```

`speakLocal()` aur `launchApp()` **pehle se likhe hue hain** — bas kahin se call nahi hote (F28).

### 13.4 🔴 F26 — BootReceiver **khokhla** hai (reboot ke baad wake OFF)

```kotlin
// BootReceiver.kt:11-17
if (Intent.ACTION_BOOT_COMPLETED == intent.action) {
    try {
        if (context.getSharedPreferences("maya", MODE_PRIVATE).getBoolean("wake", false)) {
            /* SAFE MODE v2.12.1: boot autostart band */ // WakeWordService.start(context)
        }
    } catch (e: Exception) {}
}
```

Pref **parhi** jati hai, phir **kuch nahi kiya jata**. Manifest mein receiver declared hai,
permission declared hai — yaani bahar se "boot par wake chalu hoti hai" lagta hai, andar se band.
Har reboot ke baad wake tab tak OFF jab tak user app **khol** na le (`index.html:9969` wala
1.5s delayed `setWakeService(true)` hi akela healer hai).

**Sahih ilaj:** (a) boot autostart wapas chalu, magar **shart ke sath**: RECORD_AUDIO granted +
FGS start allowed ho, warna notification se user ko batana ("Maya wake chalu nahi ho saki —
mic ki ijazat chahiye"); (b) `startForegroundService` ki jagah `WorkManager`/`setExactAndAllowWhileIdle`
se do-koshishi start; (c) agar "black screen" wala purana dar (v2.10.0) asal mein launchApp se
tha to wo F33 ke naye safe-mode mein hal ho jata hai — boot par app **kholni nahi**, sirf service
chalu karni hai.

### 13.5 🔴 F36 — service marne ke baad **koi zinda karne wala nahi**

```
$ grep -rn "WakeWordService.start" --include=*.kt .
BootReceiver.kt:14      // ← COMMENTED OUT
MainActivity.kt:552     ← JS bridge wakeService(true) — AKELA zinda rasta
```

* `onStartCommand` = `START_STICKY` ✅ magar system restart par `onCreate` dobara chalta hai —
  **sirf agar process mara ho aur Android ne dobara start kiya ho**. Android 14 par FGS-mic
  background restart par **mic-type FGS dobara start nahi hoti** (while-in-use restriction).
* `MainActivity.onResume` mein **koi check nahi** ke wake pref ON hai aur service zinda hai.
* Koi `AlarmManager`/`JobScheduler` heartbeat nahi jo service ki maut pakde.
* `startAsForeground()` ka `catch (e: Exception) {}` (`WS:171`) → agar Android 14 ne
  `SecurityException`/`ForegroundServiceStartNotAllowedException` phenka, service **bina
  foreground ke** chalti rahegi → seconds/minutes mein kill → aur humein **koi khabar nahi**
  (F29).

**Natija:** wake ki availability OEM ke insaaf par chhor di gayi hai. Tecno/HiOS jaisi aggressive
battery management par ye rozana marti hogi — aur user ko sirf "Maya ne jawab nahi diya" lagta hai.

**Sahih ilaj:** (1) `onResume` par `if (prefs.wake && !WakeWordService.alive) start()`;
(2) service apni zindagi ka saboot prefs mein likhe (`wake_lastBeat`), aur ek 15-min
`setExactAndAllowWhileIdle` alarm us beat ko check kare → na mile to restart + report;
(3) `startForeground` ki nakami ko **report** karna (`report("fgs", e.javaClass.simpleName)`)
aur notification ko "wake beemar" halat mein badalna; (4) mic permission na ho to loop hi mat
chalao — user ko saaf batana (F35).

### 13.6 🟠 F38 — settings badlo, service ko **khabar hi nahi hoti** (pref drift)

```js
// index.html:9589-9595 — ye AKELA jagah hai jahan prefs Kotlin ko jate hain
function setWakeService(on){
  window.MayaBridge.setPrefString && (
      setPrefString('wake_lang', settings.stt || 'en-IN'),
      setPrefString('mic_zoom', …), setPref('sukoon', …), setPref('mic_near', …)),
    window.MayaBridge.wakeService(on);
```

`wake_lang`, `mic_zoom`, `sukoon`, `mic_near` **sirf tab** Kotlin ko bheje jate hain jab wake
switch **toggle** ho. `saveSettings()` inhein push nahi karta.

**Natija (aur ye Phase 0 ke liye jaan-leva hai):** user Settings mein STT `ur-PK` → `en-IN` karta
hai, magar wake service **purani `ur-PK`** par chalti rehti hai — jab tak user wake ko OFF/ON na
kare. Yaani:

> ⚠ **Agar hum Phase 0 mein `wakeLang` alag setting bana bhi lein, aur pref-push ka ye rasta
> theek na karein, to fix "kaam nahi karega" lagega — halanke code sahih hoga.** Is liye F38
> Phase 0 ka **hisaa** hona chahiye, Phase 1 ka nahi.

**Sahih ilaj:** `saveSettings()` ke andar ek `pushNativePrefs()` — har settings badlaav par
(wake_lang, mic_zoom, mic_near, sukoon) prefs dobara likho, aur service ko `report("pref", …)`
se batao. Sath mein service har `startListening` se pehle pref **fresh** parhe (abhi bhi padhta
hai ✅ — `WS:409-413`) — yaani sirf likhne wala rasta toota hua hai.

### 13.7 🟠 F28 — `speakLocal()` aur `launchApp()` **dead code** hain

```
$ grep -n "speakLocal\|launchApp()" WakeWordService.kt
173:    private fun speakLocal(text: String) {      ← definition
196:    private fun launchApp() {                   ← definition
                                                   (koi call site NAHI)
```

Do taaqatwar tukre likhe hue the aur **wire nahi kiye gaye**: service ki apni TTS awaaz, aur app
kholne ka rasta. Inhi se F25 ka "SAFE MODE" asal mein kaam kar sakta tha. Sath mein service ek
poora `TextToSpeech` instance (`WS:127-128`) **bekar** mein bandh kar rakhti hai (engine binding +
memory), aur `ttsReady` flag maintain karti hai jo kabhi istemal nahi hota.

⚠ Agar inhein chalu kiya jaye to do cheezein sath karni hongi:
1. `speakLocal()` **haal = BOL_RAHI** set kare, warna service ki apni awaaz gate ko sunai degi →
   **self-wake loop** (L7 shield sirf JS-driven speech ko cover karta hai).
2. `speakLocal()` ki zubaan hardcoded `ur-PK` hai (`WS:175`) — settings se aani chahiye.

### 13.8 🟡 F41 — WebView lifecycle ka **koi intezam nahi**

```
$ grep -n "webView.onPause\|webView.onResume\|pauseTimers\|resumeTimers\|onPause()\|onResume()" MainActivity.kt
(kuch nahi)
```

* `onResume` nahi → **F36 ka ilaj yahan hona chahiye tha** (wake service health check), aur
  **F06 ka resync** (HAAL dobara bhejna) bhi.
* `onPause` nahi → WebView background mein chalta rehta hai (battery), aur chromium ke apne
  background-throttling ke tehat JS timers **der** se chalte hain — jo F33 ke screen-off wake ko
  aur bigarta hai.
* `webViewAlive` flag **maujood hai** (`MainActivity.kt:78`, `markAlive()` :283, boot-guard :130)
  magar `evalAsync()` (:1564-1566) usay **dekhta hi nahi**:
  ```kotlin
  private fun evalAsync(js: String) { webView.post { webView.evaluateJavascript(js, null) } }
  ```
  Yaani murda/destroyed WebView par bhi JS thonsa jata hai → exception ya chup-chaap zaya, aur
  caller ko lagta hai report pohanch gayi (F27).

### 13.9 🟡 F30 — Doze: `WAKE_LOCK` declared, **istemal kahin nahi**

```
$ grep -rn "WakeLock\|newWakeLock" --include=*.kt .   → 0 results
```

Poora engine `Handler.postDelayed` par chalta hai (700ms/3s poll, 45s watchdog, 12-min refresh).
Doze mein ye callbacks **rukte** hain. Sirf gate ka `AudioRecord.read()` CPU ko jagaye rakhta hai —
magar jab gate blocked ho (APP_SUN/BOL_RAHI) ya sessions ke beech ka waqt ho, phone so sakta hai
→ wake behri. Aur notification kehti hai "hamesha sun rahi hai" (F31).

**Sahih ilaj:** chhota `PARTIAL_WAKE_LOCK` (screen-off, service chalu dauran) **ya** kam-az-kam
honesty: notification + panel par "Doze mein wake sust ho sakti hai — battery optimization se
Maya ko azad karein" (`batteryUnrestricted()` pehle se maujood hai, sirf DOCTOR mein dikhta hai).

### 13.10 🟡 F31 — notification **jhoot bolti hai**

`"MAYA hamesha sun rahi hai 👂"` (`WS:158-160`) — static text. Ye inmein se kisi ko reflect
nahi karti: haal (APP_SUN/BOL_RAHI), circuit-open (error-11 storm), mic permission gayab,
WebView murda, FGS start nakam, Doze. Android user ke liye persistent notification hi **source of
truth** hoti hai.

**Sahih ilaj:** notification = live state line (Phase 2 ki `SEHATMAND / BEEMAAR / MURDA` states
isi par map hongi), aur `MURDA` par tap → seedha KAAN panel.

### 13.11 🟡 F35 — error 9 (permission) ka koi khaas ilaj nahi

Agar user mic ki ijazat wapas le le: `MicKit.open()` null → `report("gate","mic nahi khula —
seedha recognizer")` → `actuallyStart()` → `onError(9)` → `else -> 1200L` → **forever hammer**.
Koi "ijazat chahiye" notification nahi, koi loop-break nahi.

**Sahih ilaj:** error 9 par circuit **turant** open + notification action "Ijazat do" + gate/ASR
dono band. Isi tarah error 12/13 par zubaan badalna (F12 ka ilaj) aur 10 par backoff (F09).

### 13.12 Poora register — F25 … F41

| # | Sev | Flaw | Saboot |
|---|---|---|---|
| F25 | 🔴 | WebView murda → wake ka nateeja **phenk** diya jata hai; counters bhi usi WebView mein → `suna 0` ambiguous | `WS:365-377`, `WS:182-187` |
| F26 | 🔴 | BootReceiver khokhla — reboot ke baad wake OFF | `BootReceiver.kt:14` (commented) |
| F27 | 🟠 | `evalAsync` `webViewAlive` check nahi karta; murda WebView par JS; delivery ka koi saboot nahi | `MainActivity.kt:1564-1566` vs `:78,130,283` |
| F28 | 🟠 | `speakLocal()` + `launchApp()` **dead code**; TTS instance bekar mein bandha | `WS:173,196` (0 call sites) |
| F29 | 🟠 | `startAsForeground()` ka `catch {}` — Android 14 FGS nakami chup-chaap nigal jata hai | `WS:145-172` |
| F30 | 🟡 | Doze: `WAKE_LOCK` declared magar 0 istemal; Handler callbacks sote hain | grep = 0 results |
| F31 | 🟡 | Notification static/jhooti — koi state reflect nahi karti | `WS:158-160` |
| F32 | ⚪ | FGS icon `android.R.drawable.ic_dialog_info` (app icon nahi); do channels | `WS:157` |
| F33 | 🔴 | Wake ka **dimaag** WebView JS mein — OS ise kabhi bhi maar sakta hai | `index.html:8626-8685` |
| F34 | ⚪ | `lastHeardOffline` dead variable ("SAFE MODE" = kuch na karo) | `WS:374,377` |
| F35 | 🟡 | error 9 (permission) par forever-hammer, koi user-alert nahi | `WS:320-329` |
| F36 | 🔴 | Service marne ke baad koi restart nahi (boot band, onResume check nahi, heartbeat nahi) | grep: 1 live call site |
| F37 | 🟠 | Screen-off: JS throttle + WebAudio chime unreliable → wake event pohanche to bhi amal nahi | F41 se jura |
| F38 | 🟠 | **Pref drift**: `wake_lang`/`mic_zoom`/`mic_near`/`sukoon` sirf wake-toggle par push hote hain; settings badalne se service ko khabar nahi | `index.html:9589-9595` |
| F39 | 🟡 | `wakeService(on)` ka return ignore → permission na ho to bhi switch ON + "Wake ON" toast | `index.html:9595`, `MainActivity.kt:547-551` |
| F40 | ⚪ | `requestBatteryUnrestricted()` auto-fire; grant hua ya nahi, follow-up check nahi (Play-policy risk bhi) | `index.html:9596` |
| F41 | 🟡 | WebView lifecycle (`onPause/onResume`) bilkul nahi → F36/F06 ke qudrati hooks ganwaye | grep = 0 results |
| F42 | 🟡 | **Concurrent capture**: app ka recognizer (doosra UID: Google service) chalu ho to hamara gate **silence** padh sakta hai → floor ~0 latch → mic khulte hi foran false trigger | `MicKit.kt:65-73` + Android 10+ capture rules; log mein `farsh 28`/`farsh 62` ka flip |

**Qul: 43 flaws** (pass 1: F01–F24 · pass 2: F25–F42 · F43 auto-update §17 mein). Severity: **8 🔴 · 13 🟠 · 12 🟡 · 6 ⚪**
*(F42 ko pass 2 mein hi shamil kiya gaya — ye F15 ke floor-latch ko trigger karne wala mehroz hai.)*

---

## 14. 🌟 NORTH STAR — "perfect" ka matlab kya hai (target spec)

Aap ne poocha: *"bagair kisi kami galati ke flaws ke perfectly next level"*. Ye uski **qabil-e-paimaish**
taareef hai — har line ek test hai, raaye nahi.

### 14.1 Wake ka wada (jo user se kiya jata hai)

| # | Wada | Aaj | Perfect |
|---|---|---|---|
| W1 | "Maya" bolo → **1 second** mein chime | ❌ (∞) | ✅ ≤1.0s (quiet), ≤1.5s (noise) |
| W2 | Screen **band**, phone jaib mein → wake chale | ❌ (F25/F33/F37) | ✅ 10/10 |
| W3 | App **swipe** kar ke band → wake chale | ❌ (F25) | ✅ 10/10 |
| W4 | Phone **reboot** → wake khud chalu | ❌ (F26) | ✅ ≤60s boot ke baad |
| W5 | **Airplane mode** → wake chale | ❌ (cloud ASR) | ✅ 10/10 (Phase 4 ke baad) |
| W6 | Maya bol rahi ho to awaaz **kabhi na kate** | ✅ (SUKOON) | ✅ barqarar |
| W7 | Tap-to-speak ke baad wake **foran** wapas | ❌ 60s (F01) | ✅ ≤1.0s |
| W8 | Wake beemar ho to user ko **pata chale** | ❌ (F10/F31) | ✅ notification + toast + panel |
| W9 | User ka wake switch **kabhi khud off na ho** | ✅ (P9 wada) | ✅ barqarar |
| W10 | 1 ghanta TV → **≤1** false wake | ❓ (`suna 0`, test hi nahi hui) | ✅ ≤1 |
| W11 | Battery: 24 ghante background → **≤3%** extra drain | ❓ | ✅ ≤3% |
| W12 | Koi bhi nakami **log mein namood** ho (UI mara ho tab bhi) | ❌ (F25) | ✅ Kotlin-side buffer |

### 14.2 Engineering ke usool jo is forensic se nikle (aage ke har kaam par lagu)

1. **Har `pause` ka `resume` usi file mein nazar aana chahiye** — aur test-lock *call-site* par,
   declaration par nahi (F01 ka sabaq).
2. **Do state machines ek darwaza na chalayein** — ek `WakeState`, ek source of truth (F02).
3. **Har edge-triggered signal ka level-triggered fallback** (heartbeat/expiry) hona chahiye (F02/F06).
4. **Instrument mareez ke sath na mare** — counters native side, UI sirf display (F25).
5. **Har retry policy mein escalation + cap + circuit-open + user alert** — chaaron, warna wo
   policy nahi, aadat hai (F09/F10).
6. **Har `catch (e: Exception) {}` ek report ka maangta hai** — chup-chaap nigalna mana (F29/F17).
7. **Settings badle to native ko foran pata chale** — warna fix "kaam nahi karta" lagta hai (F38).
8. **Dead code ya wire karo, ya mitao** — `speakLocal`/`launchApp`/`lastHeardOffline` jaisi
   adhoori taaqat confusion paida karti hai (F28/F34).
9. **Jo cheez UI ke zinda rehne par depend kare, wo background feature nahi** (F33).
10. **Notification = sach** — jo state ho wahi likho (F31).

---

## 15. 🏗️ STRUCTURE v2 — Phase 0 → Phase 4 (pass 2 ke baad revised)

Pass 1 ka plan barqarar hai, magar pass 2 ne **tarteeb** badal di: F38 (pref drift) aur F25
(native counters) ke bagair baqi fixes **napne layak hi nahi** rahenge.

```
Phase 0  v5.10.3  "wake ZINDA"        ← 10 badlaav (8 + F38 + F39)          [1 din]
Phase 1  v5.11.0  "wake MAZBOOT"      ← state machine, VAD, recognizer       [2 din]
Phase 2  v5.11.1  "wake NAZAR"        ← native counters, wakeState(), DOCTOR v2, notification [1-2 din]
Phase 3  v5.12.0  "wake KA DIMAAG KOTLIN MEIN"  ← F25/F28/F33/F36/F26/F37   [2 din]
Phase 4  v6.0.0   "wake AZAD (offline KWS)"     ← engine swap               [3-5 din]
```

### Phase 0 (v5.10.3) — pass 1 ke 8 badlaav **+ 2 naye**

| # | Flaw | Badlaav |
|---|---|---|
| 0.1–0.8 | F01, F05, F03, F09, F11, F12, F18, F10 | *(§7 Phase 0 jaisa hi)* |
| **0.9** | **F38** | `saveSettings()` → `pushNativePrefs()`: `wake_lang`/`mic_zoom`/`mic_near`/`sukoon` har settings-badlaav par Kotlin ko. **Ye 0.6 (wakeLang) ke liye zaroori hai** warna fix pohanchega hi nahi |
| **0.10** | **F39** | `setWakeService()` ab `wakeService(on)` ka **Boolean jawab** padhe: false ho to switch wapas OFF, toast "mic ki ijazat chahiye", aur ijazat ka darwaza khule |

**Naye acceptance criteria (0.9/0.10 ke liye):**
* Settings mein STT badlo → **bina wake toggle kiye** KAAN panel par agli `start:` line nayi zubaan
  dikhaye.
* Mic permission deny kar ke wake ON karo → switch **OFF reh jaye**, toast ijazat mange, dialog khule.

**Naye test-locks:** `pushNativePrefs` ka wajood + `saveSettings` se uska call; `setPrefString`
sirf `setWakeService` ke andar na ho; JS mein `wakeService(` ka return istemal hota ho
(`var ok = … wakeService(on)` jaisa pattern); Kotlin `wakeService` ka `return false` path barqarar.

### Phase 1 (v5.11.0) — pass 1 ke 8 badlaav **+ 4 naye**

0.1–1.8 wahi (§7). Naye:

| # | Flaw | Badlaav |
|---|---|---|
| 1.9 | F29 | `startAsForeground()` ke `catch` mein `report("fgs", …)` + `alive=false` set + notification "wake beemar"; mic permission na ho to loop shuru hi na ho (F35) |
| 1.10 | F35 | `onError(9)` → circuit open + notification action "Ijazat do" (direct `openSettingNamed("appinfo")` — v5.10.x ka `go()`/`act()` rasta, blind chain nahi) |
| 1.11 | F42 | Gate ka floor **calibration window** mein tab tak na latch ho jab tak `n>0` aur 3 consecutive frames milein; `read()==0/negative` par floor update **na** ho (silence ko khamoshi samajhna ghalat hai) |
| 1.12 | F41 | `onPause`/`onResume`: resume par HAAL resync + wake-health check; pause par WebView ko explicit background (battery) magar **JS bridge zinda** |

### Phase 2 (v5.11.1) — observability, ab **native-first**

Pass 1 ke 2.1–2.6 wahi, **+**:

| # | Flaw | Badlaav |
|---|---|---|
| 2.7 | F25 | **Kotlin-side ring buffer** (last 60 events + counters) in `WakeWordService` companion; WebView zinda hote hi bulk-flush (`__wakeLogBulk`). Phir `suna`/`nakami` UI ki zindagi se azad |
| 2.8 | F27 | `evalAsync` mein `webViewAlive` guard + delivery counter (`sentOk`/`dropped`) → panel par `reports dropped: N` |
| 2.9 | F31 | Notification live state: `👂 sun rahi hai` / `🎧 app ka mic` / `🔊 bol rahi hai` / `⚠️ beemar (err 11 ×15)` / `☠️ murda — tap karein` |
| 2.10 | F32 | FGS icon app ka apna; channel cleanup |

### Phase 3 (v5.12.0) — **"wake ka dimaag Kotlin mein"** (screen-off wake ka asal ilaj)

| # | Flaw | Badlaav |
|---|---|---|
| 3.1 | F33 | `SURE`/`WAKE`/`atStart`/`DARWAZA` ka **Kotlin port** (`WakeBrain.kt`), JS ke sath **shared test corpus** — ek hi JSON fixtures file dono test suites padhein, taake regex drift pakdi jaye |
| 3.2 | F25/F34 | `handleAll()` ka faisla Kotlin mein: WebView zinda → JS ko hukm (aaj wala rasta); murda → **native path** |
| 3.3 | F28 | `speakLocal()` (haal=BOL_RAHI ke sath, zubaan settings se) + `launchApp()` wire karo; chime ke liye `ToneGenerator`/`SoundPool` (WebAudio nahi) |
| 3.4 | F37 | Native chime + native "Ji Boss?" + app ka mic kholna — sab Kotlin se, JS-throttle se azad |
| 3.5 | F26/F36 | Boot autostart (shart ke sath) + `onResume` health check + 15-min heartbeat alarm + `wake_lastBeat` |
| 3.6 | F30 | Chhota `PARTIAL_WAKE_LOCK` (ya honest Doze warning + battery-exemption CTA) |

**Acceptance:** W2, W3, W4, W8, W12 poore; screen-off 10/10 wake; reboot ke 60s baad wake zinda.

### Phase 4 (v6.0.0) — local KWS engine (§6.3 wala plan, unchanged)

Vosk-grammar / Porcupine / sherpa-onnx ka spike → engine abstraction → `wakeEngine: asr|kws|auto`
→ offline 10/10 (W5).

### 15.1 Tarteeb ka naya logic

```
0 → wake chalne lagti hai (aur hum NAPNA shuru kar sakte hain)
1 → wake tikki rehti hai (race, VAD, mic errors, FGS)
2 → wake nazar aati hai (native counters — ab UI mare to bhi sach milta hai)
3 → wake asal mein kaam aati hai (screen off, app band, reboot)
4 → wake azad hoti hai (offline, no Google, no cloud)
```

Phase 2 ko 3 se pehle is liye rakha gaya ke Phase 3 ka har natija **napa** ja sake. Phase 4 ko
aakhri is liye ke wo sab se bara badlaav hai aur us waqt tak hamare paas both a baseline aur
honest instrumentation hoga.

---

## 16. ✅ "Kuch bhi baqi nahi" ka checklist (pass 2 ke baad)

| Sawaal | Jawaab |
|---|---|
| Kya abhi bhi flaws hain? | **Haan — 42** (8 critical). Pass 2 ne 18 naye pakde, jinmein 4 critical. |
| Kya wake ka code "theek karne layak" hai? | Haan — Phase 0-2 mein. Magar **screen-off/app-band wake** sirf Phase 3 (dimaag Kotlin mein) se mumkin hai; uske bagair wake ka wada adhura rahega. |
| Kya cloud-ASR wake kabhi "perfect" ho sakti hai? | **Nahi** — W5 (offline) kabhi poora nahi hoga, aur error 10/11/12/13 ka khatra hamesha rahega (service hamari nahi). Is liye Phase 4 manzil hai, Phase 0-3 pul. |
| Kya hamara test-suite bharosemand hai? | **Adhoora.** 1153 asserts source-grep hain (code *likha* hai ya nahi) — runtime wiring nahi. F01 iska saboot hai. Har phase mein **wiring-level** locks + ek JSON fixture corpus (JS/Kotlin shared) add honge. |
| Kya instrumentation/Robolectric tests hain? | **Nahi** (sirf JVM source-grep). Phase 2 ke baad kam-az-kam `WakeBrain` ke liye unit tests (pure Kotlin, JVM par chal sakte hain) — ye sab se sasta high-value addition hai. |
| Agla sab se bara risk? | Fix kar ke bhi "kaam nahi kiya" lagna — agar **F38 (pref drift)** aur **F25 (native counters)** sath na hon. Is liye dono Phase 0/2 mein zaroori hain. |

---

## 17. 🔁 AUTO-UPDATE — jo bana hua hai, jo nahi, aur kyun ye wake ke liye zaroori hai

Aap ne poocha tha *"auto update wali baat yaad hai na?"* — forensic ke dauran isay bhi microscope
par rakha gaya. Jawaab teen hisson mein:

### 17.1 ✅ Jo BANA hua hai — web/PWA ka auto-update

| Cheez | Saboot |
|---|---|
| Service worker: HTML **network-first** ("so updates apply immediately"), assets cache-first | `sw.js:1-3` |
| Cache version har release par bump: `maya-v5.10.3` | `sw.js:4` + `public/sw.js:4` |
| `install` → `skipWaiting()`; `activate` → purane caches **delete** + `clients.claim()` | `sw.js:16-31` |
| Registration (sirf `https:` par) | `index.html:8736-8737` |
| **Version-bump discipline** — paanchon jagah ek saath | `build.gradle:14-15` · `package.json:3` · `sw.js:4` · `MainActivity.kt:132` (boot toast) · `MainActivity.kt:286` (`appVersion()`) |
| WebView update **nudge** (v4.0.1) — purana WebView detect → "Play Store se update karo" | `MainActivity.kt:139`, `index.html:1378-1382`, `9648` |

Yaani **getmaya.online / PWA users ko naya version khud-ba-khud mil jata hai.**

### 17.2 ❌ Jo NAHI bana — APK ka in-app auto-update

```
$ grep -n "releases/latest|api.github.com|checkUpdate|latestVersion|downloadApk|
           installApk|DownloadManager|REQUEST_INSTALL_PACKAGES|package-archive"  → 0 hits
$ grep -rn "FileProvider" --include=*.kt  → MainActivity.kt:961 (sirf photo/file SHARE)
```

Aaj APK update ka rasta: **CI run → MAYA-APK artifact → manual download → manual install.**

### 17.3 🔗 Ye wake forensic se kyun juda hai (F43)

1. **Wake word SIRF APK mein hai** — `index.html:9590`: *"Wake word sirf APK version mein hai"*.
   Yaani jo feature sab se zyada fixes maangta hai, wo us raste par **nahi** jata jo auto-update
   hota hai. **Structural be-taali.**
2. Iska natija hum ne apni aankh se dekha: KAAN panel ka apna message *"purani APK hai (v5.10.0 se
   pehle diagnostics thi hi nahi)"*, aur `ERRNAME` ka `"?"`. Aap ke phone par kaun si APK hai, ye
   batane ka koi **automated** rasta nahi (sirf boot toast).
3. **F38 (pref-drift) jaisa trap:** fix ban gaya magar phone tak pohancha nahi → "kaam nahi kiya"
   lagta hai. Auto-update ke bagair humara har forensic adhoora rahega.
4. **Phase 4 (local KWS) isi channel par khara hoga:** ~40MB ka model runtime download + SHA-256
   verify + unpack — ye poora nizam updater ke infrastructure ka hissa hai. Is liye auto-update
   "nice-to-have" nahi, **Phase 4 ki zaroorat** hai.

> **F43 (🟠, register mein izafa): APK ka koi update-channel nahi** — wake fixes user tak sirf
> manual install se pohanchte hain, aur version-mismatch pakadne ka koi zariya nahi.

### 17.4 Design (0-budget, jo cheez pehle se hai usi par)

```
[version.json]  { "versionCode": 75, "versionName": "5.11.0", "url": "…/maya.apk",
                  "sha256": "…", "notes": "…", "minRequired": 74 }
        │  (HTTPS GET, 24 ghante mein ek + app khulne par ek)
        ▼
native compare: BuildConfig.VERSION_CODE  vs  versionCode      ← JS se NAHI (F13 ka sabaq)
        │ naya mila
        ▼
notification + HUD/LAB par "🆕 NAYA VERSION 5.11.0"  →  user dabaye
        │
        ▼
DownloadManager (HTTPS, Wi-Fi-only default)  →  SHA-256 verify  →  FileProvider URI
        │
        ▼
ACTION_VIEW (application/vnd.android.package-archive) + FLAG_GRANT_READ_URI_PERMISSION
        │  (Android 8+: REQUEST_INSTALL_PACKAGES permission)
        ▼
user khud "Install" dabata hai  ← FORCE UPDATE KABHI NAHI
```

**Qawaneen (jo is project ke usoolon se milti hain):**
1. **Force update kabhi nahi** — sirf notification + button. User ka faisla (P9 ka wada).
2. Compare **native `versionCode`** se ho, JS `settings` se nahi.
3. **SHA-256 verify** lazmi — warna adhoora/corrupt APK install ho sakta hai.
4. Download ke dauran wake service ko koi naya haal na dena pare (mic ka koi talluq nahi) —
   magar notification **live state** wali ho (F31 ka ilaj isi mein fit hota hai).
5. `minRequired` se neeche ki APK par **warning** (na ke zabardasti).
6. Purani APK ke sath **backward compatible**: naya JS purane native bridge par bhi chale
   (`if (window.MayaBridge.checkUpdate)` guard — jaise aaj `wakeState` ke sath kiya gaya).

### 17.5 Channel ka faisla — **aap ke do raaste**

| Option | Kaise | 0-budget? | Kaun karega | Meri raye |
|---|---|---|---|---|
| **A** | CI ko `contents: write` de kar workflow mein `gh release create` + APK asset; updater `releases/latest` padhe | ✅ | **Aap** — `.github/workflows/*` push karne ki permission is sandbox mein effective nahi (azmaya ja chuka) | behtar automation, magar rukawat aap ki taraf |
| **B** | APK ko **getmaya.online** par upload + ek chhoti `version.json`; updater usay padhe | ✅ | Aap APK upload karein; **`version.json` main commit kar sakta hun** | ✅ **tajweez** — koi permission issue nahi, host pehle se maujood, aur release ka aadha kaam automated |

### 17.6 Phase plan mein kahan

**Phase 2.5 — "APK ka apna rasta"** (Phase 2 ke baad, Phase 3 se pehle):

* `version.json` + `checkUpdate()`/`downloadUpdate()` bridge + notification action.
* Manifest: `REQUEST_INSTALL_PACKAGES` (+ FileProvider paths mein `filesDir/apk`).
* Test-locks: compare native `versionCode` se · SHA-256 verify maujood · **force-update ka koi
  code path nahi** · purani APK guard (`if (bridge.checkUpdate)`) · Wi-Fi-only default.
* Qubooliyat: purani APK → notification → download → install → boot par `MAYA v5.11.0` toast.

---

## APPENDIX A — Saboot ki fehrist (file:line index)

**`WakeWordService.kt`** (493 lines): 49 `haal` · 51 `pausedByApp` · 73 `applyHaal` · 80-87
`haalBlock` · 85 `"sulah: app ka mic"` · 91 `pauseForApp` · 96 `resumeFromApp` · 119-130
`onCreate` · 129 watchdog 45s · 222 `vadEnabled` (`mic_near`) · 226 `micZoom` · 230-283
`startGate` · 232-233 gate ka haal check · 249-256 read loop · 258-261 loop mein haal check ·
263-265 **floor latch** · 266-268 `over>14`, `loud>=3` · 281 exit → `actuallyStart()` · 285
`stopGate` · 287-296 `startLoop` + `__wakeErr(5)` · 299-304 `resetRecognizer` (Activity context) ·
311-338 `onError` + backoff table · 329 `else -> 1200L` · 340-344 `onResults` · 361-363 `report` ·
365-378 `handleAll` · 379-399 `restart` (skip → `restart(700)`) · 401-428 `actuallyStart` +
intent · 409-413 `wake_lang` · 429-450 `watchdog` · 437-441 12-min reset · 445-447 stale 60s ·
455-457 `sukoonOn` · 459-471 `onHaal` · 474-481 `hardPause` · 482-488 `softResume`.

**`MicKit.kt`** (191 lines): 39 `object` · 41 `RATE = 16000` · 55-58 `bufSize` · 65-115 `open`
(VOICE_RECOGNITION, zoom/dir/NS/AGC/AEC) · 97-101 NoiseSuppressor (`ns:✗` yahan) · 117-124
`release` · 126-133 `db()` (`20·log10(rms)+10`) · 145-190 `test()` (1s quiet floor → SNR) ·
153-171 floor/peak/voiced logic (jo gate mein **istemal nahi hui**).

**`MainActivity.kt`** (1880 lines): 87 `instance = this` · 167 `instance = null` · 262-264
`stopRecognizer` · 277-279 `setHaal` bridge · 345-420 `listen()` · 363 **`pauseForApp()`** ·
378 app-path silence 700ms · 389-393 `onEndOfSpeech`/`onError`/`onResults` · 552/556
WakeWordService start/stop · 1213-1253 `micDoctor()` · 1238 `using = lastRecognizerKind` ·
1582 `lastRecognizerKind` · 1584-1614 `makeRecognizer()` (on-device API33 → googlequicksearchbox
→ default) · 1590-1597 API-33/Throwable guard.

**`index.html`** (10691 lines): 1447/1452/1481 native callbacks + `SUKOON.sunEnd` · 4366 `SR =
webkitSpeechRecognition` (WebView par nahi chalta) · 4373/4384 `sunStart` · 4395/4405/4411
`sunEnd` · 8189-8220 `SUKOON` (8197-8199 **dedup**) · 8221-8348 `KAAN` · 8223 `MAX:40` ·
8229 `WAKE` regex · 8231 `SURE` regex · 8236-8262 `DARWAZA` · 8264-8275 `atStart` · 8277-8286
`push` (counters) · 8290-8299 `match` · 8303-8305 **`ERRNAME` (1..9 only)** · 8308-8348 `report`
· 8312 nakami line · 8315 **HAAL line (JS only)** · 8317 roka line · 8350+ KAAN DOCTOR ·
~8606 "Urdu decoder مایا → ہے" · 8621-8624 `__wakeLog` · 8626-8685 `__wakeHeard` · 8632
`speaking||thinking||listening` early-return · 8667 "koi Maya nahi" skip · 8687-8692 `__wakeErr` ·
9130 `setPref("sukoon")` · 9592 **`wake_lang = settings.stt`** · 9593-9595 `mic_zoom`/`mic_near`/
`wakeService`.

## APPENDIX A.2 — pass 2 ke naye saboot (file:line)

**`AndroidManifest.xml`** (jo **theek** nikla): `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_MICROPHONE`
+ `RECORD_AUDIO` + `WAKE_LOCK` (⚠ declared, 0 istemal — F30) + `RECEIVE_BOOT_COMPLETED` +
`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` · `<queries>` poori (Gboard/Google/tts/AiAi/vending +
RecognitionService + ASSIST + settings actions) · `<service .WakeWordService
android:foregroundServiceType="microphone">` · `<receiver .BootReceiver exported=true>` ·
`compileSdk 34 / targetSdk 34 / minSdk 26` (`app/build.gradle:8,12,13`).

**`WakeWordService.kt`** — 145-172 `startAsForeground()` (157 framework icon, 158-160 static
notification text, 166-170 API-34 `FOREGROUND_SERVICE_TYPE_MICROPHONE`, **171 `catch {}`** = F29) ·
173-181 `speakLocal()` (**0 call sites** = F28; 175 hardcoded `ur-PK`) · 182-187 `evalToApp()`
(`MainActivity.instance ?: return` = F25 ka reporting black hole) · 189-194 `jsEsc` · 196-221
`launchApp()` (**0 call sites** = F28) · 365-377 `handleAll()` (369 `if (instance != null)`,
**374 `lastHeardOffline = payload` dead write** = F25/F34).

**`BootReceiver.kt`** — 8-19: pref `wake` parhi jati hai (12-13), **14 par `WakeWordService.start(context)`
commented out** ("SAFE MODE v2.12.1: boot autostart band") = F26.

**`MainActivity.kt`** — 78 `webViewAlive` (1564-1566 `evalAsync` isay **check nahi karta** = F27) ·
128/130/186-190/283 `webViewAlive` ke istemal (boot-guard, `markAlive`) · 166-171 `onDestroy`
(`instance = null`, `stopRecognizer()` — **`resumeFromApp()` yahan bhi nahi** = F01) · 544-558
`wakeService(start)` bridge (547-551 permission check + `return false`; 552 akela live
`WakeWordService.start` call site = F36) · 1560 `evalAsyncPublic` · **`onPause`/`onResume` overrides
maujood hi nahi** (F41) · 706/717 `PowerManager` sirf `batteryUnrestricted` check ke liye (WakeLock
kahin nahi = F30).

**`index.html`** — 9589-9601 `setWakeService()` (**9592-9595 akela pref-push point** = F38; 9595
`wakeService(on)` ka return ignore = F39; 9596 auto `requestBatteryUnrestricted` = F40) · 9969 boot
healer (`if (NATIVE && settings.wakeWord) setTimeout(setWakeService(true), 1500)`) · 8809-8811 wake
toggle · 9010-9019 settings-change se wake sync (sirf `wakeWas !== wakeWord` par) · 4318-4326
`afterSpeak` ka DARWAZA-driven auto-listen · 8626-8685 `__wakeHeard` = **wake ka poora dimaag** (F33).

**grep ke nateeje (jo ilzaam sabit karte hain):**

```
$ grep -rn "WakeWordService.start" --include=*.kt .
BootReceiver.kt:14:   … // WakeWordService.start(context)     ← COMMENTED
MainActivity.kt:552:      WakeWordService.start(this@MainActivity)   ← AKELA zinda rasta

$ grep -rn "lastHeardOffline" --include=*.kt .
WakeWordService.kt:374:   lastHeardOffline = payload          ← likha
WakeWordService.kt:377:   private var lastHeardOffline = ""    ← declare  (para kabhi nahi)

$ grep -n "speakLocal\|launchApp()" WakeWordService.kt
173:  private fun speakLocal(text: String) {                   ← sirf definition
196:  private fun launchApp() {                                ← sirf definition

$ grep -rn "WakeLock\|newWakeLock" --include=*.kt .            → 0 results
$ grep -n "webView.onPause\|webView.onResume\|pauseTimers\|resumeTimers" MainActivity.kt → 0 results
```

---

## APPENDIX B — Glossary (Roman-Urdu ↔ code)

| Lafz | Code |
|---|---|
| HAAL | `WakeWordService.haal` / `SUKOON.haal` (KHALI · BOL_RAHI · APP_SUN) |
| SULAH | `pauseForApp` / `resumeFromApp` / `pausedByApp` (tap-to-speak ko mic do) |
| PEHRA | VAD gate (`startGate` / `gateThread` / `MicKit`) |
| FARSH | noise floor (`floorDb`) |
| CHOKHAT | trigger threshold (`floorDb + 14`) |
| KAAN | wake-word subsystem + LAB panel (`KAAN` object) |
| DARWAZA | post-wake command window (`KAAN.DARWAZA`, default 15s) |
| SUKOON | audio arbitration layer (JS ↔ Kotlin haal bridge) |
| JAAGI | successful wake (`KAAN.woke`) |
| SUNA | recognizer returned any text (`KAAN.heard`) |
| ROKA | mic door skipped (`KAAN.skips`) |

---

*Ye dastaavez sirf analysis hai — is ke sath koi code change nahi kiya gaya. Implementation aap
ke hukm par, Phase 0 se.*
