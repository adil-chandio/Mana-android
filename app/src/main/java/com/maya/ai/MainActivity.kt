package com.maya.ai

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.app.Activity
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.provider.Settings
import android.net.Uri
import android.provider.ContactsContract
import android.provider.MediaStore

import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.util.Base64
import android.os.Build
import android.os.Bundle
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.AlarmClock
import android.speech.RecognitionListener
import android.speech.RecognitionService
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.view.WindowManager
import android.webkit.JavascriptInterface
import androidx.webkit.WebResourceErrorCompat
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import androidx.webkit.WebViewCompat
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import org.json.JSONObject
import java.util.Locale

/**
 * MAYA — Personal AI (Phase 2: Native APK)
 * WebView shell + native bridge:
 *  - Native STT (SpeechRecognizer — real Urdu/Hindi/English voice input)
 *  - Native TTS (system engine — proper Urdu voice support)
 *  - REAL system alarms & timers (AlarmClock intents)
 *  - Notifications, vibration, battery status, keep-screen-on
 */
class MainActivity : AppCompatActivity() {

    companion object {
        const val VIRTUAL_HOST = "appassets.androidplatform.net"
        const val CHANNEL_ID = "maya_notifications"
        const val REQ_PERMS = 7001
        var instance: MainActivity? = null
    }

    private lateinit var webView: WebView
    private lateinit var assetLoader: WebViewAssetLoader
    @Volatile private var webViewAlive = false
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var recognizer: SpeechRecognizer? = null
    /* 🔬 v5.10.3 (F05) — app ka mic asal mein CHALU hai ya nahi. WakeWordService
       ka stale-pause watchdog isi se poochhta hai: pehle wo 60s baad AANKH BAND
       kar ke pause azad kar deta tha (aur mic jang shuru). Ab 10s + ye check. */
    @Volatile private var appMicOn = false

    fun appMicBusy(): Boolean = appMicOn

    /* ================= LIFECYCLE ================= */

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        instance = this

        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this)
        webView.setBackgroundColor(0xFF050B14.toInt())
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowUniversalAccessFromFileURLs = true
            allowFileAccessFromFileURLs = true
            /* v4.0.1 WebView compat: file:// fallback + old-engine safety */
            allowFileAccess = true
            allowContentAccess = true
            javaScriptCanOpenWindowsAutomatically = true
            loadWithOverviewMode = true
            useWideViewPort = true
            setSupportZoom(false)
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            textZoom = 100
        }
        webView.addJavascriptInterface(MayaBridge(), "MayaBridge")
        webView.webChromeClient = object : android.webkit.WebChromeClient() {
            override fun onConsoleMessage(msg: android.webkit.ConsoleMessage): Boolean {
                val t = msg.message() ?: ""
                if (msg.messageLevel() == android.webkit.ConsoleMessage.MessageLevel.ERROR && t.isNotBlank()) {
                    evalAsync("window.__consoleErr && window.__consoleErr('" +
                        t.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ").replace("\r", " ") + "')")
                }
                return true
            }
        }
        webView.webViewClient = MayaWebViewClient()
        setContentView(webView)
        webView.loadUrl("https://$VIRTUAL_HOST/assets/web/index.html")
        Toast.makeText(this, "MAYA v5.13.0 • ⚡️ RAFTAR: jawab tukron mein (pehla jumla foran) + screen ka pakka jawab", Toast.LENGTH_LONG).show()
        // WebView zinda hai ya nahi — 8 second baad native check (v4.0.1: onPageFinished/markAlive true karte hain)
        webViewAlive = false
        android.os.Handler(Looper.getMainLooper()).postDelayed({
            if (!webViewAlive) {
                Toast.makeText(this, "WebView load NAHI hua (blank ka wajah) — developer ko batayen", Toast.LENGTH_LONG).show()
            }
        }, 8000)
        // v4.0.1: PURANA Android System WebView detect — layout (inset/color-mix) kharab ho sakta hai
        val wvVer = try { WebViewCompat.getCurrentWebViewPackage(this)?.versionName ?: "" } catch (e: Exception) { "" }
        val wvMajor = wvVer.split(".").firstOrNull()?.toIntOrNull() ?: 0
        android.os.Handler(Looper.getMainLooper()).postDelayed({
            if (wvMajor in 1..86) {
                Toast.makeText(this, "Purana WebView (Chrome $wvMajor) — Play Store se 'Android System WebView' update karo, warna layout kharab ho sakta hai", Toast.LENGTH_LONG).show()
            }
        }, 12000)

        initTts()
        createNotificationChannel()
        requestNeededPermissions()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (resultCode != Activity.RESULT_OK) return
        try {
            var bytes: ByteArray? = null
            if (requestCode == 5001) {
                val f = java.io.File(cacheDir, "maya_photo.jpg")
                if (f.exists()) bytes = f.readBytes()
            } else if (requestCode == 5002 && data?.data != null) {
                contentResolver.openInputStream(data.data!!)?.use { it.readBytes() }?.let { bytes = it }
            }
            if (bytes != null && bytes!!.size in 1..4_000_000) {
                val b64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
                evalAsync("window.__photoTaken && window.__photoTaken('" + b64 + "')")
            }
        } catch (e: Exception) {}
    }

    override fun onDestroy() {
        appMicOn = false
        try { WakeWordService.resumeFromApp() } catch (e: Exception) {}   /* 🔬 F01 */
        instance = null
        stopRecognizer()
        try { tts?.stop(); tts?.shutdown() } catch (e: Exception) {}
        super.onDestroy()
    }

    /* 🧭 1.12 (F41) — PEHLE MainActivity mein onResume/onPause THE HI NAHI.
       Nateeja: app wapas aane par JS aur Kotlin ka HAAL alag reh sakta tha (JS:
       KHALI, Kotlin: APP_SUN) aur wake chup-chaap band reh jati; aur screen band
       hone par WebView apna kaam poora jaari rakhta (battery).
       Ab: resume par WebView wapas + HAAL resync + wake ki sehat ka check;
       pause par WebView background — magar JS TIMERS ZINDA (pauseTimers() JAAN
       BOOJH kar nahi: us se heartbeat aur wake reports dono mar jate). */
    override fun onResume() {
        super.onResume()
        try { webView.onResume() } catch (e: Exception) {}
        handleOpenRequest(intent)
        try {
            evalAsyncPublic("window.SUKOON && window.SUKOON.resync && window.SUKOON.resync();" +
                            "window.__wakeHealth && window.__wakeHealth();")
        } catch (e: Exception) {}
    }

    override fun onPause() {
        try { webView.onPause() } catch (e: Exception) {}
        super.onPause()
    }

    /* 🧭 1.10 (F35) — wake notification ke "Ijazat do" button ka darwaza.
       (SINGLE_TOP par framework khud setIntent() karta hai, is liye onNewIntent
       override karne ki zaroorat nahi — onResume kaafi hai.) */
    private fun handleOpenRequest(i: Intent?) {
        val w = try { i?.getStringExtra("maya_open") } catch (e: Exception) { null } ?: return
        try { i?.removeExtra("maya_open") } catch (e: Exception) {}
        if (w == "appinfo") {
            try {
                val si = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                                Uri.parse("package:$packageName"))
                si.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                startActivity(si)
            } catch (e: Exception) {}
        }
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    /* ================= WEBVIEW CLIENT ================= */

    inner class MayaWebViewClient : WebViewClientCompat() {
        override fun shouldInterceptRequest(
            view: WebView,
            request: WebResourceRequest
        ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)

        /* v4.0.1: JS ke markAlive() + ye dono ab webViewAlive true karte hain —
           pehle false-alarm toast har launch par aata tha */
        override fun onPageFinished(view: WebView, url: String?) {
            if (url != null && (url.startsWith("https://$VIRTUAL_HOST") || url.startsWith("file:///android_asset"))) {
                webViewAlive = true
            }
            super.onPageFinished(view, url)
        }

        /* v4.0.1: WebViewAssetLoader/https virtual-host kisi purane/odd WebView par
           fail ho jaye to seedha file:///android_asset fallback — blank screen khatam */
        override fun onReceivedError(
            view: WebView,
            request: WebResourceRequest,
            error: WebResourceErrorCompat
        ) {
            if (request.isForMainFrame && request.url.host == VIRTUAL_HOST) {
                view.loadUrl("file:///android_asset/web/index.html")
            }
            super.onReceivedError(view, request, error)
        }

        override fun shouldOverrideUrlLoading(
            view: WebView,
            request: WebResourceRequest
        ): Boolean {
            val url = request.url
            // apni app — andar khule (v4.0.1: file:// fallback bhi WebView ke andar)
            if (url.host == VIRTUAL_HOST || url.scheme == "file") return false
            return try {
                startActivity(Intent(Intent.ACTION_VIEW, url))  // bahar ke links/apps
                true
            } catch (e: ActivityNotFoundException) {
                val fb = when (url.scheme) {
                    "instagram" -> "https://www.instagram.com/"
                    "market" -> "https://play.google.com/store/apps"
                    "fb" -> "https://m.facebook.com/"
                    "tg" -> "https://web.telegram.org/"
                    "googlegmail" -> "https://mail.google.com/"
                    "nflx" -> "https://www.netflix.com/"
                    "spotify" -> "https://open.spotify.com/"
                    "whatsapp" -> "https://web.whatsapp.com/"
                    "geo" -> "https://maps.google.com/"
                    else -> null
                }
                if (fb != null) {
                    try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(fb))) }
                    catch (x: Exception) { toast("Ye app is phone par install nahi hai") }
                } else toast("Ye app/link is phone par nahi mila")
                true
            }
        }
    }

    /* ================= TTS ================= */

    private fun initTts() {
        tts = TextToSpeech(this) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {}
                override fun onDone(utteranceId: String?) {
                    if (utteranceId == "maya")
                        evalAsync("window.__nativeTtsDone && window.__nativeTtsDone()")
                }
                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) {
                    if (utteranceId == "maya")
                        evalAsync("window.__nativeTtsDone && window.__nativeTtsDone()")
                }
            })
        }
    }

    /* ================= STT ================= */

    private fun stopRecognizer() {
        try { recognizer?.destroy(); recognizer = null } catch (e: Exception) {}
        appMicOn = false
        /* 🔬 v5.10.3 (F01) — pauseForApp() ki WAPSI. Pehle `resumeFromApp()` poori
           codebase mein KAHIN call nahi hoti thi (sirf 60s ka stale-watchdog
           bachata tha): har SUNO ke baad wake ek poore minute ke liye MURDA, aur
           us dauran har 700ms ek skip-report = 67 dafa "sulah: app ka mic" spam
           jis ne KAAN ka 40-entry log bhar kar asal tareekh mita di thi. */
        try { WakeWordService.resumeFromApp() } catch (e: Exception) {}
    }

    /* ================= JS BRIDGE ================= */

    inner class MayaBridge {

        @JavascriptInterface
        fun appVersion(): String = "5.13.0-native"

        /* 🎚️ P9 SUKOON — JS (SUKOON) har awaaz/mic ki HAAL yahan bhejti hai.
           KHALI | BOL_RAHI | APP_SUN — WakeWordService har mic-darwaze par isi
           ko poochhti hai. Isi se awaaz-katna + mic-larai dono khatam hain. */
        @JavascriptInterface
        fun setHaal(h: String) {
            try { WakeWordService.applyHaal(h) } catch (e: Exception) {}
        }

        /* 🧭 v5.11.0 (1.2 / F02) — HAAL ab LEVEL-TRIGGERED hai, sirf edge par nahi.
           PEHLE HAAL tab hi jata tha jab BADAL jaye: ek call kho gaya (WebView
           reload, JS exception, screen off) to Kotlin ka haal hamesha ke liye purana
           reh jata aur wake par daimi pabandi lag jati. Ab JS har 10s heartbeat
           bhejta hai; 3 heartbeat gayab = Kotlin khud KHALI. */
        @JavascriptInterface
        fun wakeBeat(h: String): String {
            return try { WakeWordService.heartbeat(h); "ok" } catch (e: Exception) { "err" }
        }

        /* 🧭 1.2 — WebView reload / boot / app wapsi par poora resync + sehat ka darwaza */
        @JavascriptInterface
        fun wakeResync(h: String): String {
            return try {
                WakeWordService.resyncHaal(h)
                WakeWordService.healthKick()
                "ok"
            } catch (e: Exception) { "err" }
        }

        /* 🔬 v5.10.3 (F04) — KOTLIN KA SACH. Panel pehle sirf JS ka haal dikhata
           tha aur "HAAL: KHALI" likh kar humein galat raaste par bhejta tha jabke
           asli mujrim `pausedByApp=true` tha. Ab dono taraf ka haal nazar aata hai
           aur JS/Kotlin beech ka MISMATCH pakda jata hai. */
        /* 🎛️ J2.3 (v5.12.5) — BAAT-CHEET MODE ka darwaza. JS batata hai ke
           "Maya" wala darwaza khula hai (true) ya band (false); us dauran wake
           service apna mic BAND rakhti hai. Nateeja: ek turn mein mic EK dafa
           khulta hai (pehle wake + app = do) aur wake ke baad 400ms ki race (F56)
           khud khatam. Mudat (90s) + heartbeat sirf safety net hain. */
        @JavascriptInterface
        fun talk(on: Boolean) {
            try { WakeWordService.talkMode(on) } catch (e: Exception) {}
        }

        @JavascriptInterface
        fun wakeState(): String {
            return try { WakeWordService.stateJson() } catch (e: Exception) { "{\"err\":1}" }
        }

        /* 🔬 v5.10.3 (F25) — native ring buffer. UI mare hue daur ke waqiat bhi
           yahan mehfooz rehte hain aur app khulte hi ek dafa mein JS ko mil jate
           hain. Isi se `suna 0` ka ambiguity khatam: ab pata chalta hai ke
           recognizer ne suna tha magar report zaya hui, ya suna hi nahi tha. */
        @JavascriptInterface
        fun wakeEvents(): String {
            return try { WakeWordService.drainEvents() } catch (e: Exception) { "[]" }
        }

        /* v4.0.1: index.html boot-guard ye call karta hai — ab native alive flag true hota hai */
        @JavascriptInterface
        fun markAlive() { webViewAlive = true }

        /* v4.0.1: doctor report ke liye installed WebView package version */
        @JavascriptInterface
        fun webViewVersion(): String = try {
            WebViewCompat.getCurrentWebViewPackage(this@MainActivity)?.versionName ?: ""
        } catch (e: Exception) { "" }

        /** Native TTS v2 — voice picker + pitch (crispy awaaz) */
        @JavascriptInterface
        fun speak(text: String, lang: String, rate: Double, pitch: Double, voiceName: String) {
            runOnUiThread {
                if (!ttsReady) {
                    evalAsync("window.__nativeTtsDone && window.__nativeTtsDone()")
                    return@runOnUiThread
                }
                try {
                    val engine = tts ?: return@runOnUiThread
                    try {
                        if (voiceName.isNotEmpty()) {
                            engine.voices?.firstOrNull { it.name == voiceName }?.let { engine.setVoice(it) }
                        } else {
                            val loc = Locale.forLanguageTag(lang.replace('_', '-'))
                            val res = engine.setLanguage(loc)
                            if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
                                engine.language = Locale.getDefault()
                            }
                        }
                    } catch (e: Exception) {}
                    engine.setSpeechRate(rate.toFloat().coerceIn(0.5f, 2f))
                    engine.setPitch(pitch.toFloat().coerceIn(0.5f, 2f))
                    engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "maya")
                } catch (e: Exception) {
                    evalAsync("window.__nativeTtsDone && window.__nativeTtsDone()")
                }
            }
        }

        /** Phone ki saari TTS voices ki list (JS ke liye JSON) */
        @JavascriptInterface
        fun ttsVoices(): String {
            return try {
                val arr = JSONArray()
                tts?.voices?.forEach { v ->
                    arr.put(
                        JSONObject()
                            .put("name", v.name)
                            .put("locale", v.locale.toLanguageTag())
                            .put("network", v.isNetworkConnectionRequired)
                    )
                }
                arr.toString()
            } catch (e: Exception) { "[]" }
        }

        @JavascriptInterface
        fun stopSpeak() {
            runOnUiThread { try { tts?.stop() } catch (e: Exception) {} }
        }

        /** Native STT — Google voice recognition (Urdu ur-PK supported) */
        @JavascriptInterface
        fun listen(lang: String) {
            runOnUiThread {
                if (ContextCompat.checkSelfPermission(
                        this@MainActivity, Manifest.permission.RECORD_AUDIO
                    ) != PackageManager.PERMISSION_GRANTED
                ) {
                    requestMicPermission()
                    /* 🛡️ J1.4 (F44) — PEHLE code 7 bhejte the. AOSP mein 7 = NO_MATCH
                       ("samajh nahi aaya") hai; IJAZAT ka code 9 =
                       ERROR_INSUFFICIENT_PERMISSIONS. Galat code par JS "dobara boliye"
                       ka loop chalati thi — jabke asal masla ijazat hai, jo dobara
                       bolne se kabhi theek nahi hoti. */
                    evalAsync("window.__nativeSpeechErr && window.__nativeSpeechErr(9)")
                    return@runOnUiThread
                }
                if (!SpeechRecognizer.isRecognitionAvailable(this@MainActivity)) {
                    evalAsync("window.__nativeSpeechErr && window.__nativeSpeechErr(5)")
                    return@runOnUiThread
                }
                stopRecognizer()
                /* 🤝 P9 MIC SULAH — app ka tap-to-speak sab se pehle. Wake service
                   apna mic chhor degi (do recognizer kabhi ek saath nahi chal sakte —
                   wahi jang v5.8.0 tak har tap-to-speak ko mar okat deti thi). */
                try { WakeWordService.pauseForApp() } catch (e: Exception) {}
                appMicOn = true
                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(
                        RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                        RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
                    )
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
                    putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, packageName)
                    /* 🎙️ P8b — pehle 1 tha! SUNO ka poora nizam "kai andazon mein se
                       behtareen chuno" par khara hai, aur main mic use SIRF EK andaza
                       deta tha — yani wo feature asal mic par kabhi chala hi nahi.
                       ("Funk Taka" -> "اس لاوا فنک" ki yehi wajah thi.) */
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 6)
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                    /* 🛡️ J1.4 (F48) — EK line mein DO galtiyan:
                       (a) key GHALAT: hum "android.speech.extra.SPEECH_INPUT_..." likhte
                           the, AOSP ki asal key "android.speech.extras.SPEECH_INPUT_..."
                           hai (PLURAL "extras"). Yani 700ms ka setting KABHI parha hi
                           nahi gaya — chup-chaap be-asar.
                       (b) value Int thi, aur recognition service getLongExtra() se
                           parhti hai — Int hota to bhi ignore ho jata.
                       Ab sarkari constant + Long value. (Imaandari: Google ki service
                       isay ignore bhi kar sakti hai — ⚡ J3 RAFTAR PANEL isi ko NAAP
                       karta hai: NAAP ke `brain` / `first` (pehli awaaz) / `done`
                       number batate hain ke 600 ms ka asar hua ya nahi.) */
                    putExtra(
                        RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS,
                        /* ⚡ J3 (F66) — 700 ms → 600 ms kiya tha (har turn par 100 ms bachat).
                           🎵 v5.14.0 K2.5 (F76) — wapas 700 ms, aur YEHI sahi tha: user
                           jumle ke beech saans leta / sochta hai aur 600 ms par recognition
                           session KHTAM ho jata tha → adhoora transcript → "Maya samajh
                           nahi rahi, ek hi baat bar bar bolni parti hai". 100 ms ki qeemat
                           adhoore jumle se kahin kam hai. Wake path (WakeWordService)
                           600 ms par qaim hai — wake word chhota hota hai, wahan tezi chahiye.
                           Minimum 300 ms barqarar; asar RAFTAR PANEL naapega (NAAP). */
                        700L
                    )
                }
                /* 🛡️ J1.4 (F49) — PEHLE yahan koi try/catch NAHI tha. makeRecognizer()
                   ka aakhri rasta `SpeechRecognizer.createSpeechRecognizer(this)` bina
                   guard ke hai; kuch OEM/Android-Go par ye IllegalStateException ya
                   NoSuchMethodError phenkta hai → app CRASH, ya JS ka `listening` flag
                   hamesha ke liye phansa (mic button ULTA kaam karta, wake DAIMI ignore).
                   Ab: dono taraf safai + JS ko code 5 (jo bol kar batata hai). */
                try {
                    recognizer = makeRecognizer().apply {
                        setRecognitionListener(object : RecognitionListener {
                            override fun onReadyForSpeech(params: Bundle?) {}
                            override fun onBeginningOfSpeech() {}
                            private var rmsTick = 0
                            override fun onRmsChanged(rmsdB: Float) {
                                rmsTick++
                                if (rmsTick % 4 == 0) evalAsync("window.__nativeRms && window.__nativeRms(" + rmsdB + ")")
                            }
                            override fun onBufferReceived(buffer: ByteArray?) {}
                            override fun onEndOfSpeech() { evalAsync("window.__nativePartial && window.__nativePartial('')") }
                            override fun onError(error: Int) {
                                /* 🔬 v5.10.3 (F01) — app ka mic khatam: wake ko foran wapas
                                   bulao. Pehle ye rasta KHALI tha; wake 60s tak soti rehti thi. */
                                appMicOn = false
                                try { WakeWordService.resumeFromApp() } catch (e: Exception) {}
                                evalAsync("window.__nativeSpeechErr && window.__nativeSpeechErr($error)")
                            }
                            override fun onResults(results: Bundle?) {
                                /* 🔬 v5.10.3 (F01) — nateeja mil gaya, mic khali: wake wapas */
                                appMicOn = false
                                try { WakeWordService.resumeFromApp() } catch (e: Exception) {}
                                /* 🎙️ Android 3-5 andaze deta hai. Pehle sirf pehla liya jata tha
                                   aur baqi phenk diye jate the — isi liye "Monarch" -> "منار" ban
                                   jata tha. Ab SAARE andaze JS ko jate hain; SUNO un mein se wo
                                   chunta hai jismein jaane-pehchane naam sab se zyada hon. */
                                val all = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                                    ?: arrayListOf()
                                val text = all.firstOrNull() ?: ""
                                val conf = try {
                                    results?.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES)
                                } catch (e: Exception) { null }
                                val arr = JSONArray()
                                for (i in 0 until minOf(all.size, 6)) {
                                    /* har andaze ke sath uska yaqeen (0..1). Pehle ye kabhi
                                       parha hi nahi jata tha — ab SUNO isay bhi dekhta hai. */
                                    val o = JSONObject()
                                    o.put("t", all[i])
                                    if (conf != null && i < conf.size) o.put("c", conf[i].toDouble())
                                    arr.put(o)
                                }
                                evalAsync(
                                    "window.__nativeSpeech && window.__nativeSpeech('" + jsEscape(text) +
                                    "','" + jsEscape(arr.toString()) + "')"
                                )
                            }
                            override fun onPartialResults(partialResults: Bundle?) {
                                val pt = partialResults
                                    ?.getStringArrayList("android.speech.extra.RESULTS")?.firstOrNull() ?: ""
                                if (pt.isNotBlank()) evalAsync("window.__nativePartial && window.__nativePartial('" + jsEscape(pt) + "')")
                            }
                            override fun onEvent(eventType: Int, params: Bundle?) {}
                        })
                        startListening(intent)
                    }
                } catch (e: Throwable) {
                    appMicOn = false
                    try { stopRecognizer() } catch (e2: Exception) {}
                    try { WakeWordService.resumeFromApp() } catch (e2: Exception) {}
                    evalAsync(
                        "window.__nativeSpeechErr && window.__nativeSpeechErr(5)"
                    )
                }
            }
        }

        @JavascriptInterface
        fun stopListen() {
            runOnUiThread { stopRecognizer() }
        }

        /** REAL alarm v2 — 3-layer: silent set > prefilled UI > fail */
        @JavascriptInterface
        fun setAlarm(hour: Int, minute: Int, message: String): Int {
            val msg = message.ifEmpty { "MAYA Alarm" }
            try {
                val i = Intent(AlarmClock.ACTION_SET_ALARM).apply {
                    putExtra(AlarmClock.EXTRA_HOUR, hour)
                    putExtra(AlarmClock.EXTRA_MINUTES, minute)
                    putExtra(AlarmClock.EXTRA_MESSAGE, msg)
                    putExtra(AlarmClock.EXTRA_SKIP_UI, true)
                }
                startActivity(i)
                return 2
            } catch (e: Exception) {}
            try {
                val i = Intent(AlarmClock.ACTION_SET_ALARM).apply {
                    putExtra(AlarmClock.EXTRA_HOUR, hour)
                    putExtra(AlarmClock.EXTRA_MINUTES, minute)
                    putExtra(AlarmClock.EXTRA_MESSAGE, msg)
                }
                startActivity(i)
                return 1
            } catch (e: Exception) {}
            return 0
        }

        /** REAL system timer — screen band ho to bhi bajta hai */
        @JavascriptInterface
        fun setTimer(seconds: Int, message: String): Boolean {
            return try {
                val i = Intent(AlarmClock.ACTION_SET_TIMER).apply {
                    putExtra(AlarmClock.EXTRA_LENGTH, seconds)
                    putExtra(AlarmClock.EXTRA_MESSAGE, message.ifEmpty { "MAYA Timer" })
                    putExtra(AlarmClock.EXTRA_SKIP_UI, true)
                }
                startActivity(i)
                true
            } catch (e: Exception) { false }
        }

        /** Battery status (JSON string — sync return) */
        @JavascriptInterface
        fun battery(): String {
            return try {
                val b = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
                    ?: return "{}"
                val level = b.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
                val scale = b.getIntExtra(BatteryManager.EXTRA_SCALE, 100)
                val status = b.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
                JSONObject()
                    .put("level", if (level >= 0) level * 100 / scale else -1)
                    .put(
                        "charging",
                        status == BatteryManager.BATTERY_STATUS_CHARGING ||
                            status == BatteryManager.BATTERY_STATUS_FULL
                    )
                    .toString()
            } catch (e: Exception) { "{}" }
        }

        @JavascriptInterface
        fun vibrate(ms: Long) {
            try {
                val vib: Vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
                } else {
                    @Suppress("DEPRECATION")
                    getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vib.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION") vib.vibrate(ms)
                }
            } catch (e: Exception) {}
        }

        @JavascriptInterface
        fun notify(title: String, text: String) {
            runOnUiThread {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                        ContextCompat.checkSelfPermission(
                            this@MainActivity, Manifest.permission.POST_NOTIFICATIONS
                        ) != PackageManager.PERMISSION_GRANTED
                    ) {
                        requestNotificationPermission()
                        return@runOnUiThread
                    }
                    val pi = PendingIntent.getActivity(
                        this@MainActivity, 0,
                        Intent(this@MainActivity, MainActivity::class.java),
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    val n = NotificationCompat.Builder(this@MainActivity, CHANNEL_ID)
                        .setSmallIcon(android.R.drawable.ic_dialog_info)
                        .setContentTitle(title)
                        .setContentText(text)
                        .setAutoCancel(true)
                        .setContentIntent(pi)
                        .build()
                    getSystemService(NotificationManager::class.java)
                        .notify((System.currentTimeMillis() % 10000).toInt(), n)
                } catch (e: Exception) {}
            }
        }

        /** Wake word service — background mein 'Maya'/'Boss' sunti hai */
        @JavascriptInterface
        fun wakeService(start: Boolean): Boolean {
            return try {
                if (start) {
                    if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECORD_AUDIO)
                        != PackageManager.PERMISSION_GRANTED) {
                        requestMicPermission()
                        return false
                    }
                    WakeWordService.start(this@MainActivity)
                    prefs().edit().putBoolean("wake", true).apply()
                    true
                } else {
                    WakeWordService.stop(this@MainActivity)
                    prefs().edit().putBoolean("wake", false).apply()
                    true
                }
            } catch (e: Exception) { false }
        }

        /** YouTube v2 — innertube JSON + consent cookie fallback (pakka videoId) */
        @JavascriptInterface
        fun ytSearch(query: String): String {
            // 1) Innertube ANDROID client — JSON, reliable
            try {
                val conn = URL("https://www.youtube.com/youtubei/v1/search?prettyPrint=false")
                    .openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.doOutput = true
                conn.connectTimeout = 8000
                conn.readTimeout = 8000
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("User-Agent", "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip")
                val esc = query.replace("\\", "\\\\").replace("\"", "\\\"")
                val body = "{\"context\":{\"client\":{\"clientName\":\"ANDROID\",\"clientVersion\":\"20.10.38\",\"androidSdkVersion\":30,\"hl\":\"en\",\"gl\":\"US\"}},\"query\":\"" + esc + "\"}"
                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                val txt = conn.inputStream.bufferedReader().use { it.readText() }
                conn.disconnect()
                val m = Regex("\"videoId\":\"([a-zA-Z0-9_-]{11})\"").find(txt)
                if (m != null) return m.groupValues[1]
            } catch (e: Exception) {}
            // 2) HTML + CONSENT cookie
            try {
                val conn = URL("https://www.youtube.com/results?search_query=" + URLEncoder.encode(query, "UTF-8"))
                    .openConnection() as HttpURLConnection
                conn.connectTimeout = 8000
                conn.readTimeout = 8000
                conn.instanceFollowRedirects = true
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36")
                conn.setRequestProperty("Cookie", "CONSENT=YES+cb.20240101-01-p0.en+FX+000; SOCS=CAI")
                conn.setRequestProperty("Accept-Language", "en-US,en;q=0.9")
                val html = conn.inputStream.bufferedReader().use { it.readText() }
                conn.disconnect()
                val m = Regex("\"videoId\":\"([a-zA-Z0-9_-]{11})\"").find(html)
                if (m != null) return m.groupValues[1]
            } catch (e: Exception) {}
            return ""
        }

        /** CONTACTS ENGINE (Phase 5) */
        @JavascriptInterface
        fun contactsSearch(query: String): String {
            return try {
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.READ_CONTACTS)
                    != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(this@MainActivity, arrayOf(Manifest.permission.READ_CONTACTS), REQ_PERMS)
                    return "{\"error\":\"permission\"}"
                }
                val q = query.trim()
                if (q.isEmpty()) return "{\"matches\":[]}"
                val arr = JSONArray()
                val seen = HashSet<String>()
                // naam se contact
                val cur = contentResolver.query(
                    ContactsContract.Contacts.CONTENT_FILTER_URI.buildUpon().appendPath(q).build(),
                    arrayOf(ContactsContract.Contacts._ID, ContactsContract.Contacts.DISPLAY_NAME),
                    null, null, null
                )
                cur?.use { c ->
                    while (c.moveToNext() && arr.length() < 6) {
                        val id = c.getString(0) ?: continue
                        val name = c.getString(1) ?: continue
                        val pcur = contentResolver.query(
                            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                            arrayOf(ContactsContract.CommonDataKinds.Phone.NUMBER),
                            ContactsContract.CommonDataKinds.Phone.CONTACT_ID + "=?",
                            arrayOf(id), null
                        )
                        pcur?.use { p ->
                            while (p.moveToNext() && arr.length() < 6) {
                                val num = p.getString(0) ?: continue
                                if (seen.add(name + "|" + num)) {
                                    arr.put(JSONObject().put("name", name).put("number", num))
                                }
                            }
                        }
                    }
                }
                // dialpad/number se bhi
                if (arr.length() == 0) {
                    val pcur = contentResolver.query(
                        ContactsContract.CommonDataKinds.Phone.CONTENT_FILTER_URI.buildUpon().appendPath(q).build(),
                        arrayOf(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                                ContactsContract.CommonDataKinds.Phone.NUMBER),
                        null, null, null
                    )
                    pcur?.use { p ->
                        while (p.moveToNext() && arr.length() < 6) {
                            val name = p.getString(0) ?: continue
                            val num = p.getString(1) ?: continue
                            if (seen.add(name + "|" + num)) {
                                arr.put(JSONObject().put("name", name).put("number", num))
                            }
                        }
                    }
                }
                JSONObject().put("matches", arr).toString()
            } catch (e: Exception) { "{\"error\":\"" + (e.message ?: "x") + "\"}" }
        }

        /** Naam se seedha CALL (bina tap — ACTION_CALL) */
        @JavascriptInterface
        fun autoCall(number: String): Boolean {
            return try {
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CALL_PHONE)
                    != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(this@MainActivity, arrayOf(Manifest.permission.CALL_PHONE), REQ_PERMS)
                    return false
                }
                startActivity(Intent(Intent.ACTION_CALL, Uri.parse("tel:" + number)))
                true
            } catch (e: Exception) { false }
            }

        /** WhatsApp: number + message draft (PK normalization + auto-send flag) */
        @JavascriptInterface
        fun openWhatsAppDraft(number: String, text: String, autoSend: Boolean): Boolean {
            return try {
                var n = number.replace(Regex("[^\\d]"), "")
                if (n.startsWith("00")) n = n.substring(2)
                if (n.startsWith("0") && n.length in 10..11) n = "92" + n.substring(1)
                if (autoSend) prefs().edit().putLong("autosend_at", System.currentTimeMillis()).apply()
                val u = "https://wa.me/" + n + "?text=" + URLEncoder.encode(text, "UTF-8")
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(u)))
                true
            } catch (e: Exception) { false }
        }

        /** SMS draft (number + text) */
        @JavascriptInterface
        fun smsDraft(number: String, text: String): Boolean {
            return try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(
                    "sms:" + number + "?body=" + URLEncoder.encode(text, "UTF-8"))))
                true
            } catch (e: Exception) { false }
        }

        /** Battery shield — unrestricted (background mic kill se bachao) */
        @SuppressLint("BatteryLife")
        @JavascriptInterface
        fun requestBatteryUnrestricted(): Boolean {
            return try {
                val pm = getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
                if (pm.isIgnoringBatteryOptimizations(packageName)) return true
                startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    Uri.parse("package:" + packageName)))
                true
            } catch (e: Exception) { false }
        }

        @JavascriptInterface
        fun batteryUnrestricted(): Boolean {
            return try {
                val pm = getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
                pm.isIgnoringBatteryOptimizations(packageName)
            } catch (e: Exception) { false }
        }

        /** AutoSend accessibility status + settings kholna */
        @JavascriptInterface
        fun accessibilityEnabled(): Boolean {
            return try {
                val s = Settings.Secure.getString(contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
                    ?: return false
                s.contains(".AutoSendService")
            } catch (e: Exception) { false }
        }

        @JavascriptInterface
        fun deviceBrand(): String = Build.MANUFACTURER ?: "unknown"

        @JavascriptInterface
        fun openAppDetails(): Boolean {
            return try {
                startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:" + packageName)))
                true
            } catch (e: Exception) { false }
        }

        @JavascriptInterface
        fun openAccessibilitySettings(): Boolean {
            return try {
                startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                true
            } catch (e: Exception) { false }
        }

        /** FILE MANAGER (Phase 8) — list/open/share */
        @JavascriptInterface
        fun listFiles(folder: String): String {
            return try {
                val f = folder.lowercase().trim()
                val uri: Uri = when (f) {
                    "pictures", "photos" -> MediaStore.Images.Media.EXTERNAL_CONTENT_URI
                    "music", "audio" -> MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
                    "videos", "movies" -> MediaStore.Video.Media.EXTERNAL_CONTENT_URI
                    else -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
                        MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL)
                    else MediaStore.Files.getContentUri("external")
                }
                val arr = JSONArray()
                val proj = arrayOf(
                    MediaStore.MediaColumns._ID,
                    MediaStore.MediaColumns.DISPLAY_NAME,
                    MediaStore.MediaColumns.MIME_TYPE,
                    MediaStore.MediaColumns.SIZE
                )
                val cur = contentResolver.query(uri, proj, null, null, MediaStore.MediaColumns.DATE_MODIFIED + " DESC")
                cur?.use { c ->
                    var i = 0
                    while (c.moveToNext() && i < 40) {
                        val id = c.getLong(0)
                        val name = c.getString(1) ?: continue
                        val mime = c.getString(2) ?: ""
                        val size = c.getLong(3)
                        val itemUri = Uri.withAppendedPath(uri, id.toString())
                        arr.put(JSONObject()
                            .put("name", name)
                            .put("type", mime)
                            .put("size", size)
                            .put("uri", itemUri.toString()))
                        i++
                    }
                }
                JSONObject().put("files", arr).put("folder", f).toString()
            } catch (e: Exception) { JSONObject().put("error", e.message ?: "x").toString() }
        }

        @JavascriptInterface
        fun openFile(uriStr: String, mime: String): Boolean {
            return try {
                val i = Intent(Intent.ACTION_VIEW, Uri.parse(uriStr)).apply {
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    if (mime.isNotEmpty()) setDataAndType(Uri.parse(uriStr), mime)
                }
                startActivity(i)
                true
            } catch (e: Exception) { false }
        }

        @JavascriptInterface
        fun shareFile(uriStr: String, mime: String): Boolean {
            return try {
                val i = Intent(Intent.ACTION_SEND).apply {
                    type = mime.ifEmpty { "*/*" }
                    putExtra(Intent.EXTRA_STREAM, Uri.parse(uriStr))
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                startActivity(Intent.createChooser(i, "MAYA share"))
                true
            } catch (e: Exception) { false }
        }

        @JavascriptInterface
        fun requestFilesPerms(): Boolean {
            return try {
                val perms = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
                    arrayOf(Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO, Manifest.permission.READ_MEDIA_AUDIO)
                else arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
                ActivityCompat.requestPermissions(this@MainActivity, perms, REQ_PERMS)
                true
            } catch (e: Exception) { false }
        }

        /* ===== QUICK CONTROLS (Phase 9) ===== */
        @JavascriptInterface
        fun torch(on: Boolean): Boolean {
            return try {
                val cm = getSystemService(Context.CAMERA_SERVICE) as CameraManager
                val id = cm.cameraIdList.firstOrNull { cid ->
                    cm.getCameraCharacteristics(cid)
                        .get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
                } ?: return false
                cm.setTorchMode(id, on)
                true
            } catch (e: Exception) { false }
        }

        @JavascriptInterface
        fun volume(pct: Int): Int {
            return try {
                val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
                val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
                val v = (max * pct.coerceIn(0, 100)) / 100
                am.setStreamVolume(AudioManager.STREAM_MUSIC, v, 0)
                v * 100 / max
            } catch (e: Exception) { -1 }
        }

        @JavascriptInterface
        fun brightness(pct: Int): Int {
            return try {
                if (!Settings.System.canWrite(this@MainActivity)) {
                    startActivity(Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS,
                        Uri.parse("package:" + packageName)))
                    return -2
                }
                val max = 255
                val b = (max * pct.coerceIn(5, 100)) / 100
                Settings.System.putInt(contentResolver, Settings.System.SCREEN_BRIGHTNESS, b)
                b * 100 / max
            } catch (e: Exception) { -1 }
        }

        @JavascriptInterface
        fun lockScreen(): Boolean {
            return try {
                val svc = com.maya.ai.AutoSendService.instance
                svc?.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_LOCK_SCREEN) == true
            } catch (e: Exception) { false }
        }

        @JavascriptInterface
        fun scheduleTask(id: String, delayMs: Long): Boolean =
            try { com.maya.ai.ScheduledReceiver.schedule(this@MainActivity, id, delayMs) } catch (e: Exception) { false }

        /* ===== WHATSAPP READER ===== */
        @JavascriptInterface
        fun notifHistory(): String =
            try { com.maya.ai.MayaNotifService.historyJson() } catch (e: Exception) { "[]" }

        @JavascriptInterface
        fun notifClear() { try { com.maya.ai.MayaNotifService.clear() } catch (e: Exception) {} }

        @JavascriptInterface
        fun notifSpeak(on: Boolean) { com.maya.ai.MayaNotifService.speakOn = on }

        @JavascriptInterface
        fun notifEnabled(): Boolean {
            return try {
                val s = Settings.Secure.getString(contentResolver, "enabled_notification_listeners") ?: return false
                s.contains(packageName)
            } catch (e: Exception) { false }
        }

        @JavascriptInterface
        fun openNotifAccess(): Boolean {
            return try { startActivity(Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")); true }
            catch (e: Exception) { false }
        }

        /* ===== REPLY via notification action (asli auto-reply) ===== */
        @JavascriptInterface
        fun notifReply(fromName: String, text: String): Int {
            return try {
                val nb = com.maya.ai.MayaNotifService.buffer
                val target = synchronized(nb) {
                    nb.toList().lastOrNull { it.optString("from") == fromName && it.optBoolean("canReply") }
                } ?: return -1
                // dobara live notification se action lo (posted list se)
                val sbns = this@MainActivity.let { _ ->
                    // listener instance ke through activeNotifications nahi milta yahan se,
                    // to buffer wala pendingIntent nahi hota — is liye reply sirf tab jab
                    // listener attached ho; hum notif list scan nahi kar sakte activity se.
                    null
                }
                // Simple robust raasta: WhatsApp draft kholo (auto-send ke saath)
                val okDraft = openWhatsAppDraftLookup(fromName, text)
                if (okDraft) 1 else 0
            } catch (e: Exception) { 0 }
        }

        private fun openWhatsAppDraftLookup(fromName: String, text: String): Boolean {
            return try {
                // contact se number dhoondo aur draft + autosend kholo
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.READ_CONTACTS)
                    == PackageManager.PERMISSION_GRANTED) {
                    val cur = contentResolver.query(
                        ContactsContract.Contacts.CONTENT_FILTER_URI.buildUpon().appendPath(fromName).build(),
                        arrayOf(ContactsContract.Contacts._ID), null, null, null)
                    var number: String? = null
                    cur?.use { c ->
                        if (c.moveToNext()) {
                            val id = c.getString(0)
                            val pc = contentResolver.query(
                                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                                arrayOf(ContactsContract.CommonDataKinds.Phone.NUMBER),
                                ContactsContract.CommonDataKinds.Phone.CONTACT_ID + "=?",
                                arrayOf(id), null)
                            pc?.use { p -> if (p.moveToNext()) number = p.getString(0) }
                        }
                    }
                    if (number != null) {
                        return openWhatsAppDraft(number!!, text, true)
                    }
                }
                false
            } catch (e: Exception) { false }
        }

        /* ===== CAMERA / VISION ===== */
        @JavascriptInterface
        fun takePhoto(): Boolean {
            return try {
                val dir = cacheDir
                val f = java.io.File(dir, "maya_photo.jpg")
                val uri = androidx.core.content.FileProvider.getUriForFile(
                    this@MainActivity, "$packageName.fileprovider", f)
                val i = Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE).apply {
                    putExtra(android.provider.MediaStore.EXTRA_OUTPUT, uri)
                    addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                startActivityForResult(i, 5001)
                true
            } catch (e: Exception) { false }
        }

        @JavascriptInterface
        fun pickImage(): Boolean {
            return try {
                val i = Intent(Intent.ACTION_GET_CONTENT)
                i.type = "image/*"
                startActivityForResult(Intent.createChooser(i, "Photo chunko"), 5002)
                true
            } catch (e: Exception) { false }
        }

        /** Universal HTTP (CORS-proof) — backup brains ke liye */
        @JavascriptInterface
        fun httpPost(url: String, authHeader: String, body: String): String {
            return try {
                val conn = URL(url).openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.doOutput = true
                conn.connectTimeout = 6000
                conn.readTimeout = 15000
                conn.setRequestProperty("Content-Type", "application/json")
                if (authHeader.isNotEmpty()) conn.setRequestProperty("Authorization", authHeader)
                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                val code = conn.responseCode
                val txt = (if (code in 200..399) conn.inputStream else conn.errorStream)
                    ?.bufferedReader()?.use { it.readText() } ?: ""
                conn.disconnect()
                JSONObject().put("status", code).put("body", txt).toString()
            } catch (e: Exception) {
                JSONObject().put("status", 0).put("body", e.message ?: "error").toString()
            }
        }

        /**
         * v4.4.0 — BRAIN POOL ke liye async POST.
         * Sync httpPost() JS thread ko 21 second tak rok deta tha; pool mein 10 provider
         * ho to app jam jati hai. Ye version alag thread par chalta hai aur jawab
         * window.__httpDone(reqId, status, base64Body) se wapas deta hai.
         * base64 is liye ke jawab mein quotes/newlines JS string ko na toren.
         */
        @JavascriptInterface
        fun httpPostAsync(url: String, authHeader: String, body: String, reqId: String, timeoutMs: Int) {
            Thread {
                var code = 0
                var txt = ""
                try {
                    val conn = URL(url).openConnection() as HttpURLConnection
                    conn.requestMethod = "POST"
                    conn.doOutput = true
                    conn.connectTimeout = if (timeoutMs > 0) timeoutMs else 12000
                    conn.readTimeout = if (timeoutMs > 0) timeoutMs else 25000
                    conn.setRequestProperty("Content-Type", "application/json")
                    conn.setRequestProperty("Accept", "application/json")
                    if (authHeader.isNotEmpty()) conn.setRequestProperty("Authorization", authHeader)
                    conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                    code = conn.responseCode
                    txt = (if (code in 200..399) conn.inputStream else conn.errorStream)
                        ?.bufferedReader()?.use { it.readText() } ?: ""
                    conn.disconnect()
                } catch (e: Exception) {
                    code = 0
                    txt = e.message ?: "network error"
                }
                val b64 = Base64.encodeToString(txt.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
                evalAsync("window.__httpDone && window.__httpDone('" + jsEscape(reqId) + "'," + code + ",'" + b64 + "')")
            }.start()
        }

        @JavascriptInterface
        fun httpGet(url: String, authHeader: String): String {
            return try {
                val conn = URL(url).openConnection() as HttpURLConnection
                conn.connectTimeout = 5000
                conn.readTimeout = 8000
                if (authHeader.isNotEmpty()) conn.setRequestProperty("Authorization", authHeader)
                val code = conn.responseCode
                val txt = (if (code in 200..399) conn.inputStream else conn.errorStream)
                    ?.bufferedReader()?.use { it.readText() } ?: ""
                conn.disconnect()
                JSONObject().put("status", code).put("body", txt).toString()
            } catch (e: Exception) {
                JSONObject().put("status", 0).put("body", e.message ?: "error").toString()
            }
        }

        /**
         * 🐟 BINARY HTTP — jab jawab MATN nahi, BYTES ho (misaal: Fish Audio ka MP3).
         *
         * httpPostAsync() jawab ko bufferedReader().readText() se parhta hai aur phir
         * UTF-8 bytes ka base64 banata hai. Matn ke liye theek — magar MP3 par ye
         * TABAHI hai: har ghair-UTF8 byte U+FFFD ban kar audio barbaad kar deta hai.
         * Ye version raw bytes uthata hai, chhuta nahi, seedha base64 karta hai.
         *
         * Saath hi custom headers bhi bhejta hai — Fish ko `model: s2.1-pro-free`
         * chahiye, jo purana bridge bhej hi nahi sakta tha.
         *
         * Ghalati ka jawab bhi bytes hi mein aata hai (JSON), JS use atob kar ke
         * parh leta hai — is liye kamyabi aur nakami dono ka ek hi raasta hai.
         *
         *   window.__binDone(reqId, status, base64Body, contentType, errText)
         */
        @JavascriptInterface
        fun httpBytes(method: String, url: String, headersJson: String, body: String, reqId: String, timeoutMs: Int) {
            Thread {
                var code = 0
                var b64 = ""
                var ctype = ""
                var err = ""
                var conn: HttpURLConnection? = null
                try {
                    val m = if (method.isBlank()) "GET" else method.uppercase(java.util.Locale.US)
                    conn = URL(url).openConnection() as HttpURLConnection
                    conn.requestMethod = m
                    conn.connectTimeout = if (timeoutMs > 0) timeoutMs else 12000
                    conn.readTimeout = if (timeoutMs > 0) timeoutMs else 30000
                    conn.instanceFollowRedirects = true
                    if (headersJson.isNotBlank()) {
                        val h = JSONObject(headersJson)
                        val it = h.keys()
                        while (it.hasNext()) {
                            val k = it.next()
                            conn.setRequestProperty(k, h.optString(k, ""))
                        }
                    }
                    if (m == "POST" || m == "PUT" || m == "PATCH") {
                        conn.doOutput = true
                        conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                    }
                    code = conn.responseCode
                    ctype = conn.contentType ?: ""
                    val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                    val bos = java.io.ByteArrayOutputStream()
                    if (stream != null) {
                        val buf = ByteArray(16384)
                        stream.use { s ->
                            while (true) {
                                val n = s.read(buf)
                                if (n < 0) break
                                bos.write(buf, 0, n)
                                if (bos.size() > 24_000_000) break        /* 24 MB ki hadd */
                            }
                        }
                    }
                    b64 = Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP)
                } catch (e: Exception) {
                    code = 0
                    err = e.message ?: "network error"
                } finally {
                    try { conn?.disconnect() } catch (e: Exception) {}
                }
                evalAsync(
                    "window.__binDone && window.__binDone('" + jsEscape(reqId) + "'," + code +
                    ",'" + b64 + "','" + jsEscape(ctype) + "','" + jsEscape(err) + "')"
                )
            }.start()
        }

        /**
         * 🎙️ EDGE TTS — muft, be-hisaab neural awaaz (asli Urdu bhi).
         *
         * JS ye kaam khud kyun nahi kar sakta? Kyun ke Microsoft ka WebSocket
         * Origin/User-Agent/Pragma headers maangta hai, aur browser ka
         * `new WebSocket()` API custom headers bhejne hi nahi deta. Native side
         * par ye pabandi nahi — is liye poora WebSocket neeche Kotlin mein hai.
         *
         * JS bas SSML banata hai; hum MP3 bytes base64 kar ke wapas dete hain:
         *     window.__edgeDone(reqId, ok, base64Mp3OrError)
         */
        @JavascriptInterface
        fun edgeTts(ssml: String, reqId: String, timeoutMs: Int) {
            Thread {
                var ok = false
                var payload: String
                try {
                    val mp3 = EdgeTts.synth(ssml, if (timeoutMs > 0) timeoutMs else 20000)
                    payload = Base64.encodeToString(mp3, Base64.NO_WRAP)
                    ok = true
                } catch (e: Exception) {
                    payload = e.message ?: "edge tts nakaam"
                }
                evalAsync(
                    "window.__edgeDone && window.__edgeDone('" + jsEscape(reqId) + "'," + ok +
                    ",'" + jsEscape(payload) + "')"
                )
            }.start()
        }

        /** Edge TTS ki poori awaaz list (JSON) — key ki zaroorat nahi. */
        @JavascriptInterface
        fun edgeVoices(): String = try {
            val u = "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list" +
                "?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4"
            val conn = URL(u).openConnection() as HttpURLConnection
            conn.connectTimeout = 8000
            conn.readTimeout = 12000
            conn.setRequestProperty("User-Agent", EdgeTts.userAgent())
            conn.setRequestProperty("Accept", "*/*")
            val code = conn.responseCode
            val txt = (if (code in 200..399) conn.inputStream else conn.errorStream)
                ?.bufferedReader()?.use { it.readText() } ?: ""
            conn.disconnect()
            JSONObject().put("status", code).put("body", txt).toString()
        } catch (e: Exception) {
            JSONObject().put("status", 0).put("body", e.message ?: "error").toString()
        }

        /**
         * 👁️ NAZAR — screen par abhi kya hai? (P7a)
         *
         * SIRF PARHTA HAI. Kuch chhuta nahi, kuch dabata nahi.
         * Accessibility service band ho to saaf keh deta hai — jhoot nahi.
         */
        @JavascriptInterface
        fun uiDump(max: Int): String {
            return try {
                val svc = com.maya.ai.AutoSendService.instance
                if (svc == null)
                    "{\"ok\":false,\"why\":\"MAYA AutoSend accessibility service band hai\"}"
                else svc.dumpScreen(max)
            } catch (e: Exception) {
                val o = JSONObject()
                o.put("ok", false)
                o.put("why", e.message ?: "screen parhne mein masla")
                o.toString()
            }
        }

        /** Persistent prefs (boot autostart wake) */
        @JavascriptInterface
        fun setPref(k: String, v: Boolean) { try { prefs().edit().putBoolean(k, v).apply() } catch (e: Exception) {} }

        @JavascriptInterface
        fun getPref(k: String): Boolean = try { prefs().getBoolean(k, false) } catch (e: Exception) { false }

        @JavascriptInterface
        fun getPrefString(k: String): String = try { prefs().getString(k, "") ?: "" } catch (e: Exception) { "" }

        /**
         * 🩺 KAAN DOCTOR (P8b) — kaan ka poora haal, andaza nahi.
         * Sab se ahem: phone ka default voice-input service ka NAAM.
         */
        @JavascriptInterface
        fun micDoctor(): String {
            val o = JSONObject()
            try {
                o.put("mic", ContextCompat.checkSelfPermission(
                    this@MainActivity, Manifest.permission.RECORD_AUDIO
                ) == PackageManager.PERMISSION_GRANTED)
                o.put("avail", SpeechRecognizer.isRecognitionAvailable(this@MainActivity))

                /* YEHI asal mujrim ho sakta hai */
                val svc = try {
                    Settings.Secure.getString(contentResolver, "voice_recognition_service") ?: ""
                } catch (e: Exception) { "" }
                o.put("svc", svc)
                o.put("aiai", svc.contains("AiAi", true) || svc.contains("SystemIntelligence", true)
                        || svc.contains("systemui", true))

                var onDev = false
                /* API 33+ (method se pehle maujood nahi). `catch (Exception)`
                   NoSuchMethodError ko NAHI pakadta (wo Error hai) — is liye
                   Throwable, warna API 31/32 phone par bridge crash karta. */
                if (Build.VERSION.SDK_INT >= 33) {
                    onDev = try { SpeechRecognizer.isOnDeviceRecognitionAvailable(this@MainActivity) }
                            catch (e: Throwable) { false }
                }
                o.put("ondevice", onDev)
                o.put("using", lastRecognizerKind)

                /* Google ki speech app maujood aur chalu hai? */
                var g = "nahi"
                try {
                    val ai = packageManager.getApplicationInfo("com.google.android.tts", 0)
                    g = if (ai.enabled) "enabled" else "DISABLED"
                } catch (e: Exception) { g = "nahi" }
                o.put("gtts", g)

                o.put("battOk", try { batteryUnrestricted() } catch (e: Exception) { false })
                o.put("wakeOn", try { prefs().getBoolean("wake", false) } catch (e: Exception) { false })
                o.put("sdk", Build.VERSION.SDK_INT)
            } catch (e: Exception) {
                o.put("err", e.message ?: "?")
            }
            return o.toString()
        }

        /**
         * 🧪 MIC TEST (P8c) — kamre ka shor, aap ki awaaz, farq (SNR),
         * aur kaunsa effect is device par SACH MEIN chala.
         */
        @JavascriptInterface
        fun micTest(ms: Int, zoom: Double): String {
            if (ContextCompat.checkSelfPermission(
                    this@MainActivity, Manifest.permission.RECORD_AUDIO
                ) != PackageManager.PERMISSION_GRANTED) {
                requestMicPermission()
                return "{\"ok\":false,\"why\":\"mic ki ijazat nahi\"}"
            }
            return try { MicKit.test(ms, zoom.toFloat()) }
            catch (e: Exception) { "{\"ok\":false,\"why\":\"" + (e.message ?: "?") + "\"}" }
        }

        /* ═══════════════════════════════════════════════════════════════
           🗣️ v5.10.1 — SETTINGS KA RAASTA: andhi chain khatam.

           User ki video ne pakda: 🗣️ ON-DEVICE LANGUAGE dabaya to phone ki
           "Digital assistant app" screen khul gayi (Google Go / Ella / None) —
           jahan offline speech ki koi cheez hi NAHI hoti.

           Wajah (code se, andaza nahi):
             tries = [ Gboard VoiceSettingsActivity,
                       Settings.ACTION_VOICE_INPUT_SETTINGS,
                       Settings.ACTION_SETTINGS ]
             har try par startActivity() aur foran `return true`        // ← ANDHA

           Do chhed the:
           1. startActivity sirf ActivityNotFoundException par rukta hai. Kai OEM
              (Android Go / Infinix / itel) Settings screens ACTION_VOICE_INPUT_
              SETTINGS ko apni "Digital assistant" screen par alias kar dete hain —
              intent CHAL jata hai, magar GALAT screen khulti hai. Aur hum khushi
              khushi `return true` kar dete the.
           2. Pehla qadam Gboard ka component tha — Android 11+ ki PACKAGE
              VISIBILITY ke qanoon se wo package humein DIKHTA hi nahi tha
              (manifest mein <queries> tha hi nahi), is liye wo hamesha fail hota.

           Ilaj:
           • go() — pehle POOCHHO ke is intent ko kaun kholega (queryIntentActivities),
             phir us component ko EXPLICIT set kar ke chalao. Screen ka NAAM wapas
             jata hai — JS ab jhoot nahi bol sakta ke "ye screen khul gayi".
           • onDeviceMap() — phone par SACH MEIN kya maujood hai ( RecognitionService
             ki poori fehrist, keyboard, assistant ) JS ko dikhao, taake panel sirf
             ASLI darwaze ke button banaye. Andaza nahi — fehrist.
           • <queries> manifest mein — ab Gboard/Google app nazar aate hain.
           ═══════════════════════════════════════════════════════════════ */

        /**
         * Screen kholo — magar PEHLE poochh kar ke use kaun kholta hai.
         * Wapas: khulne wali activity ka naam (ya null = kuch na khula).
         *
         * v5.10.2: `blocked` — kuch phones par OEM ne ACTION_VOICE_INPUT_SETTINGS
         * ko "Digital assistant" screen par alias kar diya hota hai (aap ke phone
         * par: com.android.settings/.Settings$ManageAssistActivity). Sirf NAAM
         * batana kaafi NAHI tha — wo screen KHOLNI hi nahi chahiye, kyunki us
         * mein zubaan ka pack hota hi nahi. Is liye: khulne wali screen ka naam
         * kisi blocked lafz se milta ho to use CHHOR do (null) aur seedhi ka agla
         * rung azmao.
         */
        private fun go(i: Intent, vararg blocked: String): String? {
            return try {
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                val pm = packageManager
                if (i.component == null) {
                    val list = try { pm.queryIntentActivities(i, 0) } catch (e: Exception) { emptyList() }
                    val ri = list.firstOrNull() ?: return null
                    i.setClassName(ri.activityInfo.packageName, ri.activityInfo.name)
                } else {
                    val cn = i.component ?: return null
                    val exists = try {
                        pm.getActivityInfo(cn, 0); true
                    } catch (e: Exception) { false }
                    if (!exists) return null
                }
                val cn = i.component ?: return null
                val flat = cn.flattenToShortString()
                if (blocked.isNotEmpty()) {
                    val low = flat.lowercase()
                    for (bb in blocked) if (bb.isNotEmpty() && low.contains(bb.lowercase())) return null
                }
                startActivity(i)
                flat
            } catch (e: Exception) { null }
        }

        private fun act(action: String, pkg: String? = null): Intent {
            val i = Intent(action)
            if (pkg != null) i.`package` = pkg
            return i
        }

        private fun comp(pkg: String, cls: String): Intent =
            Intent().setComponent(android.content.ComponentName(pkg, cls))

        /** Zaroori settings ke seedhe darwaze (menu mein bhatakna khatam) */
        @JavascriptInterface
        fun openSetting(which: String): Boolean = openSettingNamed(which) != null

        /** Wahi darwaza, magar ab ye batata hai ke KHALI screen khuli — jhoot nahi */
        @JavascriptInterface
        fun openSettingNamed(which: String): String? {
            val GBOARD = "com.google.android.inputmethod.latin"
            val GBOARD_GO = "com.google.android.inputmethod.latin.go"
            val VOICE_IME = "com.google.android.apps.inputmethod.latin.voiceime.settings.VoiceSettingsActivity"
            val GSPEECH = "com.google.android.tts"          // Speech Services by Google

            /* v5.10.2: JS ab phone ki fehlist se KHUD darwaza chunti hai —
               "appinfo:<pkg>" = us app ki info screen, "market:<pkg>" = Play Store.
               Aap ke phone jaise halat mein yehi kaam aata hai: speech service
               maujood hai magar poori Google app nahi. */
            if (which.startsWith("appinfo:")) {
                val pkg = which.substring(8)
                if (pkg.isEmpty()) return null
                return go(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg")))
            }
            if (which.startsWith("market:")) {
                val pkg = which.substring(7)
                if (pkg.isEmpty()) return null
                return go(Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$pkg")))
                    ?: go(Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$pkg")))
            }

            return when (which) {
                /* 🗣️ zubaan pack download karne ki screen (Gboard → Voice typing) */
                "ondevice", "gboardvoice" ->
                    go(comp(GBOARD, VOICE_IME))
                        ?: go(comp(GBOARD_GO, VOICE_IME))
                        ?: go(act(Settings.ACTION_VOICE_INPUT_SETTINGS), "assist")
                        ?: go(act(Settings.ACTION_INPUT_METHOD_SETTINGS))
                        ?: go(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$GSPEECH")))
                        ?: go(act(Settings.ACTION_SETTINGS))

                /* ⌨️ keyboard ki aam settings */
                "gboard" ->
                    go(act(Settings.ACTION_INPUT_METHOD_SETTINGS))
                        ?: go(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$GBOARD")))
                        ?: go(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$GBOARD_GO")))

                /* 🎙️ speech services — TTS + default voice input */
                "voiceservices" ->
                    go(act("com.android.settings.TTS_SETTINGS"))
                        ?: go(act(Settings.ACTION_VOICE_INPUT_SETTINGS), "assist")
                        ?: go(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$GSPEECH")))
                        ?: go(act(Settings.ACTION_SETTINGS))

                /* 🤖 digital assistant (ab SIRF tab jab user KHUD ye maange).
                   NOTE: "ACTION_ASSISTANT_SETTINGS" jaisa koi PUBLIC Settings
                   constant hai hi nahi (v5.10.1 ki pehli CI isi par tooti), is liye AOSP ka
                   asal action string literal se — literal hamesha compile hota hai,
                   aur phone par na mile to go() saaf null wapas karta hai. */
                "assistant" ->
                    go(act("android.settings.MANAGE_DEFAULT_APPS_SETTINGS"))
                        ?: go(act(Settings.ACTION_VOICE_INPUT_SETTINGS))
                        ?: go(act(Settings.ACTION_SETTINGS))

                "voice" ->
                    go(act(Settings.ACTION_VOICE_INPUT_SETTINGS), "assist")
                        ?: go(act("com.android.settings.TTS_SETTINGS"))
                "tts" ->
                    go(act("com.android.settings.TTS_SETTINGS"))
                        ?: go(act(Settings.ACTION_SETTINGS))
                "input" ->
                    go(act(Settings.ACTION_INPUT_METHOD_SETTINGS))
                        ?: go(act(Settings.ACTION_SETTINGS))
                "battery" ->
                    go(act(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
                        ?: go(act(Settings.ACTION_SETTINGS))
                else -> go(act(Settings.ACTION_SETTINGS))
            }
        }

        /**
         * 🗣️ ON-DEVICE MAP (v5.10.1+, v5.10.2 mein `play` bhi) — "andaza karo ke phone mein kya hoga" khatam.
         * Ye phone par SACH MEIN maujood cheezon ki FEHRIST deta hai:
         *   srv  : RecognitionService ki poori list (naam + component) — wahi
         *          queryIntentServices jo makeRecognizer() ki seerhi istemal karti hai
         *   aiai : Android System Intelligence (on-device ka ghar)
         *   goog : poori Google app (Speech Recognition & Synthesis)
         *   kb   : keyboard (Gboard / Gboard Go)
         *   asst : default digital assistant ka NAAM (video wala saboot)
         * JS isi se panel banata hai — sirf ASLI darwazon ke button.
         */
        @JavascriptInterface
        fun onDeviceMap(): String {
            val o = JSONObject()
            try {
                val pm = packageManager
                o.put("sdk", Build.VERSION.SDK_INT)

                /* 1. speech recognition services — Android inhein khud visible rakhta hai */
                val srv = JSONArray()
                var goog = false
                var aiai = false
                try {
                    val list = pm.queryIntentServices(
                        Intent(RecognitionService.SERVICE_INTERFACE), 0
                    )
                    for (ri in list) {
                        val si = ri.serviceInfo ?: continue
                        val label = try { ri.loadLabel(pm).toString() } catch (e: Exception) { si.packageName }
                        val one = JSONObject()
                        one.put("pkg", si.packageName)
                        one.put("label", label)
                        one.put("comp", si.packageName + "/" + si.name)
                        srv.put(one)
                        if (si.packageName.contains("googlequicksearchbox")) goog = true
                        if (si.packageName.contains("as.oss") || si.packageName.contains("AiAi") ||
                            si.packageName.contains("systemintelligence")
                        ) aiai = true
                    }
                } catch (e: Exception) {}
                o.put("srv", srv)
                o.put("goog", goog)
                o.put("aiai", aiai)

                /* 2. on-device recognizer — API 33+ (pehle ye method maujood hi
                      nahi: API 31/32 par NoSuchMethodError phenkta, jo Exception
                      NAHI hota → is liye guard 33 aur catch Throwable).
                      `this` MayaBridge hai, Context nahi → this@MainActivity. */
                var onDev = false
                if (Build.VERSION.SDK_INT >= 33) {
                    onDev = try { SpeechRecognizer.isOnDeviceRecognitionAvailable(this@MainActivity) }
                    catch (e: Throwable) { false }
                }
                o.put("ondevice", onDev)

                /* 3. phone ka default voice-input service */
                o.put("svc", try {
                    Settings.Secure.getString(contentResolver, "voice_recognition_service") ?: ""
                } catch (e: Exception) { "" })

                /* 4. keyboard — <queries> ke baad ab ye NAZAR aata hai (pehle andha tha) */
                val kb = JSONArray()
                val pkgs = listOf(
                    "com.google.android.inputmethod.latin",          // Gboard
                    "com.google.android.inputmethod.latin.go",   // Gboard Go
                    "com.google.android.apps.searchlite",        // Google Go / Search Lite
                    "com.google.android.googlequicksearchbox",   // poori Google app
                    "com.google.android.tts"                     // Speech by Google
                )
                for (pkg in pkgs) {
                    try {
                        val ai = pm.getApplicationInfo(pkg, 0)
                        if (ai.enabled) kb.put(pkg)
                    } catch (e: Exception) {}
                }
                o.put("kb", kb)

                /* 4b. Play Store — "market:" darwaza isi par chalta hai. Android Go
                       par aam tor par hota hai, magar andaza nahi: poochh lo. */
                var play = false
                try {
                    val pi = pm.getPackageInfo("com.android.vending", 0)
                    play = pi.applicationInfo != null && pi.applicationInfo.enabled
                } catch (e: Exception) { play = false }
                o.put("play", play)

                /* 5. default ASSISTANT ka NAAM — video isi ka saboot thi */
                var asst = ""
                try {
                    val ai = Intent(Intent.ACTION_ASSIST).addCategory(Intent.CATEGORY_DEFAULT)
                    val ri = pm.resolveActivity(ai, PackageManager.MATCH_DEFAULT_ONLY)
                    val pkg = ri?.activityInfo?.packageName
                    if (pkg != null) {
                        asst = try { pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString() }
                               catch (e: Exception) { pkg }
                    }
                } catch (e: Exception) {}
                if (asst.isEmpty()) {
                    try {
                        asst = Settings.Secure.getString(contentResolver, "assistant") ?: ""
                    } catch (e: Exception) {}
                }
                o.put("asst", asst)
            } catch (e: Exception) {
                try { o.put("err", e.message ?: "?") } catch (e2: Exception) {}
            }
            return o.toString()
        }

        /** v5.7.0 — wake word ki zubaan JS se service tak pohanchane ke liye */
        @JavascriptInterface
        fun setPrefString(k: String, v: String) {
            try { prefs().edit().putString(k, v).apply() } catch (e: Exception) {}
        }

        @JavascriptInterface
        fun clearPref(k: String) { try { prefs().edit().remove(k).apply() } catch (e: Exception) {} }

        /** Auto-listen mode — screen jagti rahe */
        @JavascriptInterface
        fun keepScreenOn(on: Boolean) {
            runOnUiThread {
                if (on) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
        }
    }

    /* ================= HELPERS ================= */

    fun evalAsyncPublic(js: String) { evalAsync(js) }

    /* 🔬 v5.10.3 (F27) — murda WebView par JS thonsna band.
       `webViewAlive` flag PEHLE SE maujood tha (markAlive + onPageFinished), magar
       evalAsync usay dekhta hi nahi tha — is liye WakeWordService ko lagta tha ke
       report pohanch gayi, halanke WebView khatam ho chuka hota tha. Ab delivery
       ka SABOOT milta hai (sent/dropped counters panel par nazar aate hain). */
    fun evalPublicOk(js: String): Boolean {
        return try {
            if (!webViewAlive) {
                false
            } else {
                evalAsync(js)
                true
            }
        } catch (e: Exception) { false }
    }

    private fun prefs() = getSharedPreferences("maya", Context.MODE_PRIVATE)

    private fun evalAsync(js: String) {
        webView.post { webView.evaluateJavascript(js, null) }
    }

    /* ═══════════════════════════════════════════════════════════════════
       🎯 RECOGNIZER KI SEERHI  (P8b)
       -------------------------------------------------------------------
       Android 12+ par bohat phones (khaas kar TECNO/HiOS) ka default voice
       input "Android System Intelligence" (AiAi) hota hai — aur wo
       SpeechRecognizer API ke sath THEEK KAAM NAHI KARTA. Nateeja: mic
       chalta hai, band hota hai, aur kuch nahi hota.

       Is liye ab teen darje:
         1. Android 12+ ka ON-DEVICE recognizer (isi kaam ke liye bana, offline)
         2. Google ka recognizer ZABARDASTI (ComponentName se)
         3. aam wala (jo ab tak istemal ho raha tha)
       Aur jo chala, uska naam yaad rakha jata hai — DOCTOR usay dikhata hai.
       ═══════════════════════════════════════════════════════════════════ */
    var lastRecognizerKind: String = "-"

    fun makeRecognizer(): SpeechRecognizer {
        /* v5.10.2: guard 31 se 33 kiya. isOnDeviceRecognitionAvailable /
           createOnDeviceSpeechRecognizer API 33 se hain — Android 12/12L (31/32)
           par ye call NoSuchMethodError phenkti hai, jo Error hai Exception NAHI,
           is liye purana `catch (Exception)` use pakadta hi nahi tha: SUNO dabate
           hi app crash. Teen jagah (yahan + micDoctor + onDeviceMap) ab 33 + Throwable. */
        if (Build.VERSION.SDK_INT >= 33) {
            try {
                if (SpeechRecognizer.isOnDeviceRecognitionAvailable(this)) {
                    lastRecognizerKind = "on-device"
                    return SpeechRecognizer.createOnDeviceSpeechRecognizer(this)
                }
            } catch (e: Throwable) {}
        }
        try {
            val cn = android.content.ComponentName(
                "com.google.android.googlequicksearchbox",
                "com.google.android.voicesearch.serviceapi.GoogleRecognitionService"
            )
            val pm = packageManager
            val intent = Intent(android.speech.RecognitionService.SERVICE_INTERFACE)
            val list = pm.queryIntentServices(intent, 0)
            for (ri in list) {
                if (ri.serviceInfo != null && ri.serviceInfo.packageName == cn.packageName) {
                    lastRecognizerKind = "google"
                    return SpeechRecognizer.createSpeechRecognizer(this, cn)
                }
            }
        } catch (e: Exception) {}
        lastRecognizerKind = "default"
        return SpeechRecognizer.createSpeechRecognizer(this)
    }

    private fun jsEscape(s: String): String = s
        .replace("\\", "\\\\")
        .replace("'", "\\'")
        .replace("\"", "\\\"")
        .replace("\n", " ")
        .replace("\r", " ")

    private fun toast(msg: String) {
        runOnUiThread { Toast.makeText(this, msg, Toast.LENGTH_SHORT).show() }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(
                CHANNEL_ID, "MAYA Notifications", NotificationManager.IMPORTANCE_DEFAULT
            )
            getSystemService(NotificationManager::class.java).createNotificationChannel(ch)
        }
    }

    private fun requestNeededPermissions() {
        val wanted = mutableListOf(Manifest.permission.RECORD_AUDIO, Manifest.permission.READ_CONTACTS, Manifest.permission.CALL_PHONE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
            wanted.add(Manifest.permission.POST_NOTIFICATIONS)
        val need = wanted.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (need.isNotEmpty())
            ActivityCompat.requestPermissions(this, need.toTypedArray(), REQ_PERMS)
    }

    private fun requestMicPermission() {
        ActivityCompat.requestPermissions(
            this, arrayOf(Manifest.permission.RECORD_AUDIO), REQ_PERMS
        )
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
            ActivityCompat.requestPermissions(
                this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_PERMS
            )
    }
}

/* ═══════════════════════════════════════════════════════════════════════════
   🎙️  EDGE TTS  —  MUFT, BE-HISAAB, ASLI NEURAL AWAAZ   (app v4.7.0)
   ---------------------------------------------------------------------------
   Ye wahi engine hai jo Microsoft Edge browser ke "Read aloud" ke peeche hai:
   200+ Azure neural awaazein, 50+ zabanein — koi API key nahi, koi quota nahi.
   MAYA ke liye sab se ahem: ASLI URDU awaazein (ur-PK-UzmaNeural / AsadNeural).

   To phir pehle kyun nahi chalta tha?
   -----------------------------------
   Is service ka WebSocket handshake in headers ke bagair qubool nahi hota:
       Origin: chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold
       User-Agent: ...Edg/143.0.0.0
       Pragma / Cache-Control / Sec-WebSocket-Version
   Browser ka `new WebSocket(url)` in headers ko set KAR HI NAHI SAKTA — ye
   JavaScript ki hadd hai, hamara bug nahi. Is liye app ka purana JS wala
   edgeTTS_speak() hamesha khamoshi se nakaam hota tha (default OFF pada tha).

   Ilaj: WebSocket ab KOTLIN mein hai. Yahan hum har header khud likh sakte
   hain. Neeche RFC-6455 ka chhota client hai — koi nayi library nahi
   (OkHttp bhi nahi), sirf SSLSocket. Is liye build ka koi khatra nahi.

   Auth: Sec-MS-GEC = SHA-256( windows-filetime(5 min par gol kiya) + token ),
   bilkul wesa hi jaisa rany2/edge-tts karta hai.
   ═══════════════════════════════════════════════════════════════════════════ */

private object EdgeTts {
    private const val TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4"
    private const val CHROME_FULL = "143.0.3650.75"
    private const val CHROME_MAJOR = "143"
    private const val HOST = "speech.platform.bing.com"
    private const val UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/$CHROME_MAJOR.0.0.0 Safari/537.36 Edg/$CHROME_MAJOR.0.0.0"

    fun userAgent(): String = UA

    private class Frame(val opcode: Int, val payload: ByteArray)

    /* Sec-MS-GEC — 5 minute ke block par SHA-256 */
    private fun gec(): String {
        var ticks = (System.currentTimeMillis() / 1000.0) + 11644473600.0
        ticks -= ticks % 300.0
        ticks *= 1.0e9 / 100.0
        val toHash = String.format(java.util.Locale.US, "%.0f", ticks) + TOKEN
        val dig = java.security.MessageDigest.getInstance("SHA-256")
            .digest(toHash.toByteArray(Charsets.US_ASCII))
        val sb = StringBuilder(64)
        for (b in dig) sb.append(String.format(java.util.Locale.US, "%02X", b))
        return sb.toString()
    }

    private fun hex32(): String {
        val r = java.security.SecureRandom()
        val b = ByteArray(16); r.nextBytes(b)
        val sb = StringBuilder(32)
        for (x in b) sb.append(String.format(java.util.Locale.US, "%02x", x))
        return sb.toString()
    }

    /* Python ke date_to_string() ki hoo-ba-hoo naqal */
    private fun stamp(): String {
        val f = java.text.SimpleDateFormat("EEE MMM dd yyyy HH:mm:ss", java.util.Locale.US)
        f.timeZone = java.util.TimeZone.getTimeZone("UTC")
        return f.format(java.util.Date()) + " GMT+0000 (Coordinated Universal Time)"
    }

    private fun readLine(ins: java.io.InputStream): String {
        val bos = java.io.ByteArrayOutputStream()
        var prev = -1
        while (true) {
            val c = ins.read()
            if (c < 0) break
            if (prev == 13 && c == 10) { val a = bos.toByteArray(); return String(a, 0, maxOf(0, a.size - 1), Charsets.ISO_8859_1) }
            bos.write(c); prev = c
        }
        return String(bos.toByteArray(), Charsets.ISO_8859_1)
    }

    private fun readFully(ins: java.io.InputStream, n: Int): ByteArray {
        val out = ByteArray(n); var got = 0
        while (got < n) {
            val r = ins.read(out, got, n - got)
            if (r < 0) throw java.io.IOException("connection band ho gaya")
            got += r
        }
        return out
    }

    /* client -> server frame (mask lagana LAZMI hai) */
    private fun sendFrame(out: java.io.OutputStream, opcode: Int, data: ByteArray) {
        val head = java.io.ByteArrayOutputStream()
        head.write(0x80 or opcode)
        val n = data.size
        when {
            n < 126 -> head.write(0x80 or n)
            n < 65536 -> { head.write(0x80 or 126); head.write((n shr 8) and 255); head.write(n and 255) }
            else -> {
                head.write(0x80 or 127)
                for (i in 7 downTo 0) head.write(((n.toLong() shr (8 * i)) and 255L).toInt())
            }
        }
        val mask = ByteArray(4); java.security.SecureRandom().nextBytes(mask)
        head.write(mask)
        val masked = ByteArray(n)
        for (i in 0 until n) masked[i] = (data[i].toInt() xor mask[i % 4].toInt()).toByte()
        out.write(head.toByteArray()); out.write(masked); out.flush()
    }

    private fun sendText(out: java.io.OutputStream, s: String) =
        sendFrame(out, 1, s.toByteArray(Charsets.UTF_8))

    /* server -> client frame; tukron mein aaye to jor deta hai */
    private fun readFrame(ins: java.io.InputStream): Frame {
        var firstOp = -1
        val acc = java.io.ByteArrayOutputStream()
        while (true) {
            val b0 = ins.read(); if (b0 < 0) throw java.io.IOException("stream khatam")
            val fin = (b0 and 0x80) != 0
            val op = b0 and 0x0F
            val b1 = ins.read(); if (b1 < 0) throw java.io.IOException("stream khatam")
            var len = (b1 and 0x7F).toLong()
            if (len == 126L) { val e = readFully(ins, 2); len = (((e[0].toInt() and 255) shl 8) or (e[1].toInt() and 255)).toLong() }
            else if (len == 127L) {
                val e = readFully(ins, 8); var v = 0L
                for (i in 0 until 8) v = (v shl 8) or (e[i].toLong() and 255L)
                len = v
            }
            if (len > 8_000_000L) throw java.io.IOException("frame bohat bara")
            val body = readFully(ins, len.toInt())
            if (op != 0 && firstOp < 0) firstOp = op
            acc.write(body)
            if (fin) return Frame(if (firstOp < 0) op else firstOp, acc.toByteArray())
        }
    }

    /* ═══ poora kaam: SSML andar, MP3 bytes bahar ═══ */
    fun synth(ssml: String, timeoutMs: Int): ByteArray {
        val path = "/consumer/speech/synthesize/readaloud/edge/v1" +
            "?TrustedClientToken=$TOKEN&Sec-MS-GEC=${gec()}&Sec-MS-GEC-Version=1-$CHROME_FULL" +
            "&ConnectionId=${hex32()}"

        val sock = javax.net.ssl.SSLSocketFactory.getDefault().createSocket() as javax.net.ssl.SSLSocket
        try {
            sock.connect(java.net.InetSocketAddress(HOST, 443), timeoutMs)
            sock.soTimeout = timeoutMs
            /* Hostname ki tasdeeq LAZMI — bina is ke raw SSLSocket kisi bhi
               sahih certificate ko qubool kar leta hai (MITM ka darwaza). */
            sock.sslParameters = sock.sslParameters.also { it.endpointIdentificationAlgorithm = "HTTPS" }
            sock.startHandshake()

            val out = java.io.BufferedOutputStream(sock.outputStream)
            val ins = java.io.BufferedInputStream(sock.inputStream)

            val kb = ByteArray(16); java.security.SecureRandom().nextBytes(kb)
            val wsKey = Base64.encodeToString(kb, Base64.NO_WRAP)

            val req = StringBuilder()
            req.append("GET ").append(path).append(" HTTP/1.1\r\n")
            req.append("Host: ").append(HOST).append("\r\n")
            req.append("Upgrade: websocket\r\n")
            req.append("Connection: Upgrade\r\n")
            req.append("Sec-WebSocket-Key: ").append(wsKey).append("\r\n")
            req.append("Sec-WebSocket-Version: 13\r\n")
            req.append("Pragma: no-cache\r\n")
            req.append("Cache-Control: no-cache\r\n")
            req.append("Origin: chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold\r\n")
            req.append("User-Agent: ").append(UA).append("\r\n")
            req.append("Accept-Language: en-US,en;q=0.9\r\n")
            req.append("\r\n")
            out.write(req.toString().toByteArray(Charsets.ISO_8859_1)); out.flush()

            val status = readLine(ins)
            if (!status.contains(" 101")) {
                while (true) { val l = readLine(ins); if (l.isEmpty()) break }
                throw java.io.IOException("Edge ne handshake mana kiya: $status")
            }
            while (true) { val l = readLine(ins); if (l.isEmpty()) break }

            sendText(out,
                "X-Timestamp:" + stamp() + "\r\n" +
                "Content-Type:application/json; charset=utf-8\r\n" +
                "Path:speech.config\r\n\r\n" +
                "{\"context\":{\"synthesis\":{\"audio\":{\"metadataoptions\":{" +
                "\"sentenceBoundaryEnabled\":\"false\",\"wordBoundaryEnabled\":\"false\"}," +
                "\"outputFormat\":\"audio-24khz-48kbitrate-mono-mp3\"}}}}\r\n")

            sendText(out,
                "X-RequestId:" + hex32() + "\r\n" +
                "Content-Type:application/ssml+xml\r\n" +
                "X-Timestamp:" + stamp() + "Z\r\n" +
                "Path:ssml\r\n\r\n" + ssml)

            val audio = java.io.ByteArrayOutputStream()
            val deadline = System.currentTimeMillis() + timeoutMs
            while (System.currentTimeMillis() < deadline) {
                val f = readFrame(ins)
                when (f.opcode) {
                    1 -> { if (String(f.payload, Charsets.UTF_8).contains("Path:turn.end")) return finish(audio) }
                    2 -> {
                        val p = f.payload
                        if (p.size > 2) {
                            val hlen = ((p[0].toInt() and 255) shl 8) or (p[1].toInt() and 255)
                            if (p.size > hlen + 2) audio.write(p, hlen + 2, p.size - hlen - 2)
                        }
                    }
                    8 -> return finish(audio)
                    9 -> sendFrame(out, 10, f.payload)
                }
            }
            return finish(audio)
        } finally {
            try { sock.close() } catch (e: Exception) {}
        }
    }

    private fun finish(bos: java.io.ByteArrayOutputStream): ByteArray {
        if (bos.size() == 0) throw java.io.IOException("Edge se koi audio nahi aayi")
        return bos.toByteArray()
    }
}
