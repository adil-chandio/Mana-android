# 📱 REPORT v5.16.0 🩺 ARTIST DOCTOR — aam zubaan mein (Qanoon 9)

**Version:** 5.16.0 · **versionCode:** 81 · **Naam:** 🩺 ARTIST DOCTOR · **APK native:** `5.16.0-native`
**Tarikh:** 2026-09-08 · **Pichla:** v5.15.0 🎙️ MERI AWAAZ (strict artist ka qanoon)

> **Ek line mein:** v5.15.0 ne qanoon banaya tha ke *jo artist aap ne chuna, sirf wahi bolegi*.
> v5.16.0 us qanoon ke **darwazon** ko theek karta hai: jo option dabane se kuch nahi hota tha
> ab hota hai, jo aap ke naye hukum ko nigal jata tha ab nahi nigalta, jis jagah awaaz chup ho
> jati thi ab wahan bhi awaaz nikalti hai — aur **har awaaz ka muaina** ek button par milta hai.

---

## 1) Kya naya hai (seedhi baat)

| Cheez | Pehle | Ab |
|---|---|---|
| **"🔁 Sirf dobara koshish"** option | Dabane se **kuch nahi** hota tha (dead) | Wahi artist 2.5 second baad **dobara koshish** karti hai, aap se poochhe baghair; phir bhi nakam ho to sach likh deti hai |
| **"🤫 Chup — sirf likho"** option | Phir bhi message + toast + sawal aata tha | **Bilkul chup** — na message, na toast, na sawal (hisab sirf PANEL/doctor mein) |
| Nakami ke baad aap ka message | 90 second ke andar **"theek hai, alarm 7 baje laga do"** bhi jawab samjha jata tha — alarm gum | Naya hukum **hukum hi rehta hai**: lamba message, sawal (`?`/`؟`), number ya hukum ka lafz (alarm/balance/mausam…) → jawab nahi samjha jata |
| **"sirf ab Edge se bolo"** | Sirf engine jata tha, waada ki hui **awaaz** nahi | Engine **aur** awaaz dono — jo likha wohi hota hai (usi jawab bhar, phir khud saaf) |
| Lamba jawab (hadd se bara) | Strict mode mein **dead-end**: na retry, na koi kaam ka ikhtiyar → khamoshi | **Usi artist** par tukron mein bol deti hai (artist nahi badalta) |
| Edge ki awaaz ka id | Ghalat/purana id ho to har tukra nakam, wajah dhundhli | Ghalat id pakdi jati hai → qanooni pasand chunti hai (doctor mein "⚠️ ghalat id" likha dikhta) |
| `neural`/`gemini` naam | Chup-chaap **AUTO** ban jata → aap ka 🔒 khatam | Ab 🔒 strict Gemini (aap ki chuni awaaz ke sath) |
| **🩺 ARTIST DOCTOR** | Tha hi nahi (sirf Gemini keys ka doctor) | Ek button: **charon awaazon** ka haal — tayyar? key/bridge? aakhri galti? kitni **ms** mein boli? quota? cache? warm? + session ka poora hisab + nateeja |
| Baasi sawal | Muddat sirf ek jagah check hoti thi | `askLive()` — baasi sawal par kabhi amal nahi |
| Phone ki awaaz ka hisab | Koi ginti hi nahi thi | `deviceSpoke` — doctor sach bolta hai |

**Qanoon wahi hai:** artist **kabhi** khud nahi badalta. Naye retries **usi** artist par hote hain;
doosri awaaz sirf aap ki ijazat se (`poochho` par poochh kar, ya `koi_bhi` pehle se ijazat) — aur
tab bhi sach likh kar + ginti ke sath.

## 2) Kaise jaanchein — PASS / FAIL

| # | Tajurba | ✅ PASS | ❌ FAIL |
|---|---|---|---|
| 1 | Settings → 🎙️ MERI AWAAZ → **🩺 ARTIST DOCTOR** dabayein | Ek report khulti hai: 4 artist, pasand/policy, hisab, nateeja | Button se kuch nahi hota / report adhoori |
| 2 | Policy **🔁 Sirf dobara koshish** chunein, WiFi band karke sawal puchein, phir WiFi on | Kuch der baad **wahi** artist bolne ki koshish karti hai; koi doosri awaaz nahi | Turant Edge/phone bol pada, ya bilkul khamoshi |
| 3 | Policy **🤫 Chup** chunein, WiFi band karke sawal | **Koi message/toast nahi**; jawab likha hua hai | Bubble ya toast aa gaya |
| 4 | Policy **🙋 Poochho**, WiFi band → sawal nakam → 90s ke andar likhein: `theek hai, alarm 7 baje laga do` | **Alarm lag jata hai** (hukum chalta hai) | Purana jawab doosri awaaz mein bola, alarm gum |
| 5 | Wahi haal mein likhein: `dobara koshish` | Wahi artist dobara koshish karti hai | Jawab samjha hi nahi gaya |
| 6 | `sirf ab Edge se bolo` (ya jo ikhtiyar likha ho) | **Usi** awaaz mein bolta hai jo likhi thi | Koi aur Edge awaaz |
| 7 | Lamba jawab (Gemini ki hadd se bara) | Awaaz chalti rehti hai, **ek hi artist** | Khamoshi ya beech mein artist badla |
| 8 | Doctor ki report mein "pehla tukra …ms" | Awaaz chalne ke baad **asal number** dikhta hai | Hamesha 0ms (jab artist boli ho) |

Command line se: `node tools/test-voice-engine.js` (**397**) + `node tools/test-lab-engine.js` (**1044**)
+ `node tools/test-brain-engine.js` (155) + `node tools/test-settings-ui.js` (101) → **1697 GREEN**.

## 3) Kya adhoora hai

- **Asal phone par tajurba nahi hua** — yahan sirf code + 1697 automated taale. Aap ke TECNO KL4 par
  hi mic/latency/asli Edge-Fish behaviour confirm hoga.
- **"dobara" policy ka budget 1 retry hai** (2.5s baad) — be-inteha loop jaan-boojh kar nahi
  (battery/data). Permanent rukawat (quota/key/offline) par retry hi nahi, sirf sach.
- **Hijack guard ek fehrist par chalta hai** (`alarm/timer/call/sms/kholo/bhejo/balance/mausam/kitna/
  kaise/kaun/kab…` + lambai ≤40 + sawal ka nishaan + number). Koi naya hukum ka lafz nikla to
  hijack ho sakta hai — mujhe likh dein, fehrist mein add kar doonga.
- **Doctor ki latency sirf "pehla tukra"** naapti hai (poora jawab nahi), aur sirf us engine ki jo
  is session mein bola — jo kabhi nahi bola uski latency "naapa nahi gaya".
- **Doctor network se jaanch nahi karta** (jaan-boojh kar: offline bhi chale, quota na jale). Keys ki
  gehri jaanch ke liye purana **🩺 GEMINI VOICE KEYS CHECK KARO** button wahi kaam karta hai —
  ARTIST DOCTOR batata hai ke us ki zaroorat hai ya nahi.
- **Edge ka clip cache mumkin nahi** (har tukra Microsoft se stream hota hai); Fish ka cache sirf
  preheat se bharta hai; Gemini par koi warm-up nahi (quota pyara).
- **`lockKey` ke baghair wali ek-dafa speak** par sawal dohra sakta hai (F112) — streaming jawab ka
  wada na tootne ke liye guard jaan-boojh kar wahi hai. Aam istemal mein har jawab lock ke sath hota hai.
- **Namoona (🔊) chal rahe jawab ko rok deta hai** — aap ka dabaya hua button hai, is liye roka nahi
  gaya; ab doctor/report mein is ka hisaab hai.
- **Naya APK install karna zaroori hai** — purane v5.15.0 APK par ye policies dead hi rahengi.

## 4) Fail ho to kya bhejein

1. **🩺 ARTIST DOCTOR ki poori report** (copy kar lein) — us mein pasand, policy, rukawat, latency,
   quota aur session ka hisab sab hota hai. Ye ek cheez hi kaafi hai.
2. **PANEL** ki `🎙️ MERI AWAAZ:` line (ab us mein `policy retry · chup · lambe tukre · pehla tukra ms` bhi hai).
3. Settings mein chip ka text (`🔒 SIRF yahi bolegi — …` ya `🤖 AUTO`) + kaunsi policy chuni thi.
4. Jo aap ne **likha/bola** tha aur jo **hua** (khaas kar tajurba #4 wala hijack: aap ka poora jumla).
5. `logcat` ki aakhri ~100 lines (crash/timeout), aur mic permission di thi ya nahi.
6. Version pehchaan: **5.16.0 / vc81** (Settings → version) + device/WebView version
   (aap ka: TECNO KL4, Android 14 SDK 34, WebView 152.0.7977.64).

## 5) Version pehchaan

| | |
|---|---|
| Version | **5.16.0** 🩺 **ARTIST DOCTOR** (versionCode **81**) |
| Native | `appVersion = "5.16.0-native"` · SW cache `maya-v5.16.0` · toast "MAYA v5.16.0 • 🩺 ARTIST DOCTOR …" |
| Naya | `AWAAZ.artistDoctor()` · `AWAAZ.answerOk()/askLive()` · `POL_RETRY/polRetries/silentFails/longSplits/lat/deviceSpoke/lastAuditionAt` · `ARTIST.edgeOk()` · `parse("neural"/"gemini")` · `#artistDocBtn` + `#artistDocOut` + `window.awaazArtistDoctor()` |
| Theek hua | F102 (dead "dobara") · F103 (chup bolti thi) · F104 (hukum hijack) · F105 (baasi sawal) · F106 ("sirf ab" bina awaaz) · F107 (strict TOO_LONG dead-end) · F108 (Edge id bina jaanch) · F110 (doctor nahi tha) · F111 (latency ka hisaab nahi) · F113 (`neural` → AUTO) |
| Barqarar | v5.15.0 ka strict qanoon (artist khud nahi badalta) · AUTO ka purana wada · FAST rescue sirf AUTO mein · Gemini roz quota 12 |
| Tests | **1697/1697 GREEN** — voice **397** (Section 20 = +49) · lab **1044** (Section 40 = +46) · brain 155 · settings/CSS 101 |
| Docs | `docs/FORENSIC-AWAAZ-DOCTOR.md` (F102–F113) · `docs/FIX-v5.16.0-artist-doctor.md` · ye report |
| Mirror | `public/index.html` = `app/src/main/assets/web/index.html` (byte-identical) |
| Git | commit `31d4645` · branch `arena/01a062e9-mana-android` (12 files, +934 / −37) |
| CI | run [`34260153846`](https://github.com/adil-chandio/Mana-android/actions/runs/34260153846) ✅ **SUCCESS** |
| APK | artifact `MAYA-APK` = **3,270,237 bytes** (~3.27 MB) — usi CI run se download karein |
