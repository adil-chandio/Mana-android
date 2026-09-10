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
    @Volatile private var ttsBooting = false
    /* v5.9.5: silent-TTS guard — jab tak pehli asli speech start na ho,
       engine "shak wale" haal mein maana jata hai; koi bhi bol de to clear. */
    @Volatile private var ttsEverSpoke = false
    private var recognizer: SpeechRecognizer? = null
    private var speechGeneration = 0L
    private var fishPlayer: com.maya.ai.voice.FishStreamPlayer? = null

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
        Toast.makeText(this, "MAYA " + BuildConfig.VERSION_NAME + " • Update Center", Toast.LENGTH_LONG).show()
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
        ensureWakeAlive()      /* Issue 1: listener never dies */
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
            /* Issue 5: full-resolution upload (up to 4MB -> ~5.3MB base64)
               par vision call mobile data par 5-30s leti thi. Ab Kotlin khud
               downscale karta hai (max 1280px JPEG q=80) — Gemini ke liye
               quality kaafi hoti hai, upload ~10x chhota. */
            if (bytes != null) {
                var b64: String? = null
                try {
                    val bmp = android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes!!.size)
                    if (bmp != null) {
                        val maxSide = 1280
                        val scale = minOf(1f, maxSide / maxOf(bmp.width.toFloat(), bmp.height.toFloat()))
                        val out = android.graphics.Bitmap.createBitmap(
                            (bmp.width * scale).toInt().coerceAtLeast(1),
                            (bmp.height * scale).toInt().coerceAtLeast(1),
                            android.graphics.Bitmap.Config.ARGB_8888
                        )
                        val canvas = android.graphics.Canvas(out)
                        canvas.drawBitmap(bmp, null, android.graphics.RectF(0f, 0f, out.width.toFloat(), out.height.toFloat()), null)
                        val bos = java.io.ByteArrayOutputStream()
                        out.compress(android.graphics.Bitmap.CompressFormat.JPEG, 80, bos)
                        b64 = android.util.Base64.encodeToString(bos.toByteArray(), android.util.Base64.NO_WRAP)
                        bmp.recycle(); out.recycle()
                    }
                } catch (e: Exception) {}
                if (b64 == null) {
                    /* decode fail? chhoti tasveer (<=400KB) seedha bhejo */
                    if (bytes!!.size <= 400_000) {
                        b64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
                    }
                }
                /* Issue 5: nakaam par bhi JS ko KHABAR do — UI 'dekh rahi hoon'
                   par hang nahi rahega. */
                evalAsync(
                    if (b64 != null) "window.__photoTaken && window.__photoTaken('" + b64 + "')"
                    else "window.__photoTaken && window.__photoTaken(null)"
                )
            }
        } catch (e: Exception) {}
    }

    override fun onDestroy() {
        fishPlayer?.stop(); fishPlayer = null
        instance = null
        stopRecognizer()
        try { tts?.stop(); tts?.shutdown() } catch (e: Exception) {}
        super.onDestroy()
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

    /* v5.9.5 — SILENT-VOICE-FIX, teen deewarein:
       1. init-retry: initTts ek dafa chalta tha; TextToSpeech constructor
          khamoshi fail ho jaye (kuch ROM/WebView boot races) to JS ka device
          tier HAMESHA ke liye murda ho jata tha -> "text aa gaya, awaaz zero".
          Ab max 3 koshish (2s/6s), har koshish ka log.
       2. UTTERANCE watchdog: system TTS ka onDone/onError bhool jana aam hai
          (Tecno/HiOS par bhi). Bhoola to SUKOON BOL_RAHI mein atak jata tha
          aur mic pipeline band ho jati thi. 12s HARD fallback — bolo ya
          bhoolo, JS ko jawab jayega hi.
       3. AUDIO ATTRIBUTES: pehle default stream (akasar ring/notification)
          par bolta tha — media volume ZERO ho to Maya "boli hi nahi".
          Ab USAGE_MEDIA/CONTENT_TYPE_SPEECH (media volume par). */
    private fun initTts() {
        ttsBooting = true
        try {
            tts = TextToSpeech(applicationContext) { status ->
                ttsBooting = false
                android.util.Log.i("MayaTTS", "init status=" + status + " ready=" + (status == TextToSpeech.SUCCESS))
                ttsReady = status == TextToSpeech.SUCCESS
                if (ttsReady) {
                    try {
                        tts?.setAudioAttributes(
                            android.media.AudioAttributes.Builder()
                                .setUsage(android.media.AudioAttributes.USAGE_MEDIA)
                                .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SPEECH)
                                .build()
                        )
                    } catch (e: Exception) {}
                } else {
                    retryTts()
                }
                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) {
                        if (utteranceId == "maya") ttsEverSpoke = true
                    }
                    override fun onDone(utteranceId: String?) {
                        if (utteranceId == "maya")
                            evalAsync("window.__nativeTtsDone && window.__nativeTtsDone('done')")
                    }
                    @Deprecated("Deprecated in Java")
                    override fun onError(utteranceId: String?) {
                        android.util.Log.w("MayaTTS", "utterance error")
                        if (utteranceId == "maya")
                            evalAsync("window.__nativeTtsDone && window.__nativeTtsDone('error')")
                    }
                })
            }
        } catch (e: Exception) {
            ttsBooting = false
            android.util.Log.e("MayaTTS", "init threw: " + e.message)
            retryTts()
        }
    }

    private fun retryTts() {
        if (ttsReady || ttsBooting) return
        if (ttsRetries >= 2) {
            android.util.Log.e("MayaTTS", "init nakaam — JS ko bataya (device tier off)")
            evalAsync("window.__nativeTtsStatus && window.__nativeTtsStatus('init_failed')")
            return
        }
        ttsRetries++
        val delay = if (ttsRetries == 1) 2000L else 6000L
        android.util.Log.w("MayaTTS", "init retry #" + ttsRetries + " in " + delay + "ms")
        android.os.Handler(Looper.getMainLooper()).postDelayed({
            if (!ttsReady && !ttsBooting) initTts()
        }, delay)
    }

    private var ttsRetries = 0

    /* ================= STT ================= */

    private fun stopRecognizer() {
        speechGeneration++
        try { recognizer?.destroy(); recognizer = null } catch (e: Exception) {}
    }

    /* ================= JS BRIDGE ================= */

    inner class MayaBridge {

        @JavascriptInterface
        fun appVersion(): String = BuildConfig.VERSION_NAME + "-native"

        /** Navigation only. JS cannot provide an APK URL or trigger installation. */
        @JavascriptInterface
        fun openUpdates() {
            runOnUiThread {
                startActivity(Intent(this@MainActivity, com.maya.ai.update.UpdateActivity::class.java))
            }
        }

        /* 🎚️ P9 SUKOON — JS (SUKOON) har awaaz/mic ki HAAL yahan bhejti hai.
           KHALI | BOL_RAHI | APP_SUN — WakeWordService har mic-darwaze par isi
           ko poochhti hai. Isi se awaaz-katna + mic-larai dono khatam hain. */
        @JavascriptInterface
        fun setHaal(h: String) {
            try { WakeWordService.applyHaal(h) } catch (e: Exception) {}
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
                    /* v5.9.5: init abhi zinda hai (retry chal raha) to JS ko
                       khabar na karo — warna device tier "khatam" maan kar chain
                       chhod deta. Retry khatam + phir bhi murda = sacha jawab. */
                    if (!ttsBooting) {
                        android.util.Log.w("MayaTTS", "speak on dead engine — nakaam JS ko")
                        evalAsync("window.__nativeTtsDone && window.__nativeTtsDone('engine_not_ready')")
                    }
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
                    /* v5.9.5: 12s UTTERANCE WATCHDOG — system TTS ka onDone/onError
                       bhool jana (Tecno/HiOS) = SUKOON BOL_RAHI hamesha ke liye atak
                       jata tha. Ab native khud 12s baad JS ko azaad karta hai.
                       (Edge/device TTS engine ise override kar deta hai.) */
                    evalAsync("window.__nativeTtsWatch && window.__nativeTtsWatch(12000)")
                    engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "maya")
                } catch (e: Exception) {
                    evalAsync("window.__nativeTtsDone && window.__nativeTtsDone('exception')")
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

        /** Fixed Fish streaming output; no alternate voice or arbitrary network destination. */
        @JavascriptInterface
        fun fishStreamSpeak(body: String, headers: String, id: String) {
            runOnUiThread {
                if (fishPlayer == null) fishPlayer = com.maya.ai.voice.FishStreamPlayer(this@MainActivity) { request, event, status ->
                    evalAsync("window.__fishStreamEvent && window.__fishStreamEvent('$request','$event',$status)")
                }
                fishPlayer?.speak(body, headers, id)
            }
        }

        @JavascriptInterface
        fun fishStreamStop() { runOnUiThread { fishPlayer?.stop() } }

        /** Native STT — Google voice recognition (Urdu ur-PK supported) */
        @JavascriptInterface
        fun listen(lang: String) {
            runOnUiThread {
                if (ContextCompat.checkSelfPermission(
                        this@MainActivity, Manifest.permission.RECORD_AUDIO
                    ) != PackageManager.PERMISSION_GRANTED
                ) {
                    requestMicPermission()
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
                    /* Issue 2: 700ms bohat chhota tha — jumla poora hone se pehle hi
                       mic band ho jata tha. 1200ms = poori baat pakadta hai, phir
                       bhi response tez rehta hai. */
                    putExtra("android.speech.extra.SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS", 1200)
                }
                val session = speechGeneration
                var delivered = false
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
                        override fun onEndOfSpeech() {
                            if (session == speechGeneration && !delivered) evalAsync("window.__speechTiming && window.__speechTiming('ended')")
                        }
                        override fun onError(error: Int) {
                            if (session != speechGeneration || delivered) return
                            delivered = true
                            evalAsync("window.__nativeSpeechErr && window.__nativeSpeechErr($error)")
                        }
                        override fun onResults(results: Bundle?) {
                            if (session != speechGeneration || delivered) return
                            delivered = true
                            evalAsync("window.__speechTiming && window.__speechTiming('final')")
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
                            if (session != speechGeneration || delivered) return
                            val pt = partialResults
                                ?.getStringArrayList("android.speech.extra.RESULTS")?.firstOrNull() ?: ""
                            if (pt.isNotBlank()) evalAsync("window.__nativePartial && window.__nativePartial('" + jsEscape(pt) + "')")
                        }
                        override fun onEvent(eventType: Int, params: Bundle?) {}
                    })
                    startListening(intent)
                }
                } catch (_: Exception) {
                    stopRecognizer()
                    WakeWordService.resumeFromApp()
                    evalAsync("window.__nativeSpeechErr && window.__nativeSpeechErr(5)")
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

        /* ═══ 🖐️ AMAL (Roadmap Phase 1, S2) — MayaAct bridge ═══
           JS (maya_act tool) -> Kotlin safety engine. Koi naya behavior nahi:
           saare guards MayaAct mein hain (blocked apps, sensitive fields,
           rate/attempts/timeout, touch-abort, kill-switch). */

        @JavascriptInterface
        fun mayaAct(json: String): String {
            return try {
                MayaAct.enqueue(this@MainActivity, JSONObject(json))
            } catch (e: Exception) {
                val o = JSONObject()
                o.put("ok", false)
                o.put("why", "mayaAct masla: " + (e.message ?: "?"))
                o.toString()
            }
        }

        @JavascriptInterface
        fun mayaStop() {
            try { MayaAct.killAll(this@MainActivity) } catch (e: Exception) {}
        }

        @JavascriptInterface
        fun mayaStatus(): String = try { MayaAct.status() } catch (e: Exception) { "{}" }

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
                if (Build.VERSION.SDK_INT >= 31) {
                    onDev = try { SpeechRecognizer.isOnDeviceRecognitionAvailable(this@MainActivity) }
                            catch (e: Exception) { false }
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

        /** Zaroori settings ke seedhe darwaze (menu mein bhatakna khatam) */
        @JavascriptInterface
        fun openSetting(which: String): Boolean {
            /* v5.9.4 — ON-DEVICE zubaan ka asli darwaza. Doctor ka text "[ON-DEVICE]
               dabao" kehta tha magar aisa button kahin THA HI NAHI (sirf likha tha) —
               user dhoondhta reh jata. Ab ASLI button ye chain kholta hai:
               1. Gboard → Voice typing (wahan "Faster/Offline speech recognition"
                  mein zubaan download hoti hai — Android 13/14 ka reliable raasta)
               2. Voice-input picker
               3. aam Settings */
            if (which == "ondevice") {
                val tries = listOf(
                    Intent().setComponent(android.content.ComponentName(
                        "com.google.android.inputmethod.latin",
                        "com.google.android.apps.inputmethod.latin.voiceime.settings.VoiceSettingsActivity")),
                    Intent(Settings.ACTION_VOICE_INPUT_SETTINGS),
                    Intent(Settings.ACTION_SETTINGS)
                )
                for (i in tries) {
                    try { startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); return true }
                    catch (e: Exception) {}
                }
                return false
            }
            return try {
                val act = when (which) {
                    "voice" -> Settings.ACTION_VOICE_INPUT_SETTINGS
                    "tts" -> "com.android.settings.TTS_SETTINGS"
                    "input" -> Settings.ACTION_INPUT_METHOD_SETTINGS
                    "battery" -> Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS
                    else -> Settings.ACTION_SETTINGS
                }
                startActivity(Intent(act).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                true
            } catch (e: Exception) {
                try {
                    startActivity(Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    true
                } catch (e2: Exception) { false }
            }
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

    private fun prefs() = getSharedPreferences("maya", Context.MODE_PRIVATE)

    /* ═══ Issue 1: LISTENER NEVER DIES ═══
       Tecno/HiOS background mic services ko maar deta hai. Pehle wake service
       sirf tab start hoti thi jab user switch dabata tha. Ab: har app-open par,
       agar saved pref kehti hai wake ON tha, to service dobara start + battery
       whitelist ka nudge (ek dialog, sirf jab exemption abhi nahi mili). */
    private fun ensureWakeAlive() {
        try {
            if (!prefs().getBoolean("wake", false)) return
            /* wake-regression: 1.5s par JS apna boot-start khud karta hai
               (index.html INIT -> setWakeService(true)). 2.5s par start karte
               hain taake WebView ke pehle mic session (greeting/HAAL) se
               double-start ka shor na ho. */
            android.os.Handler(Looper.getMainLooper()).postDelayed({
                try {
                    if (WakeWordService.instance == null) WakeWordService.start(this@MainActivity)
                    /* wake-regression: battery dialog har app-open par Nahi —
                       sirf PEHLI dafa (pref flag). Har khulne par system dialog
                       foreground mic session ko disturb karta tha. */
                    val pm = getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
                    if (!pm.isIgnoringBatteryOptimizations(packageName) &&
                        !prefs().getBoolean("bat_asked", false)
                    ) {
                        prefs().edit().putBoolean("bat_asked", true).apply()
                        try {
                            Toast.makeText(this@MainActivity,
                                "Listener hamesha zinda rakhne ke liye battery optimization OFF karo \uD83D\uDD0B",
                                Toast.LENGTH_LONG).show()
                            startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                                Uri.parse("package:" + packageName)))
                        } catch (e: Exception) {}
                    }
                } catch (e: Exception) {}
            }, 2500)
        } catch (e: Exception) {}
    }

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

    fun makeRecognizer(preferOnDevice: Boolean = true): SpeechRecognizer {
        if (preferOnDevice && Build.VERSION.SDK_INT >= 31) {
            try {
                if (SpeechRecognizer.isOnDeviceRecognitionAvailable(this)) {
                    lastRecognizerKind = "on-device"
                    return SpeechRecognizer.createOnDeviceSpeechRecognizer(this)
                }
            } catch (e: Exception) {}
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
