# 📱 MAYA v5.10.3 — Aam Zubaan Report (ek parcha, phone mein rakhne layak)

> **Qanoon 9:** har naye version ke baad ye parcha BANEGA — kya naya hua, kaise parakhna
> hai, kya adhoora hai. Ye parcha release doc ka hissa hai aur test-lab iski hifazat karta hai.
>
> **Version:** 5.10.3 (WAKE ZINDA) · **Tests:** 1193/1193 GREEN · **APK:** 3.2 MB
> **Build:** https://github.com/adil-chandio/Mana-android/actions/runs/33679657338

---

## 1) Kya naya hua — 8 baatein, aam zubaan mein

| # | Naya | Pehle kya hota tha |
|---|---|---|
| 1 | **"SUNO" ke baad wake ~1 second mein wapas zinda** | 60 second tak murda (Google busy / net slow / aawaz na sunne par) |
| 2 | **Wake saaf zubaan mein sunta hai** (jo har phone mein hoti hai) | Wake engine chup-chaap fail ho jata tha |
| 3 | **Settings SAVE par foran lagu** | Agli baar app kholne par badlaav aata tha |
| 4 | **Wake switch jhoot nahi bolti** | Mic ijazat ke baghair bhi ON dikhti thi |
| 5 | **Net/Google kharab ho to screen par khabar** | Chup-chaap kuch nahi hota tha |
| 6 | **Panel sach batata hai** (halat, MISMATCH, delivery) | Sirf "Zinda" likha aata tha |
| 7 | **Log mein tareekh/waqt wapas** + bar-bar waqiaat par `x N` | Log adhoora aur shor wala tha |
| 8 | **Screen band par wake sun-na RECORD hota hai** | Chup-chaap band, koi nishan nahi |

> Note: **baat-cheet aur bol kar jawab aaj bhi Urdu mein hai** — sirf wake ki pehchaan ki zubaan
> badli hai (kyunki Urdu mein wake engine kaam nahi karta tha).

---

## 2) Parakhne ka tareeqa — neeche wale khane par tick (✅) lagayen

### Pehla qadam (2 minute) — yahi sab se zaroori hai
- [ ] **T1** Purani app ke upar nayi APK install karen → app khulti hai, data qaim, version **5.10.3**
- [ ] **T2** **WAKE** switch ON → ON **rehti** hai, panel par **HAAL: Zinda** + **delivery: pohanch gaya**
- [ ] **T3** Chup-chaap kahein **"ہے مایا"** / **"OK MAYA"** → neela **SUNO** pill aata hai
- [ ] **T4** SUNO ke baad poochen **"آج موسم کیسا ہے"** → Urdu jawab, aur wake **1 second** mein wapas zinda
      ⭐ **ye 4 nishan mil gaya = 60 second wala purana masla KHATAM**

### Doosra qadam (maslon ki soorat mein)
- [ ] **T5** Airplane mode ON karke wake kahein → Toast **"Wake band — internet/Google masla"**,
      5 nakamiyon ke baad **"circuit khul gaya"**; switch **OFF nahi** hoti
- [ ] **T6** Mic ki ijazat wapas le kar WAKE switch ON karen → switch **khud OFF** rehti hai
- [ ] **T7** Settings mein **wake zubaan** badal kar **SAVE** → panel par **foran** naya naam

### Teesra qadam (background)
- [ ] **T8** Screen 5 minute band rehne den, phir **"ہے مایا"** → SUNO aata hai
- [ ] **T9** App recent se swipe karke bahar nikalen, phir **"ہے مایا"** → sun-na jaari rehta hai

### PASS / FAIL ka nishan
| | PASS ✅ | FAIL ❌ |
|---|---|---|
| HAAL | Zinda / Sun raha | Murda, ya ON hone ke baad **MISMATCH** |
| Wake | SUNO foran + uske baad 1 sec mein wapas zinda | SUNO nahi, ya jawab ke baad murda |
| Delivery | "pohanch gaya" | khaali |
| Switch | ijazat ke baghair khud OFF | ijazat ke baghair ON |
| Net kharab | saaf toast + circuit khabar | chup-chaap khamoshi |

---

## 3) Jo abhi adhoora hai (saaf batana zaroori tha)
1. **Screen band / app swipe ke baad wake sunti to hai, magar koi AMAL nahi karti** — agla marhala (Phase 3).
2. **Phone restart ke baad wake khud ON nahi hoti** — ek dafa app kholni parti hai — Phase 3.
3. **Bina internet wake** — abhi nahi (Phase 4, bara kaam).
4. **Shor wale kamre mein bariki se tune** — Phase 1.
5. **APK khud-ba-khud update** — abhi nahi; pehle aap ka faisla: zariya **GitHub** ho ya **apna server**.

---

## 4) FAIL ho to mujhe ye 5 cheezen bhejen
1. **Panel ka photo** (neeli patti + WAKE hissa + "Aakhri 5 wake waqiaat" saaf dikhen)
2. **HAAL** kya likha tha: Zinda / Murda / Sun raha / MISMATCH / Switch ON
3. Wo **5 waqiaat ki lines** (ya photo)
4. **Phone ka model + Android version**
5. **Video** — kaam karne ki aur na karne ki dono

---

## 5) Sahi version ki pehchaan (install ke baad zaroor milen)
- App ki detail mein version **5.10.3**
- Wake panel mein **HAAL / MISMATCH / delivery** ke nishan (purane version mein nahi the)
- Settings **SAVE** par panel **foran** update hona
- Log mein **tareekh/waqt** aur `rate-limit x N`

---

## 6) Ab se har version mein (aap ka hukm, likha hua qanoon)
- **Qanoon 9:** har release ke akhir mein ye parcha — kya naya, kaise parakhna (PASS/FAIL),
  kya adhoora, fail par kya bhejen, version ki pehchaan.
- Iska farma `docs/AMAL-WORKFLOW.md` (HISSA M) mein hai, aur **test-lab ke 4 locks** is ki
  hifazat karte hain — koi release is parche ke baghair GREEN nahi ho sakti.
