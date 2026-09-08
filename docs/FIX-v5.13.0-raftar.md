# ⚡ v5.13.0 "RAFTAR" — J3 ka forensics + ilaj

**Malik ki shikayat (lafz-ba-lafz):**

> "sab kuch theek ha Maya screen par dekh sakti ha bat kar Rahi ha everything bas me
> Chahta hun yeh **slow boht reply derhi ha** Thora jaldi ho ache se **instant reply** aye
> fastly or Maya **Kabhi screen par ache se dekh Rahi ha or jawab derhi ha Kabhi pooch rha
> hun to jawab hi nhi derhi** isse theek Karna ha ache se theek ha perfectly accurately
> correctly bagair kuch chore miss kiye kisi kami ke galati ke flaws ke ache se"

Do alag flaws hain:
1. **SUSTI** — jawab der se aata hai (aur bolna aur bhi der se shuru hota hai).
2. **SCREEN KA BE-YAKEENI JAWAB** — kabhi screen parh kar batati hai, kabhi chup.

Neeche microscope ka kaam hai: har flaw ka **sabab**, **suboot** (line numbers), aur **ilaj**.

---

## 1. 🔬 Forensics — 8 flaws mile (F59 – F66)

### F59 · NAZAR ka LAB switch DEFAULT OFF tha
`FLAGS.DEF` (index.html:1716) mein `nazar: false`.
`execTool` ka `read_screen` (index.html:5808) pehla kaam ye karta hai:

```js
if (typeof NAZAR === "undefined" || !FLAGS.on("nazar")) {
  out = { done: false, note: "NAZAR band hai — Settings > LAB > 👁️ NAZAR ON karo" };
}
```

Yaani accessibility service chalu ho, bridge zinda ho, screen saaf parhi ja sakti ho —
**phir bhi** tool mana kar deta tha jab tak malik khud LAB mein switch na dabaye.
Aur model ko ye note milta tha to wo ya to apni taraf se andaza laga deta
("aap Chrome mein honge…") ya chhoti si technical baat bol kar chup ho jata.
**Ye "kabhi jawab nahi deti" ka sab se bara sabab hai.**

### F60 · `read_screen` ki SIRF EK koshish
`NAZAR.look(90)` → `MayaBridge.uiDump(90)`. Screen transition ke waqt, ya
accessibility service ke sust hone par, pehla dump **khali** aa jata hai
(`items: []`). Us soorat mein `look()` `ok: true` lautata tha with `count: 0`, aur
tool khushi khushi `{done:true, count:0, screen:"SCREEN: Chrome"}` bhej deta —
dimaag ke paas batane ko kuch tha hi nahi. Nateeja: "screen par kuch nahi" ya
ghalat andaza. **Doosri koshish ka koi intezam nahi tha.**

### F61 · system prompt mein NAZAR ka ZIKR HI NAHI
`sysPrompt()` (index.html:5437) ki "SUPERPOWERS" fehrist sirf **9 tools** ka naam
leti hai (alarm, timer, reminder, open_app, play_youtube, search_web, call/message,
weather, battery, memory). `TOOL_DECLS` mein **33 tools** hain — jin mein
`read_screen`, `see_camera`, `see_image`, `list_files`, `open_file`, `share_file`,
`brightness_control`, `torch_control`, `volume_control`, `prayer_times`,
`diary_search`, `create_skill` shamil hain.

Model ko declaration JSON se tool ka wajood pata chal jata hai, magar **kab use karna
hai** wo prompt se aata hai. Screen ka zikr prompt mein na hone ki wajah se model
kabhi `read_screen` call kar leta (jab sawal seedha "screen par kya hai" ho) aur
kabhi bina dekhe jawab de deta. **Ye "kabhi dekhti hai / kabhi nahi" ki doosri jarrh hai.**

### F62 · `needsTools()` poori trigger fehlist ko default par ignore karta tha
```js
function needsTools(t){
  try { if (typeof AMAL === "object" && AMAL && FLAGS.on("poolTools")) return AMAL.actionRe().test(t); } catch (e) {}
  return ACTION_WORDS.test(t);
}
```
`AMAL.TRIGGERS` (33 tools ki poori, khud-b-khud banne wali regex) sirf tab chalti thi
jab LAB ka `poolTools` ON ho — **default OFF**. Warna purani haath se likhi
`ACTION_WORDS` (index.html:1385) chalti thi jis mein `screen`, `dekh`, `dikh`, `button`,
`nazar`, `parho` **koi lafz nahi**. Us ka asar: fallback (non-Gemini) dimaagon ko
`DIMAAG.msgs(true)` wala note na jata, aur `BRAIN.plan(need)` ka faisla bhi adhoora hota.

### F63 · dimaag SEEMA-BA-SEEMA (non-streaming) bolta tha — sab se bari susti
`geminiTry()` (index.html:6513) `:generateContent` par POST karta hai: **poora jawab
ban kar** ek sath aata hai, tab `AWAAZ.speak()` chalti hai. `maxOutputTokens: 280`
par bhi 1.5–4 second lagte hain. Tool wale sawal (screen) mein **do** round trip:
pehla `functionCall` ke liye, doosra jawab ke liye = 3–8 second.

### F64 · awaaz ki seerhi par koi FAST BUDGET nahi
`AWAAZ.speak()` (index.html:3162): Fish → Gemini neural → Edge → Pollinations → phone.
Har network tier apna timeout poora kar ke hi agli tier ko bulati hai
(`AWAAZ.TIMEOUT: 25000`, `pollen` ka apna). Network atke to user ko **khamoshi**
sunti parti — jawab mojood hai, awaaz nahi. Sehat yaad (`pollenBad`, `dropModel`,
`kchill`) mojood hai, magar **usi turn** mein bachane wala koi pehra nahi.

### F65 · RAFTAR napi hi nahi jati thi
`NAAP` (index.html:1749) `brain`, `tool`, `voice`, `done` naapta hai — magar sab se
ahem number **"pehli awaaz kitni der mein baji"** kahin darj nahi hota. Bina us ke
"susti theek hui ya nahi" ka faisla sirf andaze par hota. (MainActivity:493 ka comment
khud kehta hai: *"J3 RAFTAR PANEL isi ko NAAP kar ke tay karega ke 600L behtar hai ya nahi"*.)

### F66 · mic ki khamoshi 700ms (dono path)
`MainActivity.kt:495` aur `WakeWordService.kt:889` — bolna khatam hone ke baad
**700ms** ka wait har turn par. Ye chhota hai magar har jawab mein jur jata hai.

---

## 2. 🩺 Ilaj (J3 "RAFTAR")

### A. SCREEN PAKKI (F59–F62)
| # | Ilaj | Jagah |
|---|------|-------|
| A1 | `FLAGS.DEF.nazar: true` — screen parhna default ON; LAB switch ab **kill-switch** hai | index.html:1716 |
| A2 | `NAZAR.lookRetry(90, 160)` — pehla dump khali/adhoora to **doosri koshish**; phir bhi khali to `ok:false` + saaf wajah + `say` (bolne layak line) | NAZAR module |
| A3 | `NAZAR.n` counters (`look, ok, empty, retry, fail, lastMs`) + `NAZAR.line()` — RAFTAR report mein nazar | NAZAR module |
| A4 | `read_screen`: `lookRetry` istemal; nakami par `{done:false, note, say}` taake dimaag CHUP na rahe | execTool:5808 |
| A5 | `sysPrompt()` — poori SUPERPOWERS fehrist (screen/camera/files/torch/volume/brightness/namaz/diary/skill) + **Qanoon**: "screen ka sawal → PEHLE `read_screen`; tool ne `done:false` diya to us ki `note`/`say` user ko batao — andaza mat lagao, chup mat raho" | sysPrompt:5437 |
| A6 | `needsTools()` hamesha `AMAL.actionRe()`; `ACTION_WORDS` mein screen alfaaz bhi (fallback) | 1385/1389 |
| A7 | `AMAL.TRIGGERS.read_screen` mein mazeed alfaaz (`screen par`, `ye screen`, `is screen`, `screen kya`) | 7498 |

### B. RAFTAR (F63–F66)
| # | Ilaj | Jagah |
|---|------|-------|
| B1 | **`RAFTAR` module** — dimaag ka jawab **stream** hota hai; pehla jumla aate hi awaaz shuru; baqi jumle queue mein (`AWAAZ.speak` chain, ek doosre ko kaatte nahi) | naya module (LAB slice ke andar) |
| B2 | `geminiStream()` — `:streamGenerateContent?alt=sse`, `res.body.getReader()`, SSE parse, text + functionCall dono sambhalta hai; HTTP error par wohi `DIMAAG.classify` | geminiTry ke sath |
| B3 | **HOLD = 40 harf** — pehle 40 harf rok kar rakhe jate hain: agar ye tool-step nikla (`functionCall`) to preamble chup-chaap phenk diya jata hai (`RAFTAR.abort()`), warna bolna shuru | RAFTAR.split/feed |
| B4 | **Kill-switch**: stream do dafa nakaam (`NOSTREAM`/`EMPTY`/`NETWORK`) to session bhar streaming OFF + log — jawab kabhi stream ki wajah se nahi marta | RAFTAR.strike/kill |
| B5 | `reply(text, wasVoice, link, opts)` — `opts.noSpeak` par bubble+history darj hota hai magar dobara bolta NAHI (double-speak ka ilaj) | reply:4805 |
| B6 | **`AWAAZ.FAST = 1800ms`** fast budget: network tier par itni der mein **asli** awaaz (`AWAAZ.audioAt`, audio ke `onplay` se) na baji to foran Edge → phone; `AWAAZ.fastTrips` ginti | AWAAZ.speak/play/stop |
| B7 | `NAAP.mark("first")` — **pehli awaaz** ka waqt darj; `NAAP.report()` mein ⚡ RAFTAR hissa (aakhri turn ka breakdown, p50/p90, stream ON/OFF, strikes, fastTrips, NAZAR counters) | NAAP |
| B8 | Silence **700L → 600L** (dono Kotlin path), minimum 300L barqarar | MainActivity:495, WakeWordService:889 |
| B9 | Streaming ke waqt `#interim` par live text (💭) — dekhne wale ko pata chale jawab aa raha hai | RAFTAR.feed |

**Awaaz ki quality par koi samjhota nahi** (malik ka faisla: neural/behtar awaaz).
RAFTAR sirf **intezaar** kaat-ta hai: seerhi wahi Fish → Gemini → Edge → Pollen → phone.

**⚖️ Imaandari (forensic ke andaze badle):**
* `FORENSIC-JAWAB-LOOP.md` ne TTS fast budget **800ms** likha tha. Amal mein **1800ms** rakha:
  Gemini neural TTS ka pehla clip aam tor par 1–2 second leta hai — 800ms par **har** jawab
  Edge par girta, yaani malik ki chuni hui neural awaaz ka tarkheeb. 1800ms = dead-air ki
  hadd sirf 1.8s, quality barqarar. Fast budget tier **badalta** hai (Edge → phone), seedha
  robot awaaz par nahi koodta.
* Plan ka `MAX_LENGTH_MILLIS=15000L` **nahi** lagaya: J1 ka `LISTEN_MAX` (12s) watchdog pehle
  se wahi kaam karta hai, aur AOSP ke ye extras aksar service ignore kar deti hai — teesra
  pehra bina naap ke sirf churn hota.
* Plan ka "prompt ka bojh kam karo" (J3.4) **ulta** kiya: prompt mein 33 tools ka zikr **add**
  hua (~200 token). Wajah: screen ka jawab na aane ki jarrh prompt ka **chhota** hona nahi,
  us mein NAZAR ka **zikr na hona** tha (F61). Agar is se raftar girti dikhi to J4 mein context
  chhanta jayega — faisla andaze se nahi, **NAAP ke numbers** se hoga.

---

## 3. 🧪 Jaanch (Section 36 — `tools/test-lab-engine.js`)

`RAFTAR` jaan-boojh kar **saaf tukron** mein banaya gaya hai taake lab mein naapa ja sake:

* `RAFTAR.split(buf, final)` — jumla kaatna (poora jumla, HOLD, SENT_MAX, Urdu `۔؟`)
* `RAFTAR.sse(chunk)` — SSE lines → events + bacha hua buffer
* `RAFTAR.partsOf(ev)` — event se `text` / `functionCall` alag
* `RAFTAR.live()` / `strike()` / `kill()` / `revive()` — gate aur kill-switch
* `RAFTAR.begin/feed/finish/rearm/abort` — naqli AWAAZ ke sath **bolne ka poora amal**
* `NAZAR.lookRetry()` / `NAZAR.say()` / `NAZAR.line()` — doosri koshish + imaandari + hisaab
* source locks: `streamGenerateContent?alt=sse`, `getReader`, `noSpeak`, `AWAAZ.FAST`,
  `NAAP.mark("first")`, `nazar: true`, sysPrompt ka screen qanoon, `lookRetry`,
  `needsTools` bina `poolTools` shart ke, Kotlin `600L` ×2, version identity

**Section 36 = 55 taale** → lab 770 → **825**, poora suite **1375/1375 GREEN**
(101 CSS/UI + 294 voice + 155 brain + 825 lab). Purane 1320 taale barqarar — koi regression nahi.

Do purane locks J3 ke sath **update** hue (version qanoon ke mutabiq):
`reply(text, wasVoice, link)` → `…link, opts)` (2 slice-boundary locks), aur silence `700L` →
`600L` (2 locks). Ek **waqt-par-nirbhar flaky** lock bhi pakda gaya: KHUD ka "bolte waqt chup"
test ghante ke hisab se idle-branch chala kar `busyBlocked` 2 kar deta tha — ab
`MAYA_V4.lastInteract = NOW` pin hai (test ki niyyat wahi, ghante ki ghulami khatam).

---

## 4. ⚠️ Jo jaan-boojh kar NAHI kiya

* **Kotlin streaming / naya worker** — WebView fetch stream kaafi hai; native surface barhane ka koi faida nahi.
* **Non-Gemini providers par streaming** — har provider ki SSE shakl mukhtalif; Gemini primary hai, baqi ladder waise hi chalte hain.
* **NAZAR ka tap/click** (P7b) — Qanoon 3: pehle dekhna sabit ho, phir chhuna.
* **Awaaz ki seerhi badalna** — malik ne neural awaaz chuni hai; device-first budget nahi.
* **Wake word / mic gating** — J2 (v5.12.5) mein sabit ho chuka, chheda nahi.

---

## 5. ✅ Build ka saboot (CI)

| Cheez | Haal |
|---|---|
| Commit | `3fc3411` (branch `arena/01a062e9-mana-android`) |
| CI run | ✅ **SUCCESS** — [34186455021](%s), 93 second (gradle cache warm) |
| Artifact | **MAYA-APK 3,237,726 bytes** (v5.12.5: 3,225,897 → **+11,829**) |
| Tests | **1375/1375 GREEN** (101 UI/CSS + 294 voice + 155 brain + 825 lab) |
| Kotlin | sirf 2 lines ka amal (silence 600L ×2) + toast/appVersion — compile khatra nahi |

Barhne ki wajah: `RAFTAR` module + `geminiStream()` + NAZAR ki doosri koshish + sysPrompt
ki poori tool fehrist (~11.8 KB web-asset). APK ka native hissa lagbhag wahi hai.

---

## 6. 🚀 Baqi roadmap

| Phase | Kaam | Haal |
|-------|------|------|
| J1 | v5.12.0 "JAWAB PAKKA" | ✅ |
| J2 | v5.12.5 "MIC NAZAR" | ✅ |
| **J3** | **v5.13.0 "RAFTAR"** | **← ab** |
| J4 | v5.14 "AWAAZ PAKKI" | agla |
| 2 / 2.5 / 3 / 4 | WAKE DOCTOR v2 · auto-update (F43) · wake brain Kotlin · offline KWS | baad mein |
