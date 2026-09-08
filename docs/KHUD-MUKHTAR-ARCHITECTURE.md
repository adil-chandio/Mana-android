# 🕸️ KHUD-MUKHTAR (P6) — Maya khud sochti hai, magar LAGAAM ke sath

> **Contract:** ye dastavez usool batati hai. Code: `app/src/main/assets/web/index.html` →
> `var KHUD = { … }` (⚡ AMAL engine ke baad, 👂 KAAN se pehle).
> Plan jis se ye bana: [`P6-KHUD-MUKHTAR-PLAN.md`](P6-KHUD-MUKHTAR-PLAN.md).
> Saboot: `npm test` → Section **27** (lab) + Section **12** (settings-ui boot).

---

## 0. EK LINE MEIN

**Maya ko ab apne phone ka HAAL pata hai, wo aap ki AADAT khud pakar kar POOCHTI hai,
aap ka ADHOORA kaam yaad rakhti hai — aur ye sab ek BUDGET ke andar, sirf 🟢 SABZ kaam.**

Switch: `FLAGS.khud` — **default OFF**. Ek APK, teen switch (P6a+b+c ek sath), aap LAB se
ek ek chalu karo. *(CHHED 11 ka faida.)*

---

## 1. 🔬 FORENSIC — pehle jo tha (andaza nahi, code)

### 1.1 🔴 "proactive" = bay-maqsad shor

```js
var PRO_LINES = [ 6 jumlay ];
setInterval(function(){
  …
  msg = PRO_LINES[Math.floor(Math.random() * PRO_LINES.length)];
  reply(msg, true);
}, 360000);          /* har 6 minute */
```

Na waqt dekhta tha, na battery, na aap ka kaam. Raat 3 baje bhi
*"Bore ho rahi hoon — koi quiz karein?"* bol sakta tha. Ye khud-mukhtari nahi, **shor** tha.

### 1.2 🔴 Teen cheezein maujood thin, magar PARHI kabhi nahi gayin

| Cheez | Kahan | Kya khoya |
|---|---|---|
| 📜 `LEDGER` | P3 — har amal ka roznamcha (`t, n, a, ok, st, tier, b`) | Aadat pehchanne ka poora data tha; `MAX: 60` aur **kabhi parha nahi gaya** |
| 🤝 `HAQEEQAT.STATE` | `message_contact: "typed"` = *likha gaya, BHEJA NAHI* | Adhoora kaam darj hota tha, phir **bhool jata tha** |
| 🔋 battery / net / waqt | `MayaBridge.battery()` · `navigator.connection` | **Dimaag ko kabhi bataya hi nahi gaya** — `sysPrompt()` mein haal ka ek lafz nahi tha |

### 1.3 ✅ Jo pehle se pakka tha (is liye **Kotlin mein ek line nahi likhi gayi**)

`ScheduledReceiver` · `BootReceiver` · `WakeWordService` · `MayaNotifService` ·
`AutoSendService` (`__autoSent` callback) · `LEDGER` · `NAAP` · `IJAZAT` · `RAILS` · `SUKOON`.

---

## 2. 🏗️ DHANCHA — 5 sutoon

```
var KHUD = {
  HAAL   : {}   👁️  abhi ka haal (waqt · battery · net · headphone · aakhri amal)
  BUDGET : {}   🛡️  kitna bol sakti hai, kab nahi, aur kitni dafa ROKI gayi
  AADAT  : {}   🧠  roznamche se aadat pakarna → tajweez → roz khud (sirf 🟢)
  ADHOORA: {}   📌  "typed" amal jinki tasdeeq nahi aayi → ek dafa poochho
  (dry/report/tick/start/stop/card/say)
}
```

Har sutoon **akela** kaam karta hai aur **akela** band ho jata hai — `FLAGS.on("khud")`
ek hi darwaza hai (Qanoon 1).

### 2.1 👁️ HAAL — `HAAL.context()` har turn prompt mein jata hai

```
👁️ ABHI KA HAAL (phone se naapa gaya, dopahar 15:30 · battery 12% · 4G ·
   aakhri amal: brightness_control 30% (5 min pehle) [done]).
   Is haal ko sirf tab zikr karo jab user ki baat se lagta khaye …
   Jo HAAL mein NAHI likha, us ka daawa hargiz mat karo.
```

* **~40 token** (test: `ctx.length < 340` harf) — CHHED 9 ka sabaq: prompt phool kar na phate.
* **Battery ke do zariye:** native bridge pehle (`MayaBridge.battery()`), warna browser
  (`navigator.getBattery` → `HAAL.watch()` cache bharta hai). **Dono na hon → `null`**,
  aur HAAL mein battery ka zikr **hi nahi aata** (andaza nahi likhte).
* `lastAmal()` LEDGER se aakhri **kaamyab** amal uthata hai — *"abhi kya hua tha"* ka pata.
* `waqt()`: 4-12 subah · 12-16 dopahar · 16-19 shaam · 19-23 raat · 23-4 aadhi raat.

### 2.2 🛡️ BUDGET — be-lagam khud-mukhtari = tabahi

| Qanoon | Number | Kyun |
|---|---|---|
| 💬 Bol-budget | **6/din** | purana 6-minute shor khatam |
| ⏳ Farq | **45 min** | ek hi ghante mein 3 baatein na hon |
| 🔇 Khamosh ghante | **0:00 – 7:00** | neend (urgent ke siwa kuch nahi) |
| 🤫 Masroof | `SUKOON.haal !== "KHALI"` | P9 ka ehteram: bolte/sunte waqt chup |
| 🔋 Battery | **<10% aur charge nahi** → sirf urgent | Maya khud battery na kha jaye |
| ⏱️ Rozana hadd | har rule/tajweez **20/din** | loop mein 50 notification na aayen |
| 📊 Hisab | har ROK **darj** (`quietBlocked, gapBlocked, capBlocked, battBlocked, busyBlocked`) | andhi khud-mukhtari nahi — report mein ginti |

**Tarteeb ahem hai:** hadd (cap) ka check **farq (gap) se PEHLE** — warna budget khatam
hone par har tick *"45 min baad bol sakti hoon"* ka jhoota waada karta (test ne pakda).

**`urgent`** sirf ek cheez ke liye hai: battery. Wo khamosh ghante aur hadd dono se chhoot
deti hai — magar **masroof** (bol rahi/sun rahi) aur switch OFF se nahi.

### 2.3 🧠 AADAT — hisab, jadu nahi

```
LEDGER → (tool, arg-bucket, ghanta) ke jore
shart  : count ≥ 4  AUR  alag din ≥ 3   (aur tool 🟢 SABZ, aur amal kaamyab)
natija : tajweez card → HAAN ROZ KARO / POOCH KAR KARO / NAHI
```

* **`bucket()` — FLOOR, round NAHI.** `Math.round(25/10)*10 = 30` se 20% aur 25% **do alag
  aadatain** ban jate the aur shart kabhi poori na hoti. Ab `Math.floor` → 20 aur 25 dono
  `"20"` (yani "20-29 ek tokri"). **Boolean pehle** jaancha jata hai, warna
  `Number(true) = 1 → bucket 0` aur torch ON/OFF ek hi aadat ban jate.
* **Bekaar matn chhanta:** `code · input · text · query · url · entry` signature mein nahi
  jate — warna har WhatsApp message "nayi aadat" hota.
* **Waqt ki khirki:** us ghante mein, aadat ke minute se **59 min** tak. Ek din mein **ek dafa**.
* **Faisla localStorage mein** (`maya_khud_aadat`), saboot LEDGER mein. LEDGER sirf 60 amal
  rakhta hai — saboot ghum jaye to bhi `run()` mehfooz faisle se chal jata hai.
* **`NAHI` = hamesha ke liye.** `mode:"off"` → `due()` skip. Aur ek hi aadat ki tajweez
  **zindagi mein ek dafa** (HAAN/POOCH/NAHI — jo bhi kaha, faisla mehfooz).
* **`auto` mode ka loop-taala:** `act()` chalne se **PEHLE** `markRun()` karta hai — nakaam
  ho ya kaamyab, us ghante dobara koshish nahi (warna tick har 2 min wahi kaam karta).

### 2.4 📌 ADHOORA — asli chat ka adhoora kaam

```
LEDGER mein: st === "typed" || st === "started"
             aur e.ok === true
             aur !e.sent && !e.kdone
             aur 10 min < age < 3 din
   → "wo kaam adhoora reh gaya tha. Ab kar doon?"
```

* **Tasdeeq ka darwaza:** `window.__autoSent` (jo AutoSend ✓ par Kotlin se aata hai) ab
  `ADHOORA.markSent()` ko bulata hai — pichle **30 min** ke `typed` amal `sent` ho jate hain.
  **Is ke baghair Maya roz wahi purana message "adhoora" samajh kar poochti rehti.**
* `REHNE DO` → `kdone = 1` → dobara nahi.
* Rozana **ek** se zyada nahi (`askOk("adhoora")` + `pending` ka taala).
* 3 din se purana → **bhoola hua, adhoora nahi** (3 din baad "ab bhejun?" bewaqoofi hai).

### 2.5 ⚗️ DRY-RUN + 🕸️ REPORT

`dry()` — *"abhi karti to kya"*: budget, aadat, adhoora, haal — **na tool chalta hai na
jumla bolta** (test: `ran.length === 0 && said.length === 0`).
`report()` — seekhi hui aadatain, abhi banti hui aadatain, adhoore kaam, budget ka hisab,
aur **qanoon khud likha hua** (khamosh ghante · hadd · sirf 🟢).
Agar 🛡️ IJAZAT band ho to report **sach bolti hai**: *"LEDGER khali hai kyunki IJAZAT ka
switch band hai — roznamcha wahin banta hai"* (bahana nahi).

---

## 3. 🚫 QANOON — jo kabhi nahi toota jayega

1. **Switch OFF = ek line bhi nahi.** `context() → ""`, `can() → false`, `due() → null`,
   `find() → null`, `tick() → null`, `start() → false` (koi timer hi nahi).
   Aur purani `PRO_LINES` wali chatter **mitai nahi gayi** — sirf chhor di gayi
   (Qanoon 2: purani APK/purana raasta salamat).
2. **Khud-mukhtar amal kabhi 🔴 SURKH ya 🟡 ZARD nahi.** `run()` har dafa
   `IJAZAT.T[name] !== 1` par **rad** karta hai — chahe localStorage mein `mode:"auto"`
   likha ho (herapheri ka taala). Test: saare 36 tools par — 🟢 16 ijazat ke sath, 20 rad.
3. **Har khud-mukhtar amal darj:** `LEDGER.push` + `pushLog` + bol-budget mein ginti.
   ⟲ UNDO (P3) muft mein sath aa jata hai.
4. **Tajweez EK dafa, ek waqt mein EK card.** 5 minute mein jawab na aaya to card khud
   hat jata hai aur **NAHI** maana jata hai (IJAZAT ka hi usool).
5. **Jhoot nahi:** HAAL mein sirf jo naapa gaya. Battery maloom nahi → likha hi nahi jata.
6. **Koi naya Kotlin nahi** — purani APK ke sath bhi chalega (Qanoon 2).

---

## 4. 🔌 JORE (integration points)

| Kahan | Kya |
|---|---|
| `FLAGS.DEF` | `khud: false` |
| `sysPrompt()` wrap | `KHUD.HAAL.context()` + `KHUD.HAAL.rule()` (MALIK/HAQEEQAT ke baad) |
| `startProactive()` | `khud` ON → purana interval **nahi**, `KHUD.tick()` har 2 min |
| `window.__autoSent` | `ADHOORA.markSent()` — bheje hue message adhoore nahi |
| `handleUserText()` | `"kya seekha hai?"` · `"dry-run"` · `"abhi ka haal"` · `"aaj kuch mat karo"` · `"aadatain bhool jao"` — dimaag par jate hi nahi |
| LAB (Settings) | 🕸️ switch + 3 button (report · DRY-RUN · HAAL) + `labPaint()` |
| `DIAG.build()` | 🕸️ KHUD-MUKHTAR ka hisab diagnostic mein |
| `execTool()` | aadat/adhoora **usi darwaze** se jate hain → RAILS + IJAZAT + LEDGER + TRACE sab khud lag jate hain |

---

## 5. 🧪 SABOOT — 106 naye test

| Section | Kya | Test |
|---|---|---|
| 27a | switch OFF = purana raasta (7 + 1 static) | 8 |
| 27b | 👁️ HAAL: native + browser battery, sach, token hadd, waqt ke hisse | 10 |
| 27c | 🛡️ BUDGET: khamosh ghante · farq · hadd · urgent · SUKOON · battery · rozana hadd | 18 |
| 27d | 🧠 AADAT: bucket/sig · ≥4 aur ≥3 din · sirf 🟢 · card · auto/dry · NAHI hamesha | 23 |
| 27e | 📌 ADHOORA: 10 min · AUTO-SEND tasdeeq · 3 din · rozana hadd | 12 |
| 27f | ⚗️ DRY-RUN + 🕸️ report (SACH wali line bhi) | 6 |
| 27g | 🕸️ tick: tajweez → auto → chup · adhoora · masroof · khamosh · battery · idle | 13 |
| 27h | 🚫 qanoon: surkh/zard rad + **36/36 tools** par taala | 4 |
| | **Section 27 kul** | **94** |
| ui-12 | poori page boot kar ke: switch, 3 button, report, ON/OFF | 12 |

**Naye test: 106** (94 lab + 12 boot) · **kul 1081** (975 → 1081).

### Test ne jo 3 bug pakde (code review se nahi mile the)

1. **`Math.round` bucket** — 20% aur 25% alag aadatain → shart kabhi poori na hoti (WTF #1 mar jata).
2. **Battery-guard charging ko nahi dekhta tha** — phone raat bhar plug par, aur Maya goongi.
3. **`can()` ki tarteeb** — budget khatam hone par bhi "45 min baad bol sakti hoon" ka jhoota waada.

---

## 6. ⚠️ Imaandari se — kya GHALAT ho sakta hai

| Dar | Ilaj |
|---|---|
| *"Maya bakwas karegi"* | 6/din + 45 min + khamosh ghante + `proactive:false` par idle-baat bhi nahi |
| *"ghalat aadat pakar legi"* | ≥4 dafa AUR ≥3 alag din · sirf 🟢 · **hamesha ijazat** · NAHI = hamesha ke liye |
| *"khud se message bhej degi"* | `message_contact` 🔴 SURKH hai → `mine()` mein ginta hi nahi, `run()` rad karta hai |
| *"battery kha jayegi"* | koi network call nahi, koi polling nahi — har 2 min ek halka hisab (localStorage) |
| *"privacy"* | sab kuch **phone par** (`maya_khud_budget`, `maya_khud_aadat`). DIAG mein pehle se redaction |
| *"APK toot jayegi"* | **Kotlin mein ek line nahi badli** (sirf version string) |
| *"LEDGER chhota hai"* | Haan — `MAX: 60` (~1-2 din). **Agla qadam:** 300 karna (P6 plan §3.3). Is release mein nahi kiya kyunki purana `maya_ledger` data migrate karna parta |

---

## 7. 📅 Agla qadam (P6c — jo is release mein NAHI hai)

* 🕸️ **RULE** — *"jab battery 15% ho to batana"* zubaani rule banana (`ScheduledReceiver`
  aur `MayaNotifService` ke tukre maujood hain, engine nahi).
* 🎓 **SEEKH** — miss ka register: router samjha nahi / tool nakaam / **aap ne ek hi baat
  2 dafa kahi** / SUNO ka natija aap ne sudhara → ek tap → `AMAL.TRIGGERS` mein hamesha ke liye.
* 📜 **LEDGER.MAX 60 → 300** (aadat ke liye ~2 hafte ka data) + SCHEMA migration (`NOW: 2`).
