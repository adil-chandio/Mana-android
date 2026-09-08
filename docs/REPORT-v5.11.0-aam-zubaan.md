# 📱 MAYA v5.11.0 — Aam Zubaan Report (ek parcha, phone mein rakhne layak)

> **Qanoon 9:** har naye version ke baad ye parcha BANEGA — kya naya hua, kaise parakhna
> hai, kya adhoora hai, nakami par kya bhejein, aur version ki pehchaan.
>
> **Version:** 5.11.0 (WAKE MAZBOOT) · **Tests:** 1234/1234 GREEN · **Phase:** 1 (robustness)
> **Build:** ✅ CI GREEN (pehli koshish) · **APK:** 3,211,753 bytes (3.2 MB)
> **Download:** https://github.com/adil-chandio/Mana-android/actions/runs/33689569785
> Tafseel: [`FIX-v5.11.0-wake-mazboot.md`](FIX-v5.11.0-wake-mazboot.md)

---

## 1) Kya naya hua — aam zubaan mein

**Ek line mein:** v5.10.3 ne wake ko **zinda** kiya tha; v5.11.0 usay **mazboot** karti hai —
shor, mic ki larai, app band hone, aur "halat phans jane" ke khilaf.

| # | Naya | Pehle |
|---|---|---|
| 1 | Wake ki halat ki ab **mudat** hai — rukawat **khud** khatam hoti hai | Ek khabar kho jaye to wake **hamesha** band |
| 2 | App har **10 second** zindagi ka saboot bhejti hai | Sirf halat badalne par khabar jati thi |
| 3 | Shor wale kamre mein behtar: pehle **0.8 second** khamoshi ka **farsh** naapa jata hai | Farsh pehli awaaz par jam jata (chokhat 76dB → chillane par bhi na khulti) |
| 4 | Chokhat kabhi **72dB se upar nahi** (absolute cap) | Koi hadd nahi thi |
| 5 | Farsh **dono taraf** seekhta hai (shor barhe to false-wake nahi) | Sirf neeche ja sakta tha |
| 6 | Mic read-error par **battery/garmi** par lagam (5 koshish → mic tazaa, 90s umar) | Processor 100% ghoomta rehta |
| 7 | Maya ke bolte waqt **mic ki larai band** (pehra wajah dekh kar band hota hai) | Pehra band hone ke bawajood mic khul jata |
| 8 | Wake ka **apna kaan** + **yaad**: jo chala wahi agli dafa pehle; 4 nakami par agla azmaya jata | App mari to chupke se kamzor kaan; nakam kaan bar bar |
| 9 | Wake session ki **hadd** (0.7s khamoshi = khatam) → disconnect kam | Session bina hadd ke lambi khinchti |
| 10 | Panel par **"IS SESSION"** aur **"KUL"** nakami alag | "lagatar 15" jaisa adhoora sach |
| 11 | Mic ijazat na ho: **⚠️ wake beemar** notification + **"Ijazat do"** button; ijazat milte hi wake **khud** shuru | Chup-chaap hammer + notification ka jhoot |
| 12 | App wapas aane par haal **tazaa** + sehat ka nazar; WebView background (battery) magar heartbeat zinda | Wapsi par dono taraf ka haal alag reh sakta tha |

---

## 2) Parakhne ka tareeqa — tick (✅) lagayen

### Pehla qadam (3 minute) — version aur panel
- [ ] **M0** Purani APK ke upar install → toast **`MAYA v5.11.0 • 🛡️ WAKE MAZBOOT`**, version 5.11.0
- [ ] **M1** WAKE ON → LAB → 👂 WAKE WORD KA HAAL → nayi lines: **🧭 WAKE STATE** aur **🎧 PEHRA**
      (`farsh NdB · chokhat MdB`) — **ye lines na hon = APK purani hai**
- [ ] **M2** Khamosh kamre mein 1 minute → log mein `farsh … chokhat … frame 3`

### Doosra qadam — shor aur asli istemal
- [ ] **M3** TV chalu karke 10 dafa **"ہے مایا"** → **8 ya zyada** SUNO
- [ ] **M4** SUNO ke baad jawab lein, chhod dein, phir **"ہے مایا"** → **~1 second** mein wapas
      ⭐ *(v5.10.3 ka natija barqarar — yahi sab se ahem test hai)*
- [ ] **M5** 1 ghanta TV chalu, koi na bole → **1 ya kam** false wake

### Teesra qadam — ijazat aur notification
- [ ] **M6** Mic ijazat wapas le kar WAKE ON → switch **khud OFF** + notification
      **⚠️ MAYA wake beemar**
- [ ] **M7** Notification par **"Ijazat do"** → app-info screen khulti hai → ijazat dein →
      **45 second** ke andar wake **khud** shuru (app dobara khole baghair)

### Chautha qadam — background aur panel ka sach
- [ ] **M8** Screen 30 minute band → **"ہے مایا"** → wake chalu; `wake ka recognizer` wahi (badla nahi)
- [ ] **M9** App recent se swipe → 1 minute baad kholein → `🧭 WAKE STATE` mein JS aur Kotlin ka
      haal **ek jaisa**, `heartbeat N` barh raha ho
- [ ] **M10** Airplane mode 5 minute → circuit ki khabar + `💡 ILAJ`; **KUL nakami** barhe,
      **IS SESSION** streak reset hota rahe
- [ ] **M11** 12 minute chalu chhoden → log mein `error 3/8` **na** aaye
- [ ] **M12** `🔧 khud-sudhaar` ki ginti **0 ya bahut kam** ho

### PASS / FAIL ka nishan (FAIL ❌ / PASS ✅)
| Cheez | ✅ PASS | ❌ FAIL |
|---|---|---|
| Version | toast `v5.11.0` + `native: 5.11.0-native` | purana version |
| Panel | `🧭 WAKE STATE` + `🎧 PEHRA` + farsh/chokhat | ye lines gayab |
| Farsh | **20–50dB** ke andar, calibration `frame 3` | 60dB+, ya bar bar `calibration adhoora` |
| Chokhat | **≤72dB** | 76dB jaisi |
| Shor mein wake | 10 mein se **≥8** | ≤5 |
| False wake | 1 ghante mein **≤1** | bar bar khud SUNO |
| Halat | JS aur Kotlin **ek jaisa**, `heartbeat` barhta | MISMATCH, `heartbeat 0` |
| Ijazat | switch khud OFF + **"Ijazat do"** button + khud wapsi | switch ON ka jhoot, ya khud wapas na aaye |
| Khud-sudhaar | 0–2 | lagatar barhta rahe |
| Battery | Phone garam nahi, 12 min par `error 3/8` nahi | garmi, ya har 12 min clash |

---

## 3) Jo abhi adhoora hai (imaandari)
1. **Screen band / app swipe ke baad wake ka AMAL** (khud jawab, khud app kholna) → **Phase 3**
2. **Phone restart ke baad wake khud ON** nahi → **Phase 3**
3. **Bina internet wake** → **Phase 4**
4. **APK khud-ba-khud update** → **Phase 2.5** — aap ka faisla: **GitHub** ya **apna server**?
5. **dB ka paimana mota hai** (dBFS calibration Phase 2 mein) — numbers andaza hain, laboratory-grade nahi
6. **Wake DOCTOR v2** (ek button → poora copy-paste forensic) → **Phase 2**

---

## 4) FAIL ho to mujhe ye bhejen
1. **LAB → 👂 WAKE WORD KA HAAL** ka poora photo (nayi lines saaf dikhen)
2. **Aakhri 5–10 wake waqiaat** (log ki lines ya photo)
3. `farsh` + `chokhat` ke **numbers**, aur `calibration adhoora` aaya ya nahi
4. **HAAL (JS)** + **HAAL (Kotlin)** dono, aur `MISMATCH` / `🔧 khud-sudhaar` ki lines
5. **Phone model + Android version**
6. **Video** — kaam karne aur na karne ki dono

---

## 5) Sahi version ki pehchaan
- Boot toast: **`MAYA v5.11.0 • 🛡️ WAKE MAZBOOT — calibration + expiry + heartbeat`**
- App detail mein: **5.11.0** (versionCode **75**)
- Panel ki nayi lines: **🧭 WAKE STATE** · **🎧 PEHRA** · `wake ka recognizer` / `app ka recognizer` alag
- Notification (beemar halat mein): **⚠️ MAYA wake beemar** + **"Ijazat do"** button
- In mein se ek bhi na ho → APK **purani** hai

---

## 6) Ab se har version mein (aap ka hukm = Qanoon 9)
Har release ke akhir mein ye parcha **banega** — kya naya, kaise parakhna (PASS ✅ / FAIL ❌),
kya adhoora, nakami par kya bhejein, aur version ki pehchaan. Ye test-lab ke locks se bandha
hua hai: parcha na bane to tests **FAIL** ho jate hain.
