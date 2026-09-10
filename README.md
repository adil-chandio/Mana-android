> **Development wake-recovery candidate — 5.17.3 / code 85 (phone validation pending)**
>
> The user reports code84 typed Chat is fast and the explicitly selected Fish voice plays, but wake did not respond. Code85 preserves that chat/voice path; fixes a reproduced STOP/SUNO speech-exclusion leak; adds actual native wake status, readiness/failure diagnostics and honest indicators. No physical wake or latency improvement is claimed yet.
>
> [Current candidate evidence and installation protocol](docs/WAKE-RECOVERY-5.17.3.md) · [Code84 feedback and historical receipt](docs/PHASE3-DEVICE-TEST.md).
>
> Automated checks are not phone acceptance. **Do not reinstall older codes or promote Stable.** Secure in-app delivery is still blocked by signing/bootstrap configuration; use only the current CI-verified manual, in-place, same-development-signer candidate. Never uninstall/clear data to force it.

> **Update Center implementation — v5.17.0 / code 82 (bootstrap, not published)**
>
> Native Stable/Beta updates, signed metadata, verified APK downloads, Android install confirmation and a separate **MAYA Updates** recovery entry are implemented. First installation still needs a manually installed, signing-configured bootstrap APK. Development artifacts without a pinned update key intentionally cannot fetch/install updates.
>
> **Activation blockers:** Source can be pushed, but GitHub rejects workflow-file changes and Secrets access. Proposed workflows are in `docs/workflows/` pending authorized activation; do not use the old remote release workflow as the secure publisher. Android CI has passed all 25 native JVM tests and verified a development APK; signing configuration and real-device upgrade verification remain required. The exposed legacy APK signing identity is not repaired by this feature. Voice/wake fixes are not included.
>
> Architecture, setup, security limitations and phone test plan: [docs/UPDATE-CENTER.md](docs/UPDATE-CENTER.md). Edit `release/version.json` / notes / test checklist, then run `npm run version:sync`. Never overwrite a published update.

# 🤖 MAYA — Personal AI Assistant

**Version 5.17.3 (85) — Development device-test candidate • Android APK + Web PWA**

MAYA = aap ka apna JARVIS — voice controlled AI assistant (Gemini brain),
ab **asli Android app** (APK) ki soorat mein, native superpowers ke saath:

## Historical changelog (not current device-acceptance evidence)

## 🎚️ v5.9.0 — SUKOON: awaaz kabhi nahi kategi · mic-larai khatam *(P9 · v5.9.1 mein 🗣️ ON-DEVICE LANGUAGE ka asli button bhi)*

**📵 Ek waqt mein EK cheez — Maya ya BOL rahi hai, ya SUN rahi hai. Kabhi dono ek saath nahi.**

Teen live masle, EK jang-boot: mic aur awaaz do kore hain jo ek hi badan (audio system) par lar rahe the.

| Aap ne dekha | Jadbahad | Ilaj |
|---|---|---|
| 🔊 "MAYA onl—" — aawaaz beech mein katna | Mic khulne par Android audio-focus mic ko de deta tha; Kotlin ko pata hi nahi tha Maya bol rahi hai (`speaking` sirf JS mein tha) | **L1 HAAL bridge** — JS ke 25 hook se `BOL_RAHI/APP_SUN` lamhe mein Kotlin tak; **L2 mic ke CHAAR darwaze** pehle HAAL poochchte hain |
| 🎤 Mic ka bulb on/off (wake + tap-to-speak dono) | Do recognizer ek mic ki jang + do pending restarts ek saath | **L4 MIC SULAH** (tap-to-speak hamesha jeetta hai) + **L6 RACE TOKEN** (`pendingGen`) |
| 👂 "Maya" nahi jaagti; wake switch apne aap band | **Error 8 par service khud ko maar rahi thi aur aap ka switch mita rahi thi** | **L5 ERR-8 MERCY** — na stopSelf, na switch chhedna; sirf 2s sukoon |

Aur: **L3** 550ms echo tail (tail timer mic ko stomp nahi karta) · **L7** SELF-WAKE SHIELD (apni awaaz par jaagna imkan-harab) · 60s stale-pause recovery · escape hatch switch (LAB → 🎚️ SUKOON, default ON).

📖 [`docs/RELEASE-v5.9.0.md`](docs/RELEASE-v5.9.0.md) · usool: [`docs/SUKOON-AUDIO-ARBITRATION.md`](docs/SUKOON-AUDIO-ARBITRATION.md)

🧪 **970 test** (932 → 970)

---

## 🚪 v5.8.0 — "MAYA" ke bagair KUCH NAHI · 🎤 qareebi awaaz  *(P8a+b+c)*

**🔒 SAKHT DARWAZA** — `"yeh karo"` → ⛔ bilkul kuch nahi · `"chalo Maya yeh karo"` → ⛔ (Maya **shuru** mein honi chahiye) · `"Maya yeh karo"` → ✅ seedha kaam.
Jarh: `afterSpeak()` mein `if ((autoListen || wakeWord) && wasVoice) startListening()` — **"Maya" ki koi shart hi nahi thi.** Ab sirf jab 🚪 darwaza khula ho.
🚪 **Darwaza** — jaagne ke baad 15 sec bina "Maya" baat chale, har jawab par waqt dobara; **"bas"/"theek hai"** par foran band. Slider `0` (har baar Maya) … `60`.

**🩺 KAAN DOCTOR** — phone ka **voice-input service ka naam** parh kar batata hai (`Android System Intelligence` = **yehi masla**), aur **seedha wahi settings screen kholta hai**. 🎯 **Recognizer ki seerhi:** on-device (Android 12+) → **Google zabardasti** (AiAi bug ka ilaj) → aam.

**💀 Aur chhupa bug:** `MainActivity: EXTRA_MAX_RESULTS = 1` — **SUNO ka poora "kai andazon mein se behtareen chuno" wala nizam main mic par kabhi chala hi nahi tha.** Ab **6 andaze + `CONFIDENCE_SCORES`** *(kabhi parhe hi nahi gaye the)*. Kam yaqeen par ghalat kaam nahi — **poochh leti hai**.

**🎤 QAREEB** — `setPreferredMicrophoneFieldDimension(+0.8)` *(-1 poora kamra … +1 sirf qareeb)* · `MIC_DIRECTION_TOWARDS_USER` · `VOICE_RECOGNITION` · NS/AGC/AEC. **🎧 VAD:** sannate mein recognizer **bilkul band** — *"mic on/off"* ka asal ilaj. **🧪 MIC TEST** batata hai shor/awaaz/SNR aur **kaunsa effect is device par sach mein chala**.

🧪 **932 test** (889 → 932)

📖 [`docs/RELEASE-v5.8.0.md`](docs/RELEASE-v5.8.0.md) · plan: [`docs/P8-KAAN-v2-PLAN.md`](docs/P8-KAAN-v2-PLAN.md)

## 👂 v5.7.0 — KAAN: wake word ab sach mein jaagti hai

User: *"Background mein mic on/off hota hai, magar 'Maya' bolne par kuch nahi hota."* **7 bug mile.**

1. 🚨 **Hum ANDHE the** — service kabhi nahi batati thi ke usne kya suna ya kya error aaya. **Ab har waqia darj** + `👂 WAKE WORD KA HAAL` button
2. 🚨 `val isWake = …` **dead variable** — bana kar chhor diya jata tha, kabhi use hi nahi hua
3. 🚨 `contains("\\u0645\\u0627…")` — **double backslash** = literal matn, Urdu **kabhi match ho hi nahi sakta tha**
4. 🚨 `EXTRA_MAX_RESULTS = 1` — sirf pehla andaza. **SUNO (v4.11.0) ne sikhaya tha ke sahih jawab aksar doosre/teesre mein hota hai.** Ab **6**, aur har ek check hota hai
5. 🚨 Zubaan `"en-IN"` **hard-code** jabke user ka `stt: ur-PK` — ab settings se
6. 🚨 `NO_MATCH → restart(250ms)` — Android 11+ background mic ko **throttle** karta hai. **Yehi "mic on/off" ki wajah thi.** Ab backoff `0.7s → 3.5s`
7. 🚨 Matching sakht — ab `maiya · mahiya · my a · مایا · माया`, aur *"maya brightness barhao"* ek hi saans mein

🏗️ **Aur bara faisla:** Kotlin ab **bewaqoof** hai (sirf saare andaze forward karta hai), faisla JS mein — yani **aage tuning ke liye nayi APK nahi chahiye**

🧪 **889 test** (860 → 889)

📖 [`docs/RELEASE-v5.7.0.md`](docs/RELEASE-v5.7.0.md)

## 👁️ v5.6.0 — P7a: NAZAR (Maya SCREEN parh sakti hai)

**Forensic:** `AutoSendService.kt` **pehle se** ek asli `AccessibilityService` thi — `rootInActiveWindow`, `performAction(CLICK)`, `performGlobalAction(BACK)` sab maujood. Bas **teen line XML** ne use WhatsApp tak mehdood kar rakha tha.

- 👁️ **NAZAR** — Maya screen ka poora tree parh kar saaf fehrist bana deti hai: `✏️ [0] Search or type URL · 🔘 [1] Search ×2 · ↕️ [4] scroll`
- 🔧 **Teen line config** badli: `packageNames` hata di · `flagReportViewIds` jora · `canPerformGestures` ON *(P7b ke liye — abhi istemal nahi)*
- 📉 **Dohri chhanti** — Chrome ke page mein 500+ node hote hain. Kotlin motay tor par chhaanta hai, JS dohre hataata/jama karta/kaatta hai → **≤40 element, ~204 token** *(CHHED 9 ka sabaq)*
- 🔒 **Is release mein Maya kuch CHHU hi nahi sakti** — test ka taala: `dumpScreen()` ke andar **`performAction` hai hi nahi**. 🟢 SABZ darja, 🤝 `state:"info"`, aur **purana WhatsApp AutoSend bilkul salamat**
- 🆕 Naya tool `read_screen` (35 → 36)
- 🧪 **860 test** (825 → 860)

⚠️ **Ek dafa karna parega:** Settings → Accessibility → **MAYA AutoSend → OFF → ON** *(config badla hai)*

📖 [`docs/RELEASE-v5.6.0.md`](docs/RELEASE-v5.6.0.md) · plan: [`docs/P7-HAATH-PLAN.md`](docs/P7-HAATH-PLAN.md)

## 🎯 v5.5.0 — NISHANA: hukm ab sahih jagah jata hai

**v5.4.0 ke asli device diagnostic se bane 5 fix.** *(Pehle jeet: 🤝 SACH ne jhoot rok diya — "type kar diya hai, ab SEND dabao" · ⚡ BIJLI chali · 🎙️ SUNO chala.)*

- 🎯 **Local hukm DIMAAG ka kaam cheen leta tha** — `"Camera khol ke picture lo"` → `khol` dekh kar `"ke picture lo"` ko **app ka naam** samajh liya. Ab app APPS list mein ho to hi local handle kare, warna **DIMAAG faisla kare** (uske paas `see_camera` hai)
- 🔍 **`"arena agent search karo"` → sirf `"karo"` dhoonda jata tha** (regex `search` ke BAAD wala hissa uthata tha). Ab **dono shaklein** + bekaar matn par search hota hi nahi
- 🚨 **Bina kuch kiye "kar rahi hoon"** — *"Aankhein mode activate kar rahi hoon 👀"* jabke **koi tool chala hi nahi**. Naya guard: turn track hua + 0 tool + daawa = **JHOOT** → app khud theek karti hai (*"camera KHOLNA parega… screenshot nahi le sakti"*)
- 📊 **TRACE mein sirf `🧠 —`** dikhta tha — naam ab **jawab aate hi darj** hota hai, aur khali chip dikhta hi nahi
- 🗣️ **`"Maya"` likha → angrezi jawab** — ab **zubaan bhi mirror**; angrezi sirf tab jab **poora jumla** angrezi ho
- 🧪 **825 test** (809 → 825)

📖 [`docs/RELEASE-v5.5.0.md`](docs/RELEASE-v5.5.0.md)

## ⚡ v5.4.0 — P4: BIJLI (50ms) · 👁️ AANKHEIN

**P3 mein lagaam lag gayi thi. Ab taqat dena mehfooz hai.**

- ⚡ **BIJLI** — 🟢 SABZ kaam **dimaag se PEHLE, ~50ms mein**. `"torch on karo"` → 40ms mein torch ON, phir dimaag sirf jumla banata hai
- 🌐 **Internet ke bina bhi chalta hai** — airplane mode mein torch/brightness/volume/timer/battery sab kaam karenge, aur Maya khud jumla bana legi
- 🔒 **Dohri hifazat** — tool `IJAZAT` mein 🟢 SABZ ho **aur** `BIJLI.OK` list mein bhi. 🔴 call/SMS/WhatsApp us list mein **hain hi nahi**. Yaqeen na ho (`sirf "torch"`, value nahi) → dimaag hi kare. Nakaam ho → chup-chaap dimaag ko de deti hai
- 👁️ **AANKHEIN** — `takePhoto`/`visionAsk` **pehle se maujood** the, magar sirf ek **tang regex** par aur **TOOL nahi** the. Ab `see_camera` + `see_image` asli tools hain (33→35) — dimaag **khud** faisla karta hai ke dekhna parega. `"is bill ka total kitna hai"` ab kaam karta hai
- 🟡 Camera **ZARD** darja — khulta hai, aap dabate ho. **Chori-chhupe photo nahi.** Aur 🤝 SACH: *"camera khol diya"*, na ke *"dekh liya"*
- 🧪 **809 test** (774 → 809)

📖 [`docs/RELEASE-v5.4.0.md`](docs/RELEASE-v5.4.0.md)

## 🛡️ v5.3.0 — P3: IJAZAT · 📜 LEDGER · ⟲ UNDO · 📊 TRACE

**Workflow ka usool: lagaam P4/P6 (zyada taqat) se PEHLE.** Brightness ghalat ho to koi baat nahi — magar Maya "Ali" samajh kar raat 3 baje "Ammi" ko call laga de, **wo wapas nahi hota.**

- 🚦 **Teen darje** — 🟢 SABZ (15 tools, foran) · 🟡 ZARD (12, bata kar) · 🔴 SURKH (6, **pehle ijazat**). *Test ka taala: har tool ka darja lazmi (33/33)*
- 🔴 **Ijazat ka card** — `📞 Ammi ko CALL lagani hai  [✅ HAAN] [❌ NAHI]`. **15 sec mein jawab na mila → NAHI.** Aur ijazat na mile to Maya ko hukm: *"zid mat karo"*
- ⚡ **TRUST MODE** — aap chaho to surkh bhi zard. Faisla aap ka
- 🛡️ **RAILS** — **OTP/password wala message KABHI nahi jata** · surkh tools par 45-sec rate limit (loop mein 50 call na lagen)
- 📜 **LEDGER** — *"aaj kya kya kiya?"* → waqt, tool, darja, kaamyab/nakaam
- ⟲ **UNDO** — *"wapas karo"* / *"undo"* / *"واپس کرو"*. **Jhoota waada nahi:** call wapas nahi ho sakti to saaf keh deti hai; purani halat maloom na ho to andaza nahi lagati
- 📊 **TRACE** — `🧠 Mistral 340ms · 🔧 brightness ✅ · 🗣️ fish`. **`<think>` wala bug ab FEATURE**
- 🧪 **774 test** (738 → 774)

📖 [`docs/RELEASE-v5.3.0.md`](docs/RELEASE-v5.3.0.md)

## 🔒 v5.2.0 — AWAAZ MEHFOOZ · 🎯 STHIR LEHJA

User: *"awaaz chuni, achi lagi, app band ki — setting reset ho gayi"* aur *"alag alag accents choose kar rahi hai"*. **Dono asli bug the.**

**BUG A — awaaz kho jati thi (do wajahen):**
- `SETFORM.load()` → `el.value = settings.fishVoice`, magar option select mein hota hi nahi tha (library sirf memory mein) → browser chup-chaap `""` rakh deta → agla **SAVE** awaaz **mita** deta 💀
- 🐟 SUNO `settings.fishVoice` bajata tha, **dropdown ki nahi** → nayi awaaz chun kar sunte to **purani** bajti

**Ilaj:** settings ab sach hai (dropdown nahi) · awaaz chunte hi **foran mehfooz** (SAVE ka intezar nahi) · `fishVoice` `SETFORM` se **bahar** · library `localStorage` mein · **🎤 naam dikhta hai, hex nahi** · SUNO ab dropdown wali awaaz bajata hai

**BUG B — har turn alag lehja (do wajahen):**
- `temperature: 0.7` — Fish docs: *"higher is more **varied**, lower is more **consistent**"*. Hum Fish ko jaan-boojh kar har dafa alag bolne ko keh rahe the → ab **0.35** + slider
- 🔑 Mood ka ishara **BOLI ko tor raha tha**: `[warmly, affectionately, like a close friend]` = **45 angrezi harf jumle ke shuru mein** → Fish phir se angrezi samajh leta. Ab **`[warm]`** (test: har ishara ≤14 harf)

🧪 **738 test** (725 → 738) — Section 19 mein 12 taale

📖 [`docs/RELEASE-v5.2.0.md`](docs/RELEASE-v5.2.0.md)

## 🗣️ v5.1.0 — BOLI: hamare LEHJE mein · 🎀 pyari awaazein

User: *"Maya hamare accent mein nahi bol rahi."* **Asal wajah awaaz ki nahi — MATN ki thi.**

Fish ki dastavez: *"The model **detects the language of the input text**."* Aur hum bhejte the
`"Ho gaya boss, brightness set kar di"` — **Latin harf → Fish samajhta hai angrezi → angrezi lehja.**

- 🗣️ **BOLI** — screen par **Roman Urdu hi**, magar **bolne** ke liye Devanagari/Urdu:
  `Ho gaya boss…` → `हो गया बॉस, ब्राइटनेस सेट कर दी` · `theek hai` → `ٹھیک ہے`
  **Brand ke naam Latin hi rehte hain** (WhatsApp/Monarch/YouTube)
  *(SUNO ka bilkul ulta: SUNO = Urdu→Roman likhne ke liye, BOLI = Roman→Urdu bolne ke liye)*
- 🎀 **PYARI** — 5 talash ek sath (hindi/urdu/female/indian/girl) + chhaanti: zanana +60 · mardana −80 · Hindi/Urdu +40. **Fish ki `language` filter** ab istemal ho rahi hai
- ⚠️ **Sach:** Fish ke paas **pitch ka option hai hi nahi** — user ka pitch 1.3 zaya ja raha tha. Ab Settings mein saaf likha hai
- 🧪 **725 test** (699 → 725)

📖 [`docs/RELEASE-v5.1.0.md`](docs/RELEASE-v5.1.0.md)

## 🤝 v5.0.0 — SACH: Maya ab jhoot nahi bolti  *(P2 MUKAMMAL)*

User ne **paanch dafa** kaha *"nhi hua"* — Maya har dafa boli *"bhej diya"*. Jarh code mein saaf likhi thi:

```js
out = { done: true, how: "chat khul gaya message type ho chuka" }
//           ^^^^        aur khud iqrar ke sirf TYPE hua
```
Aur `grep "never claim | kamyabi ka daawa"` → **0**. Prompt mein sach ka qanoon tha hi nahi.

- 🤝 **HAQEEQAT** — har tool ke jawab mein `sure`: *"kya kaam SACH MEIN hua?"*
  `done`/`queued`/`info` = ✅ · **`typed`** (WhatsApp/SMS — likha, bheja nahi) aur `started` (app khola) = ❌
- ⚖️ **Prompt ka qanoon** — daawa sirf `sure:true` par
- 🔑 **POST-CHECK** — *model par bharosa nahi, JAANCH*. Jawab bahar jane se pehle app khud dekhti hai; jhoot ho to **khud theek** kar deti hai: *"type kar diya — ab SEND dabao"*. Test mein user ki chat ke **saaton** jhoot pakre gaye (Roman + Devanagari + Urdu)
- ✅ Sacha jawab kabhi nahi chhua jata
- 🧭 **Agent loop 2 → 4 qadam** — *"play store kholo **aur** messenger search karo"*
- 🧪 **699 test** (677 → 699)

📖 [`docs/RELEASE-v5.0.0.md`](docs/RELEASE-v5.0.0.md)

## 🎙️ v4.11.0 — SUNO: Maya ab aap ki AWAAZ theek samajhti hai

**Pehle v4.10.0 ka natija (asli device se): `tool wale turn 0/12 → 27/44`, p90 `31.2s → 18.4s`.** ⚡ AMAL ne kaam kiya.

Ab asal masla: `"Funk Taka"` → Maya ne suna `"اس لاوا فنک"`. `"Monarch"` → `"موناک"` / `"منار"` / `"منا"`.

- 🎙️ **Saare andaze** — Kotlin sirf `firstOrNull()` leta tha aur Android ke baqi 3-5 andaze **phenk deta tha**. Ab SUNO un mein se wo chunta hai jismein jaane-pehchane naam sab se zyada hon
- ✍️ **Urdu script → Roman Urdu** — lafz ki lughat (~90) pehle, phir harf-ba-harf (بھ→bh, چھ→chh). `"موناک کو واٹس ایپ پر میسج بھیجو"` → `"Monarch ko WhatsApp par message bhejo"`
- 🔧 **Pise hue naam theek** — `monak`/`manar`→Monarch · `instgram`→Instagram · `watsapp`→WhatsApp. Aur `karo` kabhi `Chrome` nahi banta
- 🧠 **SUNO seekhta hai** — jo naam aap khud likhte ho, hamesha ke liye yaad
- 🩹 **SAVE button transparent tha** — `background:` shorthand `background-color` reset kar deta hai (`UI CHECK` ne pakra)
- 🩹 SAAF ne `"(Note: emojis not allowed per rules)"` bhi pakar liya
- 🧪 **677 test** (646 → 677) — SUNO ke test **asli chat ke jumlon** par

📖 [`docs/RELEASE-v4.11.0.md`](docs/RELEASE-v4.11.0.md)

## ⚡ v4.10.0 — AMAL: TOOLS AB HAR DIMAAG KO

**Asli device ke diagnostic se bana release.** Us ne sabit kiya: `tool wale turn : 0 / 12`.

Gemini — Maya ka **wahid** tool-wala dimaag — ka din ka quota khatam tha. Baqi 11 turn
Groq/Mistral ne diye, aur unhe `tools` bheje **hi nahi** jate the — magar prompt unhen
tools ka **hukm** deta tha. Isi liye Maya ne kaam ke bajaye kaam ka **bayan** likha, aur
`play_youtube(query="Funk` matn mein aa gaya.

- ⚡ **1 → 7 tool-wale dimaag** — ek registry, do tarjume (Gemini + OpenAI). Schema case fix (`OBJECT`→`object`)
- 🔑 **ARG ALIAS** — `level`/`value`/`"100%"`/`song`/`vol`/`state` → sahih naam. *(screenshot wala BUG 8)*
- 🛡️ Koi provider `tools` par 400 de → **bina tools dobara**, dimaag marta nahi
- 🧭 **ROUTER** — 33 mein se **12 tools** nazar hi nahi aate the. Ab har tool apne trigger khud deta hai (`britness` bhi) + test ka taala
- 🩹 **5 device bug**: kata hua tool call · Devanagari "किसने बनाया" · stale "4.1.0" · Gemini day-quota har turn retry · Cerebras 402
- 📱 Device naya nikla (**Android 14 · WebView 152**) → P5 ka khatra 🔴→🟡
- 🧪 **646 test** (612 → 646)

📖 [`docs/RELEASE-v4.10.0.md`](docs/RELEASE-v4.10.0.md)

## 🧪 v4.9.0 — SAAF ZUBAAN · NAAP-TOL · 👑 MALIK

**Pehla release AMAL-WORKFLOW ke qanoon ke tehat — sab kuch switch ke peeche.**

- 🧹 **SAAF ZUBAAN** — `<think>`, `<|channel|>analysis`, **kata hua** `<think>`,
  "Check constraints:", `brightness_control(level=100)` — **10 shaklein**, bubble
  **aur** awaaz dono se pehle. Kuch na bache → **agla dimaag** (khali bubble kabhi nahi)
- 🪙 **Token budget** — reasoning models ko **1400** (pehle sab ko 320 — soch usi mein khatam)
- 🗣️ **Zubaan ka tazad khatam** — ab **MIRROR pehle**: jo aap bolo wohi script
- 📊 **NAAP-TOL** — har turn ka waqt (p50/p90), **BASELINE** panel, **📋 DIAGNOSTIC COPY**
  (keys/number/email khud chhup jate hain), **🗃️ HARVEST** (aap ki apni baaton se test set)
- 👑 **MALIK** — Maya ko apne banane wale ka pata: chhota · poora · **flex** (jab Adil khud puche) · English. **Sirf sach**
- 🔒 **Qanoon 2** — LAB gayab ho jaye to bhi Maya chalti rahe (6 test)
- 🧪 **92 naye test** (kul **612**) — SAAF ke test **asli screenshot ke matn** par

📖 [`docs/RELEASE-v4.9.0.md`](docs/RELEASE-v4.9.0.md) · plan: [`docs/AMAL-ENGINE-PLAN.md`](docs/AMAL-ENGINE-PLAN.md) · tareeqa: [`docs/AMAL-WORKFLOW.md`](docs/AMAL-WORKFLOW.md)

## 🐟 v4.8.0 — FISH AUDIO ("Edge mein wohi awaaz hogi?")

**Jawab tha: nahi. Aur asal masla awaaz nahi — ANDAAZ tha.**

Gemini ki awaaz pyari isi liye lagti thi ke app use lafzon mein hidayat bhejti hai:
*"Say this warmly and affectionately, like a close friend."* Edge TTS ye kar hi nahi
sakta (Microsoft ne uska SSML sirf pitch/rate tak mehdood kar rakha hai) — is liye
v4.7.0 mein aap ke saare **9 MOOD Edge par bekaar** ho gaye the.

**Fish Audio S2.1 Pro wo andaaz WAPAS le aata hai:**
```
"[whispers softly and gently] Assalam o alaikum..."
"[excited, high energy] Mubarak ho!"
```
Fish ki dastavez: *"You can use **any** descriptive expression and the model will
interpret it."* App ke har mood ka Fish ishara ban gaya — aur ek test zid karta hai
ke koi mood peeche na chhoote.

**Aur:** `s2.1-pro-free` = **$0.00, koi hard cap nahi** (Fair Use) · **~70ms** pehli
awaaz · **83 zubanein** (Urdu samet, khud pehchanta hai) · **awaaz ki library** ·
**voice cloning**.

**Do purane zakhm bhare:**
- **CORS** — isi liye `fish.audio` pehle app se *nikala* gaya tha. Hal wahi jo Edge ka tha: **Kotlin bridge**.
- **🔴 BINARY** — purana bridge jawab ko *text* samajh kar UTF-8 base64 karta tha, jo **MP3 ko tabah** kar deta. Naya `httpBytes()` **raw bytes** deta hai + custom headers (`model: s2.1-pro-free`).

- 🐟 **Nayi seerhi:** Fish → 🎭 Gemini → 🌊 Edge → 🌸 muft → 📱 phone
- 🐟 **Naya mode "Sirf Fish Audio"** — Gemini ka rozana quota bilkul nahi jalta
- 📚 **Awaaz library** seedha Settings mein + 🐟 SUNO button
- 🩺 **FISH DOCTOR** — `200` = zinda · **`402` = muft daur band** · `401` = key ghalat. Fish ka apna message, andaza nahi
- 🧪 **71 naye test** (kul 293) — mood pul, **exact MP3 bytes**, poori seerhi, Doctor ke 8 verdict

⚠️ Imaandari: free daur ki zamanat nahi (blog "31 Aug 2026" kehta hai, docs "$0.00"),
aur aap ke jumle Fish ke paas ruk sakte hain. Isi liye Fish **akela sahara nahi** —
402 aate hi awaaz khud Edge par chali jati hai.

📖 Poori tafseel: [`docs/FISH-AUDIO-ARCHITECTURE.md`](docs/FISH-AUDIO-ARCHITECTURE.md)

## 🌊 v4.7.0 — EDGE TTS ("koi aur free unlimited TTS dhoondo")

**Mil gaya — aur wo pehle se app mein maujood tha, magar toota hua.**

Microsoft Edge ka "Read aloud" engine = **Azure ki 300+ neural awaazein, koi API key
nahi, koi signup nahi, koi rozana hadd nahi** — aur us mein **ASLI Pakistani Urdu**
awaazein hain: `ur-PK-UzmaNeural` aur `ur-PK-AsadNeural`.

**Ye pehle kyun nahi chalta tha?** Microsoft ka WebSocket `Origin` / `User-Agent` /
`Pragma` headers ke bagair handshake qubool nahi karta — aur browser ka
`new WebSocket()` API custom headers bhej **hi nahi sakta**. Ye JavaScript ki hadd hai.
Chrome, Firefox, **Android WebView** — sab block. Is liye purana Edge code hamesha
khamoshi se mar jata tha (switch default OFF pada tha).

**Ilaj:** WebSocket ab **Kotlin** mein hai (`object EdgeTts` — apna RFC-6455 client,
koi nayi library nahi). Native side par header ki koi pabandi nahi. JS sirf SSML
banata hai, Kotlin MP3 wapas deta hai.

- 🌊 **Nayi seerhi:** Gemini → **EDGE (be-hisaab)** → muft neural → phone
- 🌊 **Naya mode "Sirf Edge TTS"** — Gemini ka roz ka quota bilkul nahi jalta
- 🌊 **Edge awaaz ka picker** — Auto (zubaan + persona), ya 300+ live list mein se koi bhi
- 🌊 **"EDGE AWAAZ SUNO" button** — bolta bhi hai, waqt bhi batata hai, nakami par asal wajah bhi
- 🧪 **56 naye test** (kul 222) — protocol ka saboot naqli Edge server ke against: masking,
  16-bit length, **fragmentation**, PING/PONG, 5350/5350 bytes sahih

📖 Poori tafseel: [`docs/EDGE-TTS-ARCHITECTURE.md`](docs/EDGE-TTS-ARCHITECTURE.md)

## 🩺 v4.6.0 — AWAAZ DOCTOR ("3 nayi keys lagayin, ek bhi nahi chali")

**Wajah hamare code mein nahi thi — Google ke usoolon mein thi. Magar qusoor hamara tha
ke app ne wajah batai hi nahi.**

1. **Quota KEY par nahi, PROJECT par lagta hai.** AI Studio mein "Create API key" baar
   baar dabane se sab keys **ek hi project** mein banti hain aur **ek hi quota pool** se
   peeti hain. 3 nayi keys = wahi purana khatam quota. Faida sirf **alag Google account**
   (ya "new project") se banai gayi key ka hai.
2. **19 June 2026 se "unrestricted" keys Gemini par block hain** → 403, chahe key abhi bani ho.
3. Kuch projects ko free tier milta hi nahi — Google literally `limit: 0` bhejta hai.

*(CORS wajah nahi thi — Google ka preflight `x-goog-api-key` allow karta hai. Check kar ke
rad kiya, taake ghalat cheez theek na karte rahen.)*

**Ilaj — andaza band, muaina shuru.** Settings → AWAAZ mein naya
**🩺 GEMINI VOICE KEYS CHECK KARO** button. Har key par do imtihan:
`ListModels` (key khud zinda hai? restriction to nahi?) aur ek chhoti TTS request
(quota bacha?). Phir sab natije mila kar **saaf faisla** — inme sab se ahem:

> 🎯 **ASAL MASLA: AAP KI SAB KEYS EK HI PROJECT KI HAIN.**
> ILAJ: har key ALAG GOOGLE ACCOUNT se banao — har account = apna quota.
> Tab tak 🌸 MUFT NEURAL awaaz chalti rahegi.

Saath mein: TTS model **auto-discovery** (`ListModels` se), APK mein Gemini TTS ab
**Kotlin bridge** se (CORS ka sawal khatam, poora error text parha jata hai), aur sacche
paighamat jo 🩺 button ki taraf bhejte hain.

📖 Tafseel: [`docs/SETFORM-AWAAZ-POOL.md`](docs/SETFORM-AWAAZ-POOL.md) (Hissa 3)
🧪 `npm test` — CSS PASS · 64 Settings · **166** AWAAZ · 155 DIMAAG

---

## 🗄️🎙️ v4.5.0 — SETFORM + AWAAZ POOL (do asli bug, jarh se)

### 🗄️ "Settings baar baar reset ho jati hain / girlfriend mode khud band ho jata hai"

**Asal jarh:** SAVE button par **do** click handler lage hue the. Handler A keys save
kar ke `loadSettingsForm()` chala deta tha — jisne form ko *purani* settings se dobara
likh diya (GF switch OFF) — aur phir handler B usi palti hui halat ko save kar deta tha.
Natija: GF mode, gender, phone, persona, language, proactive, remember, convo mode,
music app, assistant naam — **ye sab SAVE button se kabhi save ho hi nahi sakte the.**

**Ilaj:** ab ek hi `SETFORM` darwaza hai aur ek data-driven `SET_FIELDS` registry
(44 fields) jo **load aur save dono** chalati hai:

```
collect() → fixKeys() → apply() → persist() → load()
   ▲ SAB parho pehle              form dobara likhna AB safe hai ▲
```

Saath mein: `fixKeys()` galat khane mein pari key khud sahi jagah bhejta hai
(`gsk_`, `csk-`, `sk-or-`, `nvapi-`, `github_pat_`) — aur purani key mitata nahi,
comma laga kar jorta hai. GF mode ab chup-chaap band nahi hota, wajah batata hai.

### 🎙️ "Gemini ki voice chal hi nahi rahi, baar baar band ho jati hai"

**Teen asal jarhen mileen:**

1. **Gemini TTS ka muft quota sirf ~15 request ROZ hai** (baqi models jaise 1,500 nahi).
   Purana code har 420 harf par ek request bhejta tha → ek lamba jawab = 4-5 request →
   **din mein sirf 3-4 jawab** aur awaaz khatam.
2. **403 ko "mari hui key" samajh liya jata tha** — halanke Gemini 403 aksar *quota* ke
   liye bhejta hai. Ek quota 403 poore session ki awaaz band kar deta tha.
3. **Model fallback** ek dafa koi model chalne ke baad **band** ho jata tha
   (`!AWAAZ.model` shart), is liye wo model marte hi awaaz hamesha ke liye girti thi.

**Ilaj — AWAAZ POOL, teen tehen:**

| Teh | Kya |
|-----|-----|
| 💎 **Gemini neural** | **kai keys** (comma se) — key1 ka quota khatam? key2 khud chal padti hai. Model mara? agla model. |
| 🌸 **MUFT NEURAL** | **bina key, bina signup** — asli insani awaaz jab Gemini ka din khatam ho |
| 📱 **Phone ki awaaz** | hamesha, 0 data |

Plus **smart chunking**: pehla tukra 300 harf (awaaz *foran* shuru), baqi 1500-1500
(kam request). 2,400 harf ka jawab pehle **6** request leta tha — ab **2**.
Har key ka apna cooldown `localStorage` mein mehfooz (restart ke baad bhi yaad),
aur Settings mein live pool nazar aata hai.

📖 Poori forensic tafseel: [`docs/SETFORM-AWAAZ-POOL.md`](docs/SETFORM-AWAAZ-POOL.md)
🧪 Saboot: `npm test` — CSS PASS · **64** Settings · **142** AWAAZ · **155** DIMAAG

---

## 🧠🔥 v4.4.0 — BRAIN POOL ("quota khatam" ka mustaqil ilaj)

**Masla:** Groq ki key daalne ke baad bhi *"Aaj ka free Gemini quota khatam… Backup brain bhi thak gaya."*
**Asal jarh:** Groq ne **16 Aug 2026** ko apne purane Llama models band kar diye — hamara default wahi tha,
is liye theek key ke bawajood har Groq call fail ho rahi thi. Doosri jarh: sirf 2 provider = 2 quota ki qaid.

**Ilaj:** ab MAYA ke paas **10 dimaag** hain, teen tehon mein —

| Teh | Dimaag |
|-----|--------|
| **KEYED** | 💎 Gemini · ⚡ Groq · 🚀 Cerebras · 🇪🇺 Mistral · 🔀 OpenRouter · 🐙 GitHub · 🟩 NVIDIA · 🇨🇳 Z.ai |
| **KEYLESS** (koi signup nahi) | 🆓 LLM7 · 🌸 Pollinations |
| **LOCAL** | waqt · tareekh · hisab · yaad-dasht |

Teen chaabiyan:

1. **Kai keys, ek khana** — har key field comma/nayi line se **kai keys** leta hai.
   3 Gemini keys = **3 guna quota**. Ek khatam, agli khud chal padti hai.
2. **Model auto-discovery** — provider "model decommissioned" kahe to app us model ko
   nikal kar `/models` se **zinda list** le aati hai. **Groq wala hadsa dobara nahi hoga.**
3. **Keyless farsh** — bilkul khaali Settings par bhi MAYA jawab deti hai.

Saath mein: cooldown `localStorage` mein mehfooz (restart ke baad bhi yaad), APK mein har
request Kotlin ke **async bridge** se (CORS lagoo nahi, UI kabhi jam nahi), Settings mein
live **"BRAIN POOL DEKHO"** panel, aur header pill par sach — **`AI READY • 6 DIMAAG`**.

📖 Poori tafseel: [`docs/BRAIN-POOL-ARCHITECTURE.md`](docs/BRAIN-POOL-ARCHITECTURE.md)
🧪 Saboot: `node tools/test-brain-engine.js` — **155/155**

---

## 🧠 v4.3.0 — DIMAAG ENGINE v2 ("Sab free brains busy" ka ilaj)

Wo message bar bar isliye aata tha ke **3 bug ek doosre ko khila rahe the**:

1. **HTTP 400 ko "key ka masla" samjha jata tha** → Gemini par **10 minute** ka blackout.
   Halanki 400 aksar kharab request hoti hai, key ka masla `401`/`403` hota hai.
2. **`chatHist.slice(-8)` ka pehla turn `model` ho jata tha** → Gemini multi-turn history
   `user` se shuru maangta hai → **400** → upar wala blackout. Chaar baat-cheet ke baad
   ye **har dafa** hota tha. Yahi "bar bar" ki asal jarh.
3. **Ek sawal par 5 model try** hote the → free quota 5 guna tez khatam.

Ab:
- **Har nakami ka naam** — KEY_MISSING / KEY_BAD / QUOTA / QUOTA_DAY / BAD_REQUEST / SERVER / NETWORK / MODEL_404 / EMPTY
- **Khud-marammat** — 400 aaye to history saaf kar ke, bina tools, foran dobara koshish
- **Quota izzat se** — Google jitna waqt maange (`retryDelay`) utna cooldown; per-day quota alag pehchana jata hai
- **Bekaar request kabhi nahi** — offline / key nahi / blackout par network call hi nahi jati
- **Khali haath nahi** — sab fail? pehle local jawab (waqt, tareekh, hisab, yaad-dasht), warna **asli wajah + agla qadam**
- **7 alag paigham** us ek jumle ki jagah — aur wo jumla source se hi nikal gaya
- **Header pill ab sach bolta hai** — `AI ONLINE` sirf jab aakhri 15 min mein asli jawab aaya ho
- **Doctor** mein har provider ki koshish ka poora record

Saboot: `tools/test-brain-engine.js` — **109 assertions**.
Tafseel: [`docs/DIMAAG-ENGINE-ARCHITECTURE.md`](docs/DIMAAG-ENGINE-ARCHITECTURE.md)

## 🎙️ v4.2.0 — AWAAZ ENGINE v6

**Neural awaaz ab sach much bolti hai.** Pehle Gemini TTS ka raw PCM bina WAV header ke
`<audio>` ko diya jata tha — is liye har dafa chup-chaap fail hota tha. Ab:

- **44-byte WAV header** (sample rate mime se parhi jati hai) → Gemini ki studio awaaz chalti hai
- **30 neural awaazein** + **9 mood** (warm / cheerful / calm / pro / hype / whisper / news / funny) + persona ka auto-mood
- **3-tier fallback** — 🎭 Gemini → 🌊 Edge (optional) → 📱 phone. **Khamoshi kabhi nahi.**
- **Har nakami ka naam** — key, quota, offline, WiFi-only, timeout… Settings aur Doctor dono mein saaf likha
- **Data bachao** — 12 clips ka cache, in-flight de-dupe, 429 par 90s cooldown, WiFi-only switch, awaaz ke liye alag key
- **Lambe jawab** ab tukron mein bolte hain (agla tukra pehle wale ke bajte waqt aa jata hai — beech mein khamoshi nahi)
- **Har jawab par 🔊** — dobara suno / rok do
- Hataya gaya: fish.audio (CORS red error) aur puter.js ka murda call
- Theek kiya: slider `touchmove` ka console warning, aur raw error banner ab khamosh nishan hai

Saboot: `npm test` → CSS check + 45 UI test + 118 voice-engine test.
Tafseel: [`docs/AWAAZ-ENGINE-ARCHITECTURE.md`](docs/AWAAZ-ENGINE-ARCHITECTURE.md)

## 🆕 v4.1.0 "IRONCLAD" — Settings UI ground-up rebuild

> Patch-work band. Pehle architecture (`docs/SETTINGS-UI-ARCHITECTURE.md`), phir code,
> phir machine se test. `npm test` green hue baghair kuch push nahi hota.

- 🧱 **UI KIT v5** — Settings ka har control naye sirey se: `ui-group / ui-field /
  ui-row / ui-slider / ui-sw / ui-btn`. Sirf block/table layout, px sizes aur
  `var(--token,#hex)` colors — **koi** `color-mix` / `accent-color` / `gap` /
  `inset` / `grid` / `env()` nahi
- 🎚️ **Custom sliders** — native `<input type=range>` ab sirf **state** rakhta hai
  (chhupa hua), dikhne wala slider div se bana hai: track + fill + 28px thumb +
  **big − / + buttons** (drag na chale to bhi value badal sakti hai)
- 🔘 **Custom switches** — 54×30, `:checked ~` **aur** JS `is-on` class — do rastay
- 📏 **Measured layout** — `MayaUI.layout()` screen naap kar `main`/`.tab` ki height
  px mein set karta hai (resize / rotate / splash ke baad dobara). Scroll ab
  flexbox ki mehrbani par nahi
- 🧪 **UI CHECK button** — Settings → Data & Maintenance: har control ko naap kar
  batata hai "127 visible / 0 invisible" + kaunsa control kahan gayab hai
- 🐛 **ES6 landmine hataya** — 32 `\u{...}` code-point escapes (Chrome <44 par poora
  script SyntaxError) surrogate pairs mein badle
- ✅ **2 automated test** — `npm test`: CSS linter (banned feature = fail) +
  jsdom functional test (slider/switch/layout/IDs) — **33/33 pass**

## 🆕 v4.0.2 "OBSIDIAN" — Settings UI Fix (purane WebView par bhi)

- 🎚️ **Sliders wapas dikhte hain** — pitch / raftar / corner / text-size ke range inputs ka
  track + thumb ab explicit hex/`var()` colors se bane hain (pehle `accent-color` drop hone par
  patli invisible lakeer reh jati thi)
- 🔘 **Switches asli toggle jaise** — 48×26px, fixed offsets (`top/left`), `transform` ki jagah
  `left` animation, `color-mix()` ke baghair
- 🏷️ **Labels aur inputs solid** — har `.f` field par background + border + `min-height:44px`
  (invisible field khatam)
- 📜 **Settings ab poori scroll hoti hai** — `#app > main > .tab` chain par `min-height:0`
  (pehle `main` content jitna lamba ho jata tha aur body ka `overflow:hidden` neeche ke
  sections — AWAAZ, THEME — kaat deta tha)
- 🧪 **Feature detect** — `CSS.supports()` se `color-mix` / `accent-color` / flex-`gap` check,
  `<html>` par `nocm` / `noacc` / `nogap` class + Doctor report mein "CSS COMPAT" line
- 📐 **`gap` aur `env()` fallbacks** — margin-based spacing + nav ka safe-area padding fallback

## 🆕 v4.0.1 "OBSIDIAN" — WebView Compat Fix

- 🧩 **Old-WebView COMPAT** — `inset`/`color-mix` fallback (Chrome <87 layout toot nahi sakta)
- 🛟 **file:// fallback** — WebViewAssetLoader fail ho to bhi app khulti hai (blank screen khatam)
- 📶 **old-WebView detect + toast** — purana Android System WebView update karne ka nudge
- 🔧 **false-alarm fix** — "WebView load NAHI hua" ka jhoota toast khatam (markAlive + onPageFinished)
- ⚡ **sw.js full ES5** — purane WebView par service worker bhi parse hota hai

## 🆕 v4.0.0 "OBSIDIAN" — Kya Naya Hai

- 🏠 **HOME screen + animated ORB** — tap to speak, live states (listening/thinking/speaking)
- 💜 **3 PERSONAS** — Maya (best friend) / Friday (professional) / Venom (alien funny) — voice se badlo: *"maya venom ko bhejo"*
- 💖 **Girlfriend Mode** — settings ya voice command se
- 🎨 **THEME ENGINE** — 7 themes (Midnight Obsidian, Cyber Cyan, Aurora, Rose, Forest, Daylight, Paper) + accent colors + corner-radius/text-size sliders + **Edge Glow**
- 🧠 **Memories screen** — poora CRUD (add/edit/delete) + JSON backup download
- 🌐 **13 Languages** — Roman Urdu, Urdu, Hindi, Hinglish, English, Punjabi, Bangla, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam
- ✨ **Proactive Mode** — Maya khud ba khud baat karti hai (memory-based)
- 🗣️ **Assistant name** + Conversation Mode + favorite song memory
- 📋 Naya **drawer navigation** (☰) — Home / Chat / Memories / Skills / HUD / Commands / Settings
- 🐛 **Bug fixes** — `cleanSpeech` crash fix (voice replies ab safe), duplicate ID fix

**Video-series roadmap (getmaya.online wali Maya jaisa):** Phase 2 = Voice Guardian + Touch Guard + SOS + screen lock — structure ready hai (`docs/maya-v4-structure.md`).


- 🎤 **Native voice input** — Urdu (ur-PK) / Hindi / English (Google recognition)
- 🗣️ **Native voice output** — system TTS engine (behtar Urdu awaaz)
- ⏰ **REAL system alarm** — *"subah 6 baje alarm lagao"* → clock app mein set!
- ⏱️ **REAL system timer** — screen band ho to bhi notification + bajega
- 🔋 Battery status, vibration, notifications
- 🔁 Auto-listen mode (screen-on lock ke saath)
- 🧠 Gemini AI brain (FREE API key — app ke andar guide)
- 🧷 Memory bank — *"yaad rakhna ki ..."*

---

## 🛠️ APK KAISE BANAYEIN — Step by Step (FREE, PC ki zaroorat NAHI)

### STEP 1 — GitHub account (free)
1. **github.com** kholo → **Sign up** → account banao

### STEP 2 — Repository banao
1. GitHub par login kar ke **+** (top right) → **New repository**
2. Naam do: `maya-android` → **Create repository** (Public ya Private dono chalega)

### STEP 3 — Ye files upload karo
1. Repository page par **"uploading an existing file"** link par click karo
2. Ye poora folder drag & drop karo (sab kuch: `.github`, `app`, gradle files, etc.)
   - **Ahem:** chhupi hui folders (`.github`) browser upload mein nahi dikhte —
     is liye GitHub web par manually banao:
     - **Add file → Create new file** → naam likho:
       `.github/workflows/build-apk.yml` → is file ka content paste karo → Commit
     - Baqi files (`settings.gradle`, `build.gradle`, `gradle.properties`,
       `app/build.gradle`, `app/src/...` sab) bhi **Create new file** se sahi
       path ke saath banao aur content paste karo (ye zaroori hai kyunki
       `.github` folder zip se upload nahi hota)
   - Binary files (icons) upload page se normal drag & drop hongi
3. **Commit changes** dabao

### STEP 4 — APK build (automatic)
1. Repository mein **Actions** tab kholo
2. **"Build MAYA APK"** workflow dikhegi — pehli push par khud chal jayegi
   (nahi chale to **Run workflow** button dabao)
3. **3-6 minute** wait karo (pehli baar Gradle dependencies download hoti hain)

### STEP 5 — APK download + install
1. Actions tab mein complete hone wali run par click karo (✅ green)
2. Neeche **Artifacts** section mein **MAYA-APK** dikhega → click kar ke
   **MAYA-APK.zip** download karo
3. Zip extract karo → andar `app-debug.apk` milegi
4. Phone mein APK kholo → **"Install unknown apps / Install anyway"** allow karo
   (Play Protect warning aaye to **Install anyway** — apna hi code hai, 100% safe)
5. MAYA app khulo → **INITIALIZE** → mic + notification permission allow karo

### STEP 6 — Gemini brain (2 minute)
1. `aistudio.google.com` → **Get API key** → copy
2. MAYA app → **⚙️ Settings** → API key paste → **SAVE**
3. Ho gaya — kuch bhi poocho! 🚀

---

## 📱 App mein kya hai

| Screen | Kaam |
|---|---|
| 🏠 HOME | Animated orb — tap to speak, persona chips, quick actions, live reply |
| 💬 CHAT | Voice (🎤) ya type se baat karo (text replies) |
| 🧠 MEMORIES | Maya ki yaadein — add / edit / delete / backup |
| 🧩 SKILLS | 8 built-in skills + custom seekhe hue skills |
| 🎯 HUD | Live clock, battery, AI status, system log, quick actions |
| ⚡ COMMANDS | Saari commands + RUN buttons + setup guides |
| ⚙️ SETTINGS | Personal / Personas / Awaaz / Customize / API Keys / Advanced |

## 🗣️ Voice Commands (misal)

- "maya, subah 6 baje alarm lagao" → **real alarm**
- "maya, paanch minute ka timer lagao" → **system timer**
- "maya, open whatsapp" / "open youtube"
- "maya, youtube pe [gaana] chalao"
- "maya, search karo [kuch bhi]"
- "maya, battery kitni hai" / "waqt kya hua"
- "maya, yaad rakhna ki kal doctor appointment hai"
- "maya, call karo 0300xxxxxxx"
- Aur kuch bhi — Gemini khud jawab degi (usi zubaan mein!)

---

## ❓ MASLA HO TO (Troubleshooting)

| Masla | Hal |
|---|---|
| Mic nahi chalta | Settings → Apps → MAYA → Permissions → Microphone allow |
| Awaz nahi aati | Settings → Accessibility → Text-to-speech → Google TTS install |
| Urdu sunai nahi deti | Google app update karo (voice recognition isi se aati hai) |
| AI jawab nahi deta | API key check karo + internet on karo |
| Alarm nahi lagta | Phone ka Clock app check karo (kuch phones SKIP_UI block karte hain) |
| Build fail (Actions) | Run ka log kholo → error dekho → file theek kar ke dubara push |

## 🔒 Privacy

- API key + chat + memory **sirf aap ke phone** mein (app data)
- AI sawal **direct Google Gemini** ko jata hai — koi doosra server nahi
- Code 100% open — khud dekh lo! 😄

## 🌐 Web Version (FREE Deploy)

MAYA ka web version bhi hai — phone ke browser mein chalta hai!

### GitHub Pages se deploy (FREE, 2 minute):
1. Repository push karo (ye files automatically deploy ho jayengi: `public/` folder)
2. GitHub par **Settings → Pages** kholo
3. **Source** mein "GitHub Actions" select karo
4. **Save** dabao — 1-2 minute mein live ho jayega!
5. Link milega: `https://tumhara-username.github.io/maya-android/`

### Phone mein install karo (PWA):
1. Upar ka link phone ke Chrome mein kholo
2. Menu (⋮) → **Add to Home screen** → **Install**
3. MAYA ka icon phone pe aa jayega — app jaisa chalega!

### Netlify se deploy (FREE, alternative):
1. **app.netlify.com/drop** kholo (free account)
2. `public/` folder drag & drop karo
3. Live link mil jayega!

> **Note:** Web version mein alarm, wake word, aur auto-send jaise native features nahi chalte.
> Voice chat, AI brain, aur memory bank full kaam karte hain!

---

## 🗺️ Roadmap

- ✅ Phase 1 — PWA Pro (web app)
- ✅ Phase 2 — Native APK (ye!)
- ⏳ Phase 3 — Smart Brain (AI function calling, routines)
- ⏳ Phase 4 — Boss Level (wake word, offline AI)

