# 🩹 FIX — v5.15.0 🎙️ **MERI AWAAZ** (vc80)

**Branch:** `arena/01a062e9-mana-android` · **Pichla:** v5.14.0 🎵 EK AWAAZ (vc79, 1494 tests)
**Forensic:** `docs/FORENSIC-MERI-AWAAZ.md` (F84–F101, 18 flaws, saboot line-numbers ke sath)

---

## 0) Masla (aap ke alfaz)

> "woh khud ba khud voice change kar raha hai… main choose karun ke Fish se chahiye, Gemini se,
> Edge se — **woh khud na decide kare**. Main jisse select karun **wohi artist reply de**, uske
> ilawa kisi ki nahi. **Speed/instant reply ke chakkar mein kharab kar diya** — instant reply bhi
> nahi aaya, aur meri chuni hui awaaz **bar bar kaat** di jati hai."

**Faisla:** pasand = **QANOON**. Machine ka iktiyar sirf `AUTO` par. Raftar **usi artist se** — artist badal kar nahi.

---

## 1) K5 — kya banaya

### K5.1 · EK ARTIST (F84–F88)
* Naya module **`ARTIST`** — pasand ka **wahid darwaza**: `{ id, n, eng, voice, strict }`.
  id: `g:<GeminiVoice>` · `fish` · `edge[:<voice>]` · `device` · `auto` · `off`.
* `AWAAZ.cfg()` ab **ARTIST.cur()** se banta hai (`mode`, `voice`, `strict`, `artistName`).
* **Dead picker zinda:** `#artistGrid` → `selectArtist()` → `ARTIST.set()` (engine + voice + strict sab likhta hai).
  Purana `currentArtist()` (zero-caller) **hata diya** — dead code nahi chhupa.
* **Migration:** purani `voiceArtist` (maya ke ilawa) / `voiceEngine` / `gVoice` / `edgeVoice` / `fishVoice` → naya `artist`.
  `DEFAULTS.voiceArtist:"maya"` ko click ka saboot **nahi** mana (warna har user zabardasti strict Gemini ban jata).
* **Do-tarfa sync:** `ARTIST.syncFromKnobs()` settings form save par chalta hai → advanced knob badla to artist foran ham-ahang
  (warna F86 dohra jata: ek control badla, doosra chalta rehta).

### K5.2 · STRICT = qanoon (F89–F93, F99)
* `speak()` mein **pehle** strict dispatch: `if (c.strict && !cb.forceAuto) { AWAAZ.onlyArtist(...); return; }` —
  poori seerhi (Fish→Gemini→Edge→muft→phone) ab **sirf AUTO** ke liye.
* `onlyArtist()` **sirf** chuna hua engine chalata hai (`fish/neural/edge/device`) — koi `useEdge`/`usePollen`/`useDevice` nahi.
* **F89 ka khatma:** `voiceEngine:"neural"` migrate ho kar `g:Kore` banta hai → ab Gemini hi bolega (Fish nahi).
* **FAST hijack BAND:** timer ki shart mein `&& !c.strict`, aur strict mein `fastForced` saaf.
  Yaani 1800ms ka pehra ab aap ki awaaz ko **kaat kar** Edge/phone par nahi phenkta (F90/F91/F99).
* Quota / cooldown / WiFi-only / TOO_LONG → strict mein **reroute NAHI**, sirf `fail(code)` → K5.3.

### K5.3 · Nakami par POOCHHO (F100/F101)
* `settings.artistFail` = **`poochho`** (default) · `dobara` · `koi_bhi` · `chup` — UI chips se badla jata hai.
* Nakami par: ① **usi artist par retry** (`STRICT_RETRY = 2`, 350/700ms; permanent codes par retry nahi),
  ② `tellFail()` — screen par **sach** (`WHY[code]` ka insani matlab) + 4 ikhtiyar, ③ `AWAAZ.ask` (90s).
* Jawab `handleUserText` mein suna jata hai: *"dobara / sirf ab Edge se / hamesha Edge / chup raho"* →
  `AWAAZ.answer()` + `applyAnswer()` (retry · once · always=ARTIST.set · silent). Hijack guard: doosra hukm aaya to sawal bhool.
* **`hush`**: jis jawab mein sawal poochha gaya, baqi tukron par **na** doosri awaaz, **na** dobara sawal — magar `onDone` chalta hai
  (jawab ka silsila ruka nahi, screen ka jawab barqarar).
* `koi_bhi` policy (ya `cb.forceAuto`) → purani seerhi chalegi **magar** `tellSwitch()` + `switched++` + `allowed++` (chup-chaap nahi).

### K5.4 · Instant reply **usi artist se** (F90/F91/F94)
* **Preheat ab chune hue artist par:** Gemini (pehle jaisa `fetchClip` cache) · **Fish ka apna cache** (`FISH.cache/ckey/cacheGet/cachePut`, 6 entries, **sirf preheat se bharta hai**) · Edge → `EDGE_TTS.load()` (voices garam) · device → 0 (jhoothi ginti nahi).
* `FISH.speak()` cache-hit par **seedha bajata** hai (nayi request nahi) → tukron ke beech gap = 0.
* `ARTIST.warm(eng)` boot par + pasand badalne par (Edge voices / Fish health / device voices). Gemini par jaan-boojh kar **koi** network warm-up nahi (roz ka quota pyara hai).
* FAST ke baghair bhi raftaar: permanent rukawat (key/quota/offline) par **1.8s zaya nahi** — foran sach + sawal.

### K5.5 · Lock ab ARTIST lock (F94–F98)
* `AWAAZ.lock = { key, engine, voice, model, artist, at }` — `setEngine()` engine ke sath **voice + artist** bhi darj karta hai.
* `AWAAZ.edgeVoice()`: jawab bhar **ek hi** Edge awaaz (har tukre par `EDGE_TTS.pick()` dobara nahi — F95).
* `modelOrder()`: strict jawab mein **model pin** (F96 — model badla to lehja badal jata tha).
* `lockBegin()` `hush` saaf karta hai (naya jawab = nayi koshish).

### K5.6 · UI — sach nazar aaye
* `#artistChip`: "🔒 🐟 FISH — SIRF yahi bolegi" ya "🤖 AUTO — machine chunegi" + abhi kaun boli + artist-badla ginti.
* `#artistGrid`: **sab** engine ki awaazein (Gemini 30 · Fish · Edge list · Phone · AUTO) + har card ke sath **🔊 namoona** (`ARTIST.sample` → `AWAAZ.speakOnce`, aap ki asal pasand chhede baghair).
* `#artistPolicy`: nakami par kya kare — 4 chips (`poochho/dobara/koi_bhi/chup`).
* `paintAwaaz()`: strict par "🔒 <artist> — SIRF yahi bolegi" + rukawat ki wajah.
* **PANEL** nayi line: `🎙️ MERI AWAAZ: <artist> 🔒 · boli <engine> · retry N · nakam N · ijazat maangi N · sach bataya N · Fish cache hit N`.

### K5.7 · Pasand mehfooz (F88)
* `pushNativePrefs()` ab `awaaz_artist/artistFail/voiceEngine/gVoice/fishVoice/fishVoiceName/edgeVoice/voiceName/tts` bhi bhejta hai.
* Naya `pullNativePrefs()` boot par Kotlin `getPrefString()` se wapas lata hai — **sirf** jagah khali ho to (taaza pasand ko purani pref dabati nahi).

### K5.8 · 🩺 hisaab
* `AWAAZ.status()` mein: `artist/artistName/strict/artistRetries/artistFails/asks/tells/hush` + `edgeVoice` ab pasand/lock wali.

---

## 2) F84–F101 → ilaaj

| Flaw | Ilaj |
|---|---|
| **F84** artistGrid sirf decoration (`selectArtist` → dead setting) | K5.1/K5.6 — `selectArtist` → `ARTIST.set()` (engine+voice+strict), toast sach |
| **F85** `currentArtist()` zero-caller; toast jhoot | K5.1 — dead function **hata diya**; purane grid ids `ARTIST.parse()` mein zinda |
| **F86** 5+1 alag knobs, koi wahid artist nahi | K5.1 — `ARTIST` wahid darwaza + `syncFromKnobs()` do-tarfa |
| **F87/F88** pasand prefs mein nahi, data saaf = pasand gayab | K5.7 — push + pull (`awaaz_*`) |
| **F89** `mode:"neural"` ki shakh hi nahi (Gemini chuna → Fish boli) | K5.1/K5.2 — migration `g:<voice>` + strict dispatch |
| **F90/F91** FAST hijack: 1800ms par clip abort + Edge/phone, raftaar bhi nahi | K5.2 — strict mein timer **armed hi nahi**; K5.4 — preheat/cache/warm se asli raftaar |
| **F92** quota/QUOTA_DAY/cooldown → poora jawab Edge | K5.2/K5.3 — reroute nahi; sach + ijazat |
| **F93** health gates (fishReady/edgeReady/wifi/maxChars) chup-chaap reroute | K5.2 — `fail(code)` → retry → ask |
| **F94** Fish: retry/cache nahi, RATE par session-bhar skip | K5.3 retry + K5.4 Fish cache/preheat |
| **F95** Edge voice har tukre par dobara pick | K5.5 — `edgeVoice()` + lock.voice |
| **F96** Gemini model drift + `voiceId()` chup-chaap "Kore" | K5.5 — model pin; voice pasand se |
| **F97/F98** lock tier-level, 4 jagah tora jata | K5.5 — lock = engine+voice+model+artist; torna = K5.3 (ask), ladder nahi |
| **F99** `fastForced` lock se PEHLE chalta tha | K5.2 — strict mein `fastForced` saaf + dispatch fastForced se pehle |
| **F100/F101** sach bataya nahi jata; `switched` ginti hai hadd nahi | K5.3/K5.6/K5.8 — `tellFail/tellSwitch`, chip, PANEL, `asks/tells` |

---

## 3) 🔒 Test-lock

* **`tools/test-voice-engine.js` Section 19** — 🎙️ MERI AWAAZ ke **behavioral** taale (jsdom mein asal AWAAZ + ARTIST + FISH + EDGE_TTS + bridge):
  ARTIST parse/legacy/cur/alt/set/syncFromKnobs · dead picker zinda · F89 (neural→Gemini) · F95 (Edge voice) ·
  strict Fish/Gemini · FAST **armed hi nahi** (strict) vs armed (auto) · quota par artist nahi badla ·
  retry + ask + 4 ikhtiyar · `answer()/applyAnswer()` · `hush` · lock voice · Fish preheat+cache-hit · namoona · prefs · UI/PANEL.
* **Purana taala jo JAAN-BOOJH KAR badla** (wajah ke sath, chup-chaap nahi):
  *"sirf-neural mode bhi nakami par phone par girta hai"* → ab **STRICT** qanoon: phone par nahi girta, retry + ijazat.
  Purana wada ("khamoshi kabhi nahi") **AUTO** mode ke alag taale mein barqarar.
* **`tools/test-lab-engine.js` Section 39** — source/structure + docs + version locks (K5.1–K5.9, F84–F101, vc80).

**Kul test:** **1602** (settings/CSS 101 · voice **348** · brain 155 · lab **998**) — sab GREEN.
(v5.14.0 mein 1494 the; **+108** naye taale: voice Section 19 = **54**, lab Section 39 = **54**.)

---

## 4) ⚠️ Imaandari (kya adhoora hai)

1. **Edge ka preheat voices tak mehdood hai.** Edge har tukre par Microsoft se **WS stream** karta hai; clip cache mumkin nahi.
   Warm-up sirf voices list + bridge tayyari karta hai. Agla qadam: Edge ke liye session-level WS reuse.
2. **Fish ka cache sirf preheat se bharta hai** (jaan-boojh kar): aam speak par cache nahi bharta, warna dohraye hue jumle par
   purani clip chal sakti thi. Nateeja: bina preheat wale raaste par Fish ka gap pehle jaisa hi hai.
3. **Gemini ka roz ka quota (12) wahi hai** — strict Gemini par quota khatam hua to awaaz **rukegi** (sawal aayega).
   Ye qanoon ki qeemat hai: chup-chaap Edge par jaane se behtar hai poochh lena.
4. **`koi_bhi` policy** ladder chalati hai, magar tab bhi `tellSwitch()` + ginti hoti hai — bilkul chup-chaap kuch nahi.
5. **Browser (non-native)** mein Fish CORS ki wajah se chalta hi nahi (`FISH.native()` false) → strict Fish browser mein
   hamesha sawal dega. App (APK) mein ye masla nahi.
6. **Namoona (🔊)** usi engine par bolta hai — agar Fish key/bridge nahi to namoona bhi nakami ka sach batata hai (feature, bug nahi).
7. **`AUTO` mode ka rawaiya purana hai** (Fish → Gemini → Edge → muft → phone + FAST rescue). Jo user "khud decide" pasand
   karte hain un ke liye ye theek; magar strict ka faida sirf pasand chunne par milta hai.
8. **Pehli dafa** strict artist par jawab ~0.3–1s der se aa sakta hai (warm-up ke bawajood cold network). Der dikha kar
   sach bataya jata hai, artist badal kar jhoot nahi.

---

## Release record

| | |
|---|---|
| Commit | `f3d6576` — branch `arena/01a062e9-mana-android` (11 files, +1903 / −103) |
| CI | run `34251026266` ✅ SUCCESS · job `build` 1m51s |
| APK | artifact `MAYA-APK` = 3,263,675 bytes (~3.26 MB) |
| Tests | 1602 GREEN (lab 998 · voice 348 · brain 155 · settings/CSS 101) |
| Version | 5.15.0 · vc80 · 🎙️ MERI AWAAZ · `5.15.0-native` · `maya-v5.15.0` |
