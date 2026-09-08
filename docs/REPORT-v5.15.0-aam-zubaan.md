# 🗣️ REPORT v5.15.0 🎙️ **MERI AWAAZ** — aam zubaan mein (Qanoon 9)

**Version:** 5.15.0 · **versionCode:** 80 · **Naam:** 🎙️ MERI AWAAZ · **APK native:** `5.15.0-native`
**Branch/commit:** `arena/01a062e9-mana-android` · **Pichla:** v5.14.0 🎵 EK AWAAZ (vc79)

---

## 1) Naya kya hai (seedhi baat)

Aap ne kaha tha: *"main jo artist/voice choose karun, **wohi** bole — khud decide na kare; meri awaaz bar bar
**kaat** di jati hai; aur instant reply bhi nahi aata."* — Ye release **sirf** isi ke liye hai.

**a) Aap ka artist picker pehle DECORATION tha (sab se bara jurm).**
Screen par jo awaaz ke cards hain (Maya/Zephyr/Charon…), wo aap ki pasand likhte to the magar **engine unhe parhta hi
nahi tha** — app aap ko "Voice: ZEPHYR ✓" keh kar **jhoot** bolti thi. Ab wahi cards **asal qanoon** hain.

**b) Ek hi jagah se faisla — `ARTIST`.**
Ab ek hi cheez tay karti hai ke **kaun** bolegi: engine (🐟 Fish / 🎭 Gemini / 🌊 Edge / 📱 Phone) **aur** uski awaaz.
Grid se chuna ya settings form se — dono ek hi sach par jate hain (ek badla to doosra foran ham-ahang).

**c) STRICT = aap ki pasand qanoon hai.**
Jab aap koi artist chunte hain:
* **sirf wahi** engine bolta hai, **sirf wahi** awaaz (jawab bhar);
* machine **khud** doosri awaaz **nahi** lagati — na dheemi awaaz par, na quota khatam hone par, na internet/mobile-data par;
* wo **1800ms ka timer** jo aap ki awaaz ko **kaat** kar Edge/phone par phenk deta tha — strict mein **band** (armed hi nahi hota);
* jawab bhar **Edge ki ek hi awaaz** (har jumle par dobara chunna band) aur **Gemini ka ek hi model** (lehja badalna band).

**d) Nakami par Maya ab POOCHHTI hai (chup-chaap faisla nahi).**
Aap ki awaaz nakaam hui to: pehle **usi par 2 dafa dobara koshish**, phir screen par **sach** ("🐟 Fish abhi nahi bol saki —
rate limit") aur 4 ikhtiyar: **"dobara koshish" · "sirf ab Edge se bolo" · "hamesha Edge" · "chup raho"**.
Aap bol kar ya likh kar jawab de sakte hain (90 second tak). Default policy **poochho** hai — aap chips se badal sakte hain.

**e) Raftar ab artist BADAL kar nahi, TAYYARI se aati hai.**
* **Fish ka apna cache + preheat**: agle tukre ki awaaz peeche se pehle mangwa li jati hai → tukron ke beech ka gap khatam
  (v5.14.0 mein ye sirf Gemini ke liye tha).
* **Warm-up** app khulte hi aur pasand badalte hi (Edge ki voices tayyar, Fish ki sehat ka pata, phone ki awaazein load).
* Jo rukawat **pehle se pata** ho (key nahi / quota khatam / internet nahi) us par **1.8s zaya nahi** — foran sach + sawal.

**f) Aap ko hamesha pata rahega kaun bol rahi hai.**
* Settings mein **chip**: "🔒 🐟 FISH — SIRF yahi bolegi" (ya "🤖 AUTO — machine chunegi").
* Har artist card ke sath **🔊 namoona** — dabao, wahi artist bol kar dikhata hai (aap ki asal pasand badle baghair).
* **PANEL** mein nayi line: `🎙️ MERI AWAAZ: 🐟 FISH 🔒 · boli fish · retry 0 · nakam 0 · ijazat maangi 0 · Fish cache hit 2`.

**g) Pasand ab mehfooz.** Aap ka chuna hua artist phone (Kotlin prefs) mein bhi likha jata hai — WebView ka data/cache
saaf ho jaye to bhi pasand wapas aa jati hai.

> **AUTO ka matlab purana rawaiya:** agar aap "🤖 AUTO" chunein to machine pehle jaisa khud chunegi (Fish → Gemini → Edge → phone)
> aur khamoshi se bachne ke liye FAST rescue bhi chalega. **Pasand chunne par hi strict qanoon lagta hai.**

---

## 2) Kaise tajurba karein (PASS / FAIL)

### Tajurba 1 — pasand waqai qanoon hai
Settings → **🎙️ MERI AWAAZ** → koi artist chunein (maslan **🎭 GEMINI — Charon** ya **🐟 FISH**).
* ✅ **PASS:** chip par "🔒 … SIRF yahi bolegi"; jawab usi awaaz mein; poori baat-cheet mein **ek hi** artist; PANEL par `artist badla 0`.
* ❌ **FAIL:** beech mein awaaz badle, ya chip "🤖 AUTO" rahe, ya `artist badla 1+`.

### Tajurba 2 — Gemini chuna to Gemini (Fish nahi)
Artist = **🎭 GEMINI — Kore/Puck/Charon** → koi sawaal.
* ✅ **PASS:** sirf Gemini ki awaaz; PANEL `boli neural`.
* ❌ **FAIL:** Fish ya Edge ki awaaz aaye (ye purani F89 khami thi).

### Tajurba 3 — dheemi internet par awaaz KATNI nahi chahiye
Artist = 🐟 Fish ya 🎭 Gemini → mobile data / dheeme internet par lamba jawab.
* ✅ **PASS:** awaaz dheemi aa sakti hai magar **wahi artist** rahega; beech mein Edge/phone **nahi** bolega.
* ❌ **FAIL:** 2 second baad awaaz badal jaye (ye FAST hijack tha — strict mein band hai).

### Tajurba 4 — nakami par sawal (chup-chaap switch nahi)
Airplane mode ON (ya Gemini key hata kar) → artist = 🎭 GEMINI → sawaal poochein.
* ✅ **PASS:** screen par likha aaye *"🎭 GEMINI … abhi nahi bol saki — <wajah>"* + 4 ikhtiyar; jawab **likha** hua mile.
  Phir boliye/likhiye **"dobara koshish"** → wahi artist dobara; **"chup raho"** → sirf text.
* ❌ **FAIL:** bina bataye Edge/phone bol pare, ya koi paigham hi na aaye.

### Tajurba 5 — ijazat dene par hi doosri awaaz
Tajurba 4 ke sawal ka jawab dein: **"sirf ab Edge se bolo"**.
* ✅ **PASS:** sirf **is jawab** ke liye Edge chale; agle jawab par wapas **aap ka** artist.
  Agar **"hamesha Edge"** kaha → pasand badal jaye aur chip update ho.
* ❌ **FAIL:** "sirf ab" kehne par pasand hamesha ke liye badal jaye (ya ulta).

### Tajurba 6 — namoona (🔊) aur policy chips
Kisi artist ka **🔊** dabayein; phir policy chip **"🤫 Chup — sirf likho"** chunein.
* ✅ **PASS:** namoona **usi** artist par bole; aap ki asal pasand **na** badle. Chup policy par nakami ho to koi awaaz na ho,
  jawab likha aaye, koi sawal na aaye.
* ❌ **FAIL:** namoona kisi aur artist par bole, ya chip ka asar na ho.

### Tajurba 7 — raftar: tukron ke beech gap
Artist = 🐟 FISH → lamba jawab (3-4 jumle) bolwayein → PANEL kholein.
* ✅ **PASS:** `Fish cache hit 1+` aur `pehle se mangwaye 1+`; tukron ke beech ka gap pehle se kam.
* ❌ **FAIL:** har jumle ke baad 2-3 second ki chup, aur cache hit 0.

### Tajurba 8 — pasand mehfooz
Artist chunein → app band → **WebView cache/data saaf** kar ke (ya phone restart) dobara kholein.
* ✅ **PASS:** wahi artist chip par; boot toast: "🎙️ Aap ki pasand … ab QANOON hai".
* ❌ **FAIL:** 🤖 AUTO par wapas chala jaye.

---

## 3) Kya ADHOORA hai (imaandari)

1. **Edge ka preheat sirf voices tak** — Edge har tukre par Microsoft se live stream karta hai, is liye clip cache mumkin nahi.
   Warm-up voices + bridge tak mehdood hai.
2. **Fish ka cache sirf preheat se bharta hai** (jaan-boojh kar) — warna dohraya hua jumla purani clip bol deta.
   Bina preheat wale raaste par Fish ka gap pehle jaisa.
3. **Gemini ka roz ka quota (12) wahi hai.** Strict Gemini par quota khatam → awaaz **rukegi** aur sawal aayega.
   Ye qanoon ki qeemat hai: chup-chaap Edge par jaane se behtar hai poochh lena.
4. **Browser (bina APK)** mein Fish CORS ki wajah se chalta hi nahi → strict Fish wahan hamesha sawal dega. APK mein theek.
5. **Pehli dafa** strict artist par ~0.3–1s der mumkin (cold network) — der **dikha** kar sach bataya jata hai, artist badal kar jhoot nahi.
6. **AUTO mode** purana hi hai (ladder + FAST rescue) — strict ka faida sirf pasand chunne par.
7. **Namoona (🔊)** usi engine par bolta hai: Fish key/bridge na ho to namoona bhi nakami ka sach batata hai.

---

## 4) FAIL ho to mujhe kya bhejein

1. **PANEL ka screenshot** — khaas tor par `🎙️ MERI AWAAZ:` aur `🎵 EK AWAAZ:` ki lines.
2. **Artist chip ka screenshot** (kaun chuna tha, kya likha tha).
3. Aap ne **kaunsa artist** chuna tha aur **kya bola/likha** aaya (screen par kya likha tha).
4. **Kaunsi awaaz** asal mein sunai di (Fish jaisi / Gemini jaisi / Edge Urdu / phone ki robotic).
5. Kitni **der** baad masla hua (turant / 2s / 30s), aur internet **WiFi ya mobile data**.
6. Nakami ka **paigham** jo screen par likha aaya (us mein wajah ka code hota hai: QUOTA_DAY / RATE / OFFLINE / BRIDGE…).
7. Ho sake to 10-15 second ki **screen recording** (awaaz ke sath) — sab se bara saboot.
8. **Version** zaroor likhein: 5.15.0 (vc80) 🎙️ MERI AWAAZ.

---

## 5) Version ki pehchaan

| | |
|---|---|
| Version | **5.15.0** 🎙️ **MERI AWAAZ** (versionCode **80**) |
| Native | `appVersion = "5.15.0-native"` · SW cache `maya-v5.15.0` · toast "MAYA v5.15.0 • 🎙️ MERI AWAAZ" |
| Naya module | `ARTIST` (pasand ka wahid darwaza) · `AWAAZ.onlyArtist/artistFail/tellFail/answer/applyAnswer/speakOnce/edgeVoice` · `FISH.cache/preheat/warm` · `pullNativePrefs()` |
| Hataya gaya | `currentArtist()` (dead, zero-caller) · strict mode mein FAST hijack · chup-chaap artist switch |
| Tests | **1602/1602 GREEN** — voice **348** (Section 19 = +54) · lab **998** (Section 39 = +54) · brain 155 · settings/CSS 101 |
| Docs | `docs/FORENSIC-MERI-AWAAZ.md` (F84–F101) · `docs/FIX-v5.15.0-meri-awaaz.md` · ye report |
| Mirror | `public/index.html` = `app/src/main/assets/web/index.html` (byte-identical) |
| Git | commit `f3d6576` · branch `arena/01a062e9-mana-android` |
| CI | run [`34251026266`](https://github.com/adil-chandio/Mana-android/actions/runs/34251026266) ✅ **SUCCESS** (build 1m51s) |
| APK | artifact `MAYA-APK` = **3,263,675 bytes** (~3.26 MB) — usi CI run se download karein |
