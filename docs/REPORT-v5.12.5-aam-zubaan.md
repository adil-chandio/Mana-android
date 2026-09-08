# 📱 MAYA v5.12.5 — Aam Zubaan Report (ek parcha, phone mein rakhne layak)

> **Qanoon 9:** har naye version ke baad ye parcha BANEGA — kya naya hua, kaise parakhna
> hai, kya adhoora hai, nakami par kya bhejein, aur version ki pehchaan.
>
> **Version:** 5.12.5 (MIC NAZAR) · **Tests:** 1320/1320 GREEN · **Phase:** J2 (mic ka haal nazar)
> **Build:** ✅ CI GREEN (pehli koshish) · **APK:** 3,225,897 bytes (3.2 MB) · Tafseel: [`FIX-v5.12.5-mic-nazar.md`](FIX-v5.12.5-mic-nazar.md)
> **Pehle:** v5.12.0 "JAWAB PAKKA" — [`REPORT-v5.12.0-aam-zubaan.md`](REPORT-v5.12.0-aam-zubaan.md)

---

## 1) Kya naya hua — aam zubaan mein

**Ek line mein:** v5.12.0 ne jawab ko **chup-chaap marne** se bachaya; v5.12.5 mic ka haal
**aap ki aankh** ke samne rakhti hai — aur baat-cheet ke dauran mic **do ki jagah ek** dafa khulta hai.

| # | Naya | Pehle |
|---|---|---|
| 1 | Screen ke upar **MIC HAAL BAR** (saabit patti, har tab par): haal + **rang** + **lafz** + zinda level | Mic ka haal **nazar hi nahi aata** tha (4px ki chhoti bar sirf app-mic par) |
| 2 | **7 halatein**: 👂 WAKE SUN RAHI · 🚪 BAAT-CHEET · 🎤 AAP BOLEIN · 🧠 SOCH RAHI (Xs) · 🔊 BOL RAHI · ⚠️ MASLA · 💤 WAKE BAND | Sirf orb ka rang — matlab andaza lagana parta tha |
| 3 | **Wake ka zinda level** Kotlin se (har 0.3s) — pehra aur wake ka kaan, **dono** | Wake ka dB sirf log line mein, screen par kuch nahi |
| 4 | Wake **murda** ho to ~6 second mein patti **surkh**: *"WAKE sun nahi rahi"* | "wake ON" likha rehta tha, asal haal ka pata nahi chalta tha |
| 5 | **BAAT-CHEET MODE** (default ON, LAB switch): darwaza khula → wake ka mic **band** | Har turn par mic **do dafa** khulta (wake + app) → dot zyada jhilmilata |
| 6 | Wake ke baad ki **400ms andhi race khatam** — handoff ab haal dekh kar | Dono taraf ek hi waqt mic mangte → kabhi kabhi error 8 |
| 7 | Gate ka **90s reopen** sirf darwaza **band** par (baat-cheet beech mein nahi tootti) | 90s par mic khud dobara khul jata |
| 8 | Baat-cheet ki **mudat + heartbeat** safety net (90s / JS murda = mode khud khatam) | — (naya nizam) |
| 9 | Panel par 4 nayi lines: 🎛️ MIC HAAL · 🛠️ level (Kotlin) · 🚪 BAAT-CHEET (turn N) · 🛡️ JAWAB | Referee ka hisab sirf log mein chhupa rehta |
| 10 | Header ka version **sahi** (subtitle `v5.10.2` par jam tha) + version ka **ek ghar** | App khud apni pehchaan ka jhoot bolti thi |
| 11 | **Imaandar line** UI mein: system mic-nishan cloud-wake se jhilmilata hai, SAABIT sirf offline wake mein | Jhoot ya khamoshi |

---

## 2) Parakhne ka tareeqa — tick (✅) lagayen

### Pehla qadam (1 minute) — pehchaan
- [ ] **N0** Purani APK ke upar install → toast **`MAYA v5.12.5 • 🎛️ MIC NAZAR`** aur header
      ka subtitle **`PERSONAL AI v5.12.5`**

### Doosra qadam (3 minute) — patti ke rang
- [ ] **N1** WAKE ON + khamosh kamra → **`👂 WAKE SUN RAHI — pehra`** (sabz) aur bar **halka hile**
- [ ] **N2** "ہے مایا" boleyn → **`🎤 AAP BOLEIN`** (neeli) — bolte waqt bar **uche**
- [ ] **N3** Jawab aate waqt → **`🧠 SOCH RAHI (Xs)`** (peeli) phir **`🔊 BOL RAHI`** (jamni)
- [ ] **N4** Jawab ke baad chup rahein → **`🚪 BAAT-CHEET — boleyn (Ns)`** aur **dobara "Maya"
      ke baghair** agla sawal sun le

### Teesra qadam (3 minute) — jhoot pakadna
- [ ] **N5** Wake band karein (switch OFF) → **`💤 WAKE BAND — 🎤 dabao aur boleyn`**
- [ ] **N6** Mic ijazat wapas lein (ya service band karein) → **~6 second** mein patti **⚠️ surkh**:
      *"WAKE sun nahi rahi"*
- [ ] **N7** "bas" keh dein (ya darwaza khatam hone dein) → patti wapas **`👂 WAKE SUN RAHI`**

### Chautha qadam (3 minute) — saboot
- [ ] **N8** LAB → **👂 WAKE WORD KA HAAL** → nayi lines: **🎛️ MIC HAAL** · **🛠️ level (Kotlin)** ·
      **🚪 BAAT-CHEET (turn N)** · **🛡️ JAWAB**
- [ ] **N9** 10 minute aam baat-cheet → `mic chala` ki ginti **v5.12.0 se kam** (ek turn = ek mic)
      aur `🚪 BAAT-CHEET … turn N` barh raha ho
- [ ] **N10** LAB mein **🗣️ BAAT-CHEET** switch OFF → wake har baar "Maya" mangne lage
      (purana rawaiya) → ON karein → wapas ek turn = ek mic

---

## 3) Kya abhi bhi adhoora hai (imaandari)

- **System mic-dot poori tarah SAABIT nahi hua.** Android ka wo nishan **cloud wake** (Google
  ASR) ki wajah se jhilmilata hai; J2 ne cycle **aadha** kiya hai, khatam nahi. Mukammal
  SAABIT mic sirf **Phase 4 (offline KWS)** mein — jab wake phone par hi sune.
- **Raftar abhi wahi hai.** Jaldi sunna / jaldi bolna **J3 "RAFTAR"** ka kaam hai (dimaag ki
  streaming, awaaz ka 800ms budget, 0.6s silence extra). Ab intezar sirf **nazar** aata hai.
- **Level sirf app khuli hone par** aata hai (WebView zinda ho). App band → patti bhi gayab;
  us daur ka haal notification/panel mein Phase 3 mein aayega.
- **Awaaz ki khoobsurti (J4)** abhi baaki hai: Urdu rate/pitch, jumla-ba-jumla bolna, volume.

---

## 4) Agar kaam na kare — ye bhejein

1. Version toast ka **screenshot** (v5.12.5 nahi to APK purani hai).
2. **Patti ka screenshot** jis waqt masla hua (rang + lafz + bar ki chaurai).
3. LAB → **👂 WAKE WORD KA HAAL** ka poora screenshot (nayi 4 lines ke sath).
4. Aap ne kya kaha, patti ne kya dikhaya — **tarteeb** ke sath (maslan: 👂 → 🎤 → 🧠 → ⚠️).
5. `🚪 BAAT-CHEET` ki **turn** ginti aur `mic chala` ki ginti.

**FAIL ka nishan:** patti ka haal **asal haal se na mile** (maslan mic chal raha ho aur patti
`💤 WAKE BAND` dikha rahi ho) → wo screenshot sab se ahem saboot hai.

---

## 5) Version ki pehchaan

**MAYA v5.12.5 "MIC NAZAR"** · versionCode **77** · native **`5.12.5-native`** ·
service-worker cache **`maya-v5.12.5`** · Tests **1320/1320** ·
J-track: **J1 ✅ · J2 ✅** · J3 (RAFTAR) → J4 (SAAF AWAAZ) baaki.

---

## 6) APK kahan se

**https://github.com/adil-chandio/Mana-android/actions/runs/33787388417**

Ya: GitHub → `adil-chandio/Mana-android` → **Actions** → sab se upar wali
**"Build MAYA APK"** run → niche **Artifacts** → **`MAYA-APK`** (3,225,897 bytes) →
zip khol kar `app-debug.apk` phone mein install karein (purani APK ke upar chal jayegi,
data safe rehta hai).
