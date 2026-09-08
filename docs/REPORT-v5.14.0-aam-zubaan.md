# 📱 MAYA v5.14.0 "🎵 EK AWAAZ" — aam zubaan mein report (Qanoon 9)

**APK:** versionName **5.14.0** · versionCode **79** · naam **🎵 EK AWAAZ**
**Pehchaan kaise karein:** app khulte hi toast: `MAYA v5.14.0 • 🎵 EK AWAAZ: ek hi artist ka poora jawab · mic ka pakka sun-na · gaana poochh kar lagana`
Header par: `PERSONAL AI v5.14.0 ✨`. Settings → ⚡ RAFTAR PANEL mein nayi lines: `🎵 EK AWAAZ …`, `🎙️ MIC …`, `🎵 GANA …`, `🧠 DIMAAG …`.

---

## 1) Kya NAYA hai (aap ki teen shikayaton ka jawab)

### 🎵 A. "Awaz kat rahi hai — ek artist bolta hai, phir koi doosra"
* **Ek jawab = ek artist (ENGINE LOCK).** Pehle har jumla apni poori seerhi se guzarta tha
  (🐟 Fish → Gemini → Edge → phone), is liye beech mein artist badal jata tha. Ab jo
  awaaz jawab ke pehle tukre par chuni gayi, **poora jawab wahi bolti hai**.
* **Tukron ke beech ka gap khatam:** agle tukre ki awaaz peeche se **pehle** mangwa li jati hai.
* **Jumle ka dam nahi kat-ta:** tukra khatam hone par purani "sakht stop" (jo native awaaz ko
  beech mein kaat deti thi) ab nahi chalti.
* **Kam request = zyada din tak ek hi awaaz:** pehla jumla foran (40 harf), baqi bare tukre
  (300 harf). Gemini TTS ka roz ka quota ~15 request ka hai; ab **12** par pohanchte hi
  poora jawab Edge par chala jata hai (bar bar girne se behtar).
* Agar awaaz phir bhi badle to **ginti darj hoti hai**: PANEL mein `artist badla N dafa`.

### 🎙️ B. "Sunai nahi de rahi, samajh nahi aa raha, ek hi baat bar bar bolni parti hai"
* **TURN LOCK:** pehle Maya ke "sochne" aur "bolne" ke beech 0.5–2 second ki khidki thi jismein
  wake ghus jati thi → **do jawab takrate** (awaz kat jati, reply gayab). Ab ek sawal ka poora
  safar (suna → socha → tool → bola) ek lock mein hai; us dauran wake andar nahi aati.
* **Naya haal `SOCH_RAHI`:** Maya jawab soch rahi ho (ya tool chala rahi ho) to mic/wake band —
  ye pabandi Kotlin side bhi lagti hai, aur 60 second ki muddat ke sath (wake hamesha ke liye behri nahi hoti).
* **Jumla kat-ta nahi:** mic ki khamoshi app par **700ms** (beech ki saans par transcript nahi katta);
  wake par 600ms (wake word chhota hai, tezi chahiye).
* **Khali transcript ka ilaaj:** mic khula aur ek lafz bhi na mila → pehle **chup-chaap ek dafa dobara**
  sunti hai; phir bhi khali ho to **BOL kar** kehti hai *"Main theek se sun nahi saki — thora paas se
  ya dheere bol kar dobara kahiye"* (pehle bilkul chup rehti thi, aap ko pata hi nahi chalta tha).
* **Kam yaqeen ki sunai par poochna** (`SUNO`) ab **default ON**: ghalat kaam karne se behtar
  *"‘…’ kaha tha? dobara boliye"*. Is se Roman-Urdu safaai bhi chalti hai (naam/behtar pehchan).

### 🎵🧠 C. "Acha sa song lagao koi bhi → wahi purani TikTok clip, bar bar wahi; dimaag/reasoning nahi"
* **Gaana AB POOCHA jata hai (aap ka faisla):** *"Kaunsa gaana ya artist, Boss?"* — andaza nahi lagati,
  koi hardcoded list nahi. Naam batate hi wahi dhundhti hai (90 second tak ka intezar).
* **Asli fehrist se chunti hai:** YouTube se ab **title + duration + channel** aata hai (pehle sirf pehla
  videoId). Shorts/reel/status aur 45 second se chhoti clip **rad**; 25 minute se lamba live/mix rad;
  **2–8 minute** ke asli gaane ko tarjeeh; aap ke lafz title mein hon to sawab.
* **Bar bar wahi gaana nahi:** jo chal chuka yaad rehta hai (80 gaane) — dohrane par bara jurmana.
* **Jo chalaya, us ka naam bolti hai:** *"🎵 <gaana> (4:12) — YouTube par chala rahi hoon, Boss!"*
* **Dimaag khul gaya:** pehle har sawal par `thinkingBudget: 0` tha (sochne ki ijazat hi nahi) aur
  jawab sirf 280 token ka — is liye tool ke args bhi kat jate the (`play_youtube(query="Funk`).
  Ab tool/planning/"kyun-kaise" wale sawalon par **512 token ki soch** + **1024 token** ka jawab;
  aam baat-cheet par soch 0 (raftar wahi). Jawab adhoora kata to **ek dafa bare budget par retry**.
* **Prompt ke do naye qanoon:** GAANA QANOON (poochho, andaza nahi) aur SOCH QANOON (jawab ke sath
  chhoti wajah + agla qadam). Aur `HAQEEQAT` (sach) default ON: tool ka **asal** haal dimaag ko bataya
  jata hai — "chala diya, tasdeeq nahi" ko "ho gaya" keh kar jhoot nahi bolti; 2 ki jagah **4 tool-qadam**.
* **Khamosh 16-second search khatam:** dhoondhte waqt screen par `🎵 YouTube par dhoondh rahi hoon: …`.

---

## 2) Kaise parakhein (PASS / FAIL)

### Tajurba 1 — EK AWAAZ (sab se ahem)
1. App kholein, `Maya` bol kar kahein: **"apne aap ko introduce karo aur 5 line mein batao kya kya kar sakti ho"**.
2. Jawab sunte waqt dhyan dein: awaaz **shuru se aakhir tak ek hi artist** ki honi chahiye, jumlon ke beech **khamoshi ka gap** nahi, aur aakhri jumla **kata hua** na lage.
3. Settings → ⚡ RAFTAR PANEL kholein: `🎵 EK AWAAZ: artist badla 0 dafa` hona chahiye.
* ✅ **PASS:** ek hi awaaz, beech mein gap/katao nahi, PANEL mein `artist badla 0` (ya 1 agar internet atka ho).
* ❌ **FAIL:** jawab ke beech artist badal jaye, ya jumla adhoora kat jaye, ya `artist badla 2+`.

### Tajurba 2 — QUOTA ke baad bhi ek awaaz
1. Ek hi din mein 12+ lambi baatein karein (ya PANEL mein `TTS aaj 12/12` dekh lein).
2. Ab koi sawal poochein.
* ✅ **PASS:** awaaz Edge ki ho jaye magar **poore jawab mein wahi ek** rahe (baar baar na badle).
* ❌ **FAIL:** har jumle par alag awaaz.

### Tajurba 3 — MIC / TURN LOCK
1. `Maya` bolein, phir **foran** (jawab aate waqt) dobara `Maya` bolein — 3-4 dafa.
2. Jawab aane ke baad PANEL dekhein: `🎙️ MIC: turn ne wake roki N`.
* ✅ **PASS:** Maya ek hi jawab poora bolti hai (do jawab ek sath nahi takrate), aur `turn ne wake roki` ki ginti barhti hai. Jawab ke baad mic khud dobara sun-ne layak ho jata hai.
* ❌ **FAIL:** jawab beech mein kat kar doosra jawab shuru ho jaye, **ya** jawab ke baad Maya hamesha ke liye behri ho jaye (45 second baad bhi wake kaam na kare).

### Tajurba 4 — SUNNA (adhoora jumla)
1. Mic ke paas se **dheere aur theher kar** bole: *"Maya… mujhe aaj ka mausam… aur kal ka bhi batana hai"* (jumle ke beech 1 second ruk kar).
2. Jo Maya ne suna wo bubble mein dekhein.
* ✅ **PASS:** poora jumla likha aaye, adhoora na kate; aur agar sun na sake to Maya **bol kar** kahe ke dobara boliye (chup na rahe).
* ❌ **FAIL:** jumla beech se kat jaye, ya bolne ke baad **kuch na ho** (na jawab, na koi baat).

### Tajurba 5 — GAANA
1. Kahein: **"acha sa gaana lagao koi bhi"**.
2. Maya pooche: **"Kaunsa gaana ya artist, Boss?"** — aap kahein: **"Atif Aslam ka jeena"**.
3. YouTube khule aur Maya bole ke kaunsa gaana chala (naam + duration).
4. Wahi cheez dobara maangein.
* ✅ **PASS:** (a) pehle **poocha**, andaza laga kar kuch nahi chalaya; (b) naam batane par **asli gaana** (2–8 minute ka, Shorts/TikTok clip nahi); (c) naam bola; (d) dobara maangne par **wahi purana gaana nahi** (dusra chuna).
* ❌ **FAIL:** bina pooche koi 15-second clip chala de, ya bar bar ek hi video, ya `ho gaya` keh kar kuch chala hi na ho.

### Tajurba 6 — DIMAAG / REASONING
1. Kahein: **"soch kar batao, phone ki battery jaldi khatam kyun hoti hai aur main kya kar sakta hoon?"**
2. PANEL mein `🧠 DIMAAG: soch ka budget N dafa diya` dekhein.
* ✅ **PASS:** jawab mein **wajah + 2-3 practical qadam** hon (sirf "theek hai" nahi); tool wale kaam poore args ke sath chalein.
* ❌ **FAIL:** ek line ka jawab, ya tool ka adhoora naam (`play_youtube(query="Funk` jaisa) screen par nazar aaye.

### Tajurba 7 — VERSION
* ✅ **PASS:** toast/header mein `v5.14.0` aur naam `🎵 EK AWAAZ`; PANEL mein nayi 4 lines.
* ❌ **FAIL:** `5.13.0` nazar aaye (purani APK install hui hai).

---

## 3) Kya ADHOORA hai (imaandari)

1. **Artist ka lock TIER level par hai, voice-name level par nahi.** Ek jawab mein tier badle
   (internet atke) to Edge ki Urdu awaaz vs Fish ki awaaz farq abhi bhi sunai de sakta hai —
   magar ginti PANEL mein darj hoti hai. Agla qadam (J4 "SAAF AWAAZ"): voice-name bhi lock + Urdu rate/pitch.
2. **YouTube ki fehrist** us ke public JSON se regex se parhi jati hai (koi API key nahi = 0 budget).
   YouTube format badle to fehrist khali aa sakti hai; tab purana rasta (pehla videoId / search page)
   chalta hai aur `GANA.fallbacks` ginti barhti hai.
3. **Soch ka budget** sirf Gemini 2.5/3 models par lagta hai; purane models ignore karte hain.
4. Soch ON hone par **pehli awaaz ~0.3–1s der** se aa sakti hai — is liye aam baat-cheet par soch 0 rakhi hai.
5. **Turn lock ki muddat 45s**: us se lamba kaam (rare) par wake khud khul jati hai — jaan-boojh kar,
   kyunke hamesha ke liye behri wake is se bura masla hai.
6. Purani APK + naya web-asset (ya ulta) par `ytSearchList` na hone ki surat mein purana `ytSearch`
   fallback chalta hai — behtar chunai ka faida tab nahi milega jab tak APK update na ho.

### 🔬 Release ke baad ka self-review (isi version mein theek hua)

Push ke baad poora K1–K4 dobara parha. Teen asli khamiyan pakdi gayin — teeno theek ho kar
**taale bhi lag gaye** (lab 937 → **944**, kul **1494**):

* **Soch ke waqt wake ka mic khula reh jata tha.** Ab Maya jab jawab soch rahi ho (ya tool chala rahi ho)
  wake ka mic bhi usi lamhe band hota hai → "ek baar boli, reply kuch nahi aaya" aur do jawab ka
  takrao ka aakhri raasta band. *(Tajurba 3 aur 4 mein farq nazar aayega.)*
* **Kisi aur chhoti awaaz se artist badal sakta tha** (toast jaisi chhoti bol). Ab artist ka taala sirf
  usi jawab ke haath mein hai jis ne shuru kiya — beech mein koi chup-chaap artist nahi badal sakta.
* **PANEL ka "pehle se mangwaye N" number jhoot bol sakta tha** (jab kuch mangwaya hi na gaya ho).
  Ab ginti sirf waqai mangwayi gayi clips ki hoti hai.

---

## 4) FAIL ho to kya bhejein

1. **⚡ RAFTAR PANEL** ka poora text (Settings → RAFTAR PANEL → share/copy) — is mein `🎵 EK AWAAZ`,
   `🎙️ MIC`, `🎵 GANA`, `🧠 DIMAAG` ki lines zaroor hon.
2. **KAAN log** (WAKE WORD KA HAAL) — `ignore`, `empty`, `turn`, `sttErr` ki entries.
3. Screen **recording** ya likh kar: aap ne kya kaha, Maya ne kya kiya, kya sunai di (artist kab badla).
4. Gaane ka masla ho to: aap ka jumla + jo video chali (title/link) + `🎵 GANA:` line.
5. App ka **version** (`v5.14.0` + `native: 5.14.0-native`) — purani APK par naya code nahi hota.

---

## 5) Version pehchaan (ek nazar)

| Cheez | Value |
|---|---|
| versionName | **5.14.0** |
| versionCode | **79** |
| Naam | **🎵 EK AWAAZ** |
| Service Worker cache | `maya-v5.14.0` |
| `appVersion()` (native) | `5.14.0-native` |
| Test | **1494** locks — settings/CSS 101 · voice 294 · brain 155 · lab 944 (Section 37 = 64, Section 38 = 53) — sab GREEN |
| Plan/forensic | `docs/FORENSIC-EK-AWAAZ.md` · amal: `docs/FIX-v5.14.0-ek-awaaz.md` |
