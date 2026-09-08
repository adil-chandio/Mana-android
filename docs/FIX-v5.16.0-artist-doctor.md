# 🛠️ FIX — v5.16.0 🩺 ARTIST DOCTOR

**Tarikh:** 2026-09-08 · **Branch:** `arena/01a062e9-mana-android` · **Bunyaad:** v5.15.0 🎙️ MERI AWAAZ
**Forensic:** `docs/FORENSIC-AWAAZ-DOCTOR.md` (F102–F113) · **Qanoon 9 report:** `docs/REPORT-v5.16.0-aam-zubaan.md`

> v5.15.0 ne qanoon banaya: **jo artist aap ne chuna, sirf wahi bolegi.** v5.16.0 us qanoon ke
> **darwazon** ko theek karta hai — jo option dead tha use zinda kiya, jo hijack karta tha use band kiya,
> jo dead-end tha use khola, aur **har awaaz ka muaina** (🩺 ARTIST DOCTOR) ek jagah laaya.
> Qanoon khud wahi hai: artist kabhi khud nahi badalta.

---

## K6.1 — "🔁 Sirf dobara koshish" policy **zinda** (F102)

**Pehle:** UI aur toast waada karte the ("sirf usi artist par dobara koshish karegi"), magar
`artistFail()` mein `dobara` ka koi branch hi nahi tha — wo `poochho` wale bucket mein gir kar
`sawal` bhi nahi poochhta tha aur `koshish` bhi nahi karta tha. **Dead option** (bilkul F84/F85 jaisa).

**Ab:**
- `AWAAZ.POL_RETRY = 1`, `POL_RETRY_DELAY = 2500`, `polRetries` (budget).
- `pol === "dobara"` + rukawat **permanent na ho** + text maujood ho →
  `polRetries++`, `note("")`, isi jawab ke baqi tukron par `hush`, aur `POL_RETRY_DELAY` ke baad
  **usi artist** par dobara `speak()` (`cb.forceEngine = c.mode`, `chain = true`) — `gen` guard ke sath,
  taake aap ne rok diya ho ya naya jawab shuru ho gaya ho to purani koshish zinda na ho.
- Retry chalte waqt apni hi `hush` se ruk na jaye → timer ke andar `hush = false` pehle.
- Koshishen khatam ya **permanent** code (QUOTA/KEY/OFFLINE/TOO_LONG…) → sach likha jata hai
  ("dobara bhi nahi bol saki — <wajah>"), **sawal nahi** (aap ne "poochho mat" kaha tha).
- Budget har naye jawab par tazaa: `lockBegin()` → `polRetries = 0`.

**Na badla:** artist wahi rehta hai — retry kabhi doosre engine par nahi jata.

## K6.2 — "🤫 Chup" policy **waqai chup** (F103)

**Pehle:** `chup` bhi usi bucket mein tha → `AWAAZ.ask` banta tha (yani agle 90s mein hijack ka
darwaza khula), `tellFail()` bubble **aur** toast dono karte the. Jis ne "sirf likho" kaha usay
shor milta tha.

**Ab:** `pol === "chup"` ka apna branch —
`silentFails++` · `hush = true` (baqi tukre chup) · sirf `pushLog` (debug log) ·
**NA `ask`, NA bubble, NA toast.** Jawab screen par likha rehta hai (wo pehle se likha jata hai),
sach PANEL + `status()` + doctor ke aankron mein rehta hai — jhoot nahi, bas aap ki marzi ki khamoshi.

## K6.3 — Jawab ka **hijack guard** (F104)

**Pehle:** `answer()` ka "once" regex unanchored aur bohat chauda tha
(`haan|ji|ok|theek|bolo|bolun|abhi|ek dafa|sirf ab|edge|fish|gemini|phone|device|awaz|awaaz`).
Nakami ke sawal ke 90 second ke andar aap ka **naya hukum** bhi jawab samjha jata tha:
`theek hai, alarm 7 baje laga do` → purana text Edge se dobara, **alarm gum**.

**Ab:** `AWAAZ.answerOk(t)` guard — jawab **qabool** sirf agar:
| Shart | Wajah |
|---|---|
| lambai ≤ `ANSWER_MAX` (40) | jawab chhota hota hai, hukum lamba |
| `?` / `؟` na ho | sawal = naya sawal, jawab nahi |
| koi number na ho (`0-9`, `۰-۹`) | waqt/miqdar ka hukum ("7 baje", "5 minute") |
| `CMD_RE` ka lafz na ho | alarm/timer/call/sms/kholo/bhejo/balance/mausam/kitna/kaise/kaun/kab… |

Guard fail → `answer()` `null` → `handleUserText` ka pehle se maujood raasta (6087) `ask` bhool kar
**aap ka hukum** chalata hai. Jawab ki pehchaan wahi purani hai (dobara/chup/hamesha/sirf ab) —
sirf hijack band hua.

## K6.4 — "sirf ab … se bolo": engine **aur awaaz** (F106)

**Pehle:** `tellFail()` ikhtiyar likhta tha `② "sirf ab 🌊 EDGE — ur-PK-UzmaNeural se bolo"` magar
`applyAnswer()` sirf `cb.forceEngine` bhejta tha — waada ki hui **awaaz** kahin nahi jati thi
(`onceArtist` set hi nahi hota tha, aur `speak()` use saaf kar deta).

**Ab:** `once` par `AWAAZ.onceArtist = ARTIST.parse(r.id)` + `cb.once = true`, aur `speak()` ki safai
`if (!cb.audition && !cb.once)` — yaani "sirf ab" wali pasand **usi jawab bhar** chalti hai
(`edgeVoice()`/`voiceId()` dono isi ko dekhte hain), agle aam jawab par khud saaf.

## K6.5 — Strict + `TOO_LONG` ka **dead-end khatam** (F107)

**Pehle (ginti se):** `CHUNKN = 1500` (tukron ki lambai) > `maxChars = 1400` (Gemini ki hadd) →
1401–1500 chars ka tukra aam hai → `blockReason()` = `TOO_LONG` → `PERMANENT` mein hai → retry nahi →
sawal, magar chaaron ikhtiyar bekaar ("dobara" = wahi text = wahi nakami). AUTO ladder bach jata tha;
**strict user ko khamoshi milti thi.**

**Ab:** `onlyArtist()` mein `blk === "TOO_LONG"` par `AWAAZ.chunks(text, max(200, maxChars-40))` se
tukre, aur har tukra **usi artist** par `AWAAZ.neural()` se, sequentially, `gen` guard ke sath.
`longSplits++` ginti (doctor/PANEL ke liye). Qanoon barqarar: artist wahi, awaaz nikalti hai.
Agar tukre ban hi na sakein (1 tukra) → purana fail raasta.

## K6.6 — Edge id ka **saboot** + purane engine naam (F108, F113)

- `ARTIST.edgeOk(v)`: `EDGE_TTS.has(v)` ya Microsoft ka qanooni naam
  (`/^[a-z]{2}-[A-Za-z]{2,4}-[A-Za-z]+Neural$/`). `parse()` mein ghalat id → khaali → `EDGE_TTS.pick()`
  se qanooni pasand. Pehle ghalat/purana id har tukra nakam karta tha aur wajah saaf nahi aati thi
  (Gemini ke liye `geminiOk()` tha, Edge ke liye kuch nahi — do darje).
- **F113:** `parse("neural")` / `parse("gemini")` ab `g:<gVoice>` banta hai. Pehle ye chup-chaap
  `auto` ban jata tha → `strict = false` → **aap ka 🔒 qanoon khamoshi se khatam**. (Ye flaw naye
  tests likhte waqt pakda gaya — saboot: `ARTIST.cur().strict === true` + `voice === gVoice`.)

## K6.7 — Muddat ka **ek hi saboot** (F105)

`AWAAZ.askLive()` = `ask && (Date.now() - ask.at) < ASK_MS`. `answer()` pehle `askLive()` dekhta hai,
is liye **baasi sawal** par koi bhi caller amal nahi kar sakta. `handleUserText` ka maujooda check
wahi raha (locks barqarar) — do darwaze, ek hi qanoon.

## K6.8 — 🩺 **ARTIST DOCTOR** (F109, F110, F111)

**Pehle:** teen doctor the magar sab apne-apne engine ke (Gemini keys, Fish, KAAN). v5.15.0 ne K5.8
ke naam par sirf `status()` fields + PANEL line di — **per-artist muaina nahi.**

**Ab:** `AWAAZ.artistDoctor()` — **synchronous, bina network** (is liye offline bhi chalta hai aur
test bhi ho sakta hai). Report:
- Aap ki pasand (🔒 strict / 🤖 AUTO) + id · nakami policy + uska matlab · abhi kaun boli ·
  pehla tukra kitni **ms** mein · aakhri galti + insani wajah · warm-up kab hui.
- **🐟 FISH:** tayyar? · bridge/APK (CORS ka sach) · awaaz · boli kitni dafa · latency · cache `n/6` +
  cache-hit + warm kab.
- **🎭 GEMINI:** tayyar? + rukawat ka code aur insani wajah · keys (likhi/zinda) · key kharab? ·
  cooldown · awaaz · model · roz ka quota `n/12` + session requests · clip cache `n/12` + hit ·
  KEY_BAD par "keys check karo" ka ishara, QUOTA par "quota project par lagta hai" ka sach.
- **🌊 EDGE:** tayyar? · voices count · pasand + **sabit/ghalat** (`edgeOk`) · boli · latency ·
  "har tukra stream hota hai, clip cache mumkin nahi" ka sach.
- **📱 PHONE:** kitni awaazein · zubaan · pasand · boli · latency.
- **Hisab (is session):** boli · usi par retry · policy retry · nakam · ijazat maangi · sach bataya ·
  chup · lambe tukre · preheat · artist badla (ijazat se) · sawal zinda hai ya nahi.
- **Nateeja:** strict par "aap ki pasand tayyar hai ✅" ya "tayyar nahi ❌ — wajah; policy X chalegi;
  sab se pehle tayyar: <engine> (ijazat dein to wahi chalegi)"; AUTO par "machine chunegi + kaun tayyar hai".

**Iske sath (F111):** `onplay` par `AWAAZ.lat[engine] = audioAt - tStart` (pehla tukra kitni der mein
bola) — doctor, `status().lat`, aur PANEL isi se sach bolte hain. Lab lock (`a.onplay = function` +
`AWAAZ.audioAt`) barqarar.

**Aur (F109):** `AWAAZ.deviceSpoke` counter add hua — pehle phone ki awaaz ka koi hisaab hi nahi tha,
doctor "0 dafa" ka jhoot bolta. Gemini ke liye maujood `AWAAZ.spoke` istemal hota hai
(phantom `neuralSpoke` nahi — jhoota field banaya hi nahi gaya).

**UI:** `#artistDocBtn` ("🩺 ARTIST DOCTOR — har awaaz ka muaina") + `#artistDocOut`
(`class="ui-pre"` — wahi convention jo `#fishDocOut`/`#awaazDocOut` ka hai) + `window.awaazArtistDoctor()`.

**F109 (namoona live jawab kaat-ta hai):** ilaaj nahi, **imaandari** — namoona aap ka dabaya hua
button hai, is liye rokne ki ijazat nahi; ab `lastAuditionAt` darj hota hai aur report/docs mein saaf
likha hai ke namoona chal rahe jawab ko rok deta hai.

## K6.9 — Tests, docs, version

- **voice Section 20** (`tools/test-voice-engine.js`): **+49** behavioral taale — dobara policy ka
  retry (usi artist par, bubbles 0, budget tazaa), permanent par zaya retry nahi, chup policy
  (0 bubble/0 toast/0 ask + hush), hijack guard (alarm/balance/sawal/youtube → null; asal jawab → wahi),
  `answerOk` unit (lambai/number/؟), "sirf ab" mein awaaz + agli safai, TOO_LONG split (usi artist,
  `longSplits`), `edgeOk` + F113, `askLive` baasi sawal, doctor (lines, sar-naam, charon artist,
  hisab, nateeja, **0 network request**, latency/ginti/quota ka sach), `deviceSpoke`, aur
  "koi bhi" policy ka regression (ladder + sach + ginti).
- **lab Section 40** (`tools/test-lab-engine.js`): **+46** source/docs taale (policies ke branches ka
  slice-muaina, hijack guard ki shartein, doctor ka bina-network saboot, UI wiring, PANEL, docs, version).
- Docs: ye record + `docs/REPORT-v5.16.0-aam-zubaan.md` (Qanoon 9) + forensic (F102–F113).
- Version: **5.16.0 / vc81 / 🩺 ARTIST DOCTOR** · `5.16.0-native` · `maya-v5.16.0` ·
  `PERSONAL AI v5.16.0 ✨` · toast: "MAYA v5.16.0 • 🩺 ARTIST DOCTOR: policies ka asal amal
  (dobara/chup) · naya hukum hijack nahi hota · har awaaz ka muaina ek jagah".
- PANEL mein naye aankre: `policy retry · chup · lambe tukre · pehla tukra <ms>` (purane `🎙️ MERI
  AWAAZ:` hisaab ke sath).

**Kul test:** **1697** (settings/CSS 101 · voice **397** · brain 155 · lab **1044**) — sab GREEN.
(v5.15.0 mein 1602 the; **+95** naye taale: voice Section 20 = **49**, lab Section 40 = **46**.)

---

## ⚠️ Kya adhoora hai (imaandari)

1. **Asal phone par test nahi hua** — yahan sirf code + 1691 automated taale. TECNO KL4 (Android 14,
   WebView 152) par mic/latency ka asli tajurba aap ko karna hoga.
2. **Edge ka preheat voices tak mehdood** — Edge har tukre par Microsoft se WS stream karta hai;
   clip cache mumkin nahi (doctor yehi sach likhta hai).
3. **Fish ka cache sirf preheat se bharta hai** — bina preheat wale raaste par pehla tukra network se.
4. **Gemini par network warm-up nahi** (quota pyara) — pehla tukra 0.3–1s der se aa sakta hai.
5. **`dobara` policy ka budget 1 retry hai** (`POL_RETRY = 1`) — be-inteha retry loop jaan-boojh kar
   nahi (battery/data/UX). Permanent codes par retry hi nahi.
6. **Hijack guard ek blocklist hai** (`CMD_RE`) — Urdu ke har hukum ka lafz us mein nahi. Baqi bachao:
   lambai (≤40), sawal ka nishaan, aur number. Koi naya hukum ka lafz nikle to `CMD_RE` mein add hoga.
7. **Doctor ki latency sirf "pehla tukra"** naapti hai (poore jawab ka waqt nahi), aur sirf us engine
   ka jo asal mein bola — jis engine ne kabhi bola hi nahi, uski latency `0ms` (yaani "naapa nahi gaya").
8. **`lockKey` khaali ho to `hush` be-asar** (F112) — guard jaan-boojh kar nahi chhera, warna
   streaming jawab ka wada (K1.5/F71) toot-ta. Nateeja: bina lock wali ek-dafa speak par sawal
   dohra sakta hai (aam istemal mein har jawab lock ke sath hota hai).
9. **Naya APK/install zaroori hai** — purane v5.15.0 APK par ye policies dead hi rahengi.

---

## Release record

| | |
|---|---|
| Commit | `31d4645` — branch `arena/01a062e9-mana-android` (12 files, +934 / −37) |
| CI | run `34260153846` ✅ SUCCESS · job `build` |
| APK | artifact `MAYA-APK` = 3,270,237 bytes (~3.27 MB) |
| Tests | 1697 GREEN (lab 1044 · voice 397 · brain 155 · settings/CSS 101) |
| Version | 5.16.0 · vc81 · 🩺 ARTIST DOCTOR · `5.16.0-native` · `maya-v5.16.0` |
