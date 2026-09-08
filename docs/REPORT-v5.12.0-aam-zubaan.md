# 📱 MAYA v5.12.0 — Aam Zubaan Report (ek parcha, phone mein rakhne layak)

> **Qanoon 9:** har naye version ke baad ye parcha BANEGA — kya naya hua, kaise parakhna
> hai, kya adhoora hai, nakami par kya bhejein, aur version ki pehchaan.
>
> **Version:** 5.12.0 (JAWAB PAKKA) · **Tests:** 1281/1281 GREEN · **Phase:** J1 (jawab ka loop pakka)
> **Build:** ✅ CI GREEN (pehli koshish) · **APK:** 3,219,176 bytes (3.2 MB) · Tafseel: [`FIX-v5.12.0-jawab-pakka.md`](FIX-v5.12.0-jawab-pakka.md)
> **Forensic:** [`FORENSIC-JAWAB-LOOP.md`](FORENSIC-JAWAB-LOOP.md) (15 flaws F44–F58)

---

## 1) Kya naya hua — aam zubaan mein

**Ek line mein:** pehle Maya **chup-chaap atak** jati thi aur aap ko pata hi nahi chalta tha
ke kyun; ab har cheez par **ghari** hai, har nakami ka **naam** hai, aur mic **khud dobara** khulta hai.

| # | Naya | Pehle |
|---|---|---|
| 1 | Sunne / sochne / bolne par **watchdog** (12s / 40s / jawab ke hisab se) — atka hua kaam **khud** reset | Ek flag atak jaye to jawab ka loop **hamesha** ke liye murda |
| 2 | Nakami ke baad **mic khud dobara** (wake ON par) | Har dafa "Maya" dobara kehna parti thi |
| 3 | Har mic-error ka **sahi naam + apna amal** (internet / ijazat / zubaan / samajh nahi aaya / mic masroof) | Sirf `"Voice error"` — aur ijazat ke liye **galat** code likha tha |
| 4 | Ijazat na hone par **ijazat ka paigham** (code 9), aur ruk jana | "Mic permission nahi" ka **galat** label + be-inteha "dobara try" |
| 5 | Bar-bar nakami par **circuit breaker**: 25s mein 6 koshishein = ruk kar **bol** kar khabar | Chup-chaap har 1–2 second mic kholti rehti |
| 6 | Wake ignore hone ki **WAJAH** log + status par | Bilkul chup-chaap — pata hi nahi chalta tha |
| 7 | Dimaag fail par **bol kar** khabar ("…second mein khud dobara koshish karungi") | Sirf toast — awaaz wale user ko kuch pata nahi chalta tha |
| 8 | Lamba jawab **poora** sunai deta hai | Saabit hadd par jawab beech mein **kat** sakta tha |
| 9 | Baat-cheet ka **darwaza** jawab SHURU par bhi tazaa | Lamba jawab baat-cheet ko beech mein tod deta tha |
| 10 | Phone ki mic setting (700ms khamoshi) ab **sahi chaabi** se jati hai | Ghalat chaabi + ghalat qisam ki ginti = **kabhi be-asar** |
| 11 | Mic khulte waqt crash ka rasta **sambhala** (kuch OEM phone) | App crash ya phansa hua mic |
| 12 | Kam-yaqeen sunai par bhi **poora rasta** (bubble + awaaz + SUKOON + mic dobara) | Waki awaaz bypass hoti thi → wake apni awaaz par khul sakti thi |

---

## 2) Parakhne ka tareeqa — tick (✅) lagayen

### Pehla qadam (2 minute) — pehchaan
- [ ] **T0** Purani APK ke upar install → toast **`MAYA v5.12.0 • 🛡️ JAWAB PAKKA`**
      *(ye toast na aaye = APK purani hai, baqi test bekaar)*

### Doosra qadam (5 minute) — jawab ka loop
- [ ] **T1** "ہے مایا" → sawal → jawab. Jawab ke baad **chup rahein** → mic **khud dobara**
      khul jaye (dobara "Maya" ke baghair)
- [ ] **T2** "ہے مایا" → sawal pooch kar **bolna band** kar dein → ~12 second mein mic band,
      aur ya to *"dobara boliye"* ya *"main ruk jati hun"* — **khamoshi nahi**
- [ ] **T3** Lagatar **3 sawal** ek hi baar-cheet mein → teeno ke jawab, beech mein "Maya" na kehna pare
- [ ] **T4** *"200 lafzon mein samjhao"* jaisa lamba jawab → jawab **poora** sunai de (beech mein na kate)

### Teesra qadam (5 minute) — nakami ka imtehan
- [ ] **T5** **Airplane mode ON** → "ہے مایا" → sawal → 2–3 koshish ke baad **bol kar**
      *"internet ya Google ka masla hai"* (sirf toast **nahi**)
- [ ] **T6** Airplane mode OFF → sawal → jawab wapas aa jaye
- [ ] **T7** Settings → MAYA → mic ki ijazat **Deny** → SUNO dabayein → **ijazat** ka paigham
      aaye aur **ruk jaye** (be-inteha loop NA chale) → ijazat wapas dein → theek ho jaye

### Chautha qadam (3 minute) — nazaarat
- [ ] **T8** LAB → **👂 WAKE WORD KA HAAL** / KAAN log → nayi lines nazar aayen:
      `sttErr …`, `reListen …`, `watchdog …`, `ignore …`
- [ ] **T9** 10 minute aam baat-cheet → **har** sawal ka jawab **ya** saaf wajah; kabhi aisi
      khamoshi na ho ke pata na chale kya hua

---

## 3) Kya abhi bhi adhoora hai (imaandari)

- **Mic ka nazuk dot abhi bhi Android ka apna hai.** Aap ki shikayat *"mic par on/off hota
  rehta hai, pata nahi chalta mic on hua ya nahi"* — is ka mukammal ilaj **J2 (MIC NAZAR)**
  hai: screen par Maya ka **apna MIC HAAL BAR** (5 halatein, 5 rang, likha hua haal) + Kotlin
  se **zinda level**. J1 ne sirf *chup-chaap marna* band kiya hai.
- **Raftar J3 mein hai** (jaldi sunna / jaldi bolna): dimaag ki **streaming** (pehla jumla
  foran bolna), TTS ke alag-alag budget, aur NAAP panel. J1 mein sirf muddat (timeout) theek hui.
- Silence extra (700ms) **ab sahi chaabi se jata** hai, magar Google ki service usay ignore
  kar sakti hai — naap J3 mein.
- **Offline KWS (Phase 4)** ke baghair mic-dot ki haqeeqat nahi badal sakti.

---

## 4) Agar kaam na kare — ye bhejein

1. Version toast ka **screenshot** (5.12.0 nahi to APK purani hai).
2. LAB → **👂 WAKE WORD KA HAAL** ka poora screenshot (KAAN log ke sath).
3. Status par jo **line** aayi thi (maslan `🙉 Sun nahi sakti: …` ya `⚠️ …` ya `⏱️ …`).
4. Aap ne kya kaha, kya jawab aaya (ya **kuch nahi** aaya) — kitne second baad.
5. Airplane mode aur ijazat wale test (T5–T7) ka natija.

**FAIL ka nishan:** koi bhi test upar ke ✅ se na mile → wo line aur screenshot bhej dein;
aur agar app crash ho to phone ki Settings → Apps → MAYA → "App didn't work" report.

---

## 5) Version ki pehchaan

**MAYA v5.12.0 "JAWAB PAKKA"** · versionCode **76** · native **`5.12.0-native`** ·
service-worker cache **`maya-v5.12.0`** · Tests **1281/1281** ·
J-track: **J1 mukammal** · J2 (MIC NAZAR) → J3 (RAFTAR) → J4 (SAAF AWAAZ) baaki.

---

## 6) APK kahan se

**https://github.com/adil-chandio/Mana-android/actions/runs/33782568618**

Ya: GitHub → `adil-chandio/Mana-android` → **Actions** → sab se upar wali
**"Build MAYA APK"** run → niche **Artifacts** → **`MAYA-APK`** (3,219,176 bytes) →
zip khol kar `app-debug.apk` phone mein install karein (purani APK ke upar chal jayegi,
data safe rehta hai).
