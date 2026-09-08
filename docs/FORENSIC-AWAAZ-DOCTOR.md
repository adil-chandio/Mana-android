# 🔬 FORENSIC — v5.16.0 🩺 ARTIST DOCTOR

**Tarikh:** 2026-09-08 · **Branch:** `arena/01a062e9-mana-android` · **Bunyaad:** v5.15.0 🎙️ MERI AWAAZ (`aec0350`)
**Tareeqa:** v5.15.0 ke apne code par microscope — har policy, har promise, har regex, har dead-end.
Saboot = line numbers (`public/index.html`, jo `app/src/main/assets/web/index.html` ka mirror hai).

> v5.15.0 ne qanoon bana diya: **jo artist aap ne chuna, sirf wahi bolegi.** Ab sawal ye hai ke
> us qanoon ke **charon darwaze** waqai kaam karte hain, ya koi darwaza khokhla hai (jaise v5.14.0
> tak `#artistGrid` khokhla tha — F84). Nateeja: **3 dead/khokhle darwaze**, 1 hijack, 1 dead-end,
> aur K5.8 (AWAAZ DOCTOR) adhoora — neeche saboot ke sath.

---

## F102 — "🔁 Sirf dobara koshish" policy **DEAD** hai (promise UI par, amal zero)

**Saboot:**
- UI ka waada (11857): `["dobara", "🔁 Sirf dobara koshish"]`
- Toast ka waada (11873): `"🔁 Sirf usi artist par dobara koshish karegi"`
- Amal (3869-3899 `artistFail`): `pol` parhne ke baad sirf **ek** branch hai —
  `if (pol === "koi_bhi" || (cb && cb.forceAuto))` (3876). `dobara` us ke baad wale
  "poochho/chup" bucket mein girta hai (3890-3899): `AWAAZ.ask` banta hai,
  `tellFail(code, c, pol === "poochho")` → `withAsk = false`.
- Yaani: **na koi dobara koshish, na sawal** — sirf ek bubble. Option chuna gaya, kuch nahi hua.

**Nuqsan:** user ne "mujh se poochho mat, khud dobara koshish karo" kaha; app ne na poochha na koshish ki.
Ye bilkul wahi khami hai jo F84/F85 thi (control zinda dikhta hai, andar se murda).

**Ilaj (K6.1):** `dobara` ka apna branch — permanent rukawat na ho to **usi artist** par
`POL_RETRY` (1) aur koshish `POL_RETRY_DELAY` (2500ms) baad, bina sawal; is jawab ke baqi tukre
`hush` se chup (dobara nakami ka shor nahi). Koshishen khatam ya permanent code → sach likha jaye,
sawal NAHI. `polRetries` ka budget har naye jawab par `lockBegin()` se tazaa.

---

## F103 — "🤫 Chup" policy **bolti hai** (bubble + toast + sawal)

**Saboot:**
- UI ka waada (11858): `["chup", "🤫 Chup — sirf likho"]`; toast (11871): `"🤫 Awaaz nakaam hui to sirf likhegi"`
- Amal: `chup` bhi usi bucket mein (3890-3899) → `AWAAZ.ask = {...}` (3891) + `tellFail()` (3898)
  jo `addBubble("ai", q)` (3919) aur `toast(...)` (3920) **dono** karta hai.
- Aur `ask` banne ka matlab: agle 90 second mein jo bhi chhota message aaya, F104 wala hijack ho sakta hai.

**Nuqsan:** jis user ne "chup raho, sirf likho" kaha usay chat bubble + toast + (indirect) sawal milta hai.

**Ilaj (K6.2):** `chup` ka apna branch — NA `ask`, NA bubble, NA toast. Sach sirf `pushLog` +
PANEL + `status()`/DOCTOR ke aankron mein (`silentFails++`), aur `hush` on taake baqi tukre
baar baar nakam na hon. Jhoot nahi — khamoshi aap ki marzi se.

---

## F104 — Jawab ka regex **hijack** karta hai: asli hukum gum

**Saboot:**
- `answer()` (3925-3934), khaas taur par 3933:
  `/(haan|ji|ok|theek|bolo|bolun|abhi|ek dafa|sirf ab|edge|fish|gemini|phone|device|awaz|awaaz)/`
  — **unanchored**, bina lambai ki hadd, bina sawal/number/hukum ki pehchaan.
- `handleUserText` (6079-6090): ask zinda ho (`ASK_MS` 90000, 3810) to `AWAAZ.answer(stripped)`
  chalta hai; jawab mila to `applyAnswer()` → **purana text** dobara bola jata hai aur `return` (6084)
  — yaani aap ka naya hukum **chala hi nahi jata**.

**Asal misalein (90s ke andar nakami ke baad):**
| Aap ne likha | App ka amal | Sahi amal |
|---|---|---|
| `theek hai, alarm 7 baje laga do` | "once" → purana jawab Edge se; **alarm gum** | alarm lagana |
| `ok mera balance check karo` | "once" hijack | balance check |
| `abhi mausam kaisa hai?` | "once" hijack | mausam ka jawab |
| `ji haan` | once ✅ | once ✅ (ye theek hai) |

**Nuqsan:** v5.15.0 ne FAST hijack (F90) band kiya tha; ye **doosra hijack** isi jagah paida hua —
machine wahi karti hai jo aap ne nahi kaha. Qanoon ke khilaf.

**Ilaj (K6.3):** `answer()` se pehle **guard** `answerOk(t)`:
lambai ≤ `ANSWER_MAX` (40) · sawal ka nishaan (`?`/`؟`) nahi · koi number (`0-9`, `۰-۹`) nahi ·
hukum ka lafz (`CMD_RE`: alarm/timer/call/sms/kholo/bhejo/balance/mausam/kitna/kaise/kaun/kab…) nahi.
Guard fail → `answer()` null → ask bhool kar **aap ka hukum** chalta hai (6087 ka raasta pehle se maujood).
Purane broad regex wahi rehte hain (jawab ki pehchaan badli nahi, sirf hijack band hua).

---

## F105 — `ask` ki muddat sirf ek jagah check hoti hai

**Saboot:** `answer()` (3926) `AWAAZ.ask` dekhta hai magar `at`/`ASK_MS` nahi; muddat ka check sirf
`handleUserText` (6079) mein hai. Yaani `answer()` ka har doosra caller (future code, doctor, console)
**baasi sawal** par amal kar sakta hai.

**Ilaj (K6.7):** `askLive()` helper; `answer()` pehle `askLive()` dekhe. `handleUserText` ka
maujooda check wahi rahega (test-lock 3836/lab + 1353/voice barqarar).

---

## F106 — "sirf ab 🌊 EDGE — Urdu se bolo": engine jata hai, **awaaz nahi**

**Saboot:**
- `tellFail()` (3902-3906) ikhtiyar likhta hai: `"② \"sirf ab " + alt.n + " se bolo\""` —
  `alt.n` mein **awaaz ka naam** hota hai (jaise `🌊 EDGE — ur-PK-UzmaNeural`, `ARTIST.parse` 3023-3027).
- `applyAnswer()` (3944): `cb.forceEngine = ARTIST.parse(r.id).eng;` — sirf **engine**.
- `edgeVoice()` (3819-3828) `onceArtist` dekhta hai, magar `applyAnswer` `onceArtist` set hi nahi karta;
  aur `speak()` (3987) `if (!cb.audition) AWAAZ.onceArtist = null;` — set kar bhi dete to saaf ho jata.

**Nuqsan:** waada "Urdu (Uzma) se bolo" ka, amal `settings.edgeVoice` (koi aur awaaz) par. Chhota
farq lagta hai, magar ye usi bimari ki nishani hai: **jo likha, woh kiya nahi.**

**Ilaj (K6.4):** `applyAnswer` ke `once` raaste par `AWAAZ.onceArtist = ARTIST.parse(r.id)` +
`cb.once = true`; `speak()` ki safai `if (!cb.audition && !cb.once)` — yaani "sirf ab" wali pasand
usi jawab bhar chale, agle aam jawab par khud saaf (voice test 1329 ka wada barqarar).

---

## F107 — STRICT + `TOO_LONG` = **dead-end** (na retry, na koi kaam ka ikhtiyar)

**Saboot (ginti se):**
- `CHUNKN: 1500` (3176) — baqi tukron ki lambai; `chunkPlan()` (3489-3495) usi se kaat-ta hai.
- `maxChars: +(s.neuralMaxChars || 1400)` (3244) — Gemini ki hadd.
- `blockReason()` (3322): `if (text && text.length > c.maxChars) return "TOO_LONG";`
- **1401–1500 chars ka tukra aam hai** (chunkPlan maxChars se bara tukra bana sakta hai).
- `PERMANENT` (3815) mein `TOO_LONG` hai → `onlyArtist` ka retry (3838) chalta hi nahi →
  `artistFail` → `poochho` par sawal, magar chaaron ikhtiyar bekaar:
  "dobara koshish" = wahi text = wahi nakami; "koi bhi" = ladder par bhi `blockReason` wahi code dega
  (Gemini tier par), "chup" = khamoshi.
- AUTO mode bach jata tha (ladder Edge/phone par gir jati thi) — **strict user par qanoon ki qeemat
  khamoshi ki surat mein aati hai.**

**Ilaj (K6.5):** strict mein `TOO_LONG` par **usi artist** par tukre kar ke bolo:
`AWAAZ.chunks(text, maxChars-40)` → har tukra `AWAAZ.neural()` se, sequentially, `gen` guard ke sath.
Qanoon barqarar (artist wahi), khamoshi khatam, `longSplits` ginti doctor ke liye.

---

## F108 — Edge ki awaaz ki **jaanch nahi** (ghalat id = har tukra nakam)

**Saboot:** `ARTIST.parse()` (3023-3027): `edge:<id>` se `id` jaisa hai waisa rakha jata hai;
sirf **khaali** ho to `EDGE_TTS.pick()` (4622) chalta hai — jabke `pick()` khud jaanch karta hai
(`EDGE_TTS.has(chosen)` 4624 ya `/^[a-z]{2}-[A-Za-z]{2,4}-[A-Za-z]+Neural$/` 4625).
`edgeVoice()` (3825) `c.artistVoice` ko raw chalata hai → Microsoft se `No voice found` →
har tukra nakam → user ko wajah saaf nahi dikhti. Gemini ke liye `geminiOk()` (3011) maujood hai;
Edge ke liye koi `edgeOk()` nahi — **do engine, do darje.**

**Ilaj (K6.6):** `ARTIST.edgeOk(v)` (list mein ho ya qanooni Neural naam); `parse()` mein
ghalat id ko khaali kar ke `pick()` par bhejo — yaani pasand zinda rahe, magar saboot ke sath.

---

## F109 — Namoona (🔊) chalta hua jawab **kaat** deta hai, chup-chaap

**Saboot:** `speakOnce()` (3950-3961): `AWAAZ.stop(); AWAAZ.gen++;` → chal rahe jawab ke baqi tukre
`gen` check (3836/3990 wale raaste) par murda ho jate hain; user ko koi khabar nahi milti
(`toast` sirf artist set/change par hai, 3119-3121).

**Faisla:** ye **ilaaj nahi, imaandari** ka maamla hai — namoona aap ka dabaya hua button hai, is liye
roka nahi jayega; magar doctor/status mein `lastAuditionAt` darj hoga aur docs mein likha jayega ke
namoona chal rahe jawab ko rok deta hai (K6.8 + REPORT).

---

## F110 — **ARTIST DOCTOR maujood hi nahi** (K5.8 adhoora ship hua)

**Saboot:** teen doctor pehle se hain magar sab **apne-apne engine** ke:
`AWAAZ.doctor()` (keys — 4268+ / 4496), `FISH.doctor()` (5279), KAAN DOCTOR (10536).
v5.15.0 ne K5.8 ke naam par sirf `status()` ke fields (4259-4262) + PANEL line (2971) di —
**per-artist muaina nahi**: kaun tayyar hai? key/bridge hai? aakhri galti kya thi? kitni der mein boli?
quota kitna bacha? warm hui? cache kitna bhara? — ek jagah, bina network chhede, koi screen nahi.

**Ilaj (K6.8):** `AWAAZ.artistDoctor()` — **synchronous** (koi request nahi, is liye test bhi ho sakta hai):
har artist ka line-by-line haal + pasand/policy + ginti (boli/retry/nakam/ijazat/sach/silent/split) +
latency + nateeja ("aap ki pasand tayyar hai / ye rukawat hai"). UI: `#artistDocBtn` + `#artistDocOut`
(`class="ui-pre"`, wahi convention jo `#fishDocOut` 968 aur `#awaazDocOut` 1101 ka hai).

---

## F111 — Latency ka koi hisaab nahi (doctor "kitni der" ka jawab nahi de sakta)

**Saboot:** `audioAt` (3198) aur `tStart` (3998) maujood hain, magar `onplay` (3653) sirf
`AWAAZ.audioAt = (new Date()).getTime();` likhta hai — **farq** kahin darj nahi hota, aur engine ke
hisab se alag nahi. `status()` (4238-4265) mein latency ka koi field nahi.

**Ilaj (K6.8):** `onplay` par `AWAAZ.lat[engine] = audioAt - tStart` (pehla tukra kitni der mein bola)
+ `status()` mein `lat` — doctor aur PANEL dono isi se sach bolenge. Lab lock 3038 (`a.onplay = function`
+ `AWAAZ.audioAt`) barqarar rahega.

---

## F112 — `lockKey` khaali ho to `hush` be-asar (sawal baar baar)

**Saboot:** `artistFail` (3892-3894): `hushKey = (cb && cb.lockKey) || ""`;
`speak()` ka guard (3990): `if (AWAAZ.hush && AWAAZ.hushKey && cb.lockKey && AWAAZ.hushKey === cb.lockKey)`
— **dono** `hushKey` aur `cb.lockKey` gair-khaali hona zaroori hai. Yaani bina lockKey wali speak
(test/ek-dafa bolna) par har tukra naya sawal khol sakta hai.

**Ilaj (K6.2/K6.1):** `chup`/`dobara` branches mein hush ke sath **`ask` na banana** (F102/F103 ke ilaj
se khud-ba-khud hal), aur `poochho` mein ek hi `ask` per jawab (pehle se). Iske ilawa guard ko
jaan-boojh kar **nahi** chhera (lockKey-less speaks par sawal ka dohrana qabool) — taake streaming
jawab ka wada (K1.5/F71) na toote. Ye imaandari REPORT mein likhi jayegi.

---

## F113 — `ARTIST.parse("neural")` chup-chaap **AUTO** ban jata tha

**Saboot (test likhte waqt pakda gaya):** `parse()` (3017-3035) in ids ko samajhta tha:
`auto · off · fish · device · edge[:v] · g:<voice>` + purane `#artistGrid` ids (`maya/zephyr/…`).
Magar `settings.voiceEngine` ka naam **`neural`** hai (3244 wala cfg, aur `legacyId()` 3041-3049
`e === "neural"` par `"g:" + gVoice` banata hai). Yaani koi bhi raasta `artist = "neural"` likh deta
(purani pref, Kotlin se wapsi, ya future code) to `parse("neural")` **aakhri `return { id: "auto" … }`**
par girta → `strict = false` → **aap ka 🔒 qanoon khamoshi se khatam**, aur chip `🤖 AUTO` dikhati.

**Ilaj (K6.6):** `parse()` mein `if (i === "neural" || i === "gemini") return ARTIST.parse("g:" + (s.gVoice || "Kore"));`
— purana engine naam bhi pasand hai; test: `ARTIST.cur().strict === true` + `voice === gVoice`.

---

## 🧭 v5.16.0 🩺 ARTIST DOCTOR — amal ka plan (K6.1–K6.9)

| # | Kaam | Flaw | Nateeja (test-locked) |
|---|---|---|---|
| K6.1 | `dobara` policy zinda: usi artist par 1 delayed retry, bina sawal; budget `lockBegin` se tazaa | F102 | dead option khatam |
| K6.2 | `chup` policy sach mein chup: na bubble, na toast, na ask; `silentFails` ginti | F103 | aap ki marzi chalti hai |
| K6.3 | `answerOk()` hijack guard (lambai/sawal/number/hukum) | F104 | hukum gum nahi hota |
| K6.4 | "sirf ab" → engine **+ awaaz** (`onceArtist`, `cb.once`) | F106 | jo likha woh kiya |
| K6.5 | strict `TOO_LONG` → usi artist par tukre | F107 | dead-end khatam |
| K6.6 | `ARTIST.edgeOk()` + parse mein jaanch + purane engine naam (`neural`/`gemini`) | F108, F113 | ghalat id pakdi jati hai, 🔒 chup-chaap AUTO nahi banta |
| K6.7 | `askLive()` — muddat ka ek hi saboot | F105 | baasi sawal par amal nahi |
| K6.8 | 🩺 `AWAAZ.artistDoctor()` + UI button/output + `lat`/`status()` fields | F109-F111 | har artist ka haal ek jagah |
| K6.9 | Tests (voice Section 20 + lab Section 40) + docs + version vc81 | — | koi loophole test ke baghair nahi |

**Qanoon barqarar:** strict ka matlab wahi rahega — artist **kabhi** khud nahi badlega; naye retries
usi artist par hain, aur "koi bhi" wali ijazat ke baghair koi ladder nahi. Jo kuch badla hai woh
**dead options ka amal** hai, qanoon nahi.

**Jo nahi badlega (jaan-boojh kar):** AUTO mode ka purana rawaiya · FAST hijack auto mein ·
Gemini ka roz ka quota (12) · `handleUserText` ka ask-check string (locks) · chunkPlan ki sizes.
