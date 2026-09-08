# MAYA v5.10.1 — 🗣️ ON-DEVICE LANGUAGE ka RAASTA THEEK: andaza nahi, phone ki asli fehlist

**versionCode 72 · chhoti fix release · aap ki VIDEO ne pakda**

> ⚠️ **v5.10.2 mein is ka ek chhed aur band hua** — v5.10.1 naam to batata tha magar
> ghalat (assistant) screen KHOL bhi deta tha: [`docs/FIX-v5.10.2-assistant-screen-band.md`](FIX-v5.10.2-assistant-screen-band.md)

> Aap ne 🗣️ ON-DEVICE LANGUAGE dabaya → phone ki **"Digital assistant app"** screen khul
> gayi (`None` · `Ella` · **Google Go**) — jahan offline speech ki **koi cheez hi nahi hoti**.
> Aap ne sahi pakda: *"dekho kya ho raha hai"*. Ye release usi ka jawab hai.

---

## 1. 🔬 Forensic — screen GALAT kyun khuli (code se, andaza nahi)

v5.9.1/v5.10.0 ka Kotlin:

```kotlin
if (which == "ondevice") {
    val tries = listOf(
        Intent().setComponent(ComponentName(          // 1. Gboard → Voice typing
            "com.google.android.inputmethod.latin", "…VoiceSettingsActivity")),
        Intent(Settings.ACTION_VOICE_INPUT_SETTINGS), // 2. voice-input picker
        Intent(Settings.ACTION_SETTINGS)              // 3. aam Settings
    )
    for (i in tries) { startActivity(i); return true }   // ← ANDHA
}
```

**Do chhed, dono asli:**

| # | Chhed | Nateeja |
|---|---|---|
| 1 | `startActivity()` sirf **ActivityNotFoundException** par rukta hai. Kai OEM (Android Go / Infinix / itel / Tecno) `ACTION_VOICE_INPUT_SETTINGS` ko apni **"Digital assistant"** screen par alias kar dete hain | Intent **chal jata** hai → `return true` → hum khush, aur aap **galat screen** par khade |
| 2 | Pehla qadam Gboard ka component tha — magar **Android 11+ ki package-visibility** ke qanoon se wo package humein **dikhta hi nahi tha** (manifest mein `<queries>` tha hi nahi) | Pehla qadam **hamesha** fail → seedha doosre (galat) qadam par |

**Aur ek teesra chhed jo isi video se nikla:** `micDoctor()` ka
`getApplicationInfo("com.google.android.tts")` bhi usi visibility qanoon se
**NameNotFoundException** phenkta tha → 🩺 KAAN DOCTOR hamesha
*"Speech by Google app: nahi"* kehta tha, **chahe app install ho**. Ek jhoot jo
aap ko galat raaste par bhejta tha.

**Aur sab se ahem baat (aap ke phone ka sach):** video mein default assistant
**Google Go** hai. Is ka matlab ye phone **Android Go / lite** build hai — jahan
aam tor par **na Android System Intelligence (AiAi) hota hai na poori Google app**.
Dono ke bagair **on-device (offline) zubaan pack download hone ki jagah hi nahi**.
Matlab: wo screen khul bhi jati to bhi **kuch download na hota**.

---

## 2. 🩹 Ilaj — teen darje

### L1 `<queries>` — aankhein wapas aa gayin

`AndroidManifest.xml` mein pehli dafa `<queries>`: Gboard · Gboard Go · Google app ·
Search Lite · Speech-by-Google · AiAi + `RecognitionService` · `ASSIST` · settings ke
darwazon ke intent. **Koi permission nahi maangi gayi** — sirf "mujhe ye naam dekhne hain".

### L2 `go()` — screen khud khole se PEHLE poochho

```kotlin
private fun go(i: Intent): String? {
    if (i.component == null) {
        val ri = pm.queryIntentActivities(i, 0).firstOrNull() ?: return null   // koi kholega hi nahi?
        i.setClassName(ri.activityInfo.packageName, ri.activityInfo.name)      // EXPLICIT banao
    } else if (pm.getActivityInfo(i.component, 0) fails) return null           // wo activity hai hi nahi?
    startActivity(i)
    return cn.flattenToShortString()      // ← KAUN SI SCREEN KHULI, naam wapas
}
```

* `openSetting()` (purana bridge) **salamat** — `= openSettingNamed(which) != null` (Qanoon 2)
* Naya `openSettingNamed()` → **screen ka naam** wapas karta hai. JS ab
  *"jo screen khuli us mein dhoondo…"* wala **jhoot nahi bol sakta**: ya naam likhta hai,
  ya saaf kehta hai *"is phone par wo screen maujood nahi"*.
* `Digital assistant` ab **sirf apne alag darwaze** par (`"assistant"`) — zubaan ki seedhi
  se **bahar**. Wo ghalat screen ab kisi raaste mein nahi aati.

### L3 `onDeviceMap()` + panel — andaza nahi, **fehlist**

Naya bridge phone par **sach mein maujood** cheezein bhejta hai:

```json
{ "srv":[{"pkg":"com.google.android.apps.searchlite","label":"Google Go"}],
  "aiai":false, "goog":false, "ondevice":false, "using":"default",
  "svc":"…", "kb":["com.google.android.inputmethod.latin.go"], "asst":"Google Go" }
```

`srv` wahi `queryIntentServices(RecognitionService.SERVICE_INTERFACE)` se banta hai jo
`makeRecognizer()` ki seerhi istemal karti hai — yani **hawa mein teer nahi**.

JS ka naya panel (`KAAN.onDevice()` + `#labOnDeviceBox`) isi fehrist se banta hai:

* **sirf ASLI darwazon ke button** — Gboard nahi hai to us ka button **banta hi nahi**
* **Gboard Go** par alag sach: *"Go mein Voice typing aksar hoti hi nahi — pehle poora
  Gboard install karo"* (jhoota waada nahi)
* na AiAi na poori Google app → **"is phone par offline wake mumkin NAHI lagta"** +
  mashwara ke STT `English (India)` rakho (Urdu decoder "مایا" ko "ہے" parh leta hai)
* 🛑 saaf likha: **"Digital assistant app wali screen se ye masla HAL NAHI HOTA"** —
  aap ki video ka sabak ab app ke andar likha hua hai
* ✍️ aur hamesha **likha hua manual raasta** bhi (koi button kaam na kare to)

---

## 3. 🎬 Aap ke phone par ab kya hoga (imaandari se)

1. 🗣️ button dabao → **Digital assistant screen NAHI khulegi.** Panel khulega:
   aap ki asli fehlist (`Google Go` assistant, `Gboard Go`, AiAi ❌, poori Google app ❌).
2. Panel saaf kahega: **offline wake is phone par mumkin nahi** — kyunki pack download
   karne wala ghar hi nahi. Ye **Maya ka bug nahi, phone ki had hai** — aur ab aap ko
   pata chalega, andhere mein nahi.
3. Wake phir bhi chalegi — **online** recognizer se (internet par). Behtar natija:
   `⚙️ Settings → STT = English (India)` rakho, aur **"Maya"** saaf bolo.
4. Agar aap offline chahte ho: **poora Gboard + "Speech Recognition & Synthesis"**
   (Play Store) install karo → panel khud naye darwaze bana lega (dobara button dabao).
5. Har button ab **screen ka naam** batata hai — *"✅ Khuli: Settings$VoiceInputSettingsActivity"*
   ya *"❌ is phone par wo screen maujood nahi"*. Chup-chaap galat screen **kabhi nahi**.

---

## 4. 🧪 Saboot

`npm test` = **1123/1123 PASS** (v5.10.0 par 1081 tha → **+42**)

| Suite | Pehle | Ab |
|---|---|---|
| CSS check | ✓ | ✓ |
| settings-ui | 84 | **95** (+11: Section 13 — asli DOM mein panel + button click) |
| voice | 294 | 294 |
| brain | 155 | 155 |
| lab | 548 | **579** (+31: Section 28a/b/c/d) |

Naye test kya lock karte hain:

* **28a (Kotlin):** `<queries>` maujood · `go()` poochh kar kholta hai aur naam wapas deta
  hai · purana `openSetting()` salamat · `onDeviceMap()` RecognitionService + assistant ka
  naam deta hai · **purani andhi chain MITA di gayi** · assistant screen seedhi se bahar ·
  purane darwaze (battery/tts/voice/input) salamat
* **28b (JS):** aap ke phone jaisi fehlist par panel · Gboard nahi to jhoota button nahi ·
  Gboard Go ka alag sach · AiAi+Google par "namumkin" wali baat nahi · **purani APK
  (bina bridge)** par bhi panel chalta hai · **kharab JSON par crash nahi**
* **28c:** 🩺 doctor ki nasihat ab panel ka rasta batati hai (jhoota `[ON-DEVICE]` hawala phir nahi)
* **ui-13:** poori page boot kar ke — `labOnDeviceBox` · button click · bridge ka naam wapas
  · screen na khuli to *"maujood nahi"* + manual raasta **mehfooz** (toast 2 sec mein urr jata hai)

**Kotlin compile — CI ne teen galtiyaan PAKDI, aur wo theek kar di gayin:**

Pehle main ne socha ke CI khud toota hua hai (har run par `Restore Gradle distribution
8.7 failed: Error: Cache service responded with 400` aa raha tha). **Wo RED HERRING tha** —
gradle chala tha, aur `:app:compileDebugKotlin` 1m16s mein FAIL hua tha. Asal log
(sandbox se blob download nahi ho raha tha) nikala to ye mila:

```
e: …/MainActivity.kt:1368:37 Unresolved reference: ACTION_ASSISTANT_SETTINGS
e: …/MainActivity.kt:1369:44 Unresolved reference: ACTION_MANAGE_DEFAULT_ASSISTANT
e: …/MainActivity.kt:1436:83 Type mismatch: inferred type is MainActivity.MayaBridge but Context was expected
```

| Galti | Wajah | Ilaj |
|---|---|---|
| `Settings.ACTION_ASSISTANT_SETTINGS` | Aisa koi **public constant hai hi nahi** (na `ACTION_MANAGE_DEFAULT_ASSISTANT`) | AOSP ka asal action **string literal**: `"android.settings.MANAGE_DEFAULT_APPS_SETTINGS"` — literal hamesha compile hota hai, phone par na mile to `go()` saaf `null` deta hai |
| `isOnDeviceRecognitionAvailable(this)` | `this` = **MayaBridge** (inner class), Context nahi | `this@MainActivity` |
| *(sath nikla latent bug)* `if (SDK_INT >= 31)` | Method **API 33** se hai → API 31/32 par `NoSuchMethodError`, jo `Error` hai, `Exception` **nahi** → `catch (Exception)` pakadta nahi → **bridge crash** | Dono jagah guard `>= 33` + `catch (e: Throwable)` (ye `micDoctor()` mein v5.10.0 se pehle se tha — ab pakda gaya) |
| *(bonus)* `act(ACTION_APPLICATION_DETAILS_SETTINGS, pkg)` | App-info screen ko `setPackage` nahi, **`package:` data URI** chahiye → rung bekaar jata | `Intent(action, Uri.parse("package:$GBOARD"))` |

**Natija:** commit `e33b28a` par CI **✅ GREEN** — run `33663584197`, step *"4. APK BUILD"*
success, aur **MAYA-APK** artifact ban gayi (download: run ke page par). Yani v5.10.1 ka
Kotlin compile ho gaya — ab ye saboot par hi likha ja raha hai, andaze par nahi.

Charo galtiyaan ab **test mein lock** hain — Section **28d**: *"jo Settings constants public API
mein hain hi nahi wo dobara na aayen"*, *"bridge ke andar `this` Context nahi"*, *"guard 33 +
catch Throwable"*, *"app-info ko data URI"*. Yani agli dafa koi wahi galti likhe to test pehle
bol dega, CI nahi.

**Note:** `.github/workflows/build-apk.yml` ko sakht banane ka patch
([`docs/CI-FIX-gradle-cache-400.patch`](CI-FIX-gradle-cache-400.patch)) taiyar hai — us se build
ka log **artifact** ban jata (aaj wo log nikalne ke liye proxy se blob uthana para). Magar
Arena ke GitHub App ke paas `workflows` permission nahi, is liye main use push nahi kar sakta:
`refusing to allow a GitHub App to create or update workflow … without 'workflows' permission`.
Ye **optional** hai — build khud us ke bagair bhi chal jata hai.

## 5. Kya NAHI badla

* 🕸️ KHUD-MUKHTAR (v5.10.0, P6) — bilkul salamat, switch ab bhi **default OFF**
* `WakeWordService.kt` — ek line nahi chhui (wake ka faisla JS mein, P7 ka usool)
* Purani APK ke sath JS chal jata hai — `onDeviceMap`/`openSettingNamed` na hon to
  panel khud keh deta hai *"ye APK purani hai"* aur likha hua raasta dikhata hai
