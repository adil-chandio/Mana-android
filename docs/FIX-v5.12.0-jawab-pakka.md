# 🛡️ v5.12.0 — "JAWAB PAKKA" (J1 ka amal)

> **Forensic:** [`FORENSIC-JAWAB-LOOP.md`](FORENSIC-JAWAB-LOOP.md) (15 flaws F44–F58)
> **Aap ki shikayat:** *"kabhi bolta hun to reply nahi aata, aur mic par on/off hota
> rehta hai jo irritating hai — mujhe pata hi nahi chalta mic on hua ya nahi."*
> **Tests:** 1281/1281 GREEN · **Build:** ✅ CI GREEN (pehli koshish) · **APK:** 3,219,176 bytes · **Parcha:** [`REPORT-v5.12.0-aam-zubaan.md`](REPORT-v5.12.0-aam-zubaan.md)

---

## 1. Maqsad (ek line mein)

Jawab ka loop **chup-chaap marna band** — har rukawat ki ab **muddat**, har nakami ka
**sahi naam**, har nakami ke baad **mic khud dobara**, aur har faisla **log/status par nazar**.

J1 sirf **pakka** karta hai (jawab aana ya batana ke kyun nahi aaya). **Nazar** (mic dot)
J2 mein hai, **raftar** J3 mein — taake ek version mein teen cheezein na badlein aur
nakami ki wajah pehchanna mushkil na ho.

---

## 2. Bara badlaav — `JAWAB` (naya referee, `public/index.html`)

Pehle sunne / sochne / bolne ke teen **flags** the (`listening`, `thinking`, `speaking`)
magar un ka koi **hisab-daar** nahi tha. Ab ek jagah (`var JAWAB = {...}`) ye kaam hote hain:

| Kaam | Kya karta hai |
|---|---|
| `at.{listen,think,speak}` | har kaam ka **shuru ka waqt** (stamp) |
| `watchdog()` — **har 2 second** | teeno stamps ki muddat dekhta hai: **LISTEN 12s**, **THINK 40s**, **SPEAK 20s + 110ms/harf** — zyada hua to khud reset + user ko khabar |
| `thinkGen` | **generation token** — watchdog ne jawab rad kar diya ho to purana jawab aa bhi jaye to **bola nahi jata** (warna do jawab ek sath) |
| `sttError(code)` | AOSP ke **poore 1..15** code ka **sahi naam** + har code ka **apna amal** |
| `hearAgain(why, ms)` | mic dobara kholna (wake band ho to khud mic NAHI khulta) + **circuit breaker** |
| `ignore()` | wake ka ignore — **wajah ke sath** (log + status), aur flag phansa ho to **khud ilaaj** |
| `bol(text)` | bubble + speak + **darwaza refresh** (jawab ke baad mic khud dobara) |
| `report()` | ek-line hisab: watchdog / reset / STT err / mic dobara / ignore / breaker |

---

## 3. Badlaav ka hisab (forensic ke F44–F58)

| Flaw | Pehle | Ab |
|---|---|---|
| **F44** | AOSP ka code **7 = NO_MATCH** hai, magar hum `"Mic permission nahi"` likhte the; 8..15 ke liye sirf `"Voice error"`; Kotlin ijazat ke liye **7** bhejta tha | Poora **1..15** naam; Kotlin ijazat par **9** bhejta hai; JS code 9 par ijazat ka rasta dikhata hai |
| **F45** | Nakami ke baad mic **dobara khulta hi nahi** tha → dobara "Maya" kehna parti thi | Har code ka amal: network par 3 dafa koshish phir **bol kar** khabar; no-match par "dobara boliye" phir 4 par **darwaza band**; mic **khud dobara** |
| **F46** | Koi **watchdog nahi**: `thinking`/`listening` phans jaye to mic button **ulta** kaam karta, wake **daimi ignore**, jawab kabhi nahi | Teen watchdog (12s/40s/adaptive), mic button par **stale-flag reset**, `thinkGen` se **do-jawab** ka khatma |
| **F47** | Kam-yaqeen wala rasta `speak()` ko **bypass** karta tha (`AWAAZ.speak` seedha) → SUKOON nahi → wake apni awaaz par khul sakti thi; aur `return` ke baad mic dobara nahi khulta tha | Wahi baat ab `reply()` ke poore raste se (bubble + speak + SUKOON + afterSpeak → mic khud dobara) |
| **F48** | Silence extra ki **key hi ghalat** thi: `"android.speech.extra.SPEECH_INPUT_…"` jabke AOSP ki key `"android.speech.extras.…"` (**plural**) hai — aur value **Int** thi jabke service **Long** parhti hai → 700ms setting **kabhi be-asar** | Sarkari constant `RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS` + `700L` *(qeemat 700ms barqarar — 600L ka faisla J3 ke NAAP ke baad)* |
| **F49** | Kotlin `listen()` mein `makeRecognizer()/startListening()` par **koi try/catch nahi** → OEM par crash ya JS ka `listening` flag hamesha phansa | `try/catch(Throwable)`: `appMicOn=false` + `stopRecognizer()` + `resumeFromApp()` + JS ko **code 5** (jo bol kar batata hai) |
| **F45+** *(amal mein mila naya flaw)* | Bar-bar nakami par **be-inteha** koshish (har 1–2s mic), chup-chaap | **Circuit breaker (latch)**: 25s ke andar 6 koshishein nakam → darwaza band + **bol kar** khabar |
| **F53** | Wake ka ignore **chup-chaap** (na log, na wajah, na UI) | `JAWAB.ignore()`: wajah KAAN log + status par; flag phansa ho to khud reset kar ke **usi lamhe** sunne ka mauqa |
| **F54** | Dimaag fail par sirf **toast** (awaaz wale ko screen dekhe bina kuch pata nahi) | Retry par **bol kar** khabar: *"…second mein main khud dobara koshish karungi"* |
| **F55** | Darwaza sirf jawab ke **baad** refresh hota tha → lamba jawab baat-cheet ko beech mein tod deta | Darwaza jawab **shuru** par bhi refresh (`reply()` ke pehle line par) |
| **F56** *(wake ke baad 400ms race)* | — | **J2 ka kaam** (conversation mode handoff), is version mein nahi |
| **F58** *(raftar napi nahi jati)* | — | **J3 ka kaam** (RAFTAR PANEL), is version mein nahi |

**Note (F48):** wake wali service (`WakeWordService.kt:855-856`) ye extra **pehle se sahi**
bhej rahi thi (sarkari constant + `700L`/`300L`, v5.11.0 ke 1.7 mein) — ghalat sirf **app ke
tap-to-speak** wale raste (`MainActivity.listen()`) par tha. Yani "Maya" keh kar bolne par
khamoshi ki hadd kaam karti thi, magar SUNO/mic button dabane par nahi. Ab dono raste ek jaise.

**Jo F49–F52, F57 (mic dot / nazar / raftar / awaaz) hain — wo J2/J3/J4 ke hain, is version mein NAHI.**

---

## 4. ⚖️ Imaandari — jo plan se **alag** kiya, aur kyun

1. **THINK watchdog 25s → 40s.** Structure mein 25s likha tha. Amal mein dekha ke dimaag
   ki seedhi (4 keyed + keyless providers) **qanooni** taur par 25s se zyada le sakti hai —
   25s par kaatna *sahi jawab* ka qatl hota. 40s rakha; J3 streaming se ye waqt khud girega.
2. **SPEAK watchdog 60s (saabit) → adaptive `20s + 110ms/harf`.** 1400 harf ka jawab
   ~100 second bolta hai; saabit 60s par Maya apna hi jawab beech mein kaat deti.
3. **Watchdog reset ke baad purana jawab rad** (`thinkGen`). Ye structure mein nahi tha —
   amal mein pata chala ke baghair is ke watchdog aur dimaag **dono** jawab de dete.
4. **Silence extra ki qeemat 700ms barqarar** (600ms J3 ka kaam hai). J1 mein sirf **key +
   type** theek kiya — raftar ka faisla NAAP ke baghair nahi karna tha. Aur haan: Google
   ki service is extra ko **ignore bhi kar sakti hai** (AOSP khud likhta hai "depending on
   the recognizer implementation") — isi liye J3 mein RAFTAR PANEL se naapa jayega.
5. **Mic dot abhi bhi system ka hai** — wo J2 (MIC HAAL BAR) aur mukammal taur par Phase 4
   (offline KWS) ka kaam hai. J1 us jhoot ko **khatam nahi** karta.

---

## 5. 🧪 Test-locks — Section 34 (+19), 34b (+20), Section 24 (+1)

`tools/test-lab-engine.js`:

* **34.** J1 ke wiring-level locks: watchdog stamps, dil (2s interval), `thinkGen` guards
  (dono raste), AOSP map 1..15, code-9 ijazat, `sttError` routing, weak-path `reply()`,
  circuit breaker, `ignore()` wajah, F54 spoken retry, F55 darwaza-at-start, Kotlin
  (code 9 / constant + `700L` / `try/catch(Throwable)`), aur **mirror lock**
  (`public/index.html` ≡ `assets/web/index.html` — byte-level).
* Purana version-lock ab **v5.12.0 / versionCode 76 / cache `maya-v5.12.0`** par.
* Qanoon 9: is version ka FIX + REPORT parcha bhi test se bandha hai.

**34b.** Referee ko **chalaa kar** parakha (jsdom mein asli module): phansa mic 12s par
  reset + mic khud dobara; phansa dimaag 40s par reset + `thinkGen` barhna + bol kar
  khabar; 1400 harf ka jawab **60s par nahi katta** magar budget par katta hai; code 9 par
  ijazat ka paigham aur mic dobara **nahi**; 4 no-match par darwaza band; 3 network par bol
  kar khabar; code 5 par 2 koshish ke baad rukna; **circuit breaker ka latch**; wake OFF par
  khud mic nahi; wake ignore ki wajah + phanse flag par khud ilaaj; `report()` ka hisab.

**Section 24 (+1):** `__wakeHeard` wake-ignore se pehle **referee se poochta** hai (ginti se taala).

Sudhare hue purane taale: version-lock (vc76/5.12.0), `appVersion`, aur `EXTRA_MAX_RESULTS`
ka slice (comment barhne se lock jhoot bolne laga tha).

Kul: **1241 → 1281** (40 naye: 19 wiring + 20 amal + 1 wake-ignore).

---

## 6. ✅ Acceptance criteria — device par (TECNO KL4, Android 14)

1. **"Maya" → sawal → jawab**; jawab ke baad **mic khud dobara** (dobara "Maya" ke baghair).
2. Sawal pooch kar **chup ho jayein** (koi awaaz na aaye) → 12s ke andar mic khud band +
   ya to "dobara boliye" ya "main ruk jati hun" — **kabhi khamosh nahi**.
3. **Airplane mode** kar ke sawal → 3 koshish ke baad **bol kar**: "internet ya Google ka masla".
4. Mic **ijazat wapas** le kar SUNO dabayein → ijazat ka **sahi** paigham (pehle "mic permission
   nahi" ke naam par "dobara try karo" chalta tha), aur **be-inteha loop nahi**.
5. Lamba jawab (3–4 paragraph) → **poora** sunai de (60s par kate nahi).
6. 10 dafa lagatar sawal → har dafa jawab ya **wajah**; LAB → KAAN log mein `sttErr`,
   `reListen`, `watchdog` ki **ginti** nazar aaye.
7. Purani APK ke upar install → toast `MAYA v5.12.0 • 🛡️ JAWAB PAKKA`.

---

## 7. 🚦 CI / build

* **Branch:** `arena/01a062e9-mana-android` · **versionCode 76** · **versionName 5.12.0**
* **CI run [33782568618](https://github.com/adil-chandio/Mana-android/actions/runs/33782568618) — ✅ SUCCESS (pehli koshish)** · Kotlin compile clean
  (J1.4 ke naye `RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS` + `700L`
  aur `try/catch(Throwable)` ke sath)
* **APK:** artifact `MAYA-APK` — **3,219,176 bytes** (v5.11.0 ke 3,211,753 se **+7,423 bytes** = JAWAB module)
* **Download:** https://github.com/adil-chandio/Mana-android/actions/runs/33782568618

---

## 📱 RELEASE REPORT — v5.12.0 "JAWAB PAKKA"  *(Qanoon 9 ka farma)*

### 1. Kya naya hua — aam zubaan mein (code ke naam ke bagair)

* Maya ke sunne, sochne aur bolne par ab ek **ghari** hai: koi cheez atak jaye to **khud**
  theek ho jati hai — pehle atak kar **hamesha** ke liye chup ho jati thi.
* Mic ki nakami par ab Maya **bol kar batati** hai ke masla kya hai (internet? ijazat?
  zubaan ka pack? samajh nahi aaya?) — pehle sirf ek adhoora "Voice error" likha aata tha.
* Nakami ke baad mic **khud dobara** khulta hai — pehle har dafa "Maya" kehna parta tha.
* Bar-bar nakami par ab **ruk kar** batati hai (pehle chup-chaap har second koshish karti rehti).
* Wake ignore hone ki **wajah** ab log aur status par likhi jati hai (pehle bilkul chup-chaap).
* Lamba jawab ab **poora** sunai deta hai (beech mein katne ka khatma).
* Phone ke andar mic ki **setting** (700ms khamoshi) pehle **kaam hi nahi kar rahi thi**
  (ghalat chaabi + ghalat ginti ki qisam) — ab sahi chaabi se jati hai.
* Kuch phone par mic khulte waqt app **crash** ho sakti thi — ab wo rasta bhi sambhala gaya.

### 2. Kaise parakhna hai — ✅ PASS aur ❌ FAIL ke nishan

| # | Kya karein | ✅ PASS | ❌ FAIL |
|---|---|---|---|
| T1 | Purani APK ke upar install karein | Toast: **`MAYA v5.12.0 • 🛡️ JAWAB PAKKA`** | Purana 5.11.0 toast |
| T2 | "Maya" → sawal → jawab → chup rahein | Jawab ke baad mic **khud** dobara (orb sun-ne ki halat mein) | Dobara "Maya" kehna pare |
| T3 | "Maya" → sawal pooch kar **bolna band** | ~12s mein mic band + "dobara boliye" ya "main ruk jati hun" | Khamosh, orb atka hua |
| T4 | Airplane mode ON → "Maya" → sawal | 2–3 koshish ke baad **bol kar**: "internet ya Google ka masla" | Sirf toast, koi awaaz nahi |
| T5 | Settings se mic ijazat wapas → SUNO | **Ijazat** ka paigham + ruk jana (loop nahi) | "dobara try karo" ka be-inteha loop |
| T6 | Lamba jawab mangwayein ("200 lafzon mein…") | Jawab **poora** sunai de | ~60 second par beech mein khatam |
| T7 | LAB → 👂 WAKE WORD KA HAAL / KAAN log | `sttErr`, `reListen`, `watchdog`, `ignore` ki **ginti** | Kuch naya nazar na aaye |
| T8 | 10 minute aam baat-cheet | Har sawal ka jawab **ya** wajah | Kabhi khamoshi, pata na chale kyun |

### 3. Kya abhi bhi adhoora hai (imaandari)

* **Mic ka nazuk dot abhi bhi Android ka apna hai** — "mic on/off horha hai, pata nahi
  chalta" ka mukammal ilaj **J2 (MIC HAAL BAR)** mein hai. J1 ne sirf *chup-chaap marna* band kiya.
* **Raftar** (jaldi sunna/jaldi bolna) **J3** ka kaam hai — J1 mein muddat (timeout) theek ki
  gayi hai, lekin dimaag ki streaming aur TTS budget abhi nahi.
* Silence extra (700ms) **ab sahi jagah jata** hai, magar Google ki service usay ignore kar
  sakti hai — naap J3 mein hoga.
* Jawab ka **dohrana** (wake apni awaaz par khul jana) SUKOON par barqarar hai; J1 ne uske
  naye suraakh (F47) band kiye hain.
* **Offline KWS (Phase 4)** ke baghair system mic-dot ki haqeeqat nahi badal sakti.

### 4. Agar kaam na kare — ye bhejein

1. App ka **version toast** (screenshot) — 5.12.0 nahi to APK purani hai.
2. LAB → **👂 WAKE WORD KA HAAL** ka poora screenshot (KAAN log ke sath).
3. Wo **line** jo status par aayi thi (maslan "🙉 Sun nahi sakti: …" ya "⚠️ …").
4. Kya kaha tha, kya jawab aaya (ya **kuch nahi** aaya) — waqt ke sath.
5. Airplane mode / ijazat wala test ka natija.

### 5. Version ki pehchaan

**MAYA v5.12.0 "JAWAB PAKKA"** · versionCode **76** · native `5.12.0-native` ·
service-worker cache `maya-v5.12.0` · Tests **1281/1281** · J-track: **J1 mukammal**, J2/J3/J4 baaki.
