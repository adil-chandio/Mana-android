# 🎛️ v5.12.5 — "MIC NAZAR" (J2 ka amal)

> **Forensic:** [`FORENSIC-JAWAB-LOOP.md`](FORENSIC-JAWAB-LOOP.md) (F52, F56, F57 + churn)
> **Aap ki shikayat:** *"mic par on off horha ha jo ke irritating ha... mujhe pata hi nhi
> chalna mic on hua ha ya nhi."*
> **Pehle:** v5.12.0 "JAWAB PAKKA" (jawab chup-chaap marna band) — [`FIX-v5.12.0-jawab-pakka.md`](FIX-v5.12.0-jawab-pakka.md)
> **Tests:** 1320/1320 GREEN · **Build:** ✅ CI GREEN (pehli koshish) · **APK:** 3,225,897 bytes · **Parcha:** [`REPORT-v5.12.5-aam-zubaan.md`](REPORT-v5.12.5-aam-zubaan.md)

---

## 1. Maqsad (ek line mein)

Mic ka haal **hamesha nazar** aaye (rang + lafz + zinda level), aur baat-cheet ke dauran
mic **ek dafa** khule (do dafa nahi) — yani jhilmilahat kam aur **saboot** zyada.

---

## 2. Bara badlaav — `HAALBAR` (naya, `public/index.html`) + `talk` mode (Kotlin)

### 2.1 MIC HAAL BAR (F52)
Header ke neeche ek **saabit patti** (har tab par nazar aati hai — orb ho ya chat):

```
┌──────────────────────────────────────────────────────────────┐
│ 👂 WAKE SUN RAHI — pehra · "Maya" boleyn   ▓▓▓▓░░░░  41dB / farsh 34 │
└──────────────────────────────────────────────────────────────┘
```

| State | Lafz | Rang | Level ka zariya |
|---|---|---|---|
| `wake` | 👂 WAKE SUN RAHI — pehra / kaan khula | sabz | Kotlin `__wakeLevel` (mode 1/2) |
| `talk` | 🚪 BAAT-CHEET — boleyn (Ns) · wake ka mic band | cyan | — |
| `mic` | 🎤 AAP BOLEIN — sun rahi hun | neeli | `__nativeRms` (app mic) |
| `soch` | 🧠 SOCH RAHI (Xs) | peeli | — |
| `bol` | 🔊 BOL RAHI (Xs) | jamni | — |
| `masla` | ⚠️ MASLA: wajah / ⚠️ WAKE sun nahi rahi (Ns se level nahi) | surkh | — |
| `band` | 💤 WAKE BAND — 🎤 dabao aur boleyn | dhundla | — |

**Naya saboot:** level **1.2s** se purana = taaza nahi; **6s** se purana = bar **⚠️ surkh**
ho kar likhta hai *"WAKE sun nahi rahi — Ns se level nahi aaya"*. Pehle `wake ON` likha hota
tha magar wake asal mein murda ho to **koi nishan nahi** tha (F52 ka dusra chehra).

### 2.2 Wake ka ZINDA LEVEL (F57)
`WakeWordService` ab har **300ms** ek halki push bhejta hai: `__wakeLevel(db, farsh, chokhat, mode)`
— **mode 1** = khamoshi ka pehra (gate), **mode 2** = wake ka recognizer (`onRmsChanged`,
jo pehle **khaali** tha). Yani bar wake ke **dono** daur mein saans leta hai.

⚠️ **Ehtiyat:** ye push `report()` se **nahi** guzarti — warna KAAN ka 40-entry log har
300ms bharta aur asal tareekh mit jati (F03 ka sabaq yaad rakha gaya). Sirf `evalToApp()`.

### 2.3 BAAT-CHEET MODE (F56 + churn) — default **ON**, LAB switch ke sath
Darwaza (`KAAN.DARWAZA`) khula ho to JS Kotlin ko `talk(true)` bhejta hai → `WakeState.talkUntil`
set → `haalBlock()` wake ke mic ko **rok** deta hai. Nateeja:

* **Ek turn = ek mic open** (pehle wake ka recognizer + app ka mic = **do**) → open/close
  cycle **aadha**, is liye system mic-dot kam jhilmilata hai.
* Wake ke baad **400ms ki andhi race khatam** (F56): handoff ab **haal dekh kar** hota hai.
* Gate ka **90s reopen bhi isi darwaze se rukta hai** (J2.5) — kyunke `restart()` pehle
  `haalBlock()` se poochta hai.
* **Safety net:** `TALK_EXP_MS = 90s` + heartbeat gayab (3 × 10s) = mode **khud** khatam
  (JS mar jaye to wake hamesha ke liye band nahi rehti). `selfFixes` ginti panel par jati hai.
* Darwaza **sirf ek jagah** se Kotlin jata hai (`HAALBAR.tick()`) — koi doosra caller nahi,
  is liye "koi bhool gaya" wala bug mumkin nahi.
* Baat-cheet ke dauran wake ka **poll dheema** (`TALK_POLL_MS = 10s`, `BLOCKED_POLL_MS` 3s ki
  jagah) — kyunke JS darwaza band hote hi **khud** `talk(false)` bhejta hai. Faida: `nSkip`
  ginti be-matlab nahi barhti (F03 ka "sulah: app ka mic" spam wala sabaq) aur CPU kam jagta hai.

### 2.4 ⚖️ Imaandar line (J2.4)
LAB switch, bar ke `title`, aur panel par saaf likha hai:
> *"Android ka system mic-nishan cloud-wake ki wajah se jhilmilata hai; SAABIT mic sirf
> offline wake (Phase 4) mein."*

J2 jhilmilahat ko **kam** karta hai aur **haal nazar** deta hai — jhoot nahi bolta ke khatam ho gayi.

### 2.5 Bonus — version ka **ek ghar** (instrument ka jhoot)
Header ka subtitle **"PERSONAL AI v5.10.2"** par **jam** gaya tha (koi update nahi karta tha).
Ab `MAYA_VER` constant se toast + log + subtitle teeno bante hain, aur test-lock **gradle ke
`versionName` se milaan** karta hai — yaani APK aur web-asset ka version kabhi chup-chaap alag nahi hoga.

---

## 3. Badlaav ka hisab (forensic ke flaws)

| Flaw | Pehle | Ab |
|---|---|---|
| **F52** | Mic ka haal **nazar hi nahi aata** tha (4px bar sirf app-mic par, wake ka koi nishan nahi) | MIC HAAL BAR — 7 state, 7 rang, lafz + zinda level, **har tab** par |
| **F57** | Wake pehre ka dB Kotlin se JS tak **jata hi nahi** tha | `__wakeLevel` har 300ms (pehra **aur** recognizer) + panel par `level (Kotlin)` line |
| **F56** | Wake ke baad **400ms andhi race** (dono taraf same timing → err 8 / mic jang) | Baat-cheet mode: darwaza khula = wake ka mic band → handoff haal dekh kar |
| **churn** | Har turn par mic **do dafa** open (wake + app) → dot dobara jhilmilata | Ek turn = **ek** mic open (cycle aadha) + `talkTurns` ginti (saboot) |
| **J2.5** | Gate 90s par khud reopen (baat-cheet ke beech mic dobara) | `haalBlock()` baat-cheet mein rokta hai → reopen sirf darwaza **band** par |
| *(naya)* | Header ka subtitle purane version par **jam** | `MAYA_VER` ek ghar + gradle se milaan ka test-lock |

---

## 4. ⚖️ Imaandari — jo is version mein **nahi** hua

1. **System mic-dot mukammal SAABIT nahi hua.** Wo sirf **Phase 4 (offline KWS)** mein mumkin
   hai — jab wake phone par hi sune aur cloud recognizer ka mic cycle hi na ho. J2 ne cycle
   **aadha** kiya hai, khatam nahi.
2. **Raftar abhi wahi hai** (J3): dimaag ki streaming, TTS budget aur silence extra ki
   qeemat (600L) J3 mein. `🧠 SOCH RAHI (Xs)` ab **nazar** aata hai, magar waqt khud kam nahi hua.
3. **Level ka rang-andha (color-blind) istemal:** rang ke sath **lafz** bhi hai (design ka
   usool), magar har state ka apna **icon + lafz** hi asal sahara hai — rang akela nahi.
4. **Wake ka level sirf tab aata hai jab app khuli ho** (WebView zinda). App band ho to bar
   bhi nahi hota — ye Android ki hadd hai, iska ilaj Phase 3 (wake ka dimaag Kotlin mein)
   aur notification-level haal hai.
5. **`talk` mode wake ko rokta hai, `haal` ko nahi.** SUKOON ka nizam (KHALI/BOL_RAHI/APP_SUN)
   apni jagah barqarar hai — do referee ek dusre ke haath nahi pakadte.

---

## 5. 🧪 Test-locks — Section 35 (+23) aur 35b (+16)

* **35.** Bar ka HTML + 7 CSS state (aur banned CSS nahi) · `__wakeLevel` + `__nativeRms`
  wiring · boot tick 250ms · stale warning · Kotlin `LEVEL_PUSH_MS`/`pushLevel`/`onRmsChanged`
  (aur `report()` se **nahi** guzarti) · `stateBits` ke naye fields · `WakeState` talk
  (constants + expiry + json) · `haalBlock` talk check · `onTalk` · bridge `talk()` ·
  JS reconcile **sirf ek jagah** · LAB switch + pref mirror · imaandar line · panel lines ·
  **`MAYA_VER` = gradle `versionName`**.
* **35b.** HAALBAR ko **chalaa kar** parakha (jsdom): saat state ka faisla, level ka pct
  hisab, baat-cheet ka reconcile (ON→OFF), purana level = ⚠️, wake OFF = 💤, aur `report()`.

Kul: **1281 → 1320** (39 naye: 23 wiring + 16 amal). Purane locks sudhare: version bump (vc77/5.12.5) aur
`appVersion`.

---

## 6. ✅ Acceptance criteria — device par (TECNO KL4, Android 14)

1. App khulte hi header ke neeche **patti nazar** aaye (kisi bhi tab par).
2. WAKE ON + khamosh kamra → `👂 WAKE SUN RAHI — pehra` + bar **halka hilta** rahe (level zinda).
3. **"ہے مایا"** → `🎤 AAP BOLEIN` (bolne par bar **uche**) → `🧠 SOCH RAHI (Xs)` → `🔊 BOL RAHI`
   → jawab ke baad **`🚪 BAAT-CHEET`** (dobara "Maya" ke baghair bol saken).
4. Darwaza band hone ke baad (ya "bas" kehne par) → wapas `👂 WAKE SUN RAHI`.
5. Wake service maar dein (ya ijazat wapas lein) → **6 second** ke andar bar **⚠️ surkh**:
   *"WAKE sun nahi rahi"*.
6. LAB → 👂 WAKE WORD KA HAAL → nayi lines: **🎛️ MIC HAAL**, **🛠️ level (Kotlin)**,
   **🚪 BAAT-CHEET** (`turn N`), **🛡️ JAWAB**.
7. 10 minute baat-cheet → `mic chala` ki ginti pehle ke muqable **kam** (ek turn = ek mic).
8. Purani APK ke upar install → toast `MAYA v5.12.5 • 🎛️ MIC NAZAR` + header subtitle **5.12.5**.

---

## 7. 🚦 CI / build

* **Branch:** `arena/01a062e9-mana-android` · **versionCode 77** · **versionName 5.12.5**
* **CI run [33787388417](https://github.com/adil-chandio/Mana-android/actions/runs/33787388417) — ✅ SUCCESS (pehli koshish)** · Kotlin compile clean
  (naye `WakeState.talk*`, `haalBlock()` ka baat-cheet darwaza, `pushLevel()`/`__wakeLevel`
  aur bridge `talk(on)` ke sath)
* **APK:** artifact `MAYA-APK` — **3,225,897 bytes** (v5.12.0 ke 3,219,176 se **+6,721 bytes** = HAALBAR + talk mode)
* **Download:** https://github.com/adil-chandio/Mana-android/actions/runs/33787388417

---

## 📱 RELEASE REPORT — v5.12.5 "MIC NAZAR"  *(Qanoon 9 ka farma)*

### 1. Kya naya hua — aam zubaan mein (code ke naam ke bagair)

* Screen ke upar ek **saabit patti** aa gayi hai jo har waqt batati hai ke mic ka kya haal hai:
  **wake sun rahi** · **aap boleyn** · **soch rahi** · **bol rahi** · **baat-cheet** ·
  **masla** · **wake band** — har ek ka **apna rang aur lafz**, aur sath ek **zinda level bar**.
* Wake ke **andar ki awaaz ki paimaish** ab screen tak aati hai — yani aap **dekh** sakte hain
  ke wake asal mein sun rahi hai ya murda hai (pehle sirf andaza tha).
* **"Maya" kehne ke baad ab mic EK dafa khulta hai** (pehle do dafa: wake ka aur app ka) —
  is se mic ke on/off ka cycle **aadha** ho gaya aur jhilmilahat kam.
* Agar wake **murda** ho jaye to patti **6 second** mein surkh ho kar **likh kar** batati hai.
* App ka version ab header mein bhi **sahi** likha aata hai (pehle v5.10.2 par jam tha).

### 2. Kaise parakhna hai — ✅ PASS aur ❌ FAIL ke nishan

| # | Kya karein | ✅ PASS | ❌ FAIL |
|---|---|---|---|
| N1 | App kholein (kisi bhi tab par) | Header ke neeche **patti** nazar aaye | Koi patti nahi |
| N2 | WAKE ON + khamosh kamra | `👂 WAKE SUN RAHI — pehra` + bar **halka hile** | `💤 WAKE BAND` ya bar bilkul na hile |
| N3 | "ہے مایا" → boleyn | `🎤 AAP BOLEIN` + bolne par bar **uche** | State na badle |
| N4 | Jawab ke baad chup rahein | `🚪 BAAT-CHEET — boleyn (Ns)` aur **dobara "Maya" ke baghair** sun le | Har dafa "Maya" kehna pare |
| N5 | "bas" keh dein / darwaza band | Wapas `👂 WAKE SUN RAHI` | Patti `🚪` par atki rahe |
| N6 | Wake service band (ya ijazat wapas) | ~6s mein **⚠️ surkh** "WAKE sun nahi rahi" | Patti sabz dikhati rahe (jhoot) |
| N7 | LAB → 👂 WAKE WORD KA HAAL | Nayi lines: 🎛️ MIC HAAL · 🛠️ level (Kotlin) · 🚪 BAAT-CHEET · 🛡️ JAWAB | Lines gayab |
| N8 | Version toast + header | `v5.12.5 • 🎛️ MIC NAZAR` aur subtitle **v5.12.5** | Purana version nazar aaye |
| N9 | 10 minute baat-cheet | `mic chala` ginti **kam** (ek turn = ek mic) | Har turn par do mic open |

### 3. Kya abhi bhi adhoora hai (imaandari)

* **System mic-dot poori tarah SAABIT nahi hua** — wo sirf **offline wake (Phase 4)** mein
  mumkin hai. J2 ne cycle **aadha** kiya hai, khatam nahi.
* **Raftar wahi hai** — jaldi sunna/jaldi bolna **J3 "RAFTAR"** mein (streaming, TTS budget,
  0.6s silence). Ab sirf intezar **nazar** aata hai (`🧠 SOCH RAHI (Xs)`).
* Level **sirf app khuli hone par** aata hai (WebView zinda ho). App band → patti bhi gayab.
* Awaaz ki **khoobsurti** (J4) abhi baaki hai.

### 4. Agar kaam na kare — ye bhejein

1. Version toast ka **screenshot** (v5.12.5 nahi to APK purani hai).
2. **Patti ka screenshot** — jis waqt masla hua (rang + lafz + bar).
3. LAB → **👂 WAKE WORD KA HAAL** ka poora screenshot (nayi 4 lines ke sath).
4. Aap ne kya kaha aur patti ne kya dikhaya (tarteeb ke sath).
5. `🚪 BAAT-CHEET` line ka **turn** number (ek turn = ek mic ka saboot).

### 5. Version ki pehchaan

**MAYA v5.12.5 "MIC NAZAR"** · versionCode **77** · native `5.12.5-native` ·
service-worker cache `maya-v5.12.5` · Tests **1320/1320** · J-track: **J1 ✅ J2 ✅**, J3/J4 baaki.
