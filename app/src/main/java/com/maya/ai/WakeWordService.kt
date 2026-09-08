package com.maya.ai

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

/**
 * MAYA Wake Word Service 2.0 (Phase 10: ALWAYS-ON)
 * - Background mein hamesha sunta hai — "Maya" ya "Boss"
 * - App khula ho → WebView ke raaste poora flow (chime + listen + kaam)
 * - App band ho → apna TTS bolta hai + khud app khol deta hai
 * - Watchdog: har 45s check; har 12 min recognizer refresh
 */
class WakeWordService : Service() {

    companion object {
        const val CHANNEL_ID = "maya_wake"
        const val NOTIF_ID = 2001

        @Volatile var instance: WakeWordService? = null

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
        /* 🧭 v5.11.0 (1.1 / F02) — halat ka EK ghar ab `WakeState.kt` hai.
           Ye charon naam barqarar hain (poora code, panel aur tests inhi se baat
           karte hain) magar ab ye WakeState ke PAICHE (delegate) hain — owner,
           mudat (expiry) aur JS-heartbeat ke sath. PEHLE halat char jagah bikhri
           thi aur KISI ki koi mudat nahi thi: JS ka ek "KHALI" call kho jaye
           (WebView reload / screen off / JS exception) to Kotlin mein APP_SUN ya
           BOL_RAHI HAMESHA ke liye phans jata → wake par daimi pabandi, aur panel
           "HAAL: KHALI" likh kar jhoot bolta. */
        var haal: String
            get() = WakeState.haal
            set(v) { WakeState.set(v, if (v == "KHALI") "NONE" else "APP") }
        var lastBolAt: Long
            get() = WakeState.lastBolAt
            set(v) { WakeState.lastBolAt = v }
        var pausedByApp: Boolean
            get() = WakeState.pausedByApp
            set(v) { if (v) WakeState.pauseForApp() else WakeState.resumeFromApp() }
        var pausedAt: Long
            get() = WakeState.pausedAt
            set(v) { WakeState.pausedAt = v }
        const val ECHO_TAIL_MS = 550L                 /* JS SUKOON.tailMs se match */

        /* 🧭 1.1 — expiry ke constants (asal ghar WakeState, yahan hawala) */
        val PAUSE_EXP_MS = WakeState.PAUSE_EXP_MS     /* sulah: 8s (mic khali ho to) */
        val APP_SUN_EXP_MS = WakeState.APP_SUN_EXP_MS /* app ka mic: 30s */
        val BOL_EXP_MS = WakeState.BOL_EXP_MS         /* bolna: 20s */
        val SOCH_EXP_MS = WakeState.SOCH_EXP_MS       /* 🎵 K2.2: soch/turn lock: 60s */
        val HB_MS = WakeState.HB_MS                   /* JS heartbeat: 10s */
        val HB_MISS = WakeState.HB_MISS               /* 3 miss = JS murda → KHALI */

        /* 🧭 1.3 / 1.4 / 1.11 — KHAMOSHI KA PEHRA: calibration + spin + umar */
        const val CAL_MS = 800L                       /* farsh naapne ki khirki */
        const val CAL_FRAMES = 3                      /* itne saaf frame = calibration poora */
        const val FLOOR_DEFAULT = 34.0                /* frame hi na mile to andaza farsh */
        const val FLOOR_MIN = 20.0                    /* farsh ka clamp (F15: 62dB nahi) */
        const val FLOOR_MAX = 50.0
        const val TRIG_STEP = 14.0                    /* farsh se kitna upar = awaaz */
        const val TRIG_CAP = 72.0                     /* chokhat kabhi is se upar NAHI */
        const val FLOOR_DOWN = 0.10                   /* farsh neeche JALDI seekhe */
        const val FLOOR_UP = 0.005                    /* farsh upar DHEERE (shor barhe) */
        const val READ_STRIKES = 5                    /* n<0: itni dafa, phir mic tazaa */
        const val READ_SLEEP_MS = 8L                  /* n==0: CPU spin nahi, 8ms sukoon */
        const val GATE_LIFE_MS = 90000L               /* pehre ki zyada se zyada umar */
        /* 🎛️ J2.2 (F57) — wake ka ZINDA LEVEL JS tak: har 300ms ek push.
           Is se pehle wake ka dB sirf trigger wale log mein aata tha, yani
           "wake sun rahi hai ya murda hai" ka koi saboot NAZAR nahi aata tha. */
        const val LEVEL_PUSH_MS = 300L
        /* 🎛️ J2.3 — baat-cheet ke dauran wake ka poll DHEEMA (10s). Wajah: JS darwaza
           band hote hi KHUD talk(false) bhejta hai, is liye 3s ke poll ki zaroorat
           nahi — aur har poll `nSkip` ginti barhata hai (panel ka "roka gaya N"
           be-matlab barhta, jaisa F03 mein "sulah: app ka mic" spam ke sath hua tha). */
        const val TALK_POLL_MS = 10000L

        /* ═══ 🔬 v5.10.3 — NATIVE INSTRUMENT (F25/F27 ka ilaj) ═══
           PEHLE: saare counters SIRF JS (KAAN) mein rehte the aur report() bhi
           `MainActivity.instance ?: return` se jati thi. Yani WebView marte hi
           (screen off / app swipe / OEM kill) counters AUR wake ka nateeja dono
           zaya — `suna 0` ka do matlab ho sakta tha: recognizer behra tha, YA
           report raste mein giri. Hum apne hi instrument se andhe the.
           AB: har waqia PEHLE Kotlin mein darj hota hai, phir UI ko bheja jata
           hai. UI zinda ho ya murda — sach yahan mehfooz rehta hai. */
        const val EV_MAX = 60                        /* native ring buffer */
        const val SKIP_REPORT_MS = 15000L            /* F03 — skip-spam par lagam */
        const val BLOCKED_POLL_MS = 3000L            /* F03 — pehle 700ms tha */
        const val STALE_PAUSE_MS = 10000L            /* F05 — pehle 60000ms tha */

        @Volatile var alive: Boolean = false
        @Volatile var startedAt: Long = 0L
        @Volatile var nHeard = 0
        @Volatile var nErr = 0
        @Volatile var nStart = 0
        @Volatile var nSkip = 0
        @Volatile var nErr8 = 0
        @Volatile var nLastErr = 0
        @Volatile var nDead = 0
        @Volatile var nSentOk = 0L
        @Volatile var nDropped = 0L
        @Volatile var nLastWakeAt = 0L
        private val evBuf = ArrayList<String>()

        private fun esc(s: String): String = s.replace("\\", "\\\\").replace("\"", "\\\"")
            .replace("\n", " ").replace("\r", " ")

        /* har waqia PEHLE yahan — UI ki zindagi se azad (F25) */
        fun record(kind: String, payload: String) {
            try {
                synchronized(evBuf) {
                    evBuf.add("{\"t\":" + System.currentTimeMillis() + ",\"k\":\"" +
                              esc(kind) + "\",\"d\":\"" + esc(payload) + "\"}")
                    while (evBuf.size > EV_MAX) evBuf.removeAt(0)
                }
            } catch (e: Exception) {}
            when (kind) {
                "heard" -> nHeard++
                "wake" -> nLastWakeAt = System.currentTimeMillis()
                "err" -> { nErr++; nLastErr = payload.substringBefore("|").toIntOrNull() ?: 0 }
                "err8" -> nErr8++
                "start" -> nStart++
                "dead" -> nDead++
            }
        }

        /* UI zinda hote hi poora buffer ek dafa mein (warna agle boot par) */
        fun drainEvents(): String {
            val out = StringBuilder("[")
            try {
                synchronized(evBuf) {
                    for (i in evBuf.indices) { if (i > 0) out.append(","); out.append(evBuf[i]) }
                    evBuf.clear()
                }
            } catch (e: Exception) {}
            return out.append("]").toString()
        }

        /* 🔬 F04 — panel ka "HAAL: KHALI" JHOOT tha (wo JS ka haal tha, jabke
           Kotlin mein pausedByApp=true phansa tha). Ab Kotlin ka poora sach. */
        fun stateJson(): String {
            val ins = instance
            if (ins != null) { try { return ins.stateBits() } catch (e: Exception) {} }
            val s = StringBuilder("{")
            s.append("\"alive\":false,\"running\":false")
            s.append(",\"haal\":\"" + esc(haal) + "\"")
            s.append(",\"pausedByApp\":" + (if (pausedByApp) "true" else "false"))
            s.append(",\"block\":\"" + esc(haalBlock() ?: "") + "\"")
            s.append(",\"nHeard\":" + nHeard + ",\"nErr\":" + nErr)
            s.append(",\"nStart\":" + nStart + ",\"nSkip\":" + nSkip)
            s.append(",\"nLastErr\":" + nLastErr + ",\"nDead\":" + nDead)
            s.append(",\"dropped\":" + nDropped)
            return s.append("}").toString()
        }

        fun start(ctx: Context) {
            try {
                val i = Intent(ctx, WakeWordService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i)
                else ctx.startService(i)
            } catch (e: Exception) {}
        }

        fun stop(ctx: Context) {
            haal = "KHALI"
            pausedByApp = false
            try { ctx.stopService(Intent(ctx, WakeWordService::class.java)) } catch (e: Exception) {}
        }

        /* L1 — MainActivity.setHaal bridge se aata hai.
           NAAM SAWADHAN: isse "setHaal" mat rakhna — companion ke @Volatile var
           "haal" ka JVM setter bhi setHaal(String) banta hai -> platform clash
           (kotlin build fail). Isi liye "applyHaal". */
        fun applyHaal(h: String) {
            WakeState.set(h, "APP")                    /* 🧭 1.1 — owner ke sath */
            WakeState.lastBeat = System.currentTimeMillis()
            try { instance?.onHaal(h) } catch (e: Exception) {}
        }

        /* 🧭 1.2 — JS ka HAR 10s heartbeat: "main zinda hun, haal ye hai".
           Teen heartbeat gayab = JS/WebView mar chuka → Kotlin KHUD KHALI ho jata
           hai (pehle wake us murda HAAL ki wajah se daimi band reh jati thi). */
        fun heartbeat(h: String?) {
            val why = WakeState.enforceExpiry()
            if (why != null) { try { instance?.onSelfFix(why) } catch (e: Exception) {} }
            WakeState.beat(h)
        }

        /* 🧭 1.2 — WebView reload / boot par poora resync (JS ka dedup bypass ho kar) */
        fun resyncHaal(h: String) {
            WakeState.resync(h)
            try { instance?.onHaal(h) } catch (e: Exception) {}
        }

        /* 🧭 1.12 (F41) — app wapas aayi: wake ki sehat ka check. Wake ruki hui thi
           (ijazat / murda haal) to darwaza khulta hai — magar MIC PAR HAMLA NAHI
           agar recognizer ya pehra pehle se chal raha hai (wahi purani jang). */
        fun healthKick() {
            try { instance?.kick() } catch (e: Exception) {}
        }

        /* L2 — mic ka jawab: abhi kholna mana hai? (null = khol lo) */
        fun haalBlock(): String? {
            val s = instance ?: return null            /* service band -> faisla baema'ni */
            if (!s.sukoonOn()) return null             /* escape hatch — LAB switch OFF */
            /* 🧭 1.1 (F02) — pehle MUDAT dekho: jo halat apni expiry se aage nikal
               chuki usay khud KHALI karo (self-fix ginti panel par jati hai). */
            val fix = WakeState.enforceExpiry()
            if (fix != null) { try { s.onSelfFix(fix) } catch (e: Exception) {} }
            if (haal == "BOL_RAHI") return "Maya bol rahi hai"
            if (haal == "APP_SUN") return "app ka mic chal raha hai"
            /* 🎵 v5.14.0 K2.2 (F74) — SOCH_RAHI: jawab socha ja raha hai (tool / stream),
               awaaz abhi shuru nahi hui. PEHLE ye mudat KHALI maani jati thi → wake ka mic
               khul jata → do jawab ek sath takra jate ("ek baar boli, phir kuch nahi aaya") */
            if (haal == "SOCH_RAHI") return "Maya jawab soch rahi hai (" + (WakeState.age() / 1000L) + "s)"
            if (pausedByApp) return "sulah: app ka mic"
            /* 🎛️ J2.3 (F56) — BAAT-CHEET MODE: darwaza khula ho to wake ka mic
               BAND. Faida: (1) ek turn mein mic EK dafa khulta hai (pehle wake ka
               recognizer + app ka mic = DO, aur system mic-dot dobara jhilmilata
               tha); (2) wake ke baad 400ms ki andhi race khatam — handoff ab HAAL
               dekh kar hota hai; (3) gate ka 90s reopen bhi isi darwaze se rukta
               hai (J2.5), kyunke restart() pehle haalBlock() se poochta hai. */
            if (s.talkPrefOn() && WakeState.talkActive())
                return "baat-cheet: darwaza khula (" + (WakeState.talkLeft() / 1000L) + "s)"
            if (System.currentTimeMillis() - lastBolAt < ECHO_TAIL_MS) return "echo tail"
            return null
        }

        /* 🎛️ J2.3 — baat-cheet mode ka darwaza (JS se): WakeState + service dono */
        fun talkMode(on: Boolean) {
            if (on) WakeState.talkOn() else WakeState.talkOff()
            try { instance?.onTalk(on) } catch (e: Exception) {}
        }

        /* L4 — tap-to-speak sab se pehle; service neeche */
        fun pauseForApp() {
            WakeState.pauseForApp()
            try { instance?.hardPause() } catch (e: Exception) {}
        }
        fun resumeFromApp() {
            WakeState.resumeFromApp()
            try { instance?.softResume() } catch (e: Exception) {}
        }

        internal fun attach(s: WakeWordService) { instance = s }
        internal fun detach(s: WakeWordService) { if (instance === s) instance = null }
    }

    private var sr: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private val handler = Handler(Looper.getMainLooper())
    @Volatile private var running = false
    private var watchdogRuns = 0
    private var lastWakeAt = 0L
    /* 🧭 1.8 (F19) — "is session" ki lagatar nakami ab WakeState mein, aur KUL
       nakami (`errTotal`) alag. PEHLE errStreak sirf result/err8 par reset hota
       tha, is liye panel ka "lagatar 15" adhoora sach tha (starts=7 jabke err=15).
       Ab har kamyab session (onReadyForSpeech) streak saaf karta hai. */
    private var errStreak: Int
        get() = WakeState.errStreak
        set(v) { WakeState.errStreak = v }
    private var lastErr = 0
    private var starts = 0
    @Volatile private var listening = false   /* 🧭 1.12 — recognizer abhi mic par hai? */
    @Volatile private var loopHeld = false      /* 🧭 1.9 (F35) — mic ijazat ke baghair loop ruka */
    @Volatile private var fgsOk = true          /* 🧭 1.9 (F29) — foreground bana ya nahi */
    private var lastFixReportAt = 0L
    @Volatile private var pendingGen = 0L        /* L6 RACE TOKEN — pending restart ka duct-ticket */

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        running = true
        attach(this)                              /* P9 — HAAL bridge instance */
        alive = true                              /* 🔬 v5.10.3 — native instrument */
        startedAt = System.currentTimeMillis()
        startAsForeground()
        try {
            tts = TextToSpeech(this) { st -> ttsReady = st == TextToSpeech.SUCCESS }
        } catch (e: Exception) {}
        /* 🧭 1.9 (F29/F35) — mic ki ijazat na ho to loop SHURU HI NA HO.
           PEHLE: loop chalta tha aur har chand second error 9 khata tha (battery,
           log spam, cloud hammer) — aur notification "hamesha sun rahi hai" ka
           JHOOT likhe rehti thi. Ab: wake rukti hai, user ko SAAF bataya jata hai,
           aur watchdog ijazat milte hi khud shuru kar deta hai. */
        if (micGranted()) {
            startLoop()
        } else {
            loopHeld = true
            record("dead", "9|mic ki ijazat nahi — wake ruki hui hai")
            notifyState(true, "Mic ki ijazat chahiye — \u201CIjazat do\u201D dabayen")
            evalToApp("window.__wakeErr && window.__wakeErr(9)")
        }
        handler.postDelayed(::watchdog, 45000)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onDestroy() {
        running = false
        alive = false
        detach(this)                              /* P9 */
        stopGate()
        try { MicKit.release() } catch (e: Exception) {}
        handler.removeCallbacksAndMessages(null)
        try { sr?.destroy(); sr = null } catch (e: Exception) {}
        try { tts?.stop(); tts?.shutdown() } catch (e: Exception) {}
        super.onDestroy()
    }

    private fun startAsForeground() {
        try {
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
                .setContentTitle("MAYA hamesha sun rahi hai \uD83D\uDC42")
                .setContentText("Bolo: \u201CMaya\u201D ya \u201CBoss\u201D — kahin se bhi")
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(pi)
                .build()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
            } else {
                startForeground(NOTIF_ID, notif)
            }
            fgsOk = true
        } catch (e: Throwable) {
            /* 🧭 1.9 (F29) — PEHLE ye `catch (e: Exception) {}` tha: foreground
               service ban na sakti (Android 14 ka FGS-mic qanoon, ijazat, OEM) to
               service CHUP-CHAAP beemar reh jati aur humein kabhi pata na chalta —
               har empty catch ek report ka maangta hai. Ab: report + alive=false
               + notification par "wake beemar". */
            fgsOk = false
            alive = false
            record("fgs", "foreground service nahi bani: " + e.javaClass.simpleName)
            notifyState(true, "Wake beemar — " + e.javaClass.simpleName)
        }
    }

    /* 🧭 1.9/1.10 (F29/F35) — notification ab halat ke sath sach bolti hai.
       Sehatmand = wahi purani line; beemar = "⚠️ wake beemar" + seedha darwaza
       ("Ijazat do" → app-info screen). Blind intent-chain nahi, wahi rasta jo
       v5.10.x mein device par chalta dekha gaya. */
    @Volatile private var notifSick = false
    private fun notifyState(sick: Boolean, text: String) {
        if (!sick && !notifSick) return               /* sehatmand bar bar nahi banati */
        notifSick = sick
        try {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val b = NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(if (sick) "\u26A0\uFE0F MAYA wake beemar" else "MAYA hamesha sun rahi hai \uD83D\uDC42")
                .setContentText(text)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(PendingIntent.getActivity(
                    this, 1,
                    Intent(this, MainActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
            if (sick) {
                b.addAction(0, "Ijazat do", PendingIntent.getActivity(
                    this, 2,
                    Intent(this, MainActivity::class.java)
                        .putExtra("maya_open", "appinfo")
                        .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
            }
            nm.notify(NOTIF_ID, b.build())
        } catch (e: Throwable) {
            record("fgs", "notification nahi bani: " + e.javaClass.simpleName)
        }
    }

    /* 🧭 1.9 (F35) — mic ki ijazat ka asal haal (guess nahi) */
    private fun micGranted(): Boolean = try {
        androidx.core.content.ContextCompat.checkSelfPermission(
            this, android.Manifest.permission.RECORD_AUDIO
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
    } catch (e: Throwable) { true }

    /* 🧭 1.12 (F41) — app ke wapas aane par sehat ka darwaza */
    fun kick() {
        handler.post {
            if (!running) return@post
            val fix = WakeState.enforceExpiry()
            if (fix != null) onSelfFix(fix)
            if (loopHeld && micGranted()) {
                loopHeld = false
                notifyState(false, "Bolo: \u201CMaya\u201D ya \u201CBoss\u201D \u2014 kahin se bhi")
                startLoop()
                return@post
            }
            if (!listening && !gateOn && haalBlock() == null) restart(200)
        }
    }

    /* 🧭 1.1 — expiry ne khud sudhara to user ko batana (rate-limited) */
    fun onSelfFix(why: String) {
        val now = System.currentTimeMillis()
        if (now - lastFixReportAt < 5000L) return     /* har darwaze par ek hi baat */
        lastFixReportAt = now
        report("haal", "khud-sudhaar: " + why)
        /* mic pehle se kisi ke paas ho to hamla nahi (warna wahi error 3/8) */
        if (pausedByApp || listening || gateOn) return
        handler.post { restart(300) }                 /* pabandi hati → wake wapas */
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
    @Volatile private var gateThread: Thread? = null
    private var floorDb = 0.0
    @Volatile private var trigDb = 0.0        /* 🧭 1.3 — chokhat (farsh + TRIG_STEP, cap 72dB) */
    @Volatile private var calOk = false       /* 🧭 1.11 — calibration poora hua ya adhoora */
    @Volatile private var gateLoops = 0L      /* kitni dafa pehra chala (panel ke liye) */

    private fun vadEnabled(): Boolean = try {
        getSharedPreferences("maya", Context.MODE_PRIVATE).getBoolean("mic_near", true)
    } catch (e: Exception) { true }

    private fun micZoom(): Float = try {
        getSharedPreferences("maya", Context.MODE_PRIVATE).getString("mic_zoom", "0.8")!!.toFloat()
    } catch (e: Exception) { 0.8f }

    private fun startGate() {
        if (gateOn) return
        val why0 = haalBlock()                    /* L2 — gate ka darwaza bhi */
        if (why0 != null) { reportSkip("pehra nahi chala — " + why0); restart(BLOCKED_POLL_MS); return }
        gateOn = true
        gateThread = Thread {
            val rec = MicKit.open(micZoom())
            if (rec == null) {
                gateOn = false
                report("gate", "mic nahi khula \u2014 seedha recognizer")
                handler.post { actuallyStart() }
                return@Thread
            }
            gateLoops++
            report("gate", "pehra shuru  zoom:" + (if (MicKit.fxZoom) "\u2713" else "\u2717") +
                   " ns:" + (if (MicKit.fxNs) "\u2713" else "\u2717"))
            val buf = ShortArray(1600)
            var quiet = 0
            var loud = 0
            var strikes = 0
            var calFrames = 0
            var calMin = 99.0
            var calDone = false
            var why = "stop"                   /* voice | blocked | read | life | stop */
            floorDb = 0.0
            trigDb = 0.0
            calOk = false
            val gateUntil = System.currentTimeMillis() + GATE_LIFE_MS   /* 🧭 1.4 — umar */
            val calUntil = System.currentTimeMillis() + CAL_MS          /* 🧭 1.3 — khirki */
            try {
                rec.startRecording()
                while (gateOn && running && System.currentTimeMillis() < gateUntil) {
                    val n = rec.read(buf, 0, buf.size)
                    /* 🧭 1.4 (F16) — PEHLE `if (n <= 0) continue` tha: read-error par
                       100% CPU ka INFINITE SPIN (battery + garmi + mic mar jata) aur
                       koi timeout nahi. Ab: n<0 par ginti, 5 strike = mic tazaa;
                       n==0 par 8ms sukoon (spin nahi). */
                    if (n < 0) {
                        strikes++
                        if (strikes >= READ_STRIKES) { why = "read"; break }
                        try { Thread.sleep(READ_SLEEP_MS) } catch (e: InterruptedException) { break }
                        continue
                    }
                    if (n == 0) {
                        try { Thread.sleep(READ_SLEEP_MS) } catch (e: InterruptedException) { break }
                        continue
                    }
                    strikes = 0
                    /* L7 SELF-WAKE SHIELD — Maya ke bolte waqt PEHRA bhi khamosh.
                       Warna speaker se uski apni awaaz gate ko "awaaz" lagti aur
                       MAYA APNE HI WAKE WORD par jaag sakti thi (loop) — isi liye
                       aap ko jawab ke beech mic on/off dikh raha tha. */
                    val blocked = haalBlock()
                    if (blocked != null) {
                        reportSkip("pehra khamosh — " + blocked)
                        why = "blocked"
                        break
                    }
                    val d = MicKit.db(buf, n)
                    pushLevel(d, 1)              /* 🎛️ J2.2 — pehra ka zinda level (mode 1) */
                    /* 🧭 1.3 + 1.11 (F15/F42) — CALIBRATION WINDOW (800ms):
                       PEHLE farsh PEHLE sample par LATCH ho jata tha aur sirf NEECHE
                       ja sakta tha. Nateeja: agar pehla frame kisi shor/AGC ka tha to
                       farsh 62dB ban jata, chokhat 76dB — aur aap ke CHILLANE par bhi
                       wake na khulti ("awaaz 77dB farsh 62dB" wala log).
                       Ab: pehle 800ms khamoshi ka farsh NAAPA jata hai (kam az kam 3
                       saaf frame; read==0/negative frame farsh ko CHHOOTA hi nahi —
                       khamoshi ko farsh samajhna ghalat hai). Is dauran koi trigger nahi. */
                    if (!calDone) {
                        if (d > 0.0) { calFrames++; if (d < calMin) calMin = d }
                        if (System.currentTimeMillis() >= calUntil) {
                            val f = if (calFrames > 0 && calMin < 99.0) calMin else FLOOR_DEFAULT
                            floorDb = f.coerceIn(FLOOR_MIN, FLOOR_MAX)
                            trigDb = (floorDb + TRIG_STEP).coerceAtMost(TRIG_CAP)
                            calOk = calFrames >= CAL_FRAMES
                            calDone = true
                            report("gate", "farsh " + Math.round(floorDb) + "dB  chokhat " +
                                   Math.round(trigDb) + "dB  frame " + calFrames +
                                   (if (calOk) "" else " (calibration adhoora)"))
                        }
                        continue
                    }
                    /* 🧭 1.3 (F15) — farsh ab DONO taraf seekhta hai: neeche jaldi
                       (0.10), upar dheere (0.005) — warna shor barhne par chokhat
                       hamesha neeche reh jati aur false-wake shuru. Clamp 20..50 aur
                       chokhat par ABSOLUTE CAP (72dB) — chillane par bhi wake khule. */
                    if (d < floorDb) floorDb = floorDb * (1.0 - FLOOR_DOWN) + d * FLOOR_DOWN
                    else floorDb = floorDb * (1.0 - FLOOR_UP) + d * FLOOR_UP
                    floorDb = floorDb.coerceIn(FLOOR_MIN, FLOOR_MAX)
                    trigDb = (floorDb + TRIG_STEP).coerceAtMost(TRIG_CAP)
                    val over = d - floorDb
                    if (over > TRIG_STEP || d >= trigDb) { loud++; quiet = 0 }
                    else { quiet++; if (quiet > 3) loud = 0 }
                    if (loud >= 3) {                                       /* ~300ms qareebi awaaz */
                        report("voice", "awaaz " + Math.round(d) + "dB  farsh " +
                               Math.round(floorDb) + "dB  chokhat " + Math.round(trigDb) + "dB")
                        why = "voice"
                        break
                    }
                }
                rec.stop()
            } catch (e: Exception) {
                report("gate", "pehra nakaam: " + (e.message ?: "?"))
                if (why == "stop") why = "read"
            }
            if (why == "stop" && System.currentTimeMillis() >= gateUntil) why = "life"
            try { rec.release() } catch (e: Exception) {}
            MicKit.release()
            gateOn = false
            gateThread = null
            if (!running) return@Thread
            /* 🧭 1.5 (F17) — PEHLE har exit par `actuallyStart()` post hota tha, CHAHE
               gate bahar se band kiya gaya ho (onHaal / hardPause = app ka mic khul
               raha hai). Nateeja: wake ka recognizer usi lamhe mic par hamla karta →
               error 3/8 aur Maya ki awaaz kat jati. Ab exit ki WAJAH dekhi jati hai. */
            when (why) {
                "voice" -> handler.post { actuallyStart() }      /* ab recognizer ki baari */
                "stop"  -> { /* bahar se band (sulah) — koi race nahi, kuch mat karo */ }
                "life"  -> {
                    report("gate", "pehre ki umar khatam (" + (GATE_LIFE_MS / 1000L) + "s) — mic tazaa")
                    handler.post { restart(200) }
                }
                else    -> handler.post { restart(200) }         /* blocked / read — wapas pehre par */
            }
        }
        gateThread?.start()
    }

    /* 🧭 1.5 (F17) — pehle sirf `gateOn = false` tha: thread kaam khatam karne tak
       MIC PAR rehta (AudioRecord release nahi, join nahi). Isi liye app ka mic
       khulte hi error 3/8 aata tha. Ab: flag off → 250ms join → audio-effects
       release. (AudioRecord khud thread release karta hai — dobara release crash.) */
    private fun stopGate() {
        gateOn = false
        val t = gateThread
        if (t != null && t !== Thread.currentThread()) {
            try { t.join(250) } catch (e: Exception) {}
        }
        gateThread = null
        try { MicKit.release() } catch (e: Exception) {}
    }

    private fun startLoop() {
        handler.post {
            if (!SpeechRecognizer.isRecognitionAvailable(this)) {
                evalToApp("window.__wakeErr && window.__wakeErr(5)")
                stopSelf()
                return@post
            }
            resetRecognizer()
            actuallyStart()
        }
    }

    private fun resetRecognizer() {
        try { sr?.destroy() } catch (e: Exception) {}
        /* 🎯 P8b — wahi seerhi jo MainActivity mein hai: on-device -> Google -> aam.
           Android 12+ par default AiAi ho sakta hai jo kaam hi nahi karta. */
        try {
        /* 🧭 1.6 (F13) — wake ka APNA recognizer, SERVICE ke context se. PEHLE ye
           `MainActivity.instance?.makeRecognizer()` se banta tha: Activity mari
           (screen off / OEM kill) to wake chupke se `default` par gir jati thi, aur
           `lastRecognizerKind` SHARED hone ki wajah se DOCTOR bhi jhoot bolta tha
           ("using: on-device" jabke wake asal mein default chala rahi thi). */
        sr = (makeWakeRecognizer()
              ?: MainActivity.instance?.makeRecognizer()
              ?: SpeechRecognizer.createSpeechRecognizer(this)).apply {
            setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {
                    /* 🧭 1.8 (F19) — kamyab session: streak SAAF (KUL ginti barqarar).
                       🧭 1.6 — aur jo candidate CHALA usay yaad rakho: saboot, andaza
                       nahi. (Forensic ka "har candidate par test session" wala idea
                       JAAN BOOJH kar nahi kiya — do recognizer ek sath mic par = wahi
                       error 8 / mic jang jo Phase 0 mein mari thi.) */
                    WakeState.sessionOk()
                    rememberWakeRec()
                }
                override fun onBeginningOfSpeech() {}
                /* 🎛️ J2.2 (F57) — PEHLE ye KHALI tha: wake ke recognizer wale daur
                   mein level ka koi zariya hi nahi tha (gate sirf khamoshi naapta
                   hai). Ab recognizer ka apna RMS bhi JS tak jata hai (mode 2), yani
                   bar wake ke DONO daur mein saans leta hai. */
                override fun onRmsChanged(rmsdB: Float) { pushLevel(rmsdB.toDouble(), 2) }
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {}
                override fun onError(error: Int) {
                    /* v5.7.0 — pehle NO_MATCH par sirf 250ms baad dobara shuru
                       hota tha. Android 11+ background mic ko THROTTLE karta hai
                       aur itni tez restart par Google ka recognizer chup ho jata
                       hai — yehi "mic on hota hai band hota hai" ki wajah thi.
                       Ab har lagatar nakami par intezar barhta jata hai. */
                    listening = false
                    WakeState.sessionErr()   /* 🧭 1.8 — streak AUR kul (errTotal) dono */
                    lastErr = error
                    report("err", error.toString() + "|" + errStreak)

                    /* 🕊️ L5 ERR-8 MERCY — RECOGNIZER_BUSY ka matlab: mic kisi aur ke
                       paas hai (app ka tap-to-speak ya seester ka bhoot). PEHLE: yahan
                       service khud ko MAAR deti thi, aur JS user ka wakeWord switch bhi
                       KHUD-BA-KHUD mita deta tha. AB: na stopSelf, na switch haath mein. */
                    if (error == 8) {
                        errStreak = 0
                        report("err8", "mic masroof — 2s baad phir")
                        restart(2000)
                        return
                    }

                    /* 🔬 F35 — ERROR_INSUFFICIENT_PERMISSIONS: mic ki ijazat gayab.
                       Har 1.2s hammer bekaar hai; user ko batana zaroori hai. */
                    if (error == 9) {
                        report("dead", "9|mic ki ijazat nahi — wake ruk gayi")
                        /* 🧭 1.10 (F35) — circuit open + notification par seedha
                           darwaza ("Ijazat do"). Pehle sirf toast tha: user ko khud
                           Settings dhoondhna parta tha. */
                        loopHeld = true
                        notifyState(true, "Mic ki ijazat chahiye \u2014 \u201CIjazat do\u201D dabayen")
                        evalToApp("window.__wakeErr && window.__wakeErr(9)")
                        restart(60000)
                        return
                    }

                    /* 🔬 F09 — PEHLE 10..15 sab `else -> 1200L` par girte the:
                       error 11 (SERVER_DISCONNECTED) par har 1.2 second naya cloud
                       hamla, lagatar 15 dafa — yani hamari retry policy KHUD beemari
                       ko feed kar rahi thi (AOSP: ERROR_TOO_MANY_REQUESTS isi se aata
                       hai). AB: har code ka apna base + errStreak se escalation
                       (x1,x2,x4,x8,x16) + 30s cap. */
                    val base = when (error) {
                        6, 7 -> 700L
                        1, 2 -> 3000L
                        4 -> 1500L
                        10 -> 5000L              /* TOO_MANY_REQUESTS — thoka hum ne hai */
                        11 -> 1500L              /* SERVER_DISCONNECTED */
                        12, 13 -> 8000L          /* LANGUAGE not supported / unavailable */
                        else -> 1200L
                    }
                    val stepped = if (error == 6 || error == 7) {
                        base + (errStreak.coerceAtMost(8) * 350L)      /* 0.7s -> 3.5s (purana rawaiya) */
                    } else {
                        base * (1L shl (errStreak - 1).coerceAtMost(4))
                    }
                    val back = stepped.coerceAtMost(30000L)

                    /* 3 lagatar nakami = service ka connection khud mar chuka hai */
                    if (errStreak >= 3) { try { resetRecognizer() } catch (e: Throwable) {} }
                    /* 🧭 1.6 — 4 lagatar nakami = ye candidate is phone par kaam ka
                       nahi: prefs se bhool jao, taake agla resetRecognizer() AGLA
                       candidate azmaye (self-healing — user ke haath ka kaam nahi). */
                    if (errStreak == 4) { forgetWakeRec("4 lagatar nakami") }

                    /* 🔬 F10 — CIRCUIT OPEN: chup-chaap marna band, user ko khabar.
                       ⚠ settings.wakeWord ko HAATH NAHI lagate — P9 ka wada barqarar
                       ("wake ON karo to baad mein khud band milta tha" wala bug). */
                    if (errStreak == 5) {
                        report("dead", error.toString() + "|circuit open — 5 lagatar nakami, ab sust koshish")
                        evalToApp("window.__wakeErr && window.__wakeErr(" + error + ")")
                    }
                    restart(back)
                }
                override fun onResults(results: Bundle?) {
                    val all = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        ?: arrayListOf()
                    listening = false
                    if (all.isNotEmpty()) { handleAll(all); errStreak = 0; WakeState.sessionOk() }
                    restart(400)
                }
                override fun onPartialResults(partialResults: Bundle?) {}
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
        }
        } catch (e: Throwable) {
            /* 🔬 v5.10.3 — OEM par recognizer banane mein dhamaka ho to service
               CRASH na ho; chup-chaap nakami bhi na guzre. */
            report("gate", "recognizer bana nahi: " + e.javaClass.simpleName)
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
        record(kind, payload)                     /* 🔬 F25 — pehle Kotlin mein darj */
        val act = MainActivity.instance
        val js = "window.__wakeLog && window.__wakeLog('" + jsEsc(kind) + "','" + jsEsc(payload) + "')"
        /* 🔬 F27 — murda WebView par JS thonsna band; delivery ka hisab bhi */
        if (act != null && act.evalPublicOk(js)) nSentOk++ else nDropped++
    }

    /* 🔬 F03 — pehle har 700ms ek skip report: 67 dafa "sulah: app ka mic" ne
       KAAN ka 40-entry log bhar diya tha aur asal tareekh MIT gayi thi (hum
       apne hi diagnostic se andhe ho gaye). Ab: pehli bar foran, phir har 15s,
       aur sath chalti ginti (x N). Block hat-te hi counter reset. */
    private var lastSkipAt = 0L
    private var skipRun = 0
    private fun reportSkip(why: String) {
        nSkip++
        skipRun++
        val now = System.currentTimeMillis()
        if (lastSkipAt == 0L || now - lastSkipAt >= SKIP_REPORT_MS) {
            lastSkipAt = now
            report("skip", why + "  (x" + skipRun + ")")
        }
    }
    private fun skipReset() { skipRun = 0; lastSkipAt = 0L }

    private fun handleAll(list: List<String>) {
        val arr = JSONArray()
        for (i in list.indices) { if (i >= 6) break; arr.put(list[i]) }
        val payload = arr.toString()
        /* 🔬 F25 — recognizer ne kya suna, ye NATIVE counter mein bhi darj ho:
           pehle `suna 0` ambiguous tha (behra recognizer YA zaya hui report). */
        record("heard", payload)
        val act = MainActivity.instance
        val js = "window.__wakeHeard && window.__wakeHeard('" + jsEsc(payload) + "')"
        if (act != null && act.evalPublicOk(js)) {
            nSentOk++
        } else {
            /* SAFE MODE: app band ho to KUCH NA KARO — v2.10.0 ka khud-app-kholna
               engine hi black screen ka mujrim nikla tha.
               🔬 F25: magar ab ye waqia CHUPKE ZAYA NAHI HOTA — native buffer mein
               mehfooz hai, aur `heardOffline` ginti panel par nazar aati hai.
               (Poori native action-path Phase 3 mein: chime + launchApp.) */
            lastHeardOffline = payload
            heardOffline++
            nDropped++
        }
    }
    private var lastHeardOffline = ""
    @Volatile private var heardOffline = 0        /* 🔬 F25 — kitni wake UI ki maut ki wajah se girin */

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
                reportSkip(why)                  /* 🔬 F03 — spam nahi, hisab ke sath */
                /* 🎛️ J2.3 — baat-cheet mein intezar lamba (JS khud talk(false) bhejta hai) */
                restart(if (why.startsWith("baat-cheet")) TALK_POLL_MS else BLOCKED_POLL_MS)
                return@postDelayed
            }
            skipReset()                          /* 🔬 F03 — darwaza khul gaya, ginti saaf */
            if (vadEnabled()) startGate() else actuallyStart()
        }, delay)
    }

    private fun actuallyStart() {
        if (!running) return
        val why = haalBlock()                    /* L2 — chautha darwaza */
        if (why != null) {
            reportSkip(why)
            /* 🎛️ J2.3 — baat-cheet ke dauran dheema poll (10s), warna 3s */
            restart(if (why.startsWith("baat-cheet")) TALK_POLL_MS else BLOCKED_POLL_MS)
            return
        }
        skipReset()
        try {
            /* v5.7.0 — do badlaav:
               1. MAX_RESULTS 1 -> 6. SUNO ka sabaq: sahih jawab aksar doosre ya
                  teesre andaze mein hota hai. Wake word par ye aur zyada ahem hai.
               2. Zubaan ab settings se aati hai (pehle "en-IN" hard-code thi,
                  jabke user Urdu bolta hai). */
            val lang = wakeLangNow()          /* 🔬 F12 — ab STT se azad (default en-IN) */
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
                putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, packageName)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 6)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
                /* 🧭 1.7 (F14) — session shaping: PEHLE wake intent mein silence /
                   minimum-length KUCH nahi tha (app wale path mein 700ms tha). Is liye
                   wake sessions kabhi kabhi bohat lambi khinchti thin aur
                   SERVER_DISCONNECTED (err 11) par khatam hoti thin. Ab dono path ek
                   jaise: khamoshi = session khatam, 300ms = kam az kam bolna.
                   ⚡ J3 (F66): 700 ms → 600 ms (dono path ek sath) — har turn par
                   100 ms ki bachat; minimum 300 ms barqarar, chhote jumle kat-te nahi.
                   🎵 v5.14.0 K2.5 (F76): WAKE path 600 ms par qaim (wake word chhota
                   hota hai, jawabi tezi chahiye) — magar APP path wapas 700 ms par,
                   kyunke user jumle ke beech saans leta hai aur 600 ms par transcript
                   beech se kat jata tha ("mujhe ek hi baat bar bar bolni parti thi"). */
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 600L)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 300L)
            }
            starts++
            report("start", lang + "|" + starts)
            sr?.startListening(intent)
            listening = true                 /* 🧭 1.12 — mic par hamla karne se pehle dekho */
        } catch (e: Exception) { listening = false }
    }

    /** Har 45s zinda hai? har 12 min fresh recognizer */
    private fun watchdog() {
        if (!running) return
        watchdogRuns++
        /* 🧭 1.2 — expiry ka hisab sirf mic-darwazon par nahi, yahan bhi (45s).
           JS ke heartbeat gayab hon to haal khud KHALI, aur user ko "khud-sudhaar"
           ki report (chup-chaap nahi). */
        val fix = WakeState.enforceExpiry()
        if (fix != null) { try { onSelfFix(fix) } catch (e: Exception) {} }
        /* 🧭 1.9 (F35) — mic ki ijazat mil gayi to wake KHUD shuru: pehle user ko
           app band kar ke dobara kholni parti thi. */
        if (loopHeld && micGranted()) {
            loopHeld = false
            notifyState(false, "Bolo: “Maya” ya “Boss” — kahin se bhi")
            report("sulah", "mic ki ijazat mil gayi — wake shuru")
            startLoop()
        }
        if (watchdogRuns >= 16) { // ~12 min
            watchdogRuns = 0
            /* L2 — watchdog bhi HAAL se pooche: Maya ke bolte waqt recognizer
               todna = awaaz kaatna. Pehle ye bina dekhe chalta tha — har 12
               minute par awaaz katne ka scheduled chance tha. */
            if (haalBlock() == null) {
                /* 🔬 F18 — pehle ye gate ko CHALU chhod kar recognizer mic par thons
                   deta tha (har 12 min guaranteed clash → error 3/8/11). Ab gate
                   khuli ho to sirf recognizer fresh karo, nayi session mat chalao. */
                resetRecognizer()
                if (!gateOn) actuallyStart()
            }
        }
        /* L4 stale-sulah recovery — JS/WebView mar bhi jaye (YA uska KHALI
           call kho jaye) to 60s baad pause khud-ba-khud azad. Warna wake word
           hamesha ke liye so jata. */
        if (pausedByApp && System.currentTimeMillis() - pausedAt > STALE_PAUSE_MS) {
            /* 🔬 F05 — 60s bohot lamba tha: wake har SUNO ke baad ek poore minute
               ke liye murda rehti thi. Ab 10s — AUR app ka mic asal mein khali ho
               tab hi, warna sirf intezar barhao (blind release = mic jang). */
            val busy = try { MainActivity.instance?.appMicBusy() ?: false } catch (e: Exception) { false }
            if (busy) {
                pausedAt = System.currentTimeMillis()
            } else {
                report("sulah", "stale pause khud azad hua (" + (STALE_PAUSE_MS / 1000) + "s)")
                resumeFromApp()
            }
        }
        handler.postDelayed(::watchdog, 45000)
    }

    /* ═══ 🎚️ P9 SUKOON — instance taraf ke amal ═══ */

    /* escape hatch — LAB sukoon OFF ho to purana rawaiya */
    fun sukoonOn(): Boolean = try {
        getSharedPreferences("maya", Context.MODE_PRIVATE).getBoolean("sukoon", true)
    } catch (e: Exception) { true }

    /* 🎛️ J2.3 — baat-cheet mode ka LAB switch (pref). Default ON: user ne khud
       faisla diya tha ke baat-cheet mode chalu rahe (aur LAB mein switch hai). */
    fun talkPrefOn(): Boolean = try {
        getSharedPreferences("maya", Context.MODE_PRIVATE).getBoolean("talk", true)
    } catch (e: Exception) { true }

    /* 🎛️ J2.3 — mode ka AMAL: ON = mic isi lamhe chhodo (gate + recognizer),
       OFF = wapas pehre par. onHaal() jaisa hi, magar HAAL ko chhuta nahi —
       SUKOON ka haal (KHALI/BOL_RAHI/APP_SUN/SOCH_RAHI) apni jagah barqarar rehta hai. */
    fun onTalk(on: Boolean) {
        handler.post {
            if (!running) return@post
            if (on) {
                stopGate()
                try { sr?.cancel() } catch (e: Exception) {}
                pendingGen++                     /* pending restart murda */
                report("talk", "baat-cheet ON — wake ka mic band (darwaza khula)")
            } else {
                report("talk", "baat-cheet OFF — wake wapas pehre par")
                restart(300)
            }
        }
    }

    /* ═══ 🎛️ J2.2 (F57) — WAKE KA ZINDA LEVEL ═══
       PEHLE: wake ka dB Kotlin mein hi reh jata tha (sirf trigger par ek log
       line) — JS ko pata hi nahi chalta tha ke pehra zinda hai ya murda, aur
       user ko mic ka haal NAZAR nahi aata tha (F52). AB: har ~300ms ek halki
       push `__wakeLevel(db, farsh, chokhat, mode)`.
       ⚠️ EHTIYAT: ye report() se NAHI guzarti — warna KAAN ka 40-entry log har
       300ms bharta aur asal tareekh mit jati (F03 ka sabaq). Sirf evalToApp. */
    @Volatile private var lastLevelAt = 0L
    @Volatile private var lastLevel = 0.0
    @Volatile private var lastLevelMode = 0
    private fun r1(v: Double): String = (Math.round(v * 10) / 10.0).toString()
    private fun pushLevel(d: Double, mode: Int) {
        val t = System.currentTimeMillis()
        if (t - lastLevelAt < LEVEL_PUSH_MS) return
        lastLevelAt = t
        lastLevel = d
        lastLevelMode = mode
        evalToApp("window.__wakeLevel && window.__wakeLevel(" + r1(d) + "," +
                  r1(floorDb) + "," + r1(trigDb) + "," + mode + ")")
    }

    /* L1 — HAAL badla to foran amal */
    fun onHaal(h: String) {
        handler.post {
            if (!running) return@post
            /* 🎵 v5.14.0 K2.2 (F74) — SOCH_RAHI par bhi wahi hukum: mic ISI LAMHE band.
               PEHLE ye haal maujood hi nahi tha, is liye jawab sochte ya tool chalate waqt
               wake ka recognizer chalta rehta tha → do jawab ek sath takra jate the
               ("ek baar boli, usne suna hi nahi, reply kuch nahi aaya"). */
            if (h == "BOL_RAHI" || h == "APP_SUN" || h == "SOCH_RAHI") {
                /* mic ISI LAMHE chhodo — awaaz katna yahi se rukta hai */
                stopGate()
                try { sr?.cancel() } catch (e: Exception) {}
                pendingGen++                     /* pending restart murda */
            } else if (h == "KHALI") {
                restart(300)
            }
        }
    }

    /* L4 — tap-to-speak jeetta hamesha */
    fun hardPause() {
        handler.post {
            stopGate()
            try { sr?.cancel() } catch (e: Exception) {}
            pendingGen++
            report("sulah", "service pause — app ka mic")
        }
    }
    fun softResume() {
        handler.post {
            if (!running) return@post
            skipReset()                        /* 🔬 F03 — nayi ginti */
            report("sulah", "service wapas — pehra phir se")
            restart(300)
        }
    }

    /* ═══ 🧭 1.6 (F13) — WAKE KA APNA RECOGNIZER ═══
       Seerhi: (1) jo pehle CHALA tha (prefs mein yaad) → (2) Android 13+ ka
       on-device → (3) phone ki RecognitionService fehrist se pehla qabil →
       (4) aam default. Jo asal mein chalta hai (pehla `onReadyForSpeech`) usay
       yaad kar liya jata hai; 4 lagatar nakami par bhoola diya jata hai. */
    @Volatile private var wakeRecognizerKind: String = "-"
    private var wakeCandidate: String = ""

    private fun makeWakeRecognizer(): SpeechRecognizer? {
        val list = try {
            packageManager.queryIntentServices(
                Intent(android.speech.RecognitionService.SERVICE_INTERFACE), 0)
        } catch (e: Throwable) { emptyList() }
        val remembered = try {
            getSharedPreferences("maya", Context.MODE_PRIVATE).getString("wake_rec", null)
        } catch (e: Throwable) { null }

        if (!remembered.isNullOrEmpty()) {
            for (ri in list) {
                val si = ri.serviceInfo ?: continue
                if (si.packageName + "/" + si.name == remembered) {
                    try {
                        wakeCandidate = remembered
                        wakeRecognizerKind = "yaad:" + si.packageName
                        return SpeechRecognizer.createSpeechRecognizer(
                            this, android.content.ComponentName(si.packageName, si.name))
                    } catch (e: Throwable) {}
                }
            }
        }
        if (Build.VERSION.SDK_INT >= 33) {
            try {
                if (SpeechRecognizer.isOnDeviceRecognitionAvailable(this)) {
                    wakeCandidate = "on-device"
                    wakeRecognizerKind = "on-device"
                    return SpeechRecognizer.createOnDeviceSpeechRecognizer(this)
                }
            } catch (e: Throwable) {}
        }
        for (ri in list) {
            val si = ri.serviceInfo ?: continue
            try {
                val r = SpeechRecognizer.createSpeechRecognizer(
                    this, android.content.ComponentName(si.packageName, si.name))
                wakeCandidate = si.packageName + "/" + si.name
                wakeRecognizerKind = si.packageName
                return r
            } catch (e: Throwable) {}
        }
        return try {
            wakeCandidate = ""
            wakeRecognizerKind = "default"
            SpeechRecognizer.createSpeechRecognizer(this)
        } catch (e: Throwable) { null }
    }

    private fun rememberWakeRec() {
        if (wakeCandidate.isEmpty()) return
        try {
            val p = getSharedPreferences("maya", Context.MODE_PRIVATE)
            if (p.getString("wake_rec", null) != wakeCandidate) {
                p.edit().putString("wake_rec", wakeCandidate).apply()
                report("rec", "wake ka recognizer yaad: " + wakeRecognizerKind)
            }
        } catch (e: Throwable) {}
    }

    private fun forgetWakeRec(why: String) {
        try {
            getSharedPreferences("maya", Context.MODE_PRIVATE).edit().remove("wake_rec").apply()
            wakeCandidate = ""
            report("rec", "recognizer bhoola diya (" + why + ") — agla candidate azmaya jayega")
        } catch (e: Throwable) {}
    }

    /* 🔬 F12 — wake ki zubaan AB STT se azad hai. Urdu decoder "مایا" ko "ہے"
       jaisa parh leta hai (hamara apna KAAN DOCTOR ye kehta tha), is liye wake
       ka default en-IN hai aur user LAB se badal sakta hai. */
    private fun wakeLangNow(): String = try {
        getSharedPreferences("maya", Context.MODE_PRIVATE).getString("wake_lang", "en-IN") ?: "en-IN"
    } catch (e: Exception) { "en-IN" }

    /* 🔬 F04 — KOTLIN KA POORA SACH ek JSON mein.
       PEHLE: panel "HAAL: KHALI" dikha raha tha (wo JS ka haal tha) jabke Kotlin
       mein pausedByApp=true phansa hua tha — instrument ne humein galat raaste par
       bheja. Ab panel JS aur Kotlin DONO ka haal dikhata hai + MISMATCH pakadta hai. */
    fun stateBits(): String {
        val s = StringBuilder("{")
        s.append("\"alive\":").append(if (alive) "true" else "false")
        s.append(",\"running\":").append(if (running) "true" else "false")
        s.append(",\"haal\":\"" + haal + "\"")
        s.append(",\"pausedByApp\":").append(if (pausedByApp) "true" else "false")
        s.append(",\"pausedFor\":").append(if (pausedByApp) (System.currentTimeMillis() - pausedAt) else 0L)
        s.append(",\"block\":\"" + (haalBlock() ?: "").replace("\"", "'") + "\"")
        s.append(",\"gate\":").append(if (gateOn) "true" else "false")
        s.append(",\"listening\":").append(if (listening) "true" else "false")
        s.append(",\"sukoon\":").append(if (sukoonOn()) "true" else "false")
        s.append(",\"lang\":\"" + wakeLangNow() + "\"")
        s.append(",\"using\":\"" + wakeRecognizerKind + "\"")          /* 🧭 1.6 — wake ka APNA */
        s.append(",\"appUsing\":\"" + (MainActivity.instance?.lastRecognizerKind ?: "-") + "\"")
        s.append(",\"cand\":\"" + wakeCandidate.replace("\"", "'") + "\"")
        s.append(",\"floor\":").append(Math.round(floorDb))
        s.append(",\"trig\":").append(Math.round(trigDb))
        s.append(",\"cal\":").append(if (calOk) "true" else "false")
        /* 🎛️ J2.2 + J2.3 — level ki taazgi aur baat-cheet ka hisab panel par */
        s.append(",\"lv\":").append(Math.round(lastLevel))
        s.append(",\"lvMode\":").append(lastLevelMode)
        s.append(",\"lvAge\":").append(if (lastLevelAt > 0L) ((System.currentTimeMillis() - lastLevelAt) / 1000L) else -1L)
        s.append(",\"talkPref\":").append(if (talkPrefOn()) "true" else "false")
        s.append(",\"talk\":").append(if (WakeState.talkActive()) "true" else "false")
        s.append(",\"talkLeft\":").append(WakeState.talkLeft() / 1000L)
        s.append(",\"talkTurns\":").append(WakeState.talkTurns)
        s.append(",\"gates\":").append(gateLoops)
        s.append(",\"fgs\":").append(if (fgsOk) "true" else "false")
        s.append(",\"held\":").append(if (loopHeld) "true" else "false")
        s.append(",\"owner\":\"" + WakeState.owner + "\"")
        s.append(",\"haalAge\":").append(WakeState.age() / 1000L)
        s.append(",\"beats\":").append(WakeState.beats)
        s.append(",\"beatAge\":").append(if (WakeState.lastBeat > 0L) ((System.currentTimeMillis() - WakeState.lastBeat) / 1000L) else -1L)
        s.append(",\"selfFix\":").append(WakeState.selfFixes)
        s.append(",\"fixWhy\":\"" + WakeState.lastFixWhy.replace("\"", "'") + "\"")
        s.append(",\"starts\":").append(starts)
        s.append(",\"errStreak\":").append(errStreak)
        s.append(",\"errTotal\":").append(WakeState.errTotal)
        s.append(",\"lastErr\":").append(lastErr)
        s.append(",\"uptime\":").append(if (startedAt > 0L) ((System.currentTimeMillis() - startedAt) / 1000L) else 0L)
        s.append(",\"nHeard\":").append(nHeard)
        s.append(",\"nErr\":").append(nErr)
        s.append(",\"nStart\":").append(nStart)
        s.append(",\"nSkip\":").append(nSkip)
        s.append(",\"nErr8\":").append(nErr8)
        s.append(",\"nLastErr\":").append(nLastErr)
        s.append(",\"nDead\":").append(nDead)
        s.append(",\"heardOffline\":").append(heardOffline)
        s.append(",\"sent\":").append(nSentOk)
        s.append(",\"dropped\":").append(nDropped)
        s.append(",\"lastWake\":").append(nLastWakeAt)
        return s.append("}").toString()
    }

    /* L1/L4 ka Kotlin dastaaveezi tor par saabit: HAAL ka pehra */
    fun mazbootKotlinGate(): Boolean = true
}
