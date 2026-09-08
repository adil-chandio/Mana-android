# 🔬 FORENSIC + STRUCTURE — "EK AWAAZ · PAKKA MIC · GANA DIMAAG"

**Tarikh:** 2026-09-08 · **Hal:** v5.13.0 "RAFTAR" shipped (CI ✅ 34186455021) ke **baad** ki
shikayaton ka post-mortem · **Code abhi NAHI badla** — malik ka hukm: *pehle loopholes nikalo,
analyze/explore/deep study/forensic karo, phir poora structure banao, phir aage barhenge.*

---

## 0. Malik ki shikayat (lafz-ba-lafz)

> "ab boht se glitches flaws error agaye hen sab se pehle to **awaz kat Rahi ha woh 1 artist
> Bolta ha phr ekdam se koi or artist aake Bolta ha awaz change hojaye ha** jese pehle gemeni,
> ya fish audio se bol rha tha **1 dam se edge se bol rha ha, phr change hoke phr se pata nhi
> konsi artist bol rha ha** pehla to yeh,
> **dusra usko sunai NAHI derha sahi se samjh NAHI arha me Kya bol rha hun Kya nhi** me usse
> Bolta hun **yt par jaake acha sa song lagao koi bhi woh TikTok ki salon years purani video
> lagadeti ha or bar baar Wohi same video Laga deti ha uske andar dimag NAHI ha sochne ka
> samjhne ka reasoning mindset woh nhi ha** uske pas
> **awaz sahi NAHI phnch Rahi jabke me mobile ko face ke mouth ke pass laake bol rha hun** phr bhi
> woh nhi bol Rahi or **usse 1 hi cheez bar bar bolni parh Rahi ha yeh 1 Baar boli usne suna hi nhi
> reply wagera kuch nhi Aya uske pass awaz hi nhi Gai** phr bola phr jaake suna usme bhi galatiyan"

Teen alag ilaqe, **17 flaws** (F67–F83):

| Ilaqa | Shikayat | Flaws |
|---|---|---|
| **A. AWAAZ** | artist beech mein badalta hai, awaaz kat-ti hai | F67–F72 (6) |
| **B. MIC** | sunta nahi, samajhta nahi, baar baar bolna parta hai, pehli baar kuch nahi hota | F73–F78 (6) |
| **C. GANA/DIMAAG** | wahi purani video baar baar, reasoning nahi | F79–F83 (5) |

## 0.1 ⚖️ IMAANDARI — pehle apna jurm

**A aur B ke zyada tar flaws v5.13.0 (J3 RAFTAR) ke REGRESSION hain — mere apne haath se.**
J3 ne "jawab foran bolna" ke liye jawab ko **jumlon mein tod kar** alag-alag `AWAAZ.speak()`
diye. Us ka faida mila (pehli awaaz jaldi) magar teen qeematein chukani parin:

1. har jumla = **poori engine seerhi dobara** → artist badalta hai (F67),
2. har jumla = **ek TTS request** → Gemini TTS ka roz ka ~15 ka quota 3-5 guna tez khatam →
   beech jawab mein Edge/phone par girna (F69),
3. `thinking` pehle token par false ho jata hai → **turn-lock toot-ta hai** → wake/ambient awaaz
   beech mein ghus jati hai (F73/F74).

Aur ek purani ghalti: **silence 700ms → 600ms** maine *bina naape* kar diya tha, halanke
forensic doc ne khud likha tha ke "600L behtar hai ya nahi, RAFTAR PANEL naap kar tay karega"
(F76). Naap **ab** hoga — aur tab tak app-path wapas 700ms par.

Ye doc isi liye hai ke agli dafa **saboot ke baghair koi number na badle**.

---

# HISSE 1 — 🔬 A. AWAAZ: "ek artist bolta hai phir doosra"

### 🔴 F67 · har jumla apni poori seerhi chalta hai (engine/artist badalta hai)
**Saboot:** `RAFTAR.pump()` (index.html:2790) har tukre ke liye `AWAAZ.speak(piece, …)` bulata
hai. `AWAAZ.speak()` (3500) har call par **poori seerhi** dobara chalti hai:
`🐟 Fish → 🎭 Gemini neural → 🌊 Edge → 🌸 Pollen → 📱 phone`, aur `AWAAZ.setEngine()` har tier
par engine badalta hai. In sab ki **awaazein mukhtalif** hain (Fish ka apna voice model,
Gemini ka "Kore", Edge ki Urdu neural awaaz, phone ki robot awaaz).
**Asar:** 3 jumlon ka jawab = 3 alag artist — bilkul wahi jo malik ne suna.
**Purana rawaiya:** ek jawab = **ek** `AWAAZ.speak(poori text)` = ek engine (chunkAndar hi
CHUNK1/CHUNKN se tukre bante the, magar **same model/voice** ke sath).

### 🔴 F68 · `fastForced` ek-dafa istemal hota hai → **oscillation**
**Saboot:** `AWAAZ.speak()` line 3513: `var fastForced = AWAAZ.fastForced; AWAAZ.fastForced = "";`
— yaani "tez tier par jao" ka faisla **sirf agli ek call** ke liye hota hai.
**Asar:** jumla 1 Fish par atka → 1.8s baad Edge par gaya; jumla 2 **wapas Fish** par try hua →
phir atka → phir Edge; jumla 3 shayad Pollen ya phone. Malik ke lafzon mein: *"phr change hoke
phr se pata nhi konsi artist bol rha ha"*.

### 🔴 F69 · TTS request budget toot gaya → quota jaldi khatam → engine girna
**Saboot:** `AWAAZ.CHUNK1 = 300` / `CHUNKN = 1500` (2912) ke sath comment khud kehta hai:
*"ek jawab pehle 4-5 request leta tha, ab aksar 1"* — kyunke Gemini TTS ka free quota ~15/din hai.
RAFTAR ke jumla-dar-jumla bolne se ye optimization **ulti** ho gayi: 3-4 jumlon ka jawab = 3-4
request (+ Fish/Pollen ke apne). 4-5 jawab ke baad din ka quota khatam → `kchill`/`dropModel`
→ engine **Edge/phone** par shift → "pehle Gemini/Fish tha, ab Edge".
**Asar:** sirf awaaz badalna nahi — **poore din** ki neural awaaz jaldi khatam hona.

### 🟠 F70 · jumlon ke beech **gap** (awaaz "kat-ti" hai)
**Saboot:** har naye tukre ke liye network TTS fetch (0.5–2s) **us waqt** shuru hota hai jab
pichla tukra khatam ho (`pump()` onDone ke baad). `AWAAZ.neural()` mein **prefetch** sirf ek hi
piece ke andar hai (`if (idx + 1 < list.length) grab(idx + 1, …)`, 3411) — piece se piece par nahi.
**Asar:** "…main theek hoon." [1.2s khamoshi] "Aap ka din kaisa gaya?" — awaaz ruki ruki.

### 🟡 F71 · har chunk par `AWAAZ.stop()` = pichli dum katne ka khatra
**Saboot:** `AWAAZ.speak()` ka pehla line `AWAAZ.stop()` hai; `stop()` (3617) `edgeTTS_stop()`,
`MayaBridge.stopSpeak()`, `synth.cancel()` aur saare XHR abort karta hai. Chunked bolne mein ye
har jumle par chalta hai — agar pichle tukre ka `onended`/callback zara jaldi aa gaya ho (Edge/Kotlin
ka `onDone` audio khatam hone se pehle), to us ki **aakhri syllable kat** jati hai.

### 🟡 F72 · engine ki sehat **jawab-level** par yaad nahi rakhi jati
**Saboot:** health memory maujood hai magar **tier-level aur daaimi**: `AWAAZ.dropModel()` (Gemini
model), `AWAAZ.pollenBad`, `AWAAZ.kchill()` (key cooldown), `FISH.cool`. "Is **jawab** mein jo
engine chala, baqi tukre bhi wahi chalein" — aisa koi qanoon nahi.
**Asar:** F67/F68 ka doosra chehra; ek hi jawab ke andar bhi tier badal sakta hai.

---

# HISSE 2 — 🔬 B. MIC: "sunai nahi de rahi, baar baar bolna parta hai"

### 🔴 F73 · **turn-lock nahi** — jawab ke beech wake/ambient ghus jata hai
**Saboot:** `__wakeHeard` (9833) ka darwaza: `if (speaking || thinking || listening) { if (!JAWAB.ignore()) return; }`.
J3 se pehle `askAI` `thinking=true` rakhta tha jab tak jawab na aa jaye. **Ab** `RAFTAR.feed()`
pehle token par hi `thinking = false` kar deta hai (2756) aur `speaking` sirf tab true
hota hai jab **audio** shuru ho (`pump.onStart`). Yaani **pehla-token → pehli-audio** ke 0.5–2s
window mein teeno flag false hain → wake qubool → `handleUserText` → **doosra jawab** shuru,
pehla beech mein kata hua.
**Asar:** "awaaz kat rahi hai" + "usne suna hi nahi, reply nahi aaya" (dono jawab ek doosre ko maar dete hain).

### 🔴 F74 · SUKOON ke sirf **3 haal** — "soch rahi hai" ka koi haal nahi
**Saboot:** `SUKOON.haal` = `KHALI | BOL_RAHI | APP_SUN` (WakeState.kt:46). Kotlin ka wake gate
`haalBlock()` (WakeWordService.kt:233) sirf inhi se rokta hai (+ `pausedByApp`, `talkActive`,
`echo tail`). Dimaag soch raha ho, tool chal raha ho (ytSearch **8–16s**!), ya stream ka text aa
raha ho — **haal KHALI rehta hai** → wake ka mic khula. Sirf "baat-cheet mode" ka darwaza rokta
hai, aur wo bhi sirf **wake ke baad** khulta hai (mic button wale turn par nahi).
**Aur:** purana `speak()` (4746) `SUKOON.bolStart()` **fetch se pehle** kar deta tha
(*"fetch ki 1-2s bhi cover — mic abhi nahi khul sakta"*); `RAFTAR.pump()` ye **nahi** karta —
bolStart sirf `onStart` (audio shuru) par. Har tukre ke TTS fetch ka waqt = mic khula.

### 🟠 F75 · `rearm()` turn-lock khol deta hai (tool ke dauraan)
**Saboot:** `RAFTAR.rearm()` (2833) `speaking = false` + `SUKOON.bolEnd()` karta hai — tool-step
ke waqt. Screen/YouTube wale sawal mein tool 1–16 second leta hai: **poore waqt** wake mic khula,
aur user ka agla jumla bhi usi mein ghus sakta hai.

### 🟠 F76 · silence 600ms → transcript **adhura** (bina naape badla gaya number)
**Saboot:** `MainActivity.kt:496` + `WakeWordService.kt:891` ab `600L` (J3 se pehle `700L`).
`EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS` = "itni khamoshi ke baad session khatam".
Urdu/Hindi bolne wale jumle ke beech aksar 0.5–0.9s ka natural pause lete hain.
**Asar:** *"samjh NAHI arha me Kya bol rha hun"* — Maya ko aadha jumla milta hai
("YouTube par ja ke acha sa" … session band), phir wahi cheez dobara bolni parti hai.
**Imaandari:** J1 ke forensic ne isay "naap kar tay karo" kaha tha; J3 ne bina naape 600 kar diya.

### 🔴 F77 · khali transcript = **poori khamoshi** (na jawab, na dobara suno)
**Saboot:** `window.__nativeSpeech` (1560): `if (said && said.trim()) handleUserText(…)` — warna
function **chup-chaap khatam**. Na bubble, na "dobara boliye", na re-listen, na `JAWAB` ka hisaab.
(`JAWAB.sttError` error codes par to bolta hai — magar `onResults` **khali** aaye to koi code nahi aata.)
**Asar:** *"1 Baar boli usne suna hi nhi reply wagera kuch nhi Aya uske pass awaz hi nhi Gai"*.

### 🟡 F78 · kam-yaqeen transcript seedha dimaag ko + interim text hijack
**Saboot:** (a) `SUNO.weak()` wala "Theek se sunai nahi diya — '…' kaha tha?" ka rasta
`FLAGS.on("suno")` ke peeche hai, aur `FLAGS.DEF` (1728) mein **`suno: false`** — yaani kamzor
pehchan par bhi Maya **andaze** se kaam karti hai (ghalat tool, ghalat gaana).
(b) `RAFTAR.feed()` `interimEl.textContent = "💭 …"` likhta hai — **wahi element** jahan STT ka
live transcript (`__nativePartial`, 1562) dikhta tha. Agar stream chalta ho aur user dobara bole,
to usay **apna bola hua text nahi dikhta** ("samajh nahi aa raha main kya bol raha hun" ka UI chehra).

---

# HISSE 3 — 🔬 C. GANA/DIMAAG: "wahi purani TikTok video, dimaag nahi"

### 🔴 F79 · Kotlin `ytSearch()` = response ka **pehla `videoId` regex**
**Saboot:** `MainActivity.kt:712`. Innertube `search` JSON par sirf:
`Regex("\"videoId\":\"([a-zA-Z0-9_-]{11})\"").find(txt)` — **pehla** match.
Ye match kisi bhi block se aa sakta hai: `reelItemRenderer` (Shorts), "related/search feed",
shelf, ya ad. Na **title** dekha jata hai, na **duration**, na music-hone ki koi shart, na
Shorts ko reject kiya jata hai. Fallback HTML path par bhi wahi pehla-regex.
**Asar:** *"TikTok ki salon years purani video"* — 15–30 second ka Short/reel, ya purana clip.

### 🔴 F80 · jo gaana chala us ki **koi yaadasht nahi** → baar baar wahi
**Saboot:** `ytPlay()` (8451): `ytSearch(q)` → `openURL(watch?v=…)` → return. Na `played` list,
na history, na rotation, na "agli dafa doosra result". Same vague query = same first videoId =
**same video har dafa** (bilkul wahi shikayat).

### 🔴 F81 · `thinkingBudget: 0` + `maxOutputTokens: 280` → reasoning band, tool args **kat** jate hain
**Saboot:**
* `geminiTry` (6966) aur `brainAsk`-path (8231): `if (/2\.5|gemini-3/.test(m)) thinkingConfig = { thinkingBudget: 0 }`
  — yaani jis model ko `modelScore()` chunta hai (flash, newest) us par **soch band**. "Koi bhi
  acha gaana lagao" jaisa khula faisla = bina soche pehla andaaza.
* `maxOutputTokens: 280` functionCall ke JSON ko bhi kaat deta hai. Iska **asli saboot** khud
  code mein darj hai (1919): `play_youtube(query="Funk   ← kata hua (asli device par mila)`.
* Aur `SAAF` us kati hui line ko `LONE` regex (1920) se **chup-chaap phenk** deta hai → amal
  gaya, magar model ka matn "chala rahi hoon" keh deta hai = **jhoot**. `HAQEEQAT` (SACH) isi ko
  pakarta hai magar `FLAGS.DEF` mein `sach: false`.

### 🟠 F82 · music ke liye prompt mein **koi hidayat nahi**
**Saboot:** `sysPrompt()` mein J3 ne screen/camera/files ka zikr add kiya, magar gaane ke liye
sirf ek line hai: *"gaana/video -> play_youtube"*. Na query banane ka tareeqa (genre/zubaan/
"official audio"), na **repeat se bachne** ka hukm, na "user ko gaane ka **naam batao**".
**Asar:** model vague query bhejta hai ("acha song") → F79/F80 ka shikaar → user ko lagta hai
"dimaag hi nahi".

### 🟡 F83 · fallback kaam **user par** chhod deta hai, aur search ke dauran khamoshi
**Saboot:** `ytPlay` ka aakhri rasta: search results page khol kar *"pehla wala dabana"*. Aur
`ytSearch` ke 2 tries × 8s timeouts = **16s** tak na koi toast, na awaaz, na log-level feedback.

---

# HISSE 4 — 🏗️ STRUCTURE (amal ka poora naqsha)

Do release, tarteeb se. **K1+K2 pehle** (regression ka ilaj — malik ki awaaz aur mic),
**K3 baad mein** (gaana + reasoning — nayi salahiyat).

## 🎵 K1 — v5.13.5 "EK AWAAZ" · jawab = ek artist, bina kate

| # | Badlaav | Flaw |
|---|---|---|
| **K1.1** | **ENGINE LOCK (jawab-level):** `AWAAZ.lock = { key, engine, at }`. Ek jawab ke liye pehli **kamyab** tier lock; baqi tukre seedha usi tier par (seerhi dobara nahi). Lock sirf tab tootta hai jab wo tier **nakam** ho (phir agli tier, aur wo nayi lock). `AWAAZ.speak(text, {lockKey})` — RAFTAR har tukre par wahi `lockKey` deta hai | F67, F72 |
| **K1.2** | **`fastForced` lock ke sath jur jata hai** (ek-dafa nahi): trip hua to **poora jawab** usi tez tier par | F68 |
| **K1.3** | **TUKRON KA BUDGET (quota wapas):** pehla jumla foran (raftar barqarar), **baqi** jumle jama ho kar — `RAFTAR.HOLD_N = 300` harf ya stream khatam. Nateeja: ek jawab ≈ **2 TTS request** (pehle 3-5) | F69 |
| **K1.4** | **CROSS-CHUNK PREFETCH:** jab tukra N bol raha ho aur tukra N+1 queue mein ho, us ka clip **peeche se** mangwa lo (`AWAAZ.preheat(text)` → `fetchClip` + cache) → beech ka gap khatam | F70 |
| **K1.5** | **stop() ka ehitiyat:** chunked bolte waqt `AWAAZ.stop()` sirf **lock todne** ya user ke roknе par; tukron ke beech `gen` badalna band (warna pichli dum kat-ti hai) | F71 |
| **K1.6** | **Quota pehra:** `AWAAZ.dayTTS` ginti (localStorage, din ke hisab se reset). Gemini TTS ke din ke budget (~12) ke qareeb pohanchte hi **poore jawab** ke liye Edge ko pehle lock karo — beech mein girne se behtar hai shuru se wahi ek awaaz | F69 |
| **K1.7** | **RAFTAR OFF = purana raasta saabit:** LAB switch se streaming band → ek hi `speak()` (jaisa v5.12.5 mein tha). Kill-switch (2 strikes) barqarar | rollback |

**Acceptance (K1):**
1. Ek jawab (3+ jumle) mein **engine NAHI badalta** — panel ka `engine` ek hi naam dikhaye; `AWAAZ.switched` (naya counter) **0**.
2. 5 jawab lagatar bolne ke baad bhi neural (Fish/Gemini/Edge) hi chale — phone ki robot awaaz tab nahi aaye jab network theek ho.
3. Jumlon ke beech ka gap **≤400ms** (prefetch ke sath); pehli awaaz ka p50 **v5.13.0 se behtar ya barabar** (raftar ka faida wapas na jaye).
4. Ek jawab mein TTS request **≤2** (NAAP/RAFTAR panel par ginti nazar aaye).

## 🎙️ K2 — v5.13.5 "PAKKA MIC" · ek turn = ek lock, sunai pakki

| # | Badlaav | Flaw |
|---|---|---|
| **K2.1** | **TURN LOCK:** naya `JAWAB.turn` (start = user ka transcript mila / wake qubool; end = jawab ki awaaz khatam). `__wakeHeard` ka darwaza `speaking‖thinking‖listening‖RAFTAR.active‖JAWAB.turnOpen()` dekhega → stream-text aur tool ke dauraan wake **qubool nahi** (log mein wajah ke sath) | F73, F75 |
| **K2.2** | **SUKOON ka chautha haal `SOCH_RAHI`:** `SUKOON.soStart()`/`soEnd()`; Kotlin `haalBlock()`: `if (haal == "SOCH_RAHI") return "Maya soch rahi hai"`; `WakeState` mein `SOCH_EXP_MS = 45s` (heartbeat/expiry ke sath, taake JS mar jaye to wake daimi band na ho) | F74 |
| **K2.3** | **bolStart TTS fetch se PEHLE:** `RAFTAR.pump()` awaaz mangwane se pehle `speaking = true` + `SUKOON.bolStart()` (purane `speak()` line 4746 ka qanoon wapas); `rearm()` ab **bolEnd nahi** karega | F74, F75 |
| **K2.4** | **silence wapas 700ms (app path), wake par 600ms:** app ka dictation path lambi jumle sunta hai (`MainActivity.kt`), wake sirf "Maya" (`WakeWordService.kt`). Aur ab **naap** kar: NAAP ka naya `heard` mark (mic khulne → transcript) dono settings ke sath compare hoga — agla faisla number se | F76 |
| **K2.5** | **khali transcript ka amal:** `__nativeSpeech` par `said` khali ho to `JAWAB.sttError(7)`-numa rasta — pehli dafa *"Ji? theek se sunai nahi diya, dobara boliye"* + mic dobara; 4 dafa khali to darwaza band + *"main ruk jati hun"*. Chup-chaap `return` **khatam** | F77 |
| **K2.6** | **`suno` default ON** (kam-yaqeen transcript par **poochhna**, andaza nahi) + `SUNO.weak()` ki hadd naapi jaye | F78 |
| **K2.7** | **interim ka adab:** RAFTAR 💭 sirf tab likhe jab `listening === false`; mic khulte hi interim STT ko wapas | F78 |
| **K2.8** | **Mic-doctor line:** KAAN/HAALBAR report mein "aakhri 5 transcript + un ka yaqeen (confidence) + kitni dafa khali aaya" — taake "sunta nahi" ka saboot mile, andaza nahi | F77, F78 |

**Acceptance (K2):**
1. Jawab aate waqt (stream + tool ke dauraan) "Maya" bolne par **doosra jawab shuru NAHI hota** — log mein `wake ignore: turn lock` likha aaye.
2. Maya ke sochte/tool chalate waqt Kotlin wake mic **band** (`haalBlock` = "Maya soch rahi hai") — panel par nazar.
3. Jumle ke beech 0.7s pause par transcript **poora** aaye (10 mein se 9 dafa); user bubble mein wahi likha ho jo bola.
4. Khaali transcript par **kabhi khamoshi nahi** — ya "dobara boliye" ya mic dobara; dono ka hisab KAAN log mein.
5. Ek hi cheez **baar baar** na bolni pare: 10 koshishon mein se ≥8 pehli baar mein qubool.

## 🎧 K3 — v5.14.0 "GANA DIMAAG" · gaana soch samajh kar

| # | Badlaav | Flaw |
|---|---|---|
| **K3.1** | **Kotlin `ytSearchList(query, max)`** — Innertube `videoRenderer`/`compactVideoRenderer` blocks se **{id, title, secs, owner}** ki list (JSON). **Shorts/reel/ad blocks reject**. Purana `ytSearch()` isi ka pehla item (compatibility barqarar). Timeout 6s + ek fallback | F79 |
| **K3.2** | **`GANA` module (JS):** query banana (user ke lafzon se genre/zubaan/"official audio"), `GANA.played` (aakhri 30 video id, localStorage) → **repeat mana**, agli behtareen candidate; duration filter (2–8 minute = asli gaana, 15s reel nahi); **title wapas** taake Maya bata sake "ye gaana chala rahi hoon: …" | F79, F80 |
| **K3.3** | **"koi bhi" ka pakka hal (malik ka faisla: POOCHHO, andaza nahi):** vague hukm par Maya ek chhota sawal karti hai — *"kaunsa gaana ya artist lagaun?"* — aur `GANA.pending` darj karti hai; agla jumla (darwaza khula hone par bina "Maya" ke bhi) **gaane ka naam** samajh kar wahi chalaya jata hai. ~~curated list~~ **mansookh** | F80, F82 |
| **K3.4** | **Tool-args ki hifazat:** tool wale step par `maxOutputTokens: 512` (280 nahi); `finishReason === "MAX_TOKENS"` + adhura functionCall → **ek retry** bare budget ke sath; aur SAAF ke `LONE` se kati hui tool-line par **HAQEEQAT ko bulao** (jawab "chala rahi hoon" jhoota na ban jaye) | F81 |
| **K3.5** | **Adaptive thinkingBudget:** `0` chhoti/seedhi baat-cheet aur tool-turn ke liye (raftar barqarar); **256–512** khule/ambiguous faislon par (gaana chunna, "kuch acha batao", planning, pehli tool koshish nakaam). Faisla `needsTools` + ek chhote "openness" detector se | F81 |
| **K3.6** | **Prompt ka music hissa:** "gaane ke liye query mein zubaan/genre/'official audio'; user ko **naam** batao; ek hi gaana baar baar na lagao; 'koi bhi' ka matlab **acha** gaana, ajeeb clip nahi" | F82 |
| **K3.7** | **Search ke dauran khabar:** `ytPlay` shuru hote hi ek chhoti line ("🎧 dhundh rahi hoon…") + 6s mein nakaam to search page + **saaf** batana | F83 |

**Acceptance (K3):**
1. "YouTube par koi bhi acha gaana lagao" → **asli gaana** (2–8 min, music title) chale, Shorts/reel na chale.
2. Lagatar 5 dafa wahi hukm → **5 mukhtalif** gaane (koi repeat nahi); Maya har dafa **naam bataye**.
3. "Funk Taka lagao" → wahi artist/track chale (naam pehchan `SUNO` se barqarar).
4. Tool args kabhi **kate hue** na milen: NAAP/log mein `MAX_TOKENS retry` ki ginti nazar aaye, aur kati hui line par HAQEEQAT jawab ko "chala rahi hoon" se badal kar imaandari bana de.
5. Reasoning ka bojh naap kar: simple sawal par `thinkingBudget 0` (raftar wahi), khule sawal par budget chalu — dono RAFTAR panel par nazar.

## 📊 K4 — NAAP (dono release ke sath, chhota)
* `AWAAZ.switched` (engine badalne ki ginti per jawab), `AWAAZ.ttsReq` (request ginti), `AWAAZ.lockEngine`.
* `JAWAB.turnOpen/turnBlocks` (turn-lock ne kitni wake roki), `NAAP.mic` (khali transcript ki ginti, confidence).
* `GANA.played/n`, `ytList` ka haal (kitne candidate mile, kitne Shorts reject hue).
* Sab `NAAP.report()` / RAFTAR PANEL mein — **saboot, andaza nahi** (F58 ka qanoon barqarar).

---

## 5. 🧪 Test-lock plan

| Release | Section | Taale |
|---|---|---|
| v5.13.5 (K1+K2) | **Section 37** | ~30: engine-lock ka amal (jsdom mein naqli AWAAZ tiers ke sath: 3 tukre = 1 engine), fastForced persist, HOLD_N batching (≤2 request), prefetch, turn-lock (`__wakeHeard` ignore + log), `SOCH_RAHI` → Kotlin `haalBlock` string lock, `WakeState.SOCH_EXP_MS`, bolStart-before-fetch, 700L/600L split, khali transcript ka amal, `suno: true`, interim adab |
| v5.14.0 (K3) | **Section 38** | ~24: `ytSearchList` ka JSON shape (Kotlin source locks), `GANA` ka no-repeat (jsdom: 5 dafa = 5 mukhtalif), duration/Shorts filter, curated rotation, `maxOutputTokens 512` + MAX_TOKENS retry, adaptive thinkingBudget ke dono raste, prompt music locks, HAQEEQAT ki dakhil-andazi |
| dono | purane sections | 1375 taale barqarar — koi regression nahi (J3 ke 55 locks mein se jo rawaiya badlega, **un ki niyyat** barqarar rakhte hue update) |

## 6. ⚠️ Risk aur wapsi ka rasta
* **Engine lock** ek tier par jam sakta hai → lock sirf **nakami** par tootta hai + `FAST` budget barqarar (dead air wapas nahi aayega).
* **HOLD_N batching** se raftar thori kam ho sakti hai → pehla jumla **foran** barqarar; NAAP ka `first` p50 v5.13.0 se behtar ya barabar rahe, warna HOLD_N ghataya jayega (number se faisla).
* **`SOCH_RAHI`** Kotlin mein naya haal hai → expiry (45s) + heartbeat se JS marne par wake **khud** wapas; LAB ka `sukoon` switch escape hatch barqarar.
* **silence wapas 700ms** = har turn par 100ms dheema → K2.4 ke sath **naap** darj hogi (heard→brain), agla faisla number se.
* **Curated gaana list** = hard-coded content → sirf "koi bhi" wale vague hukm par; user ka naam liya hua gaana hamesha search se.
* Har release ke baad **Qanoon 9** ka parcha (`REPORT-<ver>-aam-zubaan.md`) + CI ✅ ka saboot.

## 6.1 ✅ Malik ke faisle (2026-09-08)

1. **Sab EK release mein** — K1 + K2 + K3 ek sath → **v5.14.0 "EK AWAAZ"** (do release nahi).
2. **Gaana: andaza NAHI, POOCHHO** — "koi bhi acha gaana" par Maya **sawal** karegi
   ("kaunsa gaana ya artist?"), aur jawab milte hi wahi lagayegi. Is liye **K3.3 (curated
   rotating list) MANSOOKH** — koi hard-coded gaanon ki fehrist nahi. Barqarar: `ytSearchList`
   (title/duration, Shorts reject), `GANA.played` memory (**repeat mana**), aur naam milne par
   pakka search.

## 7. 🚦 Tarteeb (amal)
1. **v5.13.5 "EK AWAAZ · PAKKA MIC"** (K1+K2) — regression ka ilaj, sab se pehle. *Andaza: 1 din.*
2. **v5.14.0 "GANA DIMAAG"** (K3+K4) — nayi salahiyat + reasoning. *Andaza: 1–1.5 din.*
3. Us ke baad purana roadmap: J4 ki barikiyan (Urdu rate/pitch, prosody) → Phase 2 (WAKE DOCTOR v2) → Phase 2.5 (auto-update F43) → Phase 3 (wake brain Kotlin) → Phase 4 (offline KWS = mic dot SAABIT).

**Qanoon barqarar:** plan-doc-first · har flaw ka saboot (line number) · bina naape koi number
na badle · har release ke baad aam zubaan mein report + CI saboot · jo cheez theek na ho sakti ho
us ki **imaandari** (jaisa mic-dot ke bare mein likha gaya hai).
