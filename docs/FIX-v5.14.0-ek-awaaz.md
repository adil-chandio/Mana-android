# 🎵 v5.14.0 "EK AWAAZ" — amal ka record (K1–K4)

**Plan/forensic:** `docs/FORENSIC-EK-AWAAZ.md` (17 flaws F67–F83, saboot ke sath)
**Malik ke 2 faisle:** (1) teeno kaam EK release mein (v5.14.0), (2) gaana **poochha** jaye — andaza nahi, hardcoded list nahi.
**Version:** versionCode **79** · versionName **5.14.0** · naam **🎵 EK AWAAZ**

> Shikayat (malik ke alfaaz): *"awaz kat rahi ha woh 1 artist Bolta ha phr ekdam se koi
> or artist aake Bolta ha … usko sunai NAHI derha sahi se samjh NAHI arha … acha sa
> song lagao koi bhi woh TikTok ki salon years purani video lagadeti ha or bar baar
> wohi same video … uske andar dimaag NAHI ha sochne ka samjhne ka reasoning mindset"*

---

## A. 🎵 K1 — EK AWAAZ (F67–F72)

| Flaw | Ilaj | Code |
|---|---|---|
| **F67** har jumla alag `AWAAZ.speak()` = poori seerhi dobara → artist badalta tha | **ENGINE LOCK**: ek jawab ki ek kunji (`RAFTAR.key`), jo tier pehle chali baqi tukre seedha usi par | `AWAAZ.lock/lockBegin/lockEnd`, `setEngine()`, speak() ka lock-dispatch, `RAFTAR.pump` → `lockKey` |
| **F68** `fastForced` ek dafa ka tha → agli jumlon par wapas susti tier | fast-budget ka faisla ab **lock mein darj** (`setEngine` lock.engine update karta hai) → poora jawab tez tier par | speak() forced-tier + setEngine |
| **F69** 3–5 TTS request per jawab → Gemini ka ~15/din quota 2-3 jawab mein khatam → girna shuru | **Batching**: pehla tukra 40 harf (raftar), baqi **300** (`HOLD_N`); `SENT_MAX_N 620`; + **roz ka hisaab** `maya_tts_day` (hadd **12**) → `blockReason()` = `QUOTA_DAY` | `RAFTAR.HOLD_N/SENT_MAX_N/smax()`, `AWAAZ.ttsDay/ttsBump/TTS_DAY_MAX`, `fetchClip` (sirf NAYI request ginti hai) |
| **F70** tukron ke beech network gap | **preheat**: bolte waqt agle tukre ki clip peeche se mangwa lo (`fetchClip` ka flight/cache share = extra request NAHI) | `AWAAZ.preheat()`, `RAFTAR.pump.onStart` |
| **F71** har chunk par sakht `stop()` → pichli dum kat-ti thi | **chain**: onDone ke baad wale tukre par sirf `gen++` + audio element pause — native `stopSpeak/edgeTTS_stop/synth.cancel/XHR abort` NAHI | speak() ka `cb.chain && cb.lockKey` branch |
| **F72** koi per-answer engine lock tha hi nahi | `AWAAZ.lock` + `AWAAZ.switched` counter (jawab ke andar artist badle to ginti) | AWAAZ props, `RAFTAR.line()` |

**Seerhi barqarar:** lock wali tier nakam ho (quota/network/mode) to lock toot kar **agli tier** chalti hai — khamoshi kabhi nahi. `switched` counter batata hai ke ye kitni dafa hua (0 hona chahiye).

## B. 🎙️ K2 — MIC KA PAKKA SUN-NA (F73–F78)

| Flaw | Ilaj | Code |
|---|---|---|
| **F73** koi TURN LOCK nahi: stream ke pehle harf par `thinking=false`, awaaz se pehle `speaking=false` → 0.5–2s khidki jismein wake ghus jati → **do jawab takrate** | `JAWAB.turn` (`turnStart/turnTouch/turnEnd/turnOn/turnAge`, muddat **45s**), wake gate ab turn bhi dekhta hai; `ignore()` turn ki wajah batata hai + phansa turn khud reset | `JAWAB`, `__wakeHeard`, `askAI`, `speak()/nativeSpeak() onDone`, `RAFTAR.endSpeak/abort` |
| **F74** SUKOON ke sirf 3 haal; soch/tool ke dauran haal KHALI → wake mic khul jata | **chautha haal `SOCH_RAHI`**: `sochoStart(ms)/sochoEnd()`; sunai khatam hote hi lag jata hai; Kotlin `haalBlock()` isi par rokta hai; `WakeState.SOCH_EXP_MS = 60s` safety net | `SUKOON`, `WakeWordService.haalBlock()`, `WakeState.expiredWhy/enforceExpiry` |
| **F75** `rearm()` (tool-step) par `bolEnd()` → 550ms baad KHALI → tool ke beech doosra jawab | rearm ab `JAWAB.turnStart("tool")` → mic band, turn qaim | `RAFTAR.rearm()` |
| **F76** silence 600ms → jumle ke beech ki saans par transcript kat jata ("ek hi baat bar bar") | **app path 700ms** (wapis), **wake path 600ms** (wake word chhota, tezi chahiye) | `MainActivity.listen()` 700L · `WakeWordService` 600L |
| **F77** khali transcript = chup-chaap return (na log, na koshish, na khabar) | `JAWAB.emptyHear()`: hisaab (`KAAN "empty"`), pehli dafa chup-chaap dobara suno, dobara khali → **BOL kar** "theek se sun nahi saki" + darwaza khula | `JAWAB.emptyHear/emptyN`, `__nativeSpeech` |
| **F78** `suno` (kam-yaqeen par poochna + Roman-Urdu safaai) default OFF | **default ON** (`suno: true`) — galat kaam karne se behtar poochh lena | `FLAGS.DEF` |

## C. 🎵🧠 K3 — GAANA + DIMAAG (F79–F83)

| Flaw | Ilaj | Code |
|---|---|---|
| **F79** Kotlin `ytSearch()` = regex se **pehla** videoId (na title, na duration, na Shorts) | naya **`ytSearchList(query, max)`**: `[{id,title,sec,ch}]` — Shorts/reel rad, ≤45s clip rad, title lazmi, khidki agle videoId tak (doosre renderer ka title na chipke); purana `ytSearch()` compatibility ke liye barqarar | `MainActivity.kt`: `ytInnertube/ytHtml/ytParse/ytSec/ytUnesc/ytSearchList` |
| **F80** koi yaad-dasht nahi → **bar bar wahi video** | `GANA` module: played-memory (80 gaane, localStorage `maya_gana_played`), dohraye hue par bara jurmana, `repeats` counter | `GANA.pick/remember/times/save` |
| **F81** `thinkingBudget: 0` + `maxOutputTokens: 280` → reasoning band, tool args KAT jate (asli saboot `play_youtube(query="Funk`) | **adaptive soch**: tool-step / kyun-kaise / planning / lambe sawal par **512** token soch (baqi 0 = raftar barqarar); token budget 512, soch ON ho to **1024**; `MAX_TOKENS` par **ek dafa bare budget par retry** (sirf jab stream na chala ho) | `DIMAAG.thinkBudget/maxTok/thinks`, `geminiTry` |
| **F82** gaane ke liye prompt mein koi qanoon nahi | **GAANA QANOON** (naam/artist na ho to play_youtube MAT chalao — poochho) + **SOCH QANOON** (jawab ke sath chhoti wajah/agla qadam) | `sysPrompt()` |
| **F83** naam na milne par andaza; 16s ki khamosh search; "ho gaya" ka jhoot | **poochho** (`GANA.ask` + `pending` 90s + `handleUserText` follow-up, hijack guard `AMAL.guess`/`BIJLI`), search ke dauran **status line**, jo chuna us ka **naam + duration bola**, sab Shorts/mix nikle to imaandari + search; `sach: true` (HAQEEQAT: tool ka asal haal dimaag ko, 2 → 4 tool-qadam) | `GANA.ask/followUp/vague/core`, `ytPlay`, `handleUserText`, `FLAGS.DEF.sach` |

**Malik ka faisla (record):** curated/hardcoded gaane ki list **NAHI** banai gayi — Maya poochti hai, phir `ytSearchList` ki fehrist mein se chunti hai.

## D. 📊 K4 — HISAAB (andaza nahi, number)

`RAFTAR.line()` (⚡ RAFTAR PANEL) mein naye lines:
- `🎵 EK AWAAZ: artist badla N dafa · TTS aaj N/12 (session N) · pehle se mangwaye N · lock <tier>`
- `🎙️ MIC: turn ne wake roki N · turn muddat khatam N · khali transcript N · haal <HAAL>`
- `🎵 GANA: gaane N · chune N · poochhe N · dohraye N · Shorts rade N · yaad N/80 · fallback N`
- `🧠 DIMAAG: soch ka budget N dafa diya · jawab MAX_TOKENS par kata N dafa`

---

## 🔒 Test-lock

* **Section 37** (`tools/test-lab-engine.js`) — K1 + K2 ke **57** taale: engine lock ko **CHALA kar** (jsdom mein asal `AWAAZ` source + stub tiers), batching/chain/preheat, roz ka quota, turn lock, SOCH_RAHI, wake gate, `emptyHear`, Kotlin ke source locks (haalBlock/SOCH_EXP_MS/700L-600L).
* **Section 38** — K3 + K4 + Qanoon 9 ke **53** taale: `GANA` ko CHALA kar (vague/pick/played-memory/ask), Kotlin `ytSearchList` ke locks, soch ka budget (jsdom mein asal `DIMAAG`), prompt qanoon, PANEL counters, docs.
* Purane taale jo **jaan-boojh kar** badle (wajah ke sath, chup-chaap nahi):
  * F66 silence locks → **K2.5 (F76)** app=700ms / wake=600ms.
  * F53 wake-gate lock → gate mein **turnBusy** shamil.
  * Section 35 ke `finish()/pieces` locks → **HOLD_N** batching ke mutabiq (aur naya taala: "ek harf bhi khoya nahi").
  * Version locks → 5.14.0 / vc79 / 🎵 EK AWAAZ.

**Kul test:** **1487** (settings/CSS 101 · voice 294 · brain 155 · lab **937**) — sab GREEN.
(v5.13.0 mein 1375 the; +112 naye taale: Section 37 = 57, Section 38 = 53, aur 2 purane locks K1.3 batching ke mutabiq dobara likhe gaye.)

## ⚠️ Imaandari (kya adhoora hai)

1. **Fish/Edge tier ka artist** abhi bhi tier ke andar badal sakta hai (Edge ki Urdu awaaz vs Fish): lock **tier** level par hai, voice-name level par nahi. Agla qadam (J4 "SAAF AWAAZ"): ek jawab ke liye voice-name bhi lock.
2. `ytSearchList` YouTube ke **public response** par regex se parhta hai (koi API key nahi, 0 budget). YouTube JSON badle to fehrist khali aa sakti hai — tab purana `ytSearch`/search-page fallback chalta hai aur `GANA.fallbacks` ginti barhti hai (andhera nahi).
3. Soch ka budget Gemini 2.5/3 par hi lagta hai (`thinkingConfig`); purane models par ignore hota hai.
4. `thinkingBudget` se pehli awaaz mein ~0.3–1s der aa sakti hai — raftar ke liye aam baat-cheet par budget **0** rakha gaya hai.
5. Turn lock ki muddat 45s hai: is se lamba tool-chain (rare) par wake khud khul jati hai (jaan-boojh kar — behri wake se behtar).
