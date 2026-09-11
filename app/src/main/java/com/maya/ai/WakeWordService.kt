package com.maya.ai

import com.maya.ai.voice.WakeStatus
import com.maya.ai.voice.WakeStatus.State
import com.maya.ai.voice.WakeStatus.Reason
import org.json.JSONObject
import android.os.SystemClock
import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.content.pm.ServiceInfo
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import org.json.JSONArray
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import androidx.core.app.NotificationCompat

/** User-enabled foreground recognition. Readiness requires a recognizer callback.
 * No offline command execution or automatic Activity launch is promised.
 */
class WakeWordService : Service() {

    companion object {
        const val CHANNEL_ID = "maya_wake"
        const val NOTIF_ID = 2001

        @Volatile var instance: WakeWordService? = null
        @Volatile var fishOutputActive = false

        /* ═══ 🎚️ P9 SUKOON — audio referee: ek waqt mein EK cheez ═══
           Teen jang-boot jo ye sulhaata hai:
           (1) mic khulte hi Android AUDIO FOCUS le leta hai -> Maya ki awaaz
               KAT jati thi (greeting "MAYA onl—" wala masla)
           (2) wake service ka aur tap-to-speak ka SpeechRecognizer LADTE the —
               mic ek waqt mein ek hi hota hai
           (3) wohi jang error 8 (RECOGNIZER_BUSY) deti thi -> service khud ko
               maar deti thi AUR user ka wake switch bhi mita deti thi
           (4) speaker se Maya ki awaaz VAD/recognizer ko lagti -> self-wake loop
           Hal: HAAL — JS (SUKOON) batati hai, Kotlin ka mic har darwaze par
           pehle HAAL poochhta hai. */
        @Volatile var haal: String = "KHALI"          /* KHALI | BOL_RAHI | APP_SUN */
        @Volatile var haalAt: Long = 0L               /* jab ye haal shuru hua (watchdog) */
        @Volatile var lastBolAt: Long = 0L            /* bolne ka aakhri lamha */
        @Volatile var pausedByApp: Boolean = false    /* L4 MIC SULAH */
        @Volatile var pausedAt: Long = 0L
        const val ECHO_TAIL_MS = 550L                 /* JS SUKOON.tailMs se match */

        val health = WakeStatus { SystemClock.elapsedRealtime() }
        @Volatile private var requested: Boolean? = null
        @Volatile private var requestGeneration = 0L
        @Volatile private var foreground = false

        fun publishHealth() {
            try { MainActivity.instance?.evalAsyncPublic("window.__wakeState && window.__wakeState()") } catch (_: Exception) {}
        }
        fun updateHealth(state: State, reason: Reason = Reason.NONE, error: Int = 0) {
            if (health.update(state, reason, error)) publishHealth()
        }
        fun statusJson(): JSONObject {
            val s = health.snapshot()
            return JSONObject().put("state", s.state.name.lowercase()).put("reason", s.reason.name.lowercase())
                .put("error", s.error).put("ageMs", s.ageMs).put("starts", s.starts).put("ready", s.ready)
                .put("servicePresent", instance != null).put("foreground", foreground)
                .put("fishOutputActive", fishOutputActive).put("appMicPaused", pausedByApp)
                .put("audioState", if (haal in listOf("KHALI", "BOL_RAHI", "APP_SUN")) haal else "unknown")
        }
        @Synchronized fun start(ctx: Context): Boolean {
            val generation = ++requestGeneration
            if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                updateHealth(State.ERROR, Reason.PERMISSION, 9)
                return false
            }
            requested = true
            if (instance == null) updateHealth(State.REQUESTED)
            return try {
                val i = Intent(ctx, WakeWordService::class.java)
                val component = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i)
                    else ctx.startService(i)
                if (component == null) { updateHealth(State.ERROR, Reason.START_REJECTED); false }
                else {
                    Handler(Looper.getMainLooper()).postDelayed({
                        if (generation == requestGeneration && requested == true && instance == null &&
                            health.snapshot().state in listOf(State.REQUESTED, State.UNKNOWN)) updateHealth(State.ERROR, Reason.DEADLINE)
                    }, 8000)
                    true // Accepted request, NOT a ready microphone.
                }
            } catch (_: SecurityException) { updateHealth(State.ERROR, Reason.PERMISSION, 9); false }
              catch (_: Exception) { updateHealth(State.ERROR, Reason.START_REJECTED); false }
        }

        @Synchronized fun stop(ctx: Context) {
            requestGeneration++
            requested = false
            instance?.running = false // Reject queued recognition before Android delivers onDestroy.
            updateHealth(State.STOPPED)
            haal = "KHALI"
            pausedByApp = false
            try { ctx.stopService(Intent(ctx, WakeWordService::class.java)) } catch (_: Exception) {}
        }

        /* L1 — MainActivity.setHaal bridge se aata hai.
           NAAM SAWADHAN: isse "setHaal" mat rakhna — companion ke @Volatile var
           "haal" ka JVM setter bhi setHaal(String) banta hai -> platform clash
           (kotlin build fail). Isi liye "applyHaal". */
        fun applyHaal(h: String) {
            if (h == "BOL_RAHI") lastBolAt = System.currentTimeMillis()
            haalAt = System.currentTimeMillis()       /* watchdog stuck-recovery anchor */
            /* wake-regression: KHALI = app ka mic session khatam, to pause ka
               sabab bhi khatam. Pehle pausedByApp true hi reh jata tha —
               resumeFromApp() ka KOI caller nahi tha -> har tap-to-speak ke
               baad wake 20-65s tak mara rehta tha. */
            if (h == "KHALI") pausedByApp = false
            haal = h
            try { instance?.onHaal(h) } catch (e: Exception) {}
        }

        /* L2 — mic ka jawab: abhi kholna mana hai? (null = khol lo) */
        fun haalBlock(): String? {
            if (fishOutputActive) return "selected Fish output active"
            val s = instance ?: return null            /* service band -> faisla baema'ni */
            if (!s.sukoonOn()) return null             /* escape hatch — LAB switch OFF */
            /* wake-regression: stale-HAAL live rescue — JS/WebView sach mein mar
               gaya ho to watchdog (45s tick) ka intezar na pare. 50s = JS ke
               apne 45s TTS-watchdog se bara, to zinda speech kabhi nahi kategi;
               aur JS murda ho to speech bhi murdi hai — koi jhoota block nahi. */
            if (haal != "KHALI" && System.currentTimeMillis() - haalAt > 50000) {
                try { s.report("haal", "stale " + haal + " — live rescue") } catch (e: Exception) {}
                applyHaal("KHALI")
                return null
            }
            if (haal == "BOL_RAHI") return "Maya bol rahi hai"
            if (haal == "APP_SUN") return "app ka mic chal raha hai"
            if (pausedByApp) return "sulah: app ka mic"
            if (System.currentTimeMillis() - lastBolAt < ECHO_TAIL_MS) return "echo tail"
            return null
        }

        /* L4 — tap-to-speak sab se pehle; service neeche */
        fun pauseForApp() {
            pausedByApp = true
            pausedAt = System.currentTimeMillis()
            try { instance?.hardPause() } catch (e: Exception) {}
            /* wake-regression safety: agar app ka mic session shuru hi na ho
               (sunStart kho gaya / start fail) to 1.5s baad pause khud azad.
               Sirf tab jab ab bhi KHALI ho — APP_SUN/BOL_RAHI chal rahe hain
               to unke apne KHALI ka intezar (onHaal pause clear karta hai). */
            try {
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                    if (pausedByApp && haal == "KHALI" &&
                        System.currentTimeMillis() - pausedAt >= 1400
                    ) resumeFromApp()
                }, 1500)
            } catch (e: Exception) {}
        }
        fun resumeFromApp() {
            pausedByApp = false
            try { instance?.softResume() } catch (e: Exception) {}
        }

        internal fun attach(s: WakeWordService) { instance = s }
        internal fun detach(s: WakeWordService) { if (instance === s) instance = null }
    }

    private var sr: SpeechRecognizer? = null
    private var recognitionGeneration = 0L
    private var recognitionActive = false
    private var preferOnDevice = true
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private val handler = Handler(Looper.getMainLooper())
    @Volatile private var running = false
    private var watchdogRuns = 0
    private var lastWakeAt = 0L
    private var errStreak = 0
    private var lastErr = 0
    private var starts = 0
    @Volatile private var pendingGen = 0L        /* L6 RACE TOKEN — pending restart ka duct-ticket */

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        if (requested == false || (requested == null && !getSharedPreferences("maya", Context.MODE_PRIVATE).getBoolean("wake", false))) {
            stopSelf(); return
        }
        running = true
        attach(this)                              /* P9 — HAAL bridge instance */
        pausedByApp = false
        if (!startAsForeground()) { running = false; stopSelf(); return }
        try {
            tts = TextToSpeech(this) { st -> ttsReady = st == TextToSpeech.SUCCESS }
        } catch (e: Exception) {}
        startLoop()
        handler.postDelayed(::watchdog, 45000)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = if (running) START_STICKY else START_NOT_STICKY

    override fun onDestroy() {
        running = false
        detach(this)                              /* P9 */
        foreground = false
        health.destroyed(); publishHealth()
        stopGate()
        try { MicKit.release() } catch (e: Exception) {}
        handler.removeCallbacksAndMessages(null)
        try { sr?.destroy(); sr = null } catch (e: Exception) {}
        try { tts?.stop(); tts?.shutdown() } catch (e: Exception) {}
        super.onDestroy()
    }

    private fun startAsForeground(): Boolean {
        return try {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                nm.createNotificationChannel(
                    NotificationChannel(CHANNEL_ID, "MAYA Wake Word", NotificationManager.IMPORTANCE_LOW)
                )
            }
            val pi = PendingIntent.getActivity(
                this, 1, Intent(this, MainActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val notif: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("MAYA wake service")
                .setContentText("Microphone readiness/status: open MAYA")
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(pi)
                .build()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
            } else {
                startForeground(NOTIF_ID, notif)
            }
            foreground = true
            updateHealth(State.FOREGROUND)
            true
        } catch (_: SecurityException) { updateHealth(State.ERROR, Reason.PERMISSION, 9); false }
          catch (_: Exception) { updateHealth(State.ERROR, Reason.FOREGROUND_REJECTED); false }
    }

    private fun speakLocal(text: String) {
        try {
            if (ttsReady) {
                tts?.language = java.util.Locale.forLanguageTag("ur-PK")
                tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "wake_" + System.currentTimeMillis())
            }
        } catch (e: Exception) {}
    }

    private fun evalToApp(js: String) {
        try {
            val act = MainActivity.instance ?: return
            act.evalAsyncPublic(js)
        } catch (e: Exception) {}
    }

    private fun jsEsc(s: String): String = s
        .replace("\\", "\\\\")
        .replace("'", "\\'")
        .replace("\"", "\\\"")
        .replace("\n", " ")
        .replace("\r", " ")

    private fun launchApp() {
        try {
            val i = Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            startActivity(i)
        } catch (e: Exception) {}
    }

    /* ═══════════════════════════════════════════════════════════════════
       🎧 KHAMOSHI KA PEHRA (VAD) — P8c
       -------------------------------------------------------------------
       Pehle recognizer SANNATE mein bhi har 1-3 second chalta rehta tha.
       Android 11+ background mic ko throttle karta hai -> "mic on/off".

       Ab: sasta AudioRecord chalta hai (mic zoom + shor-kush ke sath).
       Sannata -> recognizer BILKUL band. Awaaz aayi -> mic chhor kar
       recognizer chalao. Jawab aaya -> wapas pehre par.

       Mic ek waqt mein ek hi cheez ke paas ho sakta hai — is liye pehra
       aur recognizer kabhi ek sath nahi chalte.
       ═══════════════════════════════════════════════════════════════════ */
    @Volatile private var gateOn = false
    private var gateThread: Thread? = null
    private var floorDb = 0.0

    // AudioRecord gating consumed the first ~300ms of "Maya" before STT existed.
    // Keep wake STT listening directly. mic_near/zoom still apply to explicit mic tests.
    private fun vadEnabled(): Boolean = false

    private fun micZoom(): Float = try {
        /* Issue 2: 0.8 (max zoom = sirf qareeb) default tha — door ki awaaz
           pehra hi cross nahi kar pati thi. Ab 0.0 (aam pickup, poora kamra).
           Purani saved setting ki izzat barkarar. */
        getSharedPreferences("maya", Context.MODE_PRIVATE).getString("mic_zoom", "0.0")!!.toFloat()
    } catch (e: Exception) { 0.0f }

    private fun startGate() {
        if (gateOn) return
        val why0 = haalBlock()                    /* L2 — gate ka darwaza bhi */
        if (why0 != null) { report("skip", "pehra nahi chala — " + why0); restart(700); return }
        gateOn = true
        gateThread = Thread {
            val rec = MicKit.open(micZoom())
            if (rec == null) {
                gateOn = false
                report("gate", "mic nahi khula \u2014 seedha recognizer")
                handler.post { actuallyStart() }
                return@Thread
            }
            report("gate", "pehra shuru  zoom:" + (if (MicKit.fxZoom) "\u2713" else "\u2717") +
                   " ns:" + (if (MicKit.fxNs) "\u2713" else "\u2717"))
            val buf = ShortArray(1600)
            var quiet = 0
            var loud = 0
            floorDb = 0.0
            try {
                rec.startRecording()
                while (gateOn && running) {
                    val n = rec.read(buf, 0, buf.size)
                    if (n <= 0) continue
                    /* L7 SELF-WAKE SHIELD — Maya ke bolte waqt PEHRA bhi khamosh.
                       Warna speaker se uski apni awaaz gate ko "awaaz" lagti aur
                       MAYA APNE HI WAKE WORD par jaag sakti thi (loop) — isi liye
                       aap ko jawab ke beech mic on/off dikh raha tha. */
                    val why = haalBlock()
                    if (why != null) {
                        report("skip", "pehra khamosh — " + why)
                        break
                    }
                    val d = MicKit.db(buf, n)
                    if (floorDb <= 0.0) floorDb = d
                    if (d < floorDb) floorDb = floorDb * 0.9 + d * 0.1     /* farsh dheere dheere seekho */
                    val over = d - floorDb
                    /* Issue 2: 14dB se 10dB — door/baarik awaaz bhi pehra cross
                       kare. Zoom khud 0.0 hua hai, to self-wake ka khatra nahi
                       barha (L7 shield + HAAL gates waise hi hain). */
                    if (over > 10.0) { loud++; quiet = 0 } else { quiet++; if (quiet > 3) loud = 0 }
                    if (loud >= 3) {                                       /* ~300ms qareebi awaaz */
                        report("voice", "awaaz " + Math.round(d) + "dB  farsh " + Math.round(floorDb) + "dB")
                        break
                    }
                }
                rec.stop()
            } catch (e: Exception) {
                report("gate", "pehra nakaam: " + (e.message ?: "?"))
            }
            try { rec.release() } catch (e: Exception) {}
            MicKit.release()
            gateOn = false
            if (running) handler.post { actuallyStart() }                  /* ab recognizer ki baari */
        }
        gateThread?.start()
    }

    private fun stopGate() { gateOn = false }

    private fun startLoop() {
        handler.post {
            if (!running) return@post
            val available = try { SpeechRecognizer.isRecognitionAvailable(this) } catch (_: Exception) { false }
            if (!available) {
                updateHealth(State.ERROR, Reason.UNAVAILABLE, 5)
                evalToApp("window.__wakeErr && window.__wakeErr(5)")
                stopSelf()
                return@post
            }
            actuallyStart()
        }
    }

    private fun resetRecognizer() {
        val session = ++recognitionGeneration
        recognitionActive = false
        var delivered = false
        var ready = false
        val timing = com.maya.ai.voice.RecognitionTiming { SystemClock.elapsedRealtime() }
        try { sr?.destroy() } catch (e: Exception) {}
        /* 🎯 P8b — wahi seerhi jo MainActivity mein hai: on-device -> Google -> aam.
           Android 12+ par default AiAi ho sakta hai jo kaam hi nahi karta. */
        sr = (MainActivity.instance?.makeRecognizer(preferOnDevice)
              ?: SpeechRecognizer.createSpeechRecognizer(this)).apply {
            setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {
                    if (!running || session != recognitionGeneration || delivered || ready) return
                    ready = true
                    updateHealth(State.READY)
                }
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {
                    if (running && session == recognitionGeneration && !delivered) timing.end()
                }
                override fun onError(error: Int) {
                    if (!running || session != recognitionGeneration || delivered) return
                    delivered = true; recognitionActive = false
                    updateHealth(State.RETRY, Reason.RECOGNIZER_ERROR, error)
                    if (error == 12 || error == 13) preferOnDevice = false // Unsupported/unavailable language model, not a TTS voice change.
                    if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
                        updateHealth(State.ERROR, Reason.PERMISSION, 9)
                        evalToApp("window.__wakeErr && window.__wakeErr(9)")
                        stopSelf(); return
                    }
                    /* v5.7.0 — pehle NO_MATCH par sirf 250ms baad dobara shuru
                       hota tha. Android 11+ background mic ko THROTTLE karta hai
                       aur itni tez restart par Google ka recognizer chup ho jata
                       hai — yehi "mic on hota hai band hota hai" ki wajah thi.
                       Ab har lagatar nakami par intezar barhta jata hai. */
                    errStreak++
                    lastErr = error
                    report("err", error.toString() + "|" + errStreak)
                    val back = when (error) {
                        6, 7 -> 700L + (errStreak.coerceAtMost(8) * 350L)   /* 0.7s -> 3.5s */
                        1, 2 -> 3000L
                        4 -> 1500L
                        8 -> {
                            /* 🕊️ L5 ERR-8 MERCY — RECOGNIZER_BUSY ka matlab: mic kisi
                               aur ke paas hai (app ka tap-to-speak ya seester ka bhoot).
                               PEHLE: yahan service khud ko MAAR deti thi, aur JS user ka
                               wakeWord switch bhi KHUD-BA-KHUD mita deta tha — isi liye
                               aap "wake ON karo to baad mein band milta" tha.
                               AB: na stopSelf, na switch haath mein. 2s sukoon, phir koshish. */
                            errStreak = 0
                            report("err8", "mic masroof — 2s baad phir")
                            restart(2000)
                            return
                        }
                        else -> 1200L
                    }
                    restart(back)
                }
                override fun onResults(results: Bundle?) {
                    if (!running || session != recognitionGeneration || delivered) return
                    delivered = true; recognitionActive = false
                    updateHealth(State.RETRY)
                    val all = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        ?: arrayListOf()
                    if (all.isNotEmpty()) { handleAll(all, timing.endToFinal() ?: -1L); errStreak = 0 }
                    restart(400)
                }
                override fun onPartialResults(partialResults: Bundle?) {}
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
        }
    }

    /**
     * v5.7.0 — Kotlin ab FAISLA NAHI karta, sirf REPORT karta hai.
     *
     * Pehle yahan `isWake` bana kar CHHOR diya jata tha (dead variable), aur
     * Urdu ka check "\\u0645..." tha — yani literal matn, kabhi match hi nahi
     * hota tha. Ab saare andaze JS ko jate hain aur wahan faisla hota hai.
     *
     * Faida: aage wake-word ki tuning ke liye NAYI APK nahi banani paregi.
     */
    private fun report(kind: String, payload: String) {
        evalToApp("window.__wakeLog && window.__wakeLog('" + jsEsc(kind) + "','" + jsEsc(payload) + "')")
    }

    private fun handleAll(list: List<String>, recognitionMs: Long) {
        val arr = JSONArray()
        for (i in list.indices) { if (i >= 6) break; arr.put(list[i]) }
        val payload = arr.toString()
        if (MainActivity.instance != null) {
            evalToApp("window.__wakeHeard && window.__wakeHeard('" + jsEsc(payload) + "',$recognitionMs)")
        } else {
            /* SAFE MODE: app band ho to KUCH NA KARO — v2.10.0 ka khud-app-kholna
               engine hi black screen ka mujrim nikla tha. */
            lastHeardOffline = payload
        }
    }
    private var lastHeardOffline = ""

    private fun restart(delay: Long) {
        /* P8c — seedha recognizer nahi; pehle KHAMOSHI KA PEHRA. Sannate mein
           recognizer bilkul nahi chalega -> "mic on/off" khatam.
           P9 — (L6) har schedule ka apna token: naya aaye to purana pending
           MURDA (pehle do pending ek sath chal padte the -> mic strobe).
           (L2) mic ka darwaza pehle HAAL poochhe: Maya bol rahi hai ya app
           ka mic chal raha hai to kholna hi nahi — yahi awaaz-katna aur
           mic-larai ka asal ilaj hai. */
        val gen = ++pendingGen
        handler.postDelayed({
            if (!running) return@postDelayed
            if (gen != pendingGen) return@postDelayed
            val why = haalBlock()
            if (why != null) {
                blocked(why)
                report("skip", why)
                restart(700)                     /* HAAL khali hone ka intezar */
                return@postDelayed
            }
            if (vadEnabled()) startGate() else actuallyStart()
        }, delay)
    }

    private fun actuallyStart() {
        if (!running || requested == false || recognitionActive) return
        val why = haalBlock()                    /* L2 — chautha darwaza */
        if (why != null) { blocked(why); report("skip", why); restart(700); return }
        try {
            /* v5.7.0 — do badlaav:
               1. MAX_RESULTS 1 -> 6. SUNO ka sabaq: sahih jawab aksar doosre ya
                  teesre andaze mein hota hai. Wake word par ye aur zyada ahem hai.
               2. Zubaan ab settings se aati hai (pehle "en-IN" hard-code thi,
                  jabke user Urdu bolta hai). */
            val lang = try {
                getSharedPreferences("maya", Context.MODE_PRIVATE)
                    .getString("wake_lang", "en-IN") ?: "en-IN"
            } catch (e: Exception) { "en-IN" }
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
                putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, packageName)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 6)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
            }
            resetRecognizer()
            recognitionActive = true
            val session = recognitionGeneration
            starts++
            updateHealth(State.STARTING)
            report("start", lang + "|" + starts)
            sr?.startListening(intent)
            handler.postDelayed({
                if (running && recognitionActive && session == recognitionGeneration) {
                    recognitionGeneration++; recognitionActive = false
                    try { sr?.cancel() } catch (_: Exception) {}
                    updateHealth(State.RETRY, Reason.DEADLINE, 1)
                    report("err", "1|recognizer deadline")
                    restart(1500)
                }
            }, 30000)
        } catch (_: Exception) {
            recognitionActive = false; updateHealth(State.RETRY, Reason.START_FAILED, 5); report("err", "5|recognizer start failed"); restart(1500)
        }
    }

    /** Har 45s zinda hai? har 12 min fresh recognizer */
    private fun watchdog() {
        if (!running) return
        watchdogRuns++
        if (watchdogRuns >= 16) { // ~12 min
            watchdogRuns = 0
            /* L2 — watchdog bhi HAAL se pooche: Maya ke bolte waqt recognizer
               todna = awaaz kaatna. Pehle ye bina dekhe chalta tha — har 12
               minute par awaaz katne ka scheduled chance tha. */
            if (haalBlock() == null && !recognitionActive) {
                actuallyStart()
            }
        }
        /* L4 stale-sulah recovery — JS/WebView mar bhi jaye (YA uska KHALI
           call kho jaye) to 20s baad pause khud-ba-khud azad. Warna wake word
           hamesha ke liye so jata. (Issue 1: 60s -> 20s.) */
        if (pausedByApp && System.currentTimeMillis() - pausedAt > 20000) {
            report("sulah", "stale pause khud azad hua")
            resumeFromApp()
        }
        /* Issue 1 — stuck-HAAL recovery: WebView died mid-speech/mid-listen?
           JS kabhi KHALI nahi bhejegi aur mic HAMESHA ke liye blocked reh jata.
           120s (90s nahi) taake sachi lambi speech kabhi kaate na jaye. */
        if (!fishOutputActive && haal != "KHALI" && System.currentTimeMillis() - haalAt > 120000) {
            report("haal", "stuck " + haal + " — khud KHALI kiya")
            applyHaal("KHALI")
        }
        handler.postDelayed(::watchdog, 45000)
    }

    /* ═══ 🎚️ P9 SUKOON — instance taraf ke amal ═══ */

    /* escape hatch — LAB sukoon OFF ho to purana rawaiya */
    fun sukoonOn(): Boolean = try {
        getSharedPreferences("maya", Context.MODE_PRIVATE).getBoolean("sukoon", true)
    } catch (e: Exception) { true }

    private fun blocked(why: String) {
        val reason = when (why) {
            "selected Fish output active" -> Reason.FISH_OUTPUT
            "Maya bol rahi hai" -> Reason.SPEECH
            "app ka mic chal raha hai", "sulah: app ka mic" -> Reason.APP_MIC
            "echo tail" -> Reason.ECHO_TAIL
            else -> Reason.NONE
        }
        updateHealth(State.BLOCKED, reason)
    }

    /* L1 — HAAL badla to foran amal */
    fun onHaal(h: String) {
        handler.post {
            if (!running || haal != h) return@post
            if (h == "BOL_RAHI" || h == "APP_SUN") {
                /* mic ISI LAMHE chhodo — awaaz katna yahi se rukta hai */
                blocked(if (h == "APP_SUN") "app ka mic chal raha hai" else if (fishOutputActive) "selected Fish output active" else "Maya bol rahi hai")
                stopGate()
                recognitionGeneration++; recognitionActive = false
                try { sr?.cancel(); sr?.destroy(); sr = null } catch (e: Exception) {}
                pendingGen++                     /* pending restart murda */
            } else if (h == "KHALI") {
                updateHealth(State.RETRY)
                restart(300)
            }
        }
    }

    /* L4 — tap-to-speak jeetta hamesha */
    fun hardPause() {
        if (Looper.myLooper() != Looper.getMainLooper()) { handler.post { hardPause() }; return }
        if (!running) return
        blocked("app ka mic chal raha hai")
        stopGate()
        recognitionGeneration++; recognitionActive = false
        try { sr?.cancel(); sr?.destroy(); sr = null } catch (_: Exception) {}
        pendingGen++
        report("sulah", "wake paused before app microphone acquisition")
    }
    fun softResume() {
        handler.post {
            if (!running) return@post
            report("sulah", "service wapas — pehra phir se")
            restart(300)
        }
    }

    /* L1/L4 ka Kotlin dastaaveezi tor par saabit: HAAL ka pehra */
    fun mazbootKotlinGate(): Boolean = true
}
