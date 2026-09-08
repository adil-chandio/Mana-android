# MAYA v5.10.2 — 🗣️ ghalat screen ab KHULTI HI NAHI

**versionCode 73 · aap ke phone ka doosra saboot (panel ki asli output)**

> v5.10.1 ne button ko **bolna** sikha diya tha — screen ka naam batata tha.
> Aap ne wo panel chala kar jo bheja, us ke aakhri do qatron ne ek chhed aur pakda:
>
> ```
> ✅ Jo screen khuli: com.android.settings/.Settings$ManageAssistActivity
> ☝️ Us mein dhoondo: Voice typing → Faster voice typing → Offline speech recognition
> ```
>
> Yaani **"Digital assistant" wali screen phir bhi khul gayi**, aur hum ne us par
> khade ho kar aap ko *Voice typing* dhoondne ko keh diya — jo us screen par hoti
> hi nahi. Naam batana **aadha** ilaj tha. Poora ilaj: **wo screen khule hi na**.

---

## 1. 🔬 Aap ki bheji hui fehrist ne 3 cheezein batayin

| Aap ka panel kya bola | Matlab | Kya kiya |
|---|---|---|
| `✅ Jo screen khuli: …ManageAssistActivity` | OEM ne `ACTION_VOICE_INPUT_SETTINGS` ko assistant screen par alias kiya hua hai (v5.10.1 ka diagnosis **sahi** tha, ilaj **aadha**) | `go()` ko **block-list**: naam `assist` se milta ho to screen **kholta hi nahi**, agla rung azmata hai |
| `🧩 … 1 service — Speech Recognition and Synthesis — com.google.android.tts` **aur** `❌ Poori Google app: NAHI` + *"pehle Play Store se Speech Recognition & Synthesis install karo"* | Panel **apni hi fehrist se takra** gaya: app maujood thi, magar hum sirf `googlequicksearchbox` (poori Google app) dekhte the | Ab **`srv` fehlist se pehchante hain**: `com.google.android.tts` = Google ka speech service ✅ — mashwara badal gaya |
| `🤝 SACH: … offline wake mumkin NAHI` | **Jhoota dar** bhi tha: speech service maujood hai to pack download ho sakta hai | Do tarah ki imaandari: na jhoota dar, **na jhooti umeed** (neeche §3) |

Sath ek chhota magar chubhne wala qissa: panel ke matn mein `&` kahin kahin
**`&amp;`** ban kar dikha (aap ki paste mein `Languages &amp; input`). Apne
matn se nanga `&` hata diya — ab `Languages aur input`.

---

## 2. 🩹 Ilaj

### Kotlin

1. **`go(i, vararg blocked)`** — resolve karne ke baad, khulne wali activity ka
   naam `blocked` ke kisi lafz se milta hai to **`startActivity` hi nahi hota**,
   `null` wapas → seedhi ka agla rung. Teeno voice rungs par `"assist"` block:
   `ondevice/gboardvoice`, `voiceservices`, `voice`.
   **`assistant` darwaze par block NAHI** — wo aap KHUD maangein to khulna chahiye
   (bas ab panel likhta hai ke us se zubaan ka masla hal nahi hota).
2. **Naye darwaze** (JS ab fehlist dekh kar khud chunti hai):
   * `appinfo:<pkg>` → us app ki info screen (pack/storage dekhne ke liye)
   * `market:<pkg>` → Play Store (`market://` pehle, warna `play.google.com` web)
3. **`onDeviceMap()` mein `play`** — Play Store maujood hai ya nahi (andaza nahi),
   taake `market:` button sirf tab bane jab kaam ka ho. Manifest mein
   `com.android.vending` + `market` scheme ki query bhi.
4. **🛡️ Android 12/12L ka CRASH (purana, chhupa hua):** `makeRecognizer()` ka
   guard `SDK_INT >= 31` tha, magar `isOnDeviceRecognitionAvailable` /
   `createOnDeviceSpeechRecognizer` **API 33** se hain. API 31/32 par ye call
   `NoSuchMethodError` phenkti hai — wo `Error` hai, `Exception` **nahi** — is liye
   `catch (e: Exception)` use **pakadta hi nahi tha**: Android 12 phone par
   **SUNO dabate hi app crash**. Ab teeno jagah guard `33` + `catch (Throwable)`.

### JS (panel)

* **`Google ka speech service`** ki alag line (`com.google.android.tts` /
  `googlequicksearchbox` fehlist se pehchana jata hai).
* **"Poori Google app: NAHI"** ab takrata nahi — sath likhta hai
  *"(magar speech service maujood hai — zubaan pack usi mein hoti hain)"*.
* **Step 2 ka mashwara halat ke hisaab se:** ek hi service ho to *"wahi default hai,
  chunne ki zaroorat NAHI"*; kai hon to *"ye chuno, AiAi NAHI"*; koi na ho to
  *"chunne ko kuch nahi — pehle install karo"*.
* **Naye button:** `📦 …ki app-info` (speech service aur AiAi dono ke liye),
  `🛒 Play Store: Speech Services by Google` / `🛒 Play Store: Gboard` — **sirf jab
  Play Store maujood ho**.
* **Har darwaze ka apna HINT** (`b.h`) — aam *"Voice typing dhoondo"* mashwara har
  screen par sach nahi hota. Aur agar kisi OEM ne phir bhi assistant screen thons
  di, to JS naam par khud pehchan kar kehta hai:
  *"🛑 Ye 'Digital assistant' ki screen hai — is mein offline zubaan ka pack HOTA HI NAHI"*
  (Kotlin block ka doosra qila).

---

## 3. 🤝 Imaandari ki hadd — na jhoota dar, na jhooti umeed

Aap ke phone par (Gboard ✅ + `com.google.android.tts` ✅, AiAi ❌, on-device ❌) panel
ab ye kehta hai:

* zubaan pack **download ho sakta hai** → **Gboard ki voice typing offline** chalegi;
* **MAGAR Maya ki WAKE abhi online recognizer se hoti hai** (internet zaroori) —
  kyunki Maya abhi `EXTRA_PREFER_OFFLINE` istemal **nahi** karti. Ye jaan boojh kar
  nahi kiya: bina pack wale phone par wake tootne ka khatra tha. Jab aap kahein,
  v5.10.3 mein isay ek **Settings switch** ke peeche la dete hain (default OFF),
  taake offline pack wale phone par wake bina internet ke chale;
* behtar natija: `⚙️ Settings → STT = English (India)` — Urdu decoder "مایا" ko
  aksar "ہے" jaisa parh leta hai.

Jahan AiAi/on-device maujood ho, panel khush-khabri deta hai: *"pack download karo,
wake bina internet ke chalegi"*. Jahan koi speech service hi na ho, wahi purana
saaf sach: *"offline wake mumkin NAHI lagta"*.

---

## 4. 🧪 Saboot

`npm test` = **1153/1153 PASS** (v5.10.0 baseline 1081 → **+72**)

| Suite | v5.10.0 | v5.10.1 | **v5.10.2** |
|---|---|---|---|
| settings-ui | 84 | 95 | **101** (+6: Section 14 — assistant screen par sach, per-button hint) |
| voice | 294 | 294 | 294 |
| brain | 155 | 155 | 155 |
| lab | 548 | 579 | **603** (+24: Section 29a–d) |

Section 29 kya lock karta hai: `go()` ki block-list · teeno rungs par `"assist"` ·
`assistant` darwaze par block **nahi** · `appinfo:`/`market:` · Play Store query ·
`makeRecognizer` guard 33 + `Throwable` (teeno jagah) · panel ka takrao khatam ·
jhoota dar khatam · jhooti umeed bhi nahi · har darwaze ka hint · `&amp;` wala `&` nahi ·
Play Store na ho to `market:` button nahi · AiAi wale phone par khush-khabri · `act()` ko `Uri` na thonsna (v5.10.2 ki CI ne 2 `Type mismatch: Uri! but String?` pakde — ab lock).

**CI:** `Build MAYA APK` — v5.10.2 ka pehla run do `Type mismatch` par toota
(`act(action, pkg: String?)` ko `Uri.parse(...)` thons diya tha) — theek kar ke dobara push kiya;
dusra run **✅ GREEN** (run `33667553462`, step *"4. APK BUILD"* success, APK artifact `MAYA-APK` bani).

---

## 5. Kya NAHI badla

* `WakeWordService.kt` — ek line nahi (wake ka faisla JS mein)
* KHUD-MUKHTAR (P6) — switch ab bhi **default OFF**
* Purane bridge (`openSetting`) — salamat; purani APK par panel khud kehta hai
  *"ye APK purani hai"* aur likha hua raasta dikhata hai (Qanoon 2)
