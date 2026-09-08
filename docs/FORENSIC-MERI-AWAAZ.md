# 🔬 FORENSIC — "MERI AWAAZ" (v5.15.0 ka plan)

**Tareekh:** 2026-09-08 · **Branch:** `arena/01a062e9-mana-android` · **Pichla release:** v5.14.0 🎵 EK AWAAZ (vc79, CI ✅, 1494/1494 tests)

---

## 0) Aap ki shikayat (jaisi aap ne kahi, waisi darj)

> "abhi bhi woh khud ba khud voice change kar raha hai, jaise pehle system tha na waise karo.
> Matlab ke main choose karun ke mujhe voice **Fish** se chahiye, **Gemini** se chahiye, ya **Edge** se,
> ya kisi aur se — **woh khud na decide kare**. Main jisse select karun **wohi artist reply de**,
> uski awaaz aaye, **uske ilawa kisi ki nahi**.
> Aur ye **pehle versions mein hamara system workflow tha**, lekin hamne **speed / instant fast reply ke
> chakkar mein kharab kar diya**. Woh instant reply to aaya hi nahi. Main chahta tha **unhi se instant
> reply aaye jo artist/voice maine custom choose ki ho** — na ke alag se automatically choose ho kar chale.
> Abhi wahi ho raha hai. Aur ye **bar bar meri main voice ko — jise maine artist select kiya hai — kaat
> rahi hai**. Ye sahi nahi."

**Faisla (aap ka, saaf):** pasand ki awaaz = **qanoon**. Machine ki marzi = **band**.

---

## 1) Aaj artist ka faisla WAQAI kahan hota hai — 5 teh (saboot ke sath)

> File: `public/index.html` (mirror `app/src/main/assets/web/index.html` — byte-identical).
> Line numbers isi file ke hain (v5.14.0, commit `d680f40`).

### TEH 1 — Aap ki pasand **dead** hai (sab se bara jurm)

| # | Saboot | Matlab |
|---|---|---|
| **F84** | `#artistGrid` (line **997**) → `renderArtists()` (**11332**) → `window.selectArtist` (**11339**): `settings.voiceArtist = id; saveSettings(); toast("Voice: " + …)` | Screen par artist cards **dikhte** hain (Maya/Zephyr/Leda/Puck/Charon/Fenrir/Sulafat/Enceladus/Orus/Aoodee — `VOICE_ARTISTS` line **1603-1615**). Aap dabate hain, app kehti hai **"Voice: ZEPHYR ✓"** |
| **F85** | `voiceArtist` ko parhne wala **wahid** function `currentArtist(text)` (line **1617**) — **poore repo mein is ka koi caller NAHI** (`grep -rn currentArtist` → sirf 2 definition, 0 istemal) | **Artist picker sirf decoration hai.** Toast **jhoot** bolta hai. AwaaZ wahi chalti hai jo `gVoice` kehti hai |
| **F86** | Asal Gemini awaaz: `AWAAZ.cfg().voice = s.gVoice \|\| "Kore"` (**3028**) → `AWAAZ.voiceId()` (**3190**) — `gVoice` ka select `sGVoice` (**10603**), settings form ke andar chhupa hua | **Do UI, ek wired.** Aap card dabate hain (`voiceArtist`), engine `gVoice` (default "Kore") par chalta hai |
| **F87** | `VOICE_ARTISTS` ke entries mein sirf `geminiVoice` hai — **engine ka koi zikr nahi** | "Fish se chahiye / Edge se chahiye" — is ka **koi ek control maujood hi nahi**. Aaj 5 alag- thakoli: `voiceEngine` (engine) · `gVoice` (Gemini) · `fishVoice`+`fishKey` (Fish) · `edgeVoice` (Edge) · `voiceName`+`tts` (device). Aap ki demand ka **koi wahid darwaza nahi** |
| **F88** | `pushNativePrefs()` (**1360-1362**) sirf `wake_lang` + `mic_zoom` bhejta hai | Artist/voice ki pasand **Kotlin prefs mein mehfooz NAHI**. WebView ka data saaf hua → `DEFAULTS` (**1344**: `voiceEngine:"auto"`, `gVoice:"Kore"`) → "woh phir khud decide karne lagi" |

### TEH 2 — `voiceEngine` (engine dropdown) bhi **maana nahi jata**

| # | Saboot | Matlab |
|---|---|---|
| **F89** | `speak()` mein sirf **2** mode shakhen hain: `if (c.mode === "edge")` (**3711**) aur `if (c.mode === "fish")` (**3714**). **`mode === "neural"` ki koi shakh NAHI** — aakhir mein sab `useFish(afterFish)` (**3740**) par girte hain | Aap ne **Gemini (neural)** chuna → agar Fish key maujood hai to **🐟 Fish bolti hai**, Gemini nahi. Aap ki pasand ka seedha ulta |
| **F90** | **FAST hijack** (v5.13.0 J3, F64): `AWAAZ.FAST = 1800` (**2986**) aur `speak()` mein `if (AWAAZ.FAST && c.on && c.mode !== "off" && !fastForced)` (**3599**) → 1800ms mein asli awaaz na baji to `AWAAZ.stop()` (**3610** — in-flight clip **rad**) → `AWAAZ.fastForced = "edge"` ya `"device"` (**3609**) → `AWAAZ.speak(text, cb)` dobara (**3611**) | **Ye hi "meri awaaz ko kaat rahi hai" ka asal mujrim.** Shart mein `c.mode` ka **koi khayal nahi** — strict pasand bhi 1.8s baad Edge/device par phenk di jati hai. Aur `fastForced` **agli speak par bhi chipka rehta hai** (**3598**) = agla tukra bhi galat artist se |
| **F91** | Rescue **raftaar nahi lata**: `AWAAZ.stop()` us request ko maar deta hai jo lagbhag aa chuki thi, phir **nayi** network call shuru hoti hai — Edge = Kotlin→Microsoft **WS cold handshake** (`edgeTTS_ws` **4346**), ~1-2s | Nateeja: **1.8s zaya + dobara intezar + artist change**. Isi liye "instant reply to aaya hi nahi" |
| **F92** | `blockReason()` (**3097-3111**): `QUOTA` · `QUOTA_DAY` (K1.6, `TTS_DAY_MAX: 12` — **3749**) · `KEY_BAD` · `cooldownUntil` (90s, **2996**) · `MOBILE_DATA` · `TOO_LONG` → `afterFish()` (**3723-3729**) poora jawab **Edge** par bhej deta hai | Din mein ~12 Gemini request ke baad, jis ne Gemini chuna tha wo **baqi din Edge** sunta hai — **bina pooche** |
| **F93** | Health gates: `fishReady()` = fishKey + native bridge + cooldown (**4524-4530**); `edgeReady()` browser mein sirf `mode==="edge"` (**3502-3508**); `wifiOnly` (**3030**) | Har gate **chup-chaap** artist badalta hai; koi ijazat nahi maangta |

### TEH 3 — Ek hi engine ke **andar** bhi artist badalta hai

| # | Saboot | Matlab |
|---|---|---|
| **F94** | `FISH.speak()` (**4671**): androoni chunking, koi **retry nahi**, koi **cache nahi**; RATE/PAYMENT par `FISH.cool = now + COOL` (**4689**) → us ke baad Fish **poore session** skip | Ek chhoti si rate-limit → baqi jawab Edge par |
| **F95** | `EDGE_TTS.pick()` (**4193**): `s.edgeVoice` khali ho (DEFAULT **khali** hai — `edgeVoice:""`, 1344) to **har tukre par** persona+zubaan se khud chunti hai (`ur-PK-UzmaNeural` fallback **4211**) | Edge ke andar bhi tukra-ba-tukra awaaz drift mumkin; `edgeVoiceUsed` sirf **aakhri** yaad rakhta hai (**3515**) |
| **F96** | Gemini: `modelOrder()` (**3335**) + `dropModel()` (**3262**) → model nakaam to agla tukra **doosre model** par; `voiceId()` (**3190-3193**) → `gVoice` list mein na ho to **chup-chaap "Kore"** | Model/voice dono andar hi andar badal jate hain |

### TEH 4 — v5.14.0 ka lock **kamzor** hai (imaandari: apni hi khami)

| # | Saboot | Matlab |
|---|---|---|
| **F97** | Lock **tier** level par hai, voice level par nahi (`AWAAZ.lock.engine`, **3638-3674**) — ye hum ne khud "adhoora #1" likha tha | Fish vs Gemini vs Edge to rukta hai, magar Edge→Edge (Uzma vs doosri) ya Gemini model drift nahi |
| **F98** | Lock **torh** diya jata hai jab tier "qabil nahi": `AWAAZ.lock.engine = ""` (**3645, 3653, 3661, 3674**) → poori seerhi dobara | Jawab ke beech artist phir badal jata hai |
| **F99** | `fastForced` ki shakhen (**3631-3632**) lock check (**3638**) se **PEHLE** hain | FAST hijack lock ko **kood** jata hai — v5.14.0 ka taala isi raaste se tootta hai |

### TEH 5 — Sach kabhi bataya hi nahi jata

| # | Saboot | Matlab |
|---|---|---|
| **F100** | `WHY{}` (**3113-3133**) mein har code ka insani matlab maujood hai, `AWAAZ.note(code)` (**3548**) darj bhi karta hai — magar ladder sirf `pushLog` (debug) + PANEL ginti karta hai | Aap ko **kabhi nahi kaha jata**: "aap ne Fish chuna tha, wo RATE par gir gaya, is liye Edge bol raha hoon" |
| **F101** | `AWAAZ.switched` (**3747**) ginti karta hai, magar **koi hadd/alarm nahi**; rokne wala koi qanoon nahi | Hisaab hai, iktiyar nahi |

**Kul: 18 flaws — F84 se F101.**

---

## 2) Hum kya galat kar rahe the (root cause — bagair bahana)

1. **"Khamoshi kabhi nahi" ko hum ne "kisi bhi awaaz mein badal do" samajh liya.**
   AWAAZ v6 ka header (**1626-1634**) likhta hai: *"Har nakami ka NAAM. Khamoshi kabhi nahi."* — iska matlab tha ** sach batao**, hum ne iska matlab bana liya **chup-chaap doosri awaaz chala do**. Isi ek ghalat fehmi se poora ladder (Fish→Gemini→Edge→free→device) "zaroori" lagne laga.
2. **Raftar ke chakkar mein hum ne aap ka iktiyar kaat diya.** FAST (v5.13.0 J3) bina is baat ki parakh ke lagaya gaya ke **kya user ne khud engine chuna hai?** — 1800ms ka timer aap ki pasand se bara samjha gaya. (F90/F91/F99)
3. **Ek "artist" ka concept hi nahi banaya.** Engine, Gemini voice, Fish voice, Edge voice, device voice — 5 alag knobs, aur upar se ek **6th dead knob** (`voiceArtist` / artistGrid). (F84-F88)
4. **Hamare tests ne ye sawaal kabhi poocha hi nahi:** *"jo awaaz user ne chuni, kya wahi boli?"* Hum ne engine ladder ke taale lagaye (294 voice tests), artist-pasand ka **ek bhi taala nahi**. Is liye ye khami 6 versions tak zinda rahi. **Test blind spot** — ye hamari sab se bari galti hai.
5. **Dead UI chhor diya.** `currentArtist()` bina caller ke zinda raha; `selectArtist` ka jhoota toast barqarar raha. (F85)

**Kya NAHI karna chahiye (agla qadam in galtiyon ka ulta hoga):**
- ❌ "Safety" ke naam par **ek aur fallback tier** add karna.
- ❌ Explicit pasand par **FAST/timeout hijack** rakhna.
- ❌ Quota/cooldown/wifi/data bachane ke liye **chup-chaap awaaz badalna**.
- ❌ Chalti hui (in-flight) request ko **abort** kar ke raftaar dhoondna.
- ❌ **6th knob** add karna — ulta, 5 knobs ko **1 artist object** mein pirona.
- ❌ Dead UI/dead function rakhna (wire karo ya hatao).
- ❌ Bina taale ke "artist selection" dawa karna.

---

## 3) STRUCTURE — v5.15.0 🎙️ **"MERI AWAAZ"** (vc80)

> Qanoon: **`strict` mode mein machine ka iktiyar SIFR.** AwaaZ wahi, jo aap ne chuni.
> Nakami par machine **poochhegi**, khud faisla nahi karegi. Raftar **usi artist se** aayegi (warm-up + cache), artist badal kar nahi.

### K5.1 — EK ARTIST (single source of truth)

Naya module `ARTIST` + ek setting `settings.artist` (id) jo **engine + voice dono** le kar aata hai:

```js
ARTIST.list() → [
  { id:"g-kore",    n:"🌸 MAYA (Gemini Kore)",  eng:"neural", voice:"Kore",     tier:"cloud" },
  { id:"g-zephyr",  n:"☀️ ZEPHYR (Gemini)",     eng:"neural", voice:"Zephyr",   tier:"cloud" },
  { id:"g-charon",  n:"📖 CHARON (Gemini)",     eng:"neural", voice:"Charon",   tier:"cloud" },
  { id:"fish-pyari",n:"🐟 FISH (aap ki pasand)",eng:"fish",   voice:fishVoice,  tier:"cloud" },
  { id:"edge-uzma", n:"🌊 EDGE Uzma (Urdu)",    eng:"edge",   voice:"ur-PK-UzmaNeural", tier:"free" },
  { id:"edge-<x>",  n:"🌊 EDGE …",              eng:"edge",   voice:"<x>",      tier:"free" },
  { id:"device-ur", n:"📱 PHONE (ur-PK)",       eng:"device", voice:voiceName,  tier:"offline" },
  { id:"auto",      n:"🤖 AUTO (machine chune)",eng:"auto",   voice:"",         tier:"any" }
]
ARTIST.cur()   → { id, n, eng, voice, strict:true }   /* strict = eng !== "auto" */
```
* `AWAAZ.cfg()` ab `ARTIST.cur()` se banta hai — `voiceEngine/gVoice/fishVoice/edgeVoice/voiceName` **advanced** ban jate hain (purane settings ka **migration**: `voiceArtist`→`artist`, `voiceEngine`+`gVoice`→`artist`).
* `#artistGrid` **asal** ho jata hai: engine badge (🐟/🎭/🌊/📱), selection ka tick, aur **"namoona sunein"** (audition) button.
* `currentArtist()` — **wire ya delete** (dead code nahi rahega).

### K5.2 — STRICT = QANOON (F89-F93, F99 ka khatma)

`speak()` ke aghaaz par:
```js
var A = ARTIST.cur();
if (A.strict) {                     /* aap ne khud chuna hai */
  /* 1) FAST hijack DISABLED */     AWAAZ.fastForced = "";
  /* 2) koi ladder NAHI */          return AWAAZ.onlyEngine(A.eng, text, cb, A.voice);
  /* 3) quota/cooldown/wifi/maxChars = REROUTE NAHI, sirf BAAT */
}
```
* `blockReason()` strict mode mein **reroute nahi**, `AWAAZ.tell(code)` deta hai (screen + PANEL + zaroorat par K5.3 ka sawal).
* Test-lock: **strict mode mein `AWAAZ.switched` kabhi na barhe** (0 hi rahe).

### K5.3 — Nakami par **poochho** (chup-chaap artist change BAND)

Naya setting `settings.artistFail` — default **`"poochho"`**:

| Policy | Rawaiya |
|---|---|
| `dobara` | usi artist par **2 retry** (400ms backoff, cache pehle) — phir text-only + PANEL |
| **`poochho`** (default) | retry ke baad **ek-tap card**: *"🐟 Fish nahi chal rahi (RATE). Kya karun? → [Dobara koshish] [🌊 Edge se — sirf ab] [🌊 Edge hamesha] [Chup raho, sirf likho]"* |
| `koi bhi` | ladder chalega (purana auto rawaiya) — magar **toast + PANEL** par likha jayega ke artist badla aur kyun |
| `chup` | koi awaaz nahi; jawab **screen par** (v5.13.0 J2 wala pakka text barqarar) |

* Har nakami ka **insani matlab** (`WHY[code]`, 3113) card mein dikhega — jhoot nahi.
* "sirf ab" = ek jawab; "hamesha" = setting badal kar save + Kotlin prefs.

### K5.4 — Instant reply **usi artist se** (F90/F91/F94 ka asal ilaaj)

Raftar artist badal kar nahi, **tayyari** se aati hai:

1. **Warm-up (app khulte hi + wake par):** chosen engine ka cold-cost pehle ada —
   `FISH.warm()` (key/health ping + connection), `EDGE_TTS.warm()` (**WS handshake pehle**, warna pehla tukra 1-2s handshake deta hai), `AWAAZ.warm()` (Gemini model ping), `device` (voices load).
2. **Preheat chosen engine par** (abhi sirf neural par hai — `preheat` **3774**: `lock.engine !== "neural" → return 0`):
   * Fish → **naya chhota cache** (text+voice+mood → clip, 12 entries, `AWAAZ.CACHE_MAX` jaisa) + agle tukre ki pehle-from mang.
   * Edge → agle tukre ka SSML/WS **pipeline pre-warm** (handshake + first-byte).
   * Gemini → mojooda `fetchClip` cache (barqarar).
3. **FAST ka sahih badal:** strict mode mein **abort-and-restart NAHI**. Us ki jagah:
   * `block()` pehle se pata ho (key nahi, offline) → **turant** K5.3 ka card (1.8s zaya nahi).
   * Warna **sach dikhao**: "🎙️ Fish se awaaz aa rahi hai… (1.2s)" — aur agar engine mar chuka ho to retry/ask.
4. **Pehla tukra jaldi:** `HOLD = 40` barqarar + **hard cap ~350ms** (jumla poora na bhi ho to pehli awaaz shuru) — baqi tukre `HOLD_N = 300` (v5.14.0 K1.3 batching barqarar, kyunke wo artist-switch kam karti hai).

### K5.5 — Lock ab **ARTIST lock** (engine + voice), F97/F98 ka khatma

```js
AWAAZ.lock = { key:"j7", eng:"fish", voice:"<fishVoice>", artist:"fish-pyari", strict:true }
```
* Lock **sirf jawab khatam** hone par toottega (`lockEnd`).
* "Tier qabil nahi" wale 4 raaste (**3645/3653/3661/3674**) ab **ladder nahi**, K5.3 (retry→ask) par jayenge.
* Edge: voice **har tukre par dobara pick nahi** — jawab ke liye ek dafa tay (`lock.voice`), warna drift (F95).
* Gemini: `dropModel` strict mode mein **model nahi badlega** — retry same model, phir ask (F96).

### K5.6 — UI: aap ko hamesha pata ho **kaun bol raha hai**

* Main screen par **chip**: "🐟 Fish — Uzma 🔒" (artist + strict badge). Tap = artistGrid.
* artistGrid: engine badge, audition (namoona), tick, aur **"🔒 SIRF YEHI AWAAZ"** toggle.
* PANEL nayi lines: `artist: 🐟 Fish (aap ki pasand) · badla: 0 · retry: 1 · nakami: RATE · pehli awaaz: 780ms · preheat: 3`.
* Toast **sirf sach**: artist tabhi badla jab aap ne ijazat di.

### K5.7 — Pasand **mehfooz** (F88 ka khatma)

* `pushNativePrefs()` mein: `artist`, `artistFail`, `voiceStrict`, `gVoice`, `fishVoice`, `edgeVoice`, `voiceName`, `tts`.
* Boot par: prefs ⇄ localStorage **sulah** (prefs jeetein) + toast "aap ki awaaz 🐟 Fish bahal ho gayi".
* WebView data clear hone par bhi pasand zinda.

### K5.8 — 🩺 AWAAZ DOCTOR (ek screenshot mein poora sach)

Har artist ke liye: `ready? · key? · aakhri nakami + code · aakhri latency (ms) · aaj ka quota baki · cache hits · warm-up hua?` — taake FAIL ki wajah **aap ke screenshot** se saaf ho jaye.

### K5.9 — TESTS (Section 39, ~55-65 taale)

1. **Strict:** jis engine ko chuna, `speak()` sirf **wahi** bulata hai (jsdom mein CHALA kar — `fish/neural/edge/device` stubs, call-log assert).
2. **FAST:** strict mein `fastForced` kabhi set na ho; 1800ms guzarne par artist **na** badle.
3. **Quota/cooldown/wifi/maxChars:** strict mein reroute **nahi**; `AWAAZ.tell(code)` chale; `artistFail:"poochho"` par **card** bane (DOM/text assert).
4. **Retry:** nakami par pehle **usi artist** par 2 retry; `switched === 0`.
5. **Lock:** engine+voice lock; "qabil nahi" par ladder **nahi**; Edge voice tukron mein **ek hi**; Gemini model **ek hi**.
6. **ArtistGrid wired:** `selectArtist("edge-uzma")` → agli speak **Edge Uzma** (dead-code ka taala: `currentArtist` caller ke baghair file mein na rahe).
7. **Migration:** purane `voiceArtist`/`voiceEngine`/`gVoice` → naya `artist` (koi pasand na toote).
8. **Persistence:** prefs push list + boot sulah.
9. **Raftar:** preheat chosen engine par (Fish cache / Edge warm); pehla tukra ≤ cap; warm-up app-start par.
10. **Docs:** FORENSIC + FIX + REPORT (Qanoon 9).

---

## 4) Kaam ki tarteeb (agla qadam)

| Qadam | Kya | Kyun pehle |
|---|---|---|
| **1** | `ARTIST` module + `settings.artist` + migration + artistGrid **wire** | Pasand pehle **zinda** ho (F84-F88) — warna baqi sab bekar |
| **2** | **STRICT** path (`onlyEngine`) + FAST hijack **off** + blockReason→tell | "Kaatna" yahin rukta hai (F89-F93, F99) |
| **3** | Nakami policy (`poochho`/retry/card) + WHY ka sach | Machine ka faisla → **aap ka** faisla |
| **4** | Lock = artist (engine+voice), Edge/Gemini drift band | Jawab ke andar pakki awaaz (F94-F98) |
| **5** | Raftar: warm-up + preheat(chosen) + pehla-tukra cap | **Instant reply usi artist se** (F90/F91 ka sahil ilaaj) |
| **6** | UI chip + PANEL lines + AWAAZ DOCTOR + prefs persistence | Sach nazar aaye, pasand mehfooz rahe |
| **7** | Section 39 ke taale + docs + version bump (vc80) | Qanoon: bina taale ke dawa nahi |

**Anuman:** ~7 file changes (`public/index.html` + mirror, `MainActivity.kt` prefs, docs, tests). Version **5.15.0 🎙️ MERI AWAAZ**, versionCode **80**, SW `maya-v5.15.0`.

---

## 5) Aap se 4 faislay (baqi sab main sambhal loonga)

1. **Nakami par default policy:** `poochho` (mera mashwara) / `dobara` / `koi bhi` / `chup`?
2. **Strict kab ON:** artist chunte hi **hamesha strict** (mera mashwara) / sirf jab aap "🔒 SIRF YEHI AWAAZ" toggle dabayein?
3. **ArtistGrid mein kaun kaun:** Gemini (30) + Fish + Edge (Urdu/Hindi/English) + Phone + AUTO (mera mashwara) / sirf Gemini artists?
4. **Release shape:** v5.15.0 **all-in-one** (qadam 1-7 ek sath, mera mashwara) / pehle sirf "kaatna band" (qadam 1-3), phir raftaar (4-7)?

---

*Dastavez: `docs/FORENSIC-MERI-AWAAZ.md` · Agla: `docs/FIX-v5.15.0-meri-awaaz.md` + `docs/REPORT-v5.15.0-aam-zubaan.md` (Qanoon 9)*
