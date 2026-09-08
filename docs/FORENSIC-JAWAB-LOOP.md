# 🔬 FORENSIC + STRUCTURE — "JAWAB LOOP" (v5.12 → v5.13)

> **Aap ki shikayat (2026-09-03), lafz-ba-lafz:**
> *"wake mode on Hoga, voice sunai bhi de rahi ha, Maya bol bhi Rahi ha. Lekin abhi bhi Kabhi
> Bolta hun to reply nhi aata, or mic par on off horha ha Jo ke irritating ha, samajh NAHI arha
> ha, mujhe pata hi nhi chalna mic on hua ha ya nhi, or me bol rha hun to wapis se reply nhi aata
> Kabhi arha ha Kabhi NAHI arha. isse theek karo. usse sunai jaldi dena chaiye, ache se sunayi
> Dena chaiye, or upper se jaldi response aye, jaldi sune, jaldi bole."*
>
> **Teen bimariyan:** (1) jawab **kabhi kabhi** nahi aata, (2) mic ka **on/off** irritate karta
> hai aur **pata nahi chalta** mic chalu hai ya nahi, (3) **raftar** — jaldi sunna, jaldi bolna.
>
> Ye dastaavez **wake** ki forensic ka **JOD** hai (`FORENSIC-WAKE-WORD.md` = F01–F43).
> Yahan **jawab ka loop** hai: `wake → mic → STT → dimaag → awaaz → dobara mic` — **F44 se F58**.
>
> **Faisla:** pehle STRUCTURE (ye doc), phir amal — Qanoon 2 ke mutabiq.

---

## 0. Loop ka naksha (jahan jahan toota hai)

```
  (A) WAKE PEHRA (Kotlin gate + wake recognizer)     ← F52, F57: mic nishan, level nazar nahi
            │  "Maya" suna
            ▼
  (B) __wakeHeard  → chime → 400ms → startListening   ← F53: chup-chaap ignore; F56: 400ms race
            │
            ▼
  (C) APP MIC (MainActivity.listen → SpeechRecognizer) ← F46: watchdog NAHI; F48: silence Int;
            │                                           F49: exception = deadlock
            ▼
  (D) __nativeSpeech / __nativeSpeechErr               ← F44: galat code-matn; F45: mic dobara
            │                                           NAHI khulta; F47: weak path adhoora
            ▼
  (E) askAI → BRAIN (4 keyed + keyless)                ← F51: streaming nahi; F54: fail par
            │                                           BOLTI nahi
            ▼
  (F) reply → speak → AWAAZ (Fish→Gemini→Edge→Pollen→device) ← F50: network-first = dead air
            │
            ▼
  (G) afterSpeak → DARWAZA khula? → 350ms → (C)        ← F55: darwaza beech mein band
```

**Nateeja:** har teer par ek chup-chaap maut ka raasta hai. Aap ko "kabhi reply aata hai, kabhi
nahi" is liye lagta hai ke **nakami ki koi awaaz nahi** — loop chup-chaap ruk jata hai.

---

## 1. Flaws — F44 se F58 (saboot ke sath)

### 🔴 F44 — error code ka **galat** matlab (sab se bara mujrim)
`public/index.html:1508`
```js
var m = { 1:"Network timeout", 2:"Network error", 3:"Mic masla", 4:"Recognizer busy",
          5:"Voice service error", 6:"Koi awaz nahi mili", 7:"Mic permission nahi" }[code]
        || "Voice error";
```
AOSP ke mutabiq **7 = `ERROR_NO_MATCH`** (Google ne aap ki baat ka koi andaza nahi banaya) aur
**9 = `ERROR_INSUFFICIENT_PERMISSIONS`**. Yani jab aap bolte hain aur Google samajh nahi pata,
Maya kehti hai **"Mic permission nahi"** — bilkul ghalat nishani, aur 8, 10, 11, 12, 13, 14, 15
ke liye sirf **"Voice error"**. (Wake side ka ERRNAME v5.10.3 mein theek hua tha; **app side ka
nahi** — wahi purana sabak dobara.)

### 🔴 F45 — nakami ke baad mic **dobara khulta hi nahi**
`public/index.html:1506-1511` · `4394`
`__nativeSpeechErr` sirf toast + bubble deta hai, **`startListening()` wapas nahi**, aur DARWAZA
refresh nahi hota. Yani ek dafa "no match" ho gaya to baat-cheet **khatam**: aap ko dobara
"Maya" kehna parega. Aap ka tajurba: *"me bol rha hun to wapis se reply nhi aata."*

### 🔴 F46 — sunne ka koi **watchdog nahi** (deadlock)
`public/index.html:4399, 4410` (set) · `1477, 1506` (clear) · `4396`
`listening = true` sirf native callbacks se wapas hoti hai. Agar `onError`/`onResults` **kabhi na
aayen** (recognizer service mar gayi, OEM ne process roka, WebView reload hua) to:
* `startListening()` ka pehla line `if (listening) { stopListening(); return; }` → mic button
  **ulta kaam** karta hai (dabao = band),
* `__wakeHeard` (8779) `if (speaking || thinking || listening) return;` → **wake bhi ignore**,
* orb `listening` par phansa → "mic on hai" ka nishan, magar kuch sun nahi raha.
**Yehi "kabhi reply nahi aata" ki sab se khatarnak shakl hai** — aur iska koi ilaj nahi jab tak
app dobara na kholein. `thinking` aur `speaking` ke sath bhi yehi halat mumkin hai (koi watchdog
nahi).

### 🟠 F47 — "theek se sunai nahi diya" wala rasta **adhoora**
`public/index.html:1487-1493`
Kam-yaqeen (weak confidence) par Maya `AWAAZ.speak(...)` **seedha** bulati hai — `speak()` ke
zariye nahi. Nateeja: `speaking` flag false reh jata hai aur `SUKOON.bolStart()` nahi hota →
**wake ka pehra Maya ki apni awaaz par khul sakta hai** (self-wake), aur us line ke baad
`return` hai — **mic dobara khulta hi nahi** (F45 ka doosra chehra).

### 🟠 F48 — app STT ki session shaping **bekar** (raftar ka pehla mujrim)
`MainActivity.kt:469`
```kotlin
putExtra("android.speech.extra.SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS", 700)   // Int!
```
AOSP is extra ko **`getLongExtra`** se parhta hai. Hum **Int** bhej rahe hain → value **ignore**
→ recognizer apni **default** khamoshi-muddat istemal karta hai (aksar 1.5–2s+). Yani aap bolna
khatam karte hain aur Maya **1-2 second extra chup** rehti hai. Sath `MINIMUM_LENGTH_MILLIS` bhi
nahi. (Wake side ye fix v5.11.0 mein hua — **700L** — magar app side reh gaya.)

### 🟠 F49 — `listen()` mein exception = **double deadlock**
`MainActivity.kt:471-525`
`recognizer = makeRecognizer().apply { … startListening(intent) }` ke gird koi try/catch nahi.
Agar recognizer bana hi nahi (OEM/NoSuchMethod) ya `startListening` phenk de:
* `appMicOn` **true** reh jata hai → wake par pabandi (ab 8-10s expiry bachati hai, pehle 60s thi),
* JS ko koi error nahi jata → `listening` true (F46) → UI phansa.

### 🔴 F50 — awaaz ki seerhi **network-first** = dead air (raftar ka doosra mujrim)
`public/index.html` `AWAAZ.cfg()` + `AWAAZ.speak()`
Default `voiceEngine: "auto"` mein **Fish ON**, **EDGE ON**, phir Gemini neural, phir Pollinations,
**aakhri mein phone ki apni TTS**. Har network teh ka apna waqt/timeout hai — yani pehli awaaz
**1–4 second** baad aa sakti hai (aur agar network dhima ho to aur). Aap ki shikayat *"jaldi
bole"* isi ki hai. **Koi hard budget nahi** ke "itne ms mein awaaz na aayi to phone ki TTS foran".

### 🟠 F51 — dimaag se **streaming nahi** (poora jawab, phir awaaz)
`public/index.html:7074 askAI()`
`await geminiChat()` / `brainAsk()` **poora** jawab laate hain, phir `reply()` → `speak()`. Yani
dimaag ki poori generation (1–4s) ke baad **pehla lafz** banta hai. Streaming hoti to pehla jumla
~300-600ms mein bolna shuru ho jata aur baqi generate hota rehta.

### 🔴 F52 — mic ka haal **nazar hi nahi aata** (aap ki asli takleef)
`public/index.html:605, 722, 1503`
* `.micbar` sirf **4-5px** patli, sirf **app-mic** ke dauran (native RMS se),
* **wake pehra** ke dauran koi nishan NAHI — na level, na haal (sirf chhota orb state),
* Android ka **system mic dot** har cycle par jhilmilata hai (gate mic kholta hai → band karta
  hai → wake recognizer kholta hai → band → app mic…). Ye **design ka natija** hai, bug nahi —
  magar user ke liye **confusing** aur irritating.
* `setOrb()` ke states `idle/listening/thinking/speaking` hain — **"wake sun rahi"** aur
  **"mic band"** ke liye koi wazeh nishan nahi.

### 🟠 F53 — wake ka **chup-chaap ignore** hona
`public/index.html:8779`
`if (speaking || thinking || listening) return;` — koi log nahi, koi wajah nahi, koi UI nishan
nahi. Agar F46 ki wajah se flag phansa ho to wake **hamesha** ignore hoti rahegi aur aap ko
kabhi pata nahi chalega ke **kyun**.

### 🟠 F54 — dimaag fail par Maya **bolti nahi**
`public/index.html:7125-7135`
Saare brains fail → sirf **toast** + chup-chaap 5-45s baad retry. Voice mode mein user ko
**kuch sunai nahi deta** → "Maya ne ignore kar diya". (Toast phone ki screen par chhota aur
kuch second ka hota hai.)

### 🟠 F55 — DARWAZA lambe jawab ke beech **band** ho jata hai
`public/index.html:4345-4356` + `8293` (default 15s)
Darwaza `afterSpeak` par refresh hota hai — yaani jawab **bolne ke BAAD**. Agar dimaag + awaaz
mil kar 15s se zyada le lein to darwaza **beech mein** band → `afterSpeak` dobara mic nahi
kholta → baat-cheet achanak khatam. (Aap ko lagega "Maya ne sunna band kar diya".)

### 🟡 F56 — wake ke baad **400ms ka race**
`public/index.html:8831` + `WakeWordService.onResults → restart(400)`
Wake ka jawab aane ke baad JS 400ms ruk kar mic kholta hai; Kotlin side bhi ~400ms baad gate
kholne ki koshish karta hai. Dono ka waqt **takraya** to app mic ko error 8 (busy) milta hai →
jawab gaya. (Sulah maujood hai magar **timing** dono taraf ek jaisi hai — yehi race hai.)

### 🟡 F57 — wake pehre ka **level** Kotlin se JS tak nahi jata
`WakeWordService` gate loop `d` (dB) har frame par nikalta hai magar sirf trigger par report
karta hai. Is liye UI mein "wake sun rahi hai" ka **zinda saboot** (level bar) dikhaya hi nahi
ja sakta.

### ⚪ F58 — raftar **napi** nahi jati (saboot ka ghair-maujood hona)
`NAAP` module maujood hai (`public/index.html:1687`) magar (a) flag ke peechay hai, (b) baat-cheet
ke UI mein nahi dikhta, (c) TTS-ki-pehli-awaaz ka mark nahi rakhta. Yani "jaldi ho gaya" ka
**saboot** humare paas nahi — sirf andaza.

---

## 2. ⚖️ IMAANDARI — jo theek NAHI ho sakta (aur uska hal)

**Android ka system mic-dot jhilmilana poori tarah khatam nahi ho sakta** jab tak wake
**internet ASR** (Google) se sunti hai. Wajah: Google ka recognizer mic khud kholta aur band
karta hai, aur hamara VAD pehra bhi mic kholta/band karta hai — do alag client, do cycle.

| Rasta | Mic dot | Internet | Kaam |
|---|---|---|---|
| Aaj (cloud wake + VAD gate) | **jhilmilata** hai | zaroori | chalta hai |
| J2 ke baad (kam cycle + conversation mode) | **kam** jhilmilata (ek turn = ek open) | zaroori | chalta hai |
| **Phase 4: offline KWS** (Vosk/Porcupine/sherpa) | **saabit** (ek hi stream hamesha khula) | **nahi** | 3-5 din ka kaam |

Is liye J2 mein hum **cycle kam** karenge aur UI mein **saaf likhenge** ke ye nishan kyun
jhilmilata hai — jhoot nahi bolenge ke "theek ho gaya".

---

## 3. 🏗️ STRUCTURE — 4 phase (aap ki tarteeb mein)

Aap ne teen cheezein mangi hain; unki **tarteeb** yehi sab se sahi hai: pehle **jawab pakka**
(warna raftar ka koi faida nahi), phir **mic nazar** (warna aap andhere mein hain), phir
**raftar** (jab loop bharosemand ho to usay tez karo).

```
J1  v5.12.0  "JAWAB PAKKA"   ← har nakami bolti hai, koi deadlock nahi        [1 din]
J2  v5.12.5  "MIC NAZAR"     ← mic ka haal SAAF nazar, cycle kam              [1 din]
J3  v5.13.0  "RAFTAR"        ← jaldi sune, jaldi bole, streaming, saboot      [1-2 din]
J4  v5.13.5  "SAAF AWAAZ"    ← Urdu awaaz ki bariki, jumla-ba-jumla, volume    [0.5 din]
P4  v6.0.0   "WAKE AZAD"     ← offline KWS: mic dot SAABIT, bina internet     [3-5 din]
```

### 🛡️ J1 — v5.12.0 "JAWAB PAKKA" (F44, F45, F46, F47, F49, F53, F54, F55)

| # | Badlaav |
|---|---|
| **J1.1** | `__nativeSpeechErr` ka **poora AOSP map 1..15** (Roman Urdu matn + har code ka **amal**): `6/7` → *"Sunai nahi diya, dobara boliye"* + **foran mic dobara** + darwaza refresh; `8` → 700ms baad dobara; `9` → ijazat ka darwaza + **bol kar** batana; `1/2/11` → *"internet masla"* + 1 retry; `12/13` → zubaan badalne ka mashwara; `10` → 5s ruk kar |
| **J1.2** | **Teen watchdog**: `LISTEN 12s` · `THINK 25s` · `SPEAK 60s`. Har ek par: flags reset + orb reset + **bol kar** khabar + log + wake wapas. Aur `startListening()` ka "ulta kaam" (toggle) khatam — phansa flag ho to pehle reset |
| **J1.3** | Weak-confidence rasta `speak()` ke zariye (SUKOON + `speaking` flag) + **mic dobara** khule (F47) |
| **J1.4** | `MainActivity.listen()` par `try/catch` + `appMicOn=false` + JS ko foran error code (F49 deadlock khatam) |
| **J1.5** | `__wakeHeard` ka ignore **log + UI reason**: `wake ignore — Maya bol rahi hai (12s se)`. Agar flag **20s** se purana ho to khud reset (stuck-flag self-heal) |
| **J1.6** | Dimaag fail → **bol kar** khabar: *"Dimaag se rabta nahi ho raha — 10 second mein khud koshish karti hun"* + retry countdown UI par |
| **J1.7** | DARWAZA refresh **jawab shuru hote hi** (sirf baad mein nahi) → lambe jawab baat-cheet ko na toden (F55) |

**Acceptance (device par):**
1. 20 dafa bol kar baat karein → **20/20** mein ya to jawab aaye **ya bol kar wajah** bataye. **Chup-chaap khamoshi = FAIL.**
2. "no match" (jaldi/adhura bolna) → **2 second** ke andar mic dobara khule (dobara "Maya" na kehna pare).
3. Mic 30s tak phansa chhoden (bolna hi nahi) → **12s** par khud reset + khabar + wake wapas zinda.
4. Airplane mode par jawab mangein → **bol kar** "internet masla" kahe, phir khud retry kare.
5. Lambe jawab (15s+ awaaz) ke baad baat-cheet **jaari** rahe (darwaza beech mein band na ho).
6. App 1 ghanta khuli chhod dein → orb ka haal **asal** haal se milta ho (koi phansa hua "listening" nahi).

---

#### ✅ J1 ka AMAL — v5.12.0 "JAWAB PAKKA" SHIPPED (1281/1281 test GREEN)

Tafseel: [`FIX-v5.12.0-jawab-pakka.md`](FIX-v5.12.0-jawab-pakka.md) · parcha:
[`REPORT-v5.12.0-aam-zubaan.md`](REPORT-v5.12.0-aam-zubaan.md)

Naya module **`JAWAB`** (jawab ka referee) `public/index.html` mein `reply()` se pehle:
`at.{listen,think,speak}` stamps · `watchdog()` har 2s · `thinkGen` generation token ·
`ERRNAME` 1..15 · `sttError()` · `bol()` · `hearAgain()` · `reset()` · `ignore()` · `report()`.

**⚖️ Imaandari — plan se ye 6 barikiyan badlin (wajah ke sath):**

| Plan | Amal | Wajah |
|---|---|---|
| `THINK 25s` | **40s** | dimaag ki seedhi (4 keyed + keyless providers) qanooni taur par 25s se zyada le sakti hai — 25s par kaatna **sahi jawab** ka qatl tha |
| `SPEAK 60s` (saabit) | **20s + 110ms/harf** (adaptive) | 1400 harf ka jawab ~100s bolta hai; saabit hadd par Maya apna hi jawab kaat deti |
| `1/2/11` → 1 retry | **3 dafa** (1.5s gap), phir **bol kar** khabar | ek retry aksar kaafi nahi hota; teesri ke baad rukna + batana behtar hai |
| `6/7` → **foran** mic dobara | pehli nakami par **"dobara boliye" bol kar** (afterSpeak khud mic kholta hai), baad mein 500ms, **4** par darwaza band | bolna khud mic khol deta hai — dobara kholna dohra hota; aur be-inteha "dobara boliye" irritating hai (aap ki shikayat) |
| `8` → 700ms | **800ms** | mamooli farq; mic masroof hone par thora sa sabar behtar |
| (plan mein na tha) | **circuit breaker (F45+)** + `thinkGen` + code **5/14/15** ka rasta | amal mein pata chala: baghair breaker ke koi bhi code be-inteha loop bana deta hai; baghair `thinkGen` ke watchdog aur dimaag **dono** jawab dete |

**J1.4 ka natija (F48 ka *sahi-chaabi* hissa — qeemat J3 ki):** `MainActivity.listen()` ki silence-extra chaabi **ghalat** thi
(`"android.speech.extra.…"` — AOSP ki chaabi `"android.speech.extras.…"` **plural** hai) aur
value **Int** thi (service `getLongExtra()` parhti hai) → wo 700ms **kabhi be-asar** raha.
Wake wali service (v5.11.0) pehle se sahi thi; ab dono raste barabar. Ijazat ka code bhi
**7 se 9** kiya gaya (AOSP: 7 = NO_MATCH, 9 = INSUFFICIENT_PERMISSIONS).

**Kya abhi BAQI hai (isi track mein):** mic ka **nazuk dot** aur "pata nahi chalta mic on hua"
ka mukammal ilaj **J2** mein; **raftar** **J3** mein. Silence extra ki **qeemat** (600L) bhi J3
ka faisla hai — J1 ne sirf usay **be-asar se ba-asar** kiya hai.

---

### 🎛️ J2 — v5.12.5 "MIC NAZAR" (F52, F56, F57 + churn)

| # | Badlaav |
|---|---|
| **J2.1** | **MIC HAAL BAR** — hamesha nazar aane wali, bari, be-ambiguity patti: `👂 WAKE SUN RAHI` · `🎤 AAP BOLEIN` (live level) · `🧠 SOCH RAHI (Xs)` · `🔊 BOL RAHI` · `💤 WAKE BAND` · `⚠️ MASLA: wajah`. Har state ka **apna rang** aur **text** (sirf icon nahi — icon andhere mein kaam nahi karta) |
| **J2.2** | Wake pehre ka **live level** Kotlin se (har ~300ms ek dB) → `👂` state mein **saans leta hua bar**: aap DEKH saken ke wake asal mein sun rahi hai (F57) |
| **J2.3** | **CONVERSATION MODE**: darwaza khula ho to wake recognizer **beech mein na aaye** — app mic turn-by-turn foran dobara. Ek turn = **ek** mic open (pehle do) → cycle aadha, dot ka jhilmilana kam (F56 ka race bhi khatam: 400ms ki jagah haal dekh kar handoff) |
| **J2.4** | UI mein **imaandar line**: "Android ka mic nishan cloud-wake ki wajah se jhilmilata hai; offline wake (Phase 4) mein saabit rahega" — jhoot nahi, haqeeqat |
| **J2.5** | Gate ka 90s reopen sirf tab jab **darwaza band** ho (conversation ke dauran mic dobara na khule) |

**Acceptance:**
7. Har waqt screen par **ek nazar** mein pata chale mic ka haal — 5 state, 5 rang, text ke sath.
8. `🎤 AAP BOLEIN` par bolne se **bar hile** (live level) — aur chup ho to bar gire.
9. `👂 WAKE SUN RAHI` par bhi bar halka hile (Kotlin level) — wake ke zinda hone ka saboot.
10. Ek turn mein log mein **ek** hi `mic chala` entry (do nahi) → cycle aadha.
11. 10 minute ki baat-cheet mein system mic-dot ke **open/close events** pehle se kam (log ginti se saboot).

---

#### ✅ J2 ka AMAL — v5.12.5 "MIC NAZAR" SHIPPED (1320/1320 test GREEN)

Tafseel: [`FIX-v5.12.5-mic-nazar.md`](FIX-v5.12.5-mic-nazar.md) · parcha:
[`REPORT-v5.12.5-aam-zubaan.md`](REPORT-v5.12.5-aam-zubaan.md)

Naya JS module **`HAALBAR`** (MIC HAAL BAR) + Kotlin mein **`WakeState.talk*`** (baat-cheet
mode) + `WakeWordService.pushLevel()` (zinda level).

| Plan | Amal | Wajah |
|---|---|---|
| 5 state, 5 rang | **7 state, 7 rang** (`wake` · `talk` · `mic` · `soch` · `bol` · `masla` · `band`) | `talk` (darwaza khula, mic band) aur `masla` alag karna zaroori tha — warna "mic khula hai ya nahi" ka jawab ambiguous rehta |
| level Kotlin se har ~300ms | wahi, magar **do mode**: 1 = pehra (gate), 2 = wake ka **recognizer** (`onRmsChanged`, jo pehle **khaali** tha) | gate sirf khamoshi naapta hai; wake ke "kaan khule" daur ka level warna milta hi nahi |
| (plan mein na tha) | **level purana = ⚠️** (1.2s taaza, 6s = surkh "WAKE sun nahi rahi") | F52 ka dusra chehra: `wake ON` likha ho aur wake murda ho — bar ko **jhoot bolna mana** hai |
| (plan mein na tha) | `TALK_POLL_MS = 10s` (baat-cheet mein wake ka poll dheema) | JS darwaza band hote hi khud `talk(false)` bhejta hai; 3s poll se `nSkip` ginti be-matlab barhti (F03 ka sabaq) |
| (plan mein na tha) | **`MAYA_VER` ek ghar** (header subtitle + toast + log) + gradle se milaan ka lock | Header ka subtitle **v5.10.2** par jam tha — instrument apni pehchaan ka jhoot bolta tha |
| conversation mode default ON | wahi (malik ka faisla) + **LAB switch** + 90s/heartbeat safety net | JS mar jaye to wake daimi band na rahe |

**Kya BAQI hai:** mic-dot **SAABIT** sirf Phase 4 (offline KWS) mein — J2 ne cycle **aadha**
kiya. **Raftar J3** mein (streaming, TTS budget, 600L silence). **Awaaz ki bariki J4** mein.

---

### ⚡ J3 — v5.13.0 "RAFTAR" (F48, F50, F51, F58)

| # | Badlaav |
|---|---|
| **J3.1** | App STT shaping **Long** extras se: `COMPLETE_SILENCE_LENGTH_MILLIS=600L`, `MINIMUM_LENGTH_MILLIS=300L`, `MAX_LENGTH_MILLIS=15000L` → bolna khatam hone ke **~0.6s** baad mic band (pehle 1.5-2s+) |
| **J3.2** | **TTS fast-path budget**: neural teh ko **800ms**; us mein awaaz shuru na hui to **phone ki TTS foran** (dead air khatam). Chhote jawab (<120 char) aur voice-mode ke "Ji Boss?" jaise tukron par **device-first** |
| **J3.3** | **STREAMING**: dimaag ka **pehla jumla** aate hi bolna shuru; baqi jumle queue. Perceived latency 2-5s → **<1s** |
| **J3.4** | Prompt ka bojh kam (context ki chhant) → generation tez |
| **J3.5** | **RAFTAR PANEL** (NAAP se): har turn ke numbers — `suna Xms · dimaag Yms · pehli awaaz Zms · kul Wms` + aakhri 10 turn ka average. **Saboot, andaza nahi** |

**Acceptance:**
12. Bolna khatam → **1 second** ke andar Maya ka pehla lafz (RAFTAR panel ka `kul` ≤1000ms, 10 turn average).
13. Airplane mode ON → awaaz **2 second** ke andar shuru ho (device TTS fast-path) — 4 second dead air nahi.
14. RAFTAR panel har turn ke numbers dikhaye aur average barqarar rakhe.

#### ✅ J3 ka AMAL — v5.13.0 "RAFTAR" SHIPPED (1375/1375 test GREEN)

Tafseel: [`FIX-v5.13.0-raftar.md`](FIX-v5.13.0-raftar.md) · parcha:
[`REPORT-v5.13.0-aam-zubaan.md`](REPORT-v5.13.0-aam-zubaan.md)

Naya JS module **`RAFTAR`** (stream + jumla-dar-jumla awaaz + kill-switch), naya
**`geminiStream()`** (`:streamGenerateContent?alt=sse`), `AWAAZ.FAST` budget,
`NAAP` mein **`first`** (pehli awaaz) mark, aur **NAZAR** ki pakkaai
(`lookRetry` + `say` + counters + default ON).

| Plan | Amal | Wajah |
|---|---|---|
| J3.1 silence `600L` | **wahi 600L**, dono path (app + wake), minimum `300L` barqarar | har turn par 100ms; chhote jumle na katen |
| J3.1 `MAX_LENGTH_MILLIS=15000L` | **nahi lagaya** | J1 ka `LISTEN_MAX` (12s) watchdog wahi kaam karta hai; AOSP extras aksar ignore hote hain — teesra pehra bina naap ke churn hai |
| J3.2 TTS budget **800ms** | **1800ms** (`AWAAZ.FAST`), aur trip par **tier badalta** hai (Edge → phone) | Gemini neural TTS ka pehla clip 1–2s leta hai; 800ms par har jawab Edge par girta = malik ki chuni hui neural awaaz ka tarkheeb. Saboot `audioAt` (audio ke `onplay`) se — andaza nahi |
| J3.3 STREAMING | **wahi**, magar 3 pehre ke sath: `HOLD` 40 harf, **kill-switch** (2 strikes), tool-step par `rearm` | tool-step ka preamble beech mein bolna = awaaz kaatna; stream ki nakami kabhi jawab ko maar na sake |
| J3.4 prompt ka bojh kam | **ulta**: prompt mein 33 tools ka zikr **add** hua (~200 token) | screen ka jawab na aane ki jarrh prompt ka chhota hona nahi, **NAZAR ka zikr na hona** tha (F61). Raftar par asar NAAP naapega; zaroorat hui to J4 mein context chhantenge |
| J3.5 RAFTAR PANEL | **NAAP.report() ke andar** (naya UI nahi): `pehli awaaz p50/p90`, `stream N/M`, aakhri jawab ka breakdown, fast-budget trips, NAZAR ka hisaab | ek hi jagah (LAB → 📊 NAAP), purana hisaab barqarar, naya UI = naya risk |
| (plan mein na tha) | **SCREEN PAKKI**: `nazar` default ON (F59), `lookRetry` = doosri koshish (F60), prompt ka QANOON + poori tool fehrist (F61), `needsTools` bina `poolTools` qaid (F62) | malik ki doosri shikayat: "kabhi screen par jawab hi nahi deti" — 4 alag sabab mile, chaaron band |

**Acceptance ka haal:**
* **12** (bolna khatam → 1s mein pehla lafz): streaming se pehla jumla aate hi awaaz;
  target 0.6–1.5s. **Waada nahi, naap** — RAFTAR panel ka `pehli awaaz` p50 yahi batayega
  (dimaag ka pehla token + TTS ka pehla clip, dono network par hain).
* **13** (airplane mode → 2s mein awaaz): `navigator.onLine === false` par AWAAZ seedha
  **device** tier par jata hai (pehle se), aur dimaag offline/local jawab deta hai ✓.
* **14** (panel numbers + average): NAAP p50/p90 (120 turn) + RAFTAR ka aakhri-turn breakdown ✓.

**Kya BAQI hai:** streaming **sirf Gemini** par (backup dimaag purane raaste — un par faida kam);
600L ka asar phone ki Google speech service par nirbhar (panel naapega); **awaaz ki bariki J4**;
NAZAR abhi sirf **dekhta** hai (tap/click = P7b); mic-dot SAABIT = Phase 4 (offline KWS).

---

### 🎵 J4 — v5.13.5 "SAAF AWAAZ"

| # | Badlaav |
|---|---|
| **J4.1** | Urdu ke liye rate/pitch ki **asli tuning** (device TTS voice list se Urdu/Hindi voice chunna, warna fallback) |
| **J4.2** | **Jumla-ba-jumla** TTS (prosody behtar, lamba jawab ek saans mein na lage) |
| **J4.3** | Volume/ducking: Maya bolte waqt media ki awaaz dheemi (agar API ijazat de — warna imaandari) |
| **J4.4** | Setting: **"awaaz tez / aam / dheemi"** + "baat-cheet mein phone ki awaaz" (raftar vs khoobsurti ka faisla aap ke haath mein) |

**Acceptance:** 15. Lambe jawab mein awaaz **saaf** aur **natural**; aap ko "kya?" na poochna pare.

---

## 4. 🧪 Test-locks ka plan (har phase ke sath)

| Phase | Naye locks | Kya lock hoga |
|---|---|---|
| J1 | ~14 | AOSP map **1..15** + har code ka amal; teen watchdog ke constants **aur** wiring; weak-path `speak()` ke zariye; `listen()` try/catch + `appMicOn=false`; ignore-reason log; bol kar khabar; darwaza refresh **pehle** |
| J2 | ~10 | MIC HAAL BAR ke 5 state (text + rang); level bar wiring (`__nativeRms` + naya `__wakeLevel`); conversation mode (darwaza khula → wake recognizer skip); 90s reopen sirf darwaza band par |
| J3 | ~12 | STT extras **Long** (600L/300L/15000L); TTS budget 800ms + device fast-path wiring; streaming ka pehla-jumla rasta; RAFTAR panel ke numbers |
| J4 | ~6 | rate/pitch defaults; jumla-ba-jumla split; awaaz-tez setting |

**Usool barqarar:** har lock **WIRING** par (declaration par nahi), aur Qanoon 9 ke mutabiq har
phase ke baad **📱 RELEASE REPORT + ek parcha** (kya naya, kaise parakhna, PASS/FAIL, kya
adhoora, kya bhejein, version ki pehchaan).

---

## 5. ❓ Do faisle jo aap se chahiye (baqi sab main kar lunga)

**A. CONVERSATION MODE (J2.3)** — darwaza khula ho to mic **turn-by-turn khula rahe** (wake
recognizer beech mein na aaye)?
* **Faida:** jawab tez, mic cycle **aadha**, dot kam jhilmilata, "Maya" bar bar na kehna pare.
* **Nuqsan:** mic zyada der khula = **battery** thori zyada, aur system dot **zyada der** jalta
  rahega (band nahi hoga jab tak darwaza khula hai).
* **Mera mashwara:** ON (default), magar LAB mein switch — aap band kar saken.

**B. AWAAZ: raftar ya khoobsurti? (J3.2)** — neural (Fish/Edge/Gemini) awaaz **khoobsurat**
magar 1-4s late; phone ki TTS **foran** magar aam.
* **Mera mashwara:** **800ms budget** — neural ko 800ms, warna phone ki TTS foran. Aur LAB mein
  ek switch: `AWAAZ: tez (phone) | behtar (neural) | auto (budget)`.

---

## 6. 📅 Kaam ki tarteeb aur waqt

```
J1 (v5.12.0)  → aaj/abhi        → "kabhi reply nahi aata" KHATAM
J2 (v5.12.5)  → J1 ke turant baad → "mic ka pata nahi chalta" KHATAM
J3 (v5.13.0)  → J2 ke baad       → "jaldi sune, jaldi bole" + SABOOT (RAFTAR panel)
J4 (v5.13.5)  → J3 ke baad       → "ache se sunayi de"
P4 (v6.0.0)   → sab se baad      → offline wake: mic dot SAABIT, bina internet
```

Har phase ke baad: **npm test** (sab locks GREEN) → **CI** (APK build) → **📱 RELEASE REPORT**
(aap ki Qanoon 9 farmaish) → aap device par parakh kar batayen → agla phase.

> **Wada:** har phase mein sirf **us phase** ka kaam hoga — naya feature, naya dependency,
> naya UI redesign nahi (Qanoon 3). Aur jo cheez theek **nahi** ho sakti (system mic dot),
> uska **jhoot** nahi bola jayega.
