# 🏗️ AMAL WORKFLOW — "full next level, magar masla bilkul nahi"

> `AMAL-ENGINE-PLAN.md` batata hai **KYA** banega.
> Ye dastavez batati hai **KAISE** banega — is tarah ke 6730 line ki chalti hui app
> mein 6 phase ka bara kaam ho jaye aur **ek cheez bhi na toote**.
>
> Ye khud koi feature nahi. Ye wo **qanoon** hai jis ke tehat har feature banega.

---

# HISSA A — Buniyad: app ka maujooda dhancha (jo pehle se SAHIH hai)

```
public/index.html   6730 lines
  ├─ AWAAZ          1000   awaaz ka WAHID DARWAZA        → AWAAZ.speak()
  ├─ FISH            625   🐟 engine                      → FISH.speak()
  ├─ EDGE_TTS        315   🌊 engine                      → edgeTTS_speak()
  ├─ DIMAAG          896   sochne ka nizam                → askAI()
  ├─ BRAIN           242   10 dimaag ka pool              → BRAIN.ask()
  ├─ SETFORM         774   settings ka WAHID DARWAZA      → SETFORM.save()
  └─ THEMES / PERSONAS / TOOLS …
```

**Yahan pehle se ek bohat achhi aadat maujood hai: "WAHID DARWAZA".**
Poori app awaaz ke liye sirf `AWAAZ.speak()` bulati hai. Settings sirf `SETFORM.save()`.
Isi liye v4.6 → v4.7 → v4.8 mein teen naye engine (Doctor, Edge, Fish) **jur gaye aur
kuch nahi toota**.

> **Qanoon 0 — Jo tareeqa 3 dafa chal chuka hai, wohi 6 phase ke liye bhi chalega.**
> Naya `AMAL` bhi bilkul isi shakl mein banega: **ek namespace, ek darwaza.**

---

# HISSA B — 7 QANOON (in ke bina koi line nahi likhi jayegi)

### ⚖️ Qanoon 1 — HAR NAYI CHEEZ EK SWITCH KE PEECHE
Har naya hissa `FLAGS` mein apna switch lekar aayega, aur **shuru mein OFF**:
```
FLAGS = { saaf:1, poolTools:0, amalText:0, bijli:0, aankhein:0, stream:0, triggers:0 }
```
- Switch OFF = code maujood hai magar **chalta hi nahi** → purana raasta jyun ka tyun.
- Kuch bigra → switch OFF → **Maya foran theek**. Nayi APK ka intezar nahi.
- Ye switches Settings mein **🧪 LAB** naam ke chhupe khane mein honge.

### ⚖️ Qanoon 2 — PURANA RAASTA KABHI NAHI MITEGA (Strangler)
Naya engine purane ke **saath** chalega, uski **jagah** nahi:
```
AMAL.run(hukm)
   ├─ naya raasta try karo
   └─ kisi bhi wajah se na chale → PURANA raasta (jo aaj chal raha hai)
```
Purana code **P6 mukammal aur device par tasdeeq hone tak** hataya nahi jayega.
*(Bilkul waise jaise Fish nakaam ho to Gemini → Edge → phone.)*

### ⚖️ Qanoon 3 — SHADOW MODE: pehle dekho, phir karo
Naya router pehli dafa **koi amal nahi karega**. Wo sirf **chupke se likhega** ke
"main kya karti":
```
🕵️ SHADOW: "britness barhao 100%"
    purana router → (kuch nahi)
    naya router   → brightness_control{percent:100}   ✅ behtar
```
Ye log Settings mein dikhega. **Jab tak 50 asli hukm par naya router purane se
behtar ya barabar na ho, uska switch ON nahi hoga.**
→ Yani feature aap ke phone par **sabit** hone ke baad chalu hota hai, umeed par nahi.

### ⚖️ Qanoon 4 — INVARIANTS: 8 baatein jo KABHI nahi toot saktin
Har phase ke baad ye 8 test chalenge. **Ek bhi laal = release nahi.**

| # | Qanoon | Test kya karega |
|---|---|---|
| 1 | **Maya kabhi khamosh nahi** | har nakami ka raasta banao → jawab phir bhi aaye |
| 2 | **Andar ki soch kabhi bahar nahi** | 10 reasoning shaklein → bubble aur awaaz dono saaf |
| 3 | **Bina `ok` ke kamyabi ka daawa nahi** | tool fail karwao → jawab mein "ho gaya" na ho |
| 4 | **🔴 tool bina ijazat kabhi nahi** | call/SMS ka hukm → ijazat maange bagair na chale |
| 5 | **Purana raasta hamesha zinda** | sab naye switch OFF → app v4.8 jaisi chale |
| 6 | **Settings kabhi khud reset na hon** | SETFORM ke 72 test (pehle se maujood) |
| 7 | **Awaaz ki seerhi kabhi na toote** | Fish→Gemini→Edge→muft→phone (293 test) |
| 8 | **Ek hukm = ek amal** | dohra amal na ho (double-fire guard) |

### ⚖️ Qanoon 5 — HAR PHASE APNA TAALA KHUD LAGAYEGA
Jo bug theek ho, uska test **usi commit mein** likha jayega — taake wo **dobara wapas
na aa sake**. *(Misaal: BUG 1 ke liye "har tool pakra jaye" wala 33-test.)*
**Regression budget hamesha 0.**

### ⚖️ Qanoon 6 — EK PHASE = EK RELEASE = EK ROLLBACK
Har phase apna alag commit + tag. Bigar jaye to:
```
git revert <us phase ka commit>     → sirf wo phase gaya, baqi sab salamat
```
Kabhi bhi do phase ek commit mein nahi.

### ⚖️ Qanoon 7 — DEVICE PAR AAP KI TASDEEQ = DARWAZA
Main `npm test` green kar sakta hoon, magar **asli faisla aap ke kaan aur aankh ka hai.**
Aap ke "haan chal raha hai" ke bagair **agla phase shuru nahi hoga.**

---

### ⚖️ Qanoon 9 — HAR VERSION KE AAKHIR MEIN: "KYA NAYA HUA + KAISE PARAKHNA HAI"

> **Aap ki farmaish (2026-09-03):** *"har naye version, naye improvement jab bhi karein, hum ko
> batana hai last mein ke isme kya naya add hua aur usko kaise check karna hai, test kaise karna hai."*

Ye ab **qanoon** hai, mashwara nahi. Har release ke aakhri qadam par (CI green hone ke BAAD,
chat jawab se PEHLE) **HISSA M ka farma** poora bhar kar dena lazmi hai:

1. **Kya naya hua** — aam zubaan mein, code ke naam/file ke naam ke bagair. User ko *farq*
   nazar aana chahiye, *implementation* nahi.
2. **Kaise check karein** — har nayi cheez ka apna test: kadam 1-2-3, **PASS ka nishaan**, aur
   **FAIL ka nishaan** (ye sab se zaroori hai — "check karo" ke bagair natija andaza ban jata hai).
3. **Kya abhi bhi adhoora hai** — imaandari se. Jo cheez is release mein theek NAHI hui, uska
   naam aur uska phase. (Jhooti tasalli se bara koi nuqsan nahi.)
4. **Agar kaam na kare to kya bhejein** — report ka exact tareeqa (kaun sa panel, kaun sa button,
   kya copy karna hai).
5. **Version ki pehchaan** — user ko kaise pata chale ke nayi APK asal mein lag gayi (boot toast,
   `appVersion()`, panel ki koi nayi line).

**Do jagah ye report likhi jayegi:**
* `docs/FIX-<version>-<naam>.md` (ya `RELEASE-<version>.md`) ke andar **"## 📱 RELEASE REPORT"**
  heading se — taake hamesha ke liye darj rahe.
* Chat ke aakhri jawab mein — chhota, table ki shakl mein.

*(Note: HISSA K ke audit mein "Qanoon 8 (naya)" lafz commit+push discipline ke liye istemal
hua tha — is liye ye **QANOON 9** hai, takraav se bachne ko.)*

**Ye qanoon test-lock bhi hai** (`tools/test-lab-engine.js`, Section 31): agar release doc mein
`## 📱 RELEASE REPORT` heading na ho, ya us mein "PASS ka nishaan" na ho, to tests **FAIL** honge.


# HISSA C — NAYA DHANCHA (code kahan rahega)

Sab kuch usi `index.html` mein rahega *(single-file app hai — service worker aur
APK mirror isi par khare hain)*, magar **saaf hudood** ke sath:

```
var AMAL = {                        ← naya WAHID DARWAZA (~700 lines)

  FLAGS   : {…}                     ← Qanoon 1  · har feature ka switch
  TOOLS   : [ …33+ ]                ← ek registry: naam · args · triggers · darja · alias
  DIALECT : { gemini, openai, text }← ek registry, teen tarjume
  SAAF    : fn(text)                ← soch ka sanitizer (10 shaklein)
  ROUTER  : { match, shadow, learn }← lughat TOOLS se khud banti hai
  RUN     : fn(name, args)          ← ijazat → amal → {ok,value,error} → ledger
  LEDGER  : { push, undo, today }   ← har amal + ⟲ wapas
  LOOP    : fn(msgs)                ← asli agent loop (dono zubanon ke liye ek)
  TRACE   : { start, step, end }    ← live naqsha
  GUARD   : { rate, otp, unknown }  ← safety rails
}
```

### Nirbharta ka rukh (kabhi ulta nahi)
```
SETFORM  →  AMAL  →  { BRAIN, AWAAZ, MayaBridge }
```
- `AMAL` neeche walon ko **bula sakta hai**.
- `AWAAZ` / `BRAIN` `AMAL` ko **kabhi nahi** bulayenge.
- **Faida:** awaaz ka nizam (293 test) aur pool (155 test) ko haath hi nahi lagta.

### Ek chhota magar ahem test: DHANCHE KA TAALA
Test harness code ko **naam se dhoond kar** nikalta hai:
```js
const FA = HTML.indexOf('var FISH = {');
```
Agar koi in nishanion ko hila de to **520 test khamoshi se ghalat cheez jaanchne
lagenge**. Is liye ek naya test:
> *"AWAAZ · EDGE_TTS · FISH · AMAL · BRAIN · DIMAAG · SETFORM — saaton maujood hon,
> isi tarteeb mein hon, aur ek doosre mein na ghusen."*

---

# HISSA D — HAR PHASE KA WORKFLOW (7 qadam, har dafa wahi)

```
1️⃣  ISSUE CARD   Kya toota hai? Saboot ke sath (code ki line / chala kar dikhaya hua)
        ↓
2️⃣  CONTRACT     Kya banega, kya NAHI banega, kaunsa switch, kaunse test
        ↓          → aap ki manzoori ← (yahan main rukta hoon)
3️⃣  CODE         Switch OFF ke sath. Purana raasta chhua tak nahi.
        ↓
4️⃣  SABOOT       Naye test + purane 520 → SAB green. Regression 0.
        ↓
5️⃣  SHADOW       APK mein switch OFF, magar log chalta hai.
        ↓          Aap 2-3 din normal istemal karo.  🕵️ log dekho.
6️⃣  FLAG ON      Log sahih → LAB se switch ON → aap device par tasdeeq karo
        ↓
7️⃣  TAALA        Test likh kar bug ko qaid karo → tag → agla phase
```

> **Qadam 2 aur 6 par main hamesha rukunga.** Aap ki manzoori ke bagair aage nahi.

---

# HISSA E — HAR PHASE KA KHATRA, AUR USKA THEEK ILAJ

| P | Kya | Kya bigar sakta hai | Ilaj (mechanism) | Bacha |
|---|---|---|---|---|
| **P1** SAAF ZUBAAN | sanitizer · token · zubaan | sanitizer zyada kaat de → jawab adhoora | saaf ke baad khali/chhota → **purana matn** wapas + agla dimaag · `FLAGS.saaf` | 🟢 |
| **P2a** pool ko tools | `BRAIN.ask` mein `tools` | koi provider `tools` par 400 de → **wo dimaag mar jaye** | 400 aaye → **usi waqt bina tools dobara** + us provider par tools band yaad rakho · `FLAGS.poolTools` | 🟢 |
| **P2b** text protocol | `‹AMAL›` parser | parser jhoote match kare → ghalat amal | sirf 🟢 tools bina ijazat · parser sakht · rescue sirf tool ke naam par · shadow pehle | 🟢 |
| **P2c** router | lughat TOOLS se | naya router purane se bura nikle | **Qanoon 3 — SHADOW.** 50 hukm par sabit hone tak ON nahi | 🟢 |
| **P2d** agent loop | multi-step | loop mein atak jaye / bar bar chale | qadam ≤5 · kul waqt ≤30s · ek tool ek turn mein ek dafa · `gen` guard *(AWAAZ mein pehle se maujood tareeqa)* | 🟢 |
| **P3** ijazat + ledger | lagaam | ijazat ka dialog atak jaye | timeout par **na** karo (default = mana) · undo hamesha | 🟢 |
| **P4a** BIJLI | 50ms local | ghalat local match | yaqeen kam → purana raasta · sirf 🟢 · ledger + ⟲ | 🟢 |
| **P4b** AANKHEIN | camera | camera na khule / bara photo | `takePhoto()` pehle se maujood ✅ · photo chhota karo · nakaam = aam jawab | 🟢 |
| **P5** STREAM | **naya Kotlin SSE** | **build fail / crash** | **neeche alag protokol** ↓ | 🟡 |
| **P6** TRIGGERS | agar→to | rule loop → 50 notification | har rule 1/ghanta · kul 20/din · `GUARD.rate` · DRY-RUN pehle | 🟢 |

---

# HISSA F — 🔴 P5 ka khaas protokol (wahid jagah jahan Kotlin badlega)

Main Kotlin **compile nahi kar sakta**. Is liye P5 par ye 6 pabandiyan:

1. **Sirf JORNA, badalna nahi.** Naya `httpStream()` likha jayega. `httpBytes()`,
   `httpPostAsync()`, `edgeTts()` — kisi ko **chhua bhi nahi** jayega.
2. **JS pehle poochhega:** `if (MayaBridge.httpStream)` — na mile to purana raasta.
   Yani **purani APK bhi nayi index.html ke sath chalti rahegi**.
3. **Python mirror se saboot** — bilkul Edge TTS wala tareeqa: Kotlin ka hoo-ba-hoo
   tarjuma bana kar naqli SSE server par chalaunga *(us dafa 5350/5350 bytes sahih nikle the)*.
4. **Brace/import/API scan** — jaise ab tak har Kotlin commit par kiya.
5. **P5 bilkul akela commit** hoga — kisi aur cheez ke sath nahi.
6. **Aap pehle APK build karo.** Build fail = `git revert` = ek minute mein wapas.
   Build pass = phir switch ON.

> **Is liye P5 sab se aakhir mein hai.** P1-P4 aur P6 mein Kotlin ko haath tak nahi lagta —
> wahan "build toot jayega" wala khatra **wujood hi nahi rakhta**.

---

# HISSA G — TEST KA PAIMANA (kaam khatam kab mana jayega)

Har phase ke liye **DEFINITION OF DONE** — saaton sahih hon, warna phase adhoora:

```
□ 1  Naye test likhe gaye (pehle fail hote hon, phir pass)
□ 2  Purane 520 test green — regression 0
□ 3  8 INVARIANT test green
□ 4  Dhanche ka taala green (namespace tarteeb salamat)
□ 5  Mirror sync (public/ == app/src/main/assets/web/)
□ 6  Doc likha (kya · kyun · nuqsanat imaandari se)
□ 7  Aap ne device par apne haath se tasdeeq ki
```

Test ka kul hisab jab sab mukammal ho:
```
aaj                          520
+ P1 sanitizer                24
+ P2 amal engine             178
+ P3 ijazat/ledger/undo       40
+ P4 bijli + aankhein         35
+ P5 stream + barge-in        25
+ P6 triggers + routines      35
─────────────────────────────────
                             857
```

---

# HISSA H — TARTEEB, AUR IS TARTEEB KI WAJAH

```
P1 ── P2 ── P3 ── P4 ── P6 ── P5
🟢    🟡    🟢    🟢    🟡    🔴
```

| Kyun ye tarteeb | |
|---|---|
| **P1 pehle** | Sab se sasta, sab se mehfooz, aur **aap ki aaj ki poori shikayat** ka jawab. Kotlin nahi chhoota. |
| **P2 doosra** | Baqi sab isi par khara hai. Ye asal buniyad hai. |
| **P3 teesra — P4/P6 se PEHLE** | **Ye lagaam hai.** Ijazat + ledger + undo + rails maujood hone se pehle Maya ko zyada taqat dena be-waqoofi hai. |
| **P4 chautha** | Sasta aur bara dhamaka (vision + 50ms), aur ab lagaam maujood hai. |
| **P6 paanchwan** | Asli khud-mukhtari — **sirf tab mehfooz jab P3 maujood ho**. |
| **P5 aakhir mein** | Wahid jagah jahan Kotlin badalta hai. Sab kuch chal raha hoga, to is ka khatra bhi mol lena aasan hoga. |

**Ghaur:** maine P5 (streaming) ko **P6 ke baad** rakh diya hai — halanke wo zyada
"mazedar" hai. Wajah sirf ek: **wo wahid cheez hai jo APK ka build tor sakti hai.**
Us se pehle app poori tarah next-level ho chuki hogi.

---

# HISSA I — Khulasa: "masla kyun nahi hoga"

| Aap ka dar | Is ka jawab |
|---|---|
| *"kuch toot jayega"* | Har cheez **switch ke peeche** (Qanoon 1) + **purana raasta zinda** (Qanoon 2) |
| *"pata hi nahi chalega kya bigra"* | **8 invariant** + 857 test + har phase ka apna taala |
| *"naya feature bura nikla to?"* | **SHADOW mode** — chalane se pehle aap ke apne phone par sabit hoga |
| *"wapas kaise karun?"* | Ek phase = ek commit = `git revert` (Qanoon 6) |
| *"APK build fail hua to?"* | Sirf P5 mein mumkin — aur wo **sab se aakhir** mein, akela, Python mirror se sabit shuda |
| *"Maya ghalat kaam kar degi"* | 🟢/🟡/🔴 darje + ijazat + rate limit + **⟲ undo** + OTP/paisa guard |
| *"beech mein chhor doge?"* | Har phase **apne aap mein mukammal** hai. P2 par ruk jayen to bhi app P2 tak next-level rahegi. |

---

## 🎯 Aakhri baat

Ye workflow koi nayi cheez nahi hai — **yehi tareeqa is app par 4 dafa chal chuka hai**
(v4.5 SETFORM · v4.6 Doctor · v4.7 Edge · v4.8 Fish). Har dafa naya bara engine jura
aur **ek bhi purana test laal nahi hua**.

Farq sirf itna hai ke ab hum ne use **likh kar qanoon bana diya hai** — taake 6 phase ke
bare kaam mein bhi ek bhi cheez ittefaq par na chhoray.

---

# HISSA J — 🔍 PLAN KA APNA AUDIT (imaandari se: abhi perfect nahi)

Aap ne poocha "sab perfectly correctly accurately hai ya aur behtar ho sakta hai?"
Maine apne hi plan par wohi forensic chalaya jo screenshot par chalaya tha.
**8 chhed mile.** Sab se bara sab se sharmnaak hai.

---

## 🕳️ CHHED 1 — Hum ne NAAPNE KA AALA hi nahi banaya *(sab se bara)*

Poora plan kehta hai "teiz hoga", "behtar hoga", "next level hoga".
**Magar aaj ke number hamare paas hain hi nahi.**

```
$ grep -c "performance.now" public/index.html
6        ← poori 6730 line ki app mein 6 jagah
```

Yani P4 (BIJLI) ke baad hum kaise sabit karenge ke wo sach much teiz hua?
"Mehsoos ho raha hai teiz" **saboot nahi** — aur is poore kaam ka usool hi "andaza nahi, saboot" hai.

**Naapna kya chahiye (aaj, badalne se PEHLE):**
| Paimana | Aaj kitna? |
|---|---|
| Aap ke bolne se le kar **tool chalne** tak | ??? |
| Aap ke bolne se le kar **pehli awaaz** tak | ??? |
| 100 hukm mein se kitne **sahih tool** par gaye | ??? |
| 100 jawab mein se kitno mein **soch leak** hui | ??? |
| Kaunsa dimaag **kitni dafa** jawab deta hai | ??? |

---

## 🕳️ CHHED 2 — Golden set main bana raha tha… magar khazana AAP ke phone mein hai

Maine likha tha: "60 golden commands". Wo **meri banai hui** misalein hoteen.
Magar:
```js
localStorage "maya_chat"  →  aakhri 300 turn mehfooz hain
```

**Aap ki apni zubaan, aap ke apne alfaz, aap ke apne 300 hukm — pehle se mehfooz hain.**
Golden set unse banna chahiye, meri tasavvur se nahi. "britness" jaise lafz main
soch bhi nahi sakta tha — aap ki history mein wo maujood hai.

---

## 🕳️ CHHED 3 — Diagnostic bahar bhejne ka koi tareeqa hi nahi

```
$ grep -n "copyLog|exportLog|clipboard" public/index.html
(kuch nahi)
```

**Poori session mein aap ne mujhe screenshot bhej bhej kar bug batae.**
Ek button — **📋 DIAGNOSTIC COPY** — jo ek tap par ye sab clipboard par daal de:
```
app 4.8.0 · WebView 121 · Android 13 · brand Xiaomi
engine: fish OFF(no key) · gemini QUOTA · edge READY · pool 6/10 zinda
aakhri 60 log · aakhri 3 ghalti · settings (SAARI KEYS CHHUPI HUI 🔒)
```
Aap paste kar do — mujhe **poori tasveer** mil jaye. Har agli bug 10 guna jaldi hal.

> Ye chhota sa button poore mansoobe ka sab se ziyada faida dene wala hissa hai.

---

## 🕳️ CHHED 4 — 12 localStorage keys, aur koi VERSION nahi

```
maya_awaaz  maya_brainpool  maya_cache  maya_chat  maya_consol_ts  maya_diary
maya_facts  maya_fish  maya_models  maya_sched  maya_settings  maya_skills
```

Aur P3 `maya_ledger` layega, P6 `maya_rules`, P2 `maya_learn`, P0 `maya_metrics`…
**16+ keys, aur koi migration ka raasta nahi.**

Kal shakl badalni pari to purana data ya to tootega ya chhoot jayega.
`maya_schema = 1` **abhi** rakhna chahiye — jab keys 12 hain, 20 hone se pehle.

---

## 🕳️ CHHED 5 — Hamare test "shareef" hain — ASAL DUNIYA gandi hai

Ye sab se ahem sabaq hai:

> **293 AWAAZ test pass the. 155 DIMAAG test pass the.
> Phir bhi `<think>` wala bug aap ke phone tak pohanch gaya.**

Kyun? Kyunke hamara harness hamesha **saaf-suthra** jawab naqli banata hai:
```js
state.respond = () => ({ status: 200, body: okBody() })   // hamesha shareef
```

Asal duniya mein jawab aise aate hain:
```
"<think>The user wants…"                    ← band hi nahi hua
"<|channel|>analysis…<|message|>Salam"      ← gpt-oss harmony
"brightness_control(level=100)"             ← tool ka natak
"```json\n{...}\n```"                       ← markdown mein lipta
"चमक सेट कर दी"                              ← ghalat zubaan
HTTP 200 magar body mein {"error":…}        ← jhoota 200
""                                          ← bilkul khali
```

**Chahiye: BADTAMEEZ FIXTURE LIBRARY** — asli models ke asli kachre ka zakheera,
jo har naye engine par chalaya jaye. Ye ek bug ka ilaj nahi, **poori qism** ka ilaj hai.

---

## 🕳️ CHHED 6 — Zubaan ka faisla maine CHUPKE se kar liya tha *(meri ghalti)*

BUG 6 par maine likha "do mutazad hukm hain, theek karenge". Magar **kaise** theek
karenge — wo product ka faisla hai, mera nahi. Aur ghaur se dekha to:

```js
LR["hindi"] = "Reply in Hindi (Devanagari script)."
```
Aap ke phone par `settings.lang = "hindi"` **hai**. Yani model ne jo kiya, wo
technically **hukm ki tameel** thi!

**Asal sawal jo mujhe AAP se poochna chahiye tha:**
> Jab aap Roman Urdu mein bolo magar setting "Hindi" ho — **kaun jeete?**

Teen mumkin jawab, teeno jaiz:
| | Tareeqa | Kis ke liye behtar |
|---|---|---|
| **A** | **Jo aap bolo, wohi script** — setting sirf tab jab pata na chale | Roz-marra, sab se qudrati |
| **B** | **Setting hamesha jeete** — jo chuna hai wohi milega | Jab aap qasdan Hindi chahte ho |
| **C** | **Likha Roman Urdu · Bola Urdu** — screen aur awaaz alag | Parhne mein aasan + sunne mein khoobsurat |

*(Mera mashwara: **A** — magar faisla aap ka.)*

---

## 🕳️ CHHED 7 — "Kamyabi" ka koi NUMBER nahi

"Perfect" ek ehsaas hai. Ehsaas se release nahi hota. Har phase ke liye **number** chahiye:

| P | Kamyabi ka paimana (P0 ke baseline se muqabla) |
|---|---|
| P1 | 200 jawab mein **0** soch-leak · khali bubble **0** |
| P2 | Golden set par sahih tool **≥95%** · tool chalane wale dimaag **1 → ≥6** |
| P3 | Bina ijazat 🔴 tool **0 dafa** · har amal ka ⟲ **100%** |
| P4 | 🟢 amal **≤150ms** · airplane mode mein **kaam kare** |
| P6 | Trigger ka jhoota amal **0** · rate limit **kabhi na toote** |
| P5 | Pehli awaaz tak **p50 ≤1.2s** (aaj ~4s) |

Ye number **P0 ke bagair naap hi nahi sakte** — Chhed 1 par wapas.

---

## 🕳️ CHHED 8 — Battery aur data ka koi budget nahi

P4 (BIJLI) aur P6 (TRIGGERS) background mein kaam karenge. Phone par ye **muft nahi**.
Saaf pabandiyan chahiye:
- Koi `setInterval` polling **nahi** — sirf `scheduleTask()` (jo pehle se hai)
- Trigger jaanchne ka kaam sirf tab jab phone waise bhi jaag raha ho
- Rozana wake budget mehdood
- "Sirf WiFi par" wali pabandi bhi maujood ho *(AWAAZ mein ye pattern pehle se hai)*

---

# 🆕 IS AUDIT KA NATIJA: **P0 — NAAP-TOL**

Chhed 1,2,3,4,5 sab ek hi baat kehte hain:
> **Badalne se pehle, naapne aur dekhne ka aala banao.**

**P0 — v4.8.1 · NAAP-TOL** *(P1 se bhi PEHLE)*

| # | Kya | Kis chhed ka ilaj |
|---|---|---|
| 1 | 📋 **DIAGNOSTIC COPY** button (keys chhupi hui) | 3 |
| 2 | ⏱️ **NAAP** — har turn ka waqt: sunna → dimaag → tool → awaaz | 1, 7 |
| 3 | 📊 **BASELINE** panel — aaj ke number, kal ke muqable ke liye | 1, 7 |
| 4 | 🗃️ **GOLDEN HARVEST** — aap ki `maya_chat` se asli hukm nikal kar test set | 2 |
| 5 | 👹 **BADTAMEEZ FIXTURES** — asli kachre ki library | 5 |
| 6 | 🔖 `maya_schema = 1` + migration ka dhancha | 4 |
| 7 | 🔋 Battery/data budget ke usool likhe jayen | 8 |

**Khatra: 🟢 sab se kam jo mumkin hai.**
Kyunke P0 mein **Maya ka koi rawaiya badalta hi nahi** — sirf naapa aur dikhaya jata hai.
Kotlin ko haath nahi. Purana raasta chhua tak nahi. Sirf **jorna**.

**Aur is ka faida:** P1 se P6 tak har phase ab **sabit** ho sakega —
*"pehle itna tha, ab itna hai"* — bajaye *"lag raha hai behtar hai"*.

---

## 🔄 Nazr-e-sani shuda tarteeb

```
P0 ── P1 ── P2 ── P3 ── P4 ── P6 ── P5
🟢    🟢    🟡    🟢    🟢    🟡    🔴
naap  saaf  amal  lagaam bijli khud  zinda
      zubaan engine       aankhein mukhtar
```

Test ka safar: `520 → P0 +30 → 550 → … → 887`

> **Bina P0 ke baqi sab "shayad behtar hua" rahega.
> P0 ke sath har phase ka SABOOT hoga.**

---

# HISSA K — 🔍 DOOSRA AUDIT (round 2): 7 aur chhed

Pehle round mein 8 mile the. Dobara dekha — **7 aur** mile. Ek to naap kar sabit hua.

---

## 🕳️ CHHED 9 — PROMPT KHUD PHOOL KAR PHAT JAYEGA *(naap kar sabit)*

```
sysPrompt ka sabit matn        ~ 2,842 harf   (~710 token)
TOOL_DECLS ka JSON             ~ 7,958 harf   (~1,989 token)
                                 ─────────────────────────
P2 (text protocol) ke baad     ~ 2,700 token ka SYSTEM PROMPT
```
Aur is ke oopar **har turn** ye bhi jurta hai:
`persona · active skill · custom skills · memory summary · diary · 15 facts ·
language rule · favorite song · music app · gf mode`

**Muft models par ye tabahi hai:**
- Har request mein ~3,000 token — rate limit **3 guna jaldi** khatam
- Model ahem qawaid ko **matn ke pahaar mein kho** deta hai
- Chhote context wale models mein **jagah hi nahi bachegi**

**Ilaj — TOP-K TOOLS:** poore 33 tools bhejne ki zaroorat hi nahi hai.
Router pehle se jaanta hai ke hukm kis taraf ka hai:
```
"britness barhao"  →  sirf 4 tool bhejo:
                      brightness_control · volume_control · torch_control · notify
                      (~180 token, 1989 nahi)  =  10 guna kam
```
**Aur maze ki baat: ye teiz hone ke SATH SATH zyada SAHIH bhi hoga** — jab 33 ke bajaye
4 hi samne hon to model ghalat tool chunega hi nahi.

---

## 🕳️ CHHED 10 — P1 aur P5 aapas mein LARTE hain

- **P1 kehta hai:** `<think>…</think>` kaat do.
- **P5 kehta hai:** jumla banta hi foran bol do.

**Magar `<think>` ko kaatne ke liye `</think>` ka intezar karna parta hai!**
Agar hum stream par seedha bolna shuru kar den, to Maya soch **bol degi** —
bilkul wahi bug jo P1 theek karta hai.

**Ilaj:** sanitizer ko **stream-aware** banana parega —
matn ko tab tak rok kar rakho jab tak "mehfooz kinara" na aa jaye
(`</think>` mile, ya pehla saaf jumla mukammal ho). Ye P5 ka **hissa** hai,
baad ki soch nahi.

---

## 🕳️ CHHED 11 — 7 phase = 7 APK build? **Nahi. Ye behtar ho sakta hai** ✅

Har phase par aap ko GitHub par release chalana, APK banwana, install karna parega.
**7 dafa.** Ye sab se bara *waqt* ka kharcha hai.

**Magar Qanoon 1 (feature flags) is ka hal khud hai:**
```
EK APK mein P0 + P1 + P2 ka poora code bhej do — P1/P2 ka switch OFF
   ↓ aap ek dafa build karo
LAB se switch ON karo, ek ek kar ke, BINA nayi APK ke
```
**7 build → 3 build.** Aur agar kuch bura lage, switch OFF — **foran**, build ka intezar nahi.

> Ye maine pehle nahi socha tha. Flags sirf hifazat nahi — **waqt bhi bachate hain.**

---

## 🕳️ CHHED 12 — Sandbox is session mein DO DAFA reset hua

Do dafa git history gayab hui (dono dafa GitHub se bahal ki). Agar ye kisi phase ke
**beech** mein ho jata to kaam zaya ho sakta tha.

**Qanoon 8 (naya):** har mukammal qadam par **commit + push** — phase ke aakhir mein nahi.
GitHub hi asal mehfooz jagah hai, sandbox nahi.

---

## 🕳️ CHHED 13 — Aap ka phone kaunsa hai — **mujhe pata hi nahi**

Poori app ek `check-oldwebview-css.js` test rakhti hai kyunke purane WebView pehle
masla ban chuke hain. Magar main ye maan kar chal raha hoon ke:

| Feature | Chahiye |
|---|---|
| Fish/Edge ka MP3 | `Blob` + `URL.createObjectURL` |
| 👁️ AANKHEIN | Camera + bara base64 WebView ke aar paar |
| 🗣️ STREAM | Naya WebView, chalta hua SSE |

**Agar aap ka WebView purana hua to P4/P5 ka naqsha badalna parega.**
Ye maloomat P0 ka diagnostic button de dega — magar **abhi** poochh lena behtar hai.

---

## 🕳️ CHHED 14 — Privacy: sirf KEYS chhupana kaafi nahi

- **Golden harvest** aap ki `maya_chat` parhega → us mein **contact ke naam, phone
  number, zaati baatein** hain.
- **Diagnostic copy** mein bhi wohi khatra.

**Qanoon:** dono jagah **naam aur number bhi chhupein** (`Ali` → `<naam>`,
`03001234567` → `<number>`). Aur golden set **phone se bahar bheja hi na jaye** —
sirf uska **hisab** (kitne sahih, kitne ghalat) dikhe.

---

## 🕳️ CHHED 15 — "Mukammal" ki koi tareef nahi

Har phase kuch aur jorta hai. To **khatam kab hoga?** Bina is ke ye kaam kabhi na
ruk-ne wala ban jayega.

**MINIMUM MUKAMMAL MAYA (P0+P1+P2+P3):**
> Soch kabhi bahar nahi · har dimaag tools chala sakta hai · jhoot nahi bolti ·
> khatarnak kaam ijazat se · har amal wapas ho sakta hai · saboot naapa gaya hai.
>
> **Yahan ruk jayen to bhi Maya ek MUKAMMAL, mehfooz, bharosemand assistant hai.**

P4/P5/P6 us ke baad **"tabahi"** hain — zaroori nahi, **mazedar** hain.
Ye farq likha hona chahiye taake dabao na rahe.

---

# 📌 DOOSRE AUDIT KA NATIJA

| | |
|---|---|
| **Naye chhed** | 7 (kul 15) |
| **Sab se ahem** | CHHED 9 — prompt 2,700 token ho jata; ilaj **TOP-K tools** (10× kam, aur zyada sahih) |
| **Sab se faidemand** | CHHED 11 — flags se **7 build → 3 build** |
| **Sab se zaroori** | CHHED 14 — naam/number bhi chhupein, sirf keys nahi |
| **Naya Qanoon 8** | Har qadam par commit + push (sandbox bharose ke laiq nahi) |

Plan mein ye sab shamil kar diya gaya. **Ab naqsha mukammal hai.**

---

# HISSA L — 🔍 TEESRA AUDIT: nayi farmaish ne 3 chhed khole

Aap ne portfolio ka link diya aur kaha "Maya ko mere bare mein pata hona chahiye".
Us ek farmaish ne teen aisi kamiyan khol deen jo pehle nazar hi nahi aayi thin:

| # | Chhed | Ilaj |
|---|---|---|
| **16** | Maya ko apne **malik** ka pata hi nahi (`settings.name` = "Boss", bas) | naya `MALIK` block |
| **17** | `facts[]` ek bikhri fehrist hai — `slice(0,15)` se **kat** jati hai. Malik ki pehchan aise kat gayi to sharmindagi | `MALIK` alag, mehfooz khana — kabhi na kate |
| **18** | Portfolio **kal live hoga**, Maya ka ta'aruf **purana** ho jayega | `web_fetch` (pehle se maujood) se haftawar khud-taza |

Tafseel: [`MALIK-PROFILE.md`](MALIK-PROFILE.md)

## Is se ek AAM sabaq bhi mila

> **Chhed us waqt tak nazar nahi aate jab tak koi ASLI farmaish unhen na chhue.**

Do audit round mein 15 chhed mile. **Teesra round maine nahi kiya — aap ki ek
farmaish ne kar diya**, aur 3 aur nikal aaye. Isi liye workflow mein **SHADOW MODE**
(Qanoon 3) aur **aap ki device tasdeeq** (Qanoon 7) hain: kaghaz par har cheez
mukammal lagti hai, asal imtihan istemal hai.

**Kul chhed: 18. Sab plan mein shamil.**

---

# HISSA M — 📱 RELEASE REPORT ka FARMA (har version ke baad lazmi bharna hai)

Qanoon 9 ka amal. Is farma ko copy kar ke har `docs/FIX-*.md` / `docs/RELEASE-*.md` ke aakhir
mein chipkayein, aur chat ke jawab mein iska chhota roop dein.

```markdown
## 📱 RELEASE REPORT — v<version> "<naam>"

### 1. Kya naya hua (aam zubaan — code ke naam ke bagair)
| # | Aap ko kya farq dikhega | Pehle | Ab |
|---|---|---|---|
| 1 | … | … | … |

### 2. Kaise check karein (har cheez ka apna test)
| Test | Kadam (1-2-3) | ✅ PASS ka nishaan | ❌ FAIL ka nishaan |
|---|---|---|---|
| T1 | … | … | … |

### 3. Kya abhi bhi adhoora hai (imaandari)
* … (kaun sa flaw, kis phase mein theek hoga)

### 4. Agar kaam na kare — ye bhejein
* LAB → <panel ka naam> → poora text copy → yahan paste
* Sath mein: phone ka naam, Android version, aur kya kar rahe the

### 5. Version ki pehchaan (nayi APK lagi ya nahi)
* Boot par toast: `MAYA v<version> • …`
* LAB → <kahan> par: `<pehchaan ki line>`
```

**Bharne ke usool:**

* Hissa 1 mein **file ka naam, function ka naam, flaw-code (F01 waghera) NAHI** — wo sab doc ke
  upar wale hisson mein hota hai. Yahan sirf *"aap ki zindagi mein kya badla"*.
* Hissa 2 ka har test **≤4 kadam** ka ho aur **ek nazar** mein natija dikhe (panel ki koi line,
  koi toast, koi awaaz). Aisa test na likhein jiske liye adb ya logcat chahiye.
* Hissa 2 mein **FAIL ka nishaan** likhna lazmi hai — warna user ko pata hi nahi chalega ke
  cheez tooti hui hai (aur hum andhere mein guess karte rahenge).
* Hissa 3 **khali nahi ho sakta** — koi release mukammal nahi hoti. Jo adhoora hai wo likhein.
* Hissa 5 ke bagair user purani APK par naye fix ko azmata rahega aur humein "kaam nahi kiya"
  kahega — ye v5.10.x ka barha hua sabak hai.
