# ⚡ MAYA v5.13.0 "RAFTAR" — aam zubaan mein report

**Version:** 5.13.0 · **versionCode:** 78 · **Naam:** ⚡ RAFTAR
**Pichla version:** 5.12.5 "MIC NAZAR" · **Tests:** 1375/1375 pass (55 naye taale J3 ke — lab Section 36)

Aap ki do shikayatein thin:

1. *"yeh slow boht reply derhi ha… instant reply aye fastly"*
2. *"Maya kabhi screen par ache se dekh rahi ha or jawab derhi ha, kabhi pooch rha hun
   to jawab hi nhi derhi"*

Dono ka **sabab microscope se dhoonda gaya** (8 flaws: F59–F66, poora hisaab
`docs/FIX-v5.13.0-raftar.md` mein) aur dono ka ilaj is version mein hai.

---

## 1. 🆕 Kya naya hua

### A. Jawab ab FORAN bolna shuru hota hai (⚡ RAFTAR)
* **Pehle:** dimaag ka **poora** jawab ban kar aata tha (1.5–4 second), phir awaaz shuru hoti thi.
  Screen wale sawal mein do round trip = 3–8 second ka wait.
* **Ab:** jawab **tukron (stream)** mein aata hai. **Pehla jumla bante hi Maya bolna shuru** kar deti
  hai, baqi jumle peeche-peeche. Aam tor par pehli awaaz **0.6–1.5 second** mein.
* Awaaz ki **quality wahi neural** hai (🐟 Fish → 🎭 Gemini → 🌊 Edge → 🌸 Pollen → 📱 phone).
  Aap ne "behtar awaaz" chuni thi — wo tarkheeb nahi hui, sirf **intezaar** kata gaya.
* Jawab likha bhi **live** aata hai (💭 wali line par), phir poora bubble chat mein.

### B. Awaaz ka "dead air" khatam (⏱️ FAST BUDGET)
* **Pehle:** neural awaaz ka network atak jaye to 25 second tak **khamoshi** — jawab mojood, awaaz gayab.
* **Ab:** **1.8 second** mein asli awaaz na baji to Maya foran agli tier par chali jati hai
  (Edge → phone ki apni awaaz). Khamoshi ki jagah **tez, thori aam awaaz** — jawab kabhi nahi rukta.

### C. Screen ka jawab PAKKA (👁️ NAZAR)
Teen alag sabab mile, teeno theek kiye:
1. **NAZAR ka switch DEFAULT BAND tha** (LAB mein) — is liye tool aksar "NAZAR band hai" kehta tha.
   **Ab default ON.** LAB ka switch ab sirf band karne ke liye hai.
2. **Screen ki sirf EK koshish** hoti thi. Screen badalte waqt pehla dump khali aa jata →
   Maya "kuch nahi dikha" ya chup. **Ab doosri koshish** (zyada elementon ke sath) hoti hai;
   phir bhi khali ho to **saaf batati hai** ke kya hua (chup nahi hoti, andaza nahi lagati).
3. **Maya ke dimaag ko pata hi nahi tha** ke screen parhne ka tool hai — us ki hidayat (system prompt)
   mein 33 tools mein se sirf 9 ka zikr tha. **Ab poori fehrist + qanoon:**
   *"screen ka sawal ho to PEHLE read_screen call karo; tool nakam ho to us ki baat user ko batao —
   chup mat raho, andaza mat lagao."*
4. Bonus: "screen par kya hai" jaise jumle pehle **tool-router** mein hi nahi the (sirf LAB ke
   `poolTools` ON par milte the) — ab hamesha pehchane jate hain.

### D. Har turn 100 ms tez (🎙️ silence 700 → 600 ms)
Bolna khatam karne ke baad mic ka intezaar 700 ms se **600 ms** — chhote jumle phir bhi nahi kat-te
(minimum 300 ms barqarar).

### E. ⚡ RAFTAR PANEL — ab naap kar pata chalega (F65)
Settings → LAB → **📊 NAAP/BASELINE** button par ab ye bhi likha aata hai:
```
  dimaag        1.2s     2.4s
  pehli awaaz   1.6s     2.9s     (stream 9/12)
  kul           4.1s     7.0s
── ⚡ RAFTAR ──
  stream ON · strikes 0/2
  aakhri jawab: pehla harf 640ms · pehli awaaz 1180ms · kul 3900ms · 3 tukre
  awaaz ka fast-budget trip: 0 (1800ms)
  👁️ NAZAR: koshish 4 · kamyab 4 · khali 0 · doosri koshish 1 · nakaam 0 · 210ms
```
Yaani **"tez ho gaya" ab ehsaas nahi, NUMBER hai.**

---

## 2. 🧪 Kaise parakhein (PASS / FAIL)

APK install karein (purani APK ke upar chalti hai, data nahi jata).

### Test 1 — pehchan
App khulte hi toast: **"MAYA v5.13.0 • ⚡️ RAFTAR: jawab tukron mein (pehla jumla foran) + screen ka pakka jawab"**
Header par: **PERSONAL AI v5.13.0 ✨**
* **PASS:** dono jagah 5.13.0 likha hai.
* **FAIL:** 5.12.5 ya purana version dikhe → purani APK install hui hai.

### Test 2 — raftar (sab se ahem)
Koi aam sawal boleín: *"Maya, aaj mausam kaisa hai?"* ya *"ek chhota sa joke sunao"*.
* **PASS:** bolna **khatam** karne ke **1.5 second ke andar** Maya ki **awaaz shuru** ho jaye
  (jawab poora likha aane se PEHLE wo bolna shuru kar de), aur chat mein 💭 live line dikhe.
* **FAIL:** 3–4 second tak bilkul khamoshi rahe, phir ek sath poora jawab bole.

### Test 3 — screen ka jawab (10 dafa azmayen)
Kisi bhi app mein jayen (Chrome/WhatsApp/Settings), phir Maya se poochein:
*"Maya, screen par kya hai?"* · *"kaunse button hain?"* · *"is screen par kya likha hai?"*
* **PASS:** **har dafa** jawab aaye aur wo **asli screen** ke mutabiq ho (jo app khuli hai us ka naam,
  jo button nazar aate hain un ka zikr).
* **FAIL:** kabhi bilkul jawab na aaye, ya wo screen ka **andaza** lage ("aap shayad Chrome mein hain")
  bina parhe.

### Test 4 — NAZAR ki ijazat band kar ke
Settings → Accessibility → MAYA NAZAR ko **OFF** karein, phir screen ka sawal poochein.
* **PASS:** Maya **saaf bataye**: ijazat band hai, ON karo (chup na ho, na hi jhoot bole).
* **FAIL:** khamoshi, ya screen ka jhoota haal.

### Test 5 — dead air (network slow ho)
Wi-Fi/data ko jaan-boojh kar slow karein (ya flight-mode ON/OFF karein), phir sawal poochein.
* **PASS:** ~2 second baad awaaz **kisi na kisi tier se** aa jaye (toast/log mein
  "RAFTAR: 1800ms mein awaaz na baji — tez tier par" likha aaye).
* **FAIL:** 5–10 second ki khamoshi, phir jawab hi na aaye.

### Test 6 — RAFTAR PANEL
Settings → LAB → 📊 **NAAP/BASELINE** button dabayen.
* **PASS:** upar wale namoone jaisi lines aayen — **"pehli awaaz"** ka number, **stream ON**,
  aur **👁️ NAZAR** ka hisaab (koshish/kamyab/khali).
* **FAIL:** "pehli awaaz" ya RAFTAR ka hisaab hi na dikhe.

---

## 3. ⚠️ Kya adhoora / imaandari

* **Streaming sirf Gemini par** hai (primary dimaag). Backup dimaag (Groq/Cerebras/keyless)
  purane raaste se poora jawab bhejte hain — un par raftar ka faida kam hoga.
* **Pehla jumla chhota ho sakta hai** (kabhi "Ji boss." jaisa) — ye jaan-boojh kar hai:
  awaaz jaldi shuru ho. Agar aap ko tukron mein bolna pasand na aaye to
  **Settings → LAB → ⚡ RAFTAR OFF** kar dein — app purane saabit raaste par chali jayegi.
* **Streaming ka kill-switch:** agar stream 2 dafa nakaam ho to app khud us session ke liye
  streaming band kar deti hai (log mein "RAFTAR: streaming BAND") — jawab phir bhi aata rahega.
* **600 ms silence** ka asar phone ke Google speech service par bhi nirbhar hai (kuch phones par
  ye setting ignore hoti hai). Isi liye RAFTAR PANEL banaya hai — number khud batayenge.
* **NAZAR abhi sirf DEKHTA hai, CHHUTA nahi** (tap/click = Phase P7b, agla kaam).
* Sandbox mein **Android build nahi ho sakti** — APK GitHub Actions se banta hai (CI link neeche).

---

## 4. 🆘 FAIL ho to ye bhejein

1. **Kaunsa test** (1–6) aur kya hua — 1 line mein.
2. App ke **log** ka screenshot ya text: Settings → LAB → **📋 LOG** (us mein
   `RAFTAR:`, `NAZAR:`, `GEMINI/…` ki lines saboot hain).
3. **⚡ RAFTAR PANEL** ka screenshot (Settings → LAB → 📊 NAAP/BASELINE).
4. Screen wale masle par: **us app ka naam** jis par sawal kiya + kya jawab aaya (ya nahi aaya).
5. Phone: **TECNO KL4, Android 14** ✓ (koi doosra phone ho to us ka naam).

---

## 5. 🏷️ Version pehchaan

| Cheez | Value |
|---|---|
| versionName | **5.13.0** |
| versionCode | **78** |
| Naam | **⚡ RAFTAR** |
| JS constant | `MAYA_VER = "5.13.0"`, `MAYA_NAAM = "⚡️ RAFTAR"` |
| Kotlin | `appVersion() = "5.13.0-native"` + toast v5.13.0 |
| SW cache | `maya-v5.13.0` |
| Tests | **1375/1375** (lab Section 36 ke **55** naye taale) |
| Plan-doc | `docs/FIX-v5.13.0-raftar.md` (F59–F66 + ilaj) |
| CI | ✅ **GREEN** — [run 34186455021](https://github.com/adil-chandio/Mana-android/actions/runs/34186455021) (93 second) |
| APK | **MAYA-APK 3,237,726 bytes** (v5.12.5 se +11,829) — artifact CI se utarein |

**Aage:** J4 = v5.13.5 "SAAF AWAAZ" (awaaz ki pakki sehat + voice-doctor),
phir Phase 2 (WAKE DOCTOR v2), 2.5 (auto-update), 3 (wake brain Kotlin), 4 (offline KWS).
