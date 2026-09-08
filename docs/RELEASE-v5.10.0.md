# MAYA v5.10.0 — 🕸️ KHUD-MUKHTAR: Maya ab khud NOTICE karti hai

**versionCode 71 · versionName 5.10.0 · P6 (a+b+c ek APK mein, switch default OFF)**

> *"Aap ne kabhi ye nahi bataya. Aap ne khud bhi ghaur nahi kiya tha."*
> Ab Maya apne roznamche se aap ki aadat khud pakar kar **poochti** hai.

Usool: [`KHUD-MUKHTAR-ARCHITECTURE.md`](KHUD-MUKHTAR-ARCHITECTURE.md) ·
plan: [`P6-KHUD-MUKHTAR-PLAN.md`](P6-KHUD-MUKHTAR-PLAN.md)

---

## 1. Masla — "proactive" ka matlab tha: har 6 minute ek RANDOM jumla

```js
var PRO_LINES = [ "Bore ho rahi hoon — koi quiz karein?", …6 jumlay ];
setInterval(… msg = PRO_LINES[Math.floor(Math.random() * PRO_LINES.length)]; reply(msg, true); …, 360000);
```

Na waqt dekhta tha, na battery, na aap ka kaam — **raat 3 baje bhi**.
Ye khud-mukhtari nahi, **bay-maqsad shor** tha (plan §1.2 — forensic, andaza nahi).

Aur doosri taraf teen cheezein maujood thin magar **kabhi istemal na huin**:

| Cheez | Halat | Kya khoya |
|---|---|---|
| 📜 `LEDGER` (P3) | har amal darj hota tha | aadat pehchanne ka poora data — **parha kabhi nahi gaya** |
| 🤝 `state:"typed"` (P5) | "matn likha gaya, BHEJA nahi" darj hota tha | adhoora kaam **bhool jata tha** |
| 🔋 battery / net / waqt | maloom ho sakta tha | **dimaag ko bataya hi nahi gaya** — `sysPrompt()` mein haal ka ek lafz nahi |

---

## 2. Ilaj — 5 sutoon, EK switch (`khud`, default OFF)

### 👁️ HAAL — dimaag ab ANDHA nahi

Har turn prompt mein ~40 token:

```
👁️ ABHI KA HAAL (phone se naapa gaya, dopahar 15:30 · battery 12% ·
   aakhri amal: brightness_control 30% (5 min pehle) [done]).
   … Jo HAAL mein NAHI likha, us ka daawa hargiz mat karo.
```

Battery ke **do zariye** (native bridge → browser `getBattery`), aur **dono na hon to
HAAL mein battery ka zikr hi nahi aata** — andaza nahi likhte.

### 🛡️ BUDGET — bolne ki lagaam

| Qanoon | Number |
|---|---|
| 💬 khud se baatein | **6/din** |
| ⏳ do ke darmiyan | **45 min** |
| 🔇 khamosh ghante | **raat 12 → subah 7** |
| 🤫 Maya bol/sun rahi ho | **chup** (P9 `SUKOON.haal` se) |
| 🔋 battery <10% (charge na ho) | sirf **zaroori** |
| ⏱️ har rule/tajweez | **20/din** |

Har **ROK darj** hoti hai — `roki: khamosh-ghante 3 · farq 2 · hadd 1 · battery 0 · masroof 4`.
Andhi khud-mukhtari nahi: report mein ginti nazar aati hai.

### 🧠 AADAT — WTF #1

```
🧠 MAYA NE KUCH NOTICE KIYA

  Pichle 4 alag dinon mein 4 dafa:
  brightness_control (20%) — roz taqreeban 15:10

  Ye aap ne kabhi bataya nahi tha — maine apne 📜 roznamche se khud nikala.
  Roz is waqt KHUD kar diya karun?

  [ ✅ HAAN, ROZ KARO ]  [ ⏰ POOCH KAR KARO ]  [ ❌ NAHI ]
```

Shart: **≥4 dafa AUR ≥3 alag din** · sirf 🟢 SABZ tools · ek waqt mein **EK** tajweez ·
**NAHI = dobara kabhi nahi**.

### 📌 ADHOORA — WTF #2

```
📌 EK KAAM ADHOORA REH GAYA THA

  20:56 par Monarch ko message_contact — "main aa raha hoon"
  (14 ghante pehle — matn TYPE hua tha magar BHEJA nahi gaya)

  Ab kar doon?     [ ✅ HAAN, ABHI KARO ]  [ ❌ REHNE DO ]
```

`window.__autoSent` (AutoSend ✓) ab **tasdeeq** karta hai → *bheja hua message adhoora NAHI*.
Rozana **ek** se zyada nahi · 3 din se purana = bhoola hua, adhoora nahi.

### ⚗️ DRY-RUN + 🕸️ REPORT

LAB mein 3 naye button: **🕸️ KHUD-MUKHTAR KA HAAL** · **⚗️ DRY-RUN** (karti to kya — karegi
kuch nahi) · **👁️ ABHI KA HAAL**. Aur zubaani: *"kya seekha hai?"* · *"abhi ka haal?"* ·
*"dry-run"* · *"aaj kuch mat karo"* · *"aadatain bhool jao"*.

---

## 3. 🚫 Qanoon 2 — khud se KABHI surkh/zard nahi

`run()` har dafa `IJAZAT.T[name] !== 1` par **rad** karta hai — chahe localStorage mein
`mode:"auto"` likha ho (herapheri ka taala). Test saare **36 tools** par chalta hai:
🟢 16 ijazat ke sath, baqi 20 rad. Yani khud se **na call, na SMS, na WhatsApp**.

Aur: switch OFF → `context():""` · `can():false` · `due():null` · `tick():null` ·
`start():false` (koi timer hi nahi). Purani `PRO_LINES` chatter **mitai nahi gayi** —
sirf chhor di gayi (Qanoon 2: purana raasta salamat).

---

## 4. 🐞 Test ne jo 3 bug pakde (code review se nahi mile the)

1. **`Math.round` bucket** — `round(25/10)*10 = 30`, yani 20% aur 25% **do alag aadatain**
   ban jate the aur `≥4` ki shart **kabhi poori na hoti** (WTF #1 mar jata). Ab **FLOOR**
   (20-29 ek tokri) + boolean pehle (`Number(true)=1 → "0"` se torch ON/OFF ek na ban jayen).
2. **Battery-guard `charging` ko nahi dekhta tha** — phone raat bhar plug par laga ho to bhi
   Maya **goongi** ho jati. Ab `!b.charging` shart hai.
3. **`can()` ki tarteeb** — budget khatam hone par bhi *"45 min baad bol sakti hoon"* ka
   **jhoota waada** nikalta tha. Ab hadd ka check farq se **pehle**.

---

## 5. Saboot

- `npm test` = **1081/1081 PASS** (CSS ✓ · settings **84** · voice 294 · brain 155 · lab **548**)
- Lab engine Section **27a–27h**: 94 naye test — switch OFF ka taala · HAAL ki sachchai ·
  BUDGET ke 6 qanoon · AADAT ka hisab + card + NAHI · ADHOORA + AUTO-SEND tasdeeq ·
  DRY-RUN · tick ke 7 scene · **36/36 tools** par surkh/zard ka taala
- Settings-UI Section **12**: poori page jsdom mein **boot** kar ke — switch, 3 button,
  report, ON/OFF (12 test)
- **Kotlin mein ek line nahi badli** (sirf version strings) → purani APK ke sath bhi chalega
- CI har push par `assembleDebug` — compile proof push ke baad ✅/❌

---

## 6. Device par kya dekhna hai (aap ka hissa)

1. **Settings → 🧪 LAB → 🕸️ KHUD-MUKHTAR = ON** (default OFF hai — ye zaroori hai)
2. **👁️ ABHI KA HAAL** dabao → waqt + battery + aakhri amal nazar aana chahiye
3. **⚗️ DRY-RUN** → "karti to kya" ka poora hisab (kuch chalega nahi)
4. 🛡️ **IJAZAT** bhi ON karo (roznamcha wahin banta hai) → 3-4 din aam istemal
   → **🕸️ KHUD-MUKHTAR KA HAAL** mein "abhi banti hui aadatain" nazar aayengi
5. **Raat 12 ke baad** → Maya khud se **kuch nahi** bolegi (khamosh ghante)
6. Ek WhatsApp message type karwa ke **SEND na dabao** → 10 min baad 📌 card aana chahiye
7. *Aur sab se ahem:* purana **har 6 minute wala random jumla ab NAHI aayega** — shor kam hua hai

---

## 7. Agla qadam (P6c — is release mein NAHI)

* 🕸️ **RULE** — *"jab battery 15% ho to batana"* zubaani rule banana
* 🎓 **SEEKH** — apni ghaltiyon ka register: **aap ne ek hi baat 2 dafa kahi** → ek tap → hamesha ke liye seekh liya
* 📜 **LEDGER.MAX 60 → 300** (+ SCHEMA migration `NOW: 2`) — aadat ke liye ~2 hafte ka data
