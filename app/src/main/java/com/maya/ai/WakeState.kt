package com.maya.ai

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  🧭 WAKE STATE — v5.11.0 Phase 1 (F02 ka ilaj)
 * ───────────────────────────────────────────────────────────────────────────
 *  PEHLE: wake ki halat CHAR alag jagah bikhri hui thi —
 *      · `WakeWordService.haal`        (JS se aata tha)
 *      · `WakeWordService.pausedByApp` (L4 sulah)
 *      · `WakeWordService.lastBolAt`   (echo tail)
 *      · `SUKOON.haal`                 (JS ki apni copy)
 *  Aur in mein se KOI BHI expiry nahi rakhta tha: agar JS ka "KHALI" call kho
 *  gaya (WebView reload, screen off, JS exception) to Kotlin mein `APP_SUN`
 *  YA `BOL_RAHI` HAMESHA ke liye phans jata tha → wake par permanent pabandi.
 *  Panel "HAAL: KHALI" dikha raha hota tha jabke asal mein pabandi lagi thi —
 *  instrument hi jhoot bolta tha (F04 ka doosra chehra).
 *
 *  AB: halat ka **EK** ghar. Har halat ke sath:
 *      · `owner`  — kis ne ye halat lagayi (APP / WAKE / TTS / NONE)
 *      · `since`  — kab se (har halat ki apni MUDAT)
 *      · `beat`   — JS ka 10s heartbeat; 3 miss = JS mar chuka → khud KHALI
 *  `haalBlock()` sirf isi se poochhta hai — aur expiry se khud sudhar jata hai
 *  (self-fix ginti `selfFixes` panel par nazar aati hai, chup-chaap nahi).
 *
 *  ⚠️ IMAANDARI: expiry ek SAFETY NET hai, tareeqa nahi. Agar `selfFixes`
 *  barh rahi hain to matlab JS ka HAAL bhejna toota hua hai — us waqt panel
 *  par MISMATCH/heartbeat gayab dikhega, aur wo hi asal bug hoga.
 * ═══════════════════════════════════════════════════════════════════════════
 */
object WakeState {

    /* ── mudat (expiry) — Phase 1.1 ke constants ── */
    const val PAUSE_EXP_MS = 8000L      /* L4 sulah (pausedByApp) ki zindagi */
    const val APP_SUN_EXP_MS = 30000L   /* app ka mic 30s se zyada nahi maana jata */
    const val BOL_EXP_MS = 20000L       /* Maya ka bolna 20s se zyada nahi maana jata */
    /* 🎵 v5.14.0 K2.2 (F74) — CHAUTHA HAAL "SOCH_RAHI": Maya ne sun liya, jawab
       soch rahi hai (dimaag / tool / stream) magar abhi awaaz shuru nahi hui.
       PEHLE is poori mudat mein haal KHALI rehta tha → wake ka mic khul jata →
       DO JAWAB EK SATH takrate (awaz kat-ti, reply gayab). JS ka turn lock 45s
       par khud khulta hai; ye 60s sirf SAFETY NET hai (JS mar jaye to wake behri
       na rahe). */
    const val SOCH_EXP_MS = 60000L
    const val HB_MS = 10000L            /* JS heartbeat ka waqfa (1.2) */
    const val HB_MISS = 3               /* itne heartbeat gayab = JS murda → KHALI */
    const val TAIL_MS = 550L            /* echo tail — JS SUKOON.tailMs se match */
    /* 🎛️ J2.3 (v5.12.5) — BAAT-CHEET MODE: darwaza khula ho to wake ka mic BAND,
       taake ek turn mein mic EK dafa khule (pehle wake + app = DO, aur donon ke
       beech 400ms ki race = F56). 90s sirf SAFETY NET hai — JS har turn par
       taazeed karta hai aur darwaza band hote hi talkOff() bhejta hai. */
    const val TALK_EXP_MS = 90000L

    /* ── halat ── */
    @Volatile var haal: String = "KHALI"        /* KHALI | BOL_RAHI | APP_SUN | SOCH_RAHI */
    @Volatile var owner: String = "NONE"        /* NONE | APP | WAKE | TTS */
    @Volatile var since: Long = 0L
    @Volatile var lastBeat: Long = 0L
    @Volatile var lastBolAt: Long = 0L
    @Volatile var pausedByApp: Boolean = false
    @Volatile var pausedAt: Long = 0L
    /* 🎛️ J2.3 — baat-cheet mode (darwaza khula = wake ka mic band) */
    @Volatile var talkUntil: Long = 0L
    @Volatile var talkSince: Long = 0L
    @Volatile var talkTurns: Long = 0L

    /* ── ginti (panel ke liye — chup-chaap kuch nahi hota) ── */
    @Volatile var beats: Long = 0L              /* kitne heartbeat aaye */
    @Volatile var selfFixes: Long = 0L          /* expiry ne khud kitni dafa sudhara */
    @Volatile var lastFixWhy: String = ""
    @Volatile var errStreak: Int = 0            /* IS SESSION ki lagatar nakami (1.8) */
    @Volatile var errTotal: Long = 0L           /* KUL nakami (session se azad) */
    @Volatile var lastGoodAt: Long = 0L         /* aakhri kamyab session (onReadyForSpeech) */

    fun now(): Long = System.currentTimeMillis()

    fun age(): Long = if (since > 0L) now() - since else 0L

    /** halat lagao — owner ke sath, taake pata rahe kis ne lagayi */
    fun set(h: String, who: String) {
        if (h == "BOL_RAHI") lastBolAt = now()
        haal = h
        owner = who
        since = now()
    }

    /** 1.2 — JS ka heartbeat: "main zinda hun, haal ye hai" */
    fun beat(h: String?) {
        beats++
        lastBeat = now()
        /* heartbeat khud halat ki taazeed hai — magar sirf tab jab JS ne haal bheja ho */
        if (!h.isNullOrEmpty()) {
            if (h != haal) set(h, "APP") else since = now()
        } else if (since > 0L) {
            since = now()
        }
    }

    /** 1.2 — WebView reload/boot par poora resync (dedup bypass ke sath) */
    fun resync(h: String) {
        set(h, "APP")
        lastBeat = now()
    }

    /** L4 sulah — app ka mic sab se pehle */
    fun pauseForApp() {
        pausedByApp = true
        pausedAt = now()
    }

    fun resumeFromApp() {
        pausedByApp = false
        pausedAt = 0L
    }

    /* ═══ 🎛️ J2.3 — BAAT-CHEET MODE ═══
       JS ka darwaza (KAAN.DARWAZA) khulte hi talkOn(), band hote hi talkOff().
       Ginti sirf OFF→ON par barhti hai = kitne TURN is mode mein hue (saboot:
       acceptance 10/11 — ek turn mein ek mic, na ke do). */
    fun talkOn() {
        val t = now()
        if (talkUntil <= t) { talkSince = t; talkTurns++ }
        talkUntil = t + TALK_EXP_MS
    }

    fun talkOff() { talkUntil = 0L; talkSince = 0L }

    fun talkActive(): Boolean = talkUntil > now()

    fun talkLeft(): Long = if (talkUntil > now()) (talkUntil - now()) else 0L

    /** 1.8 — kamyab session: streak saaf, KUL ginti barqarar */
    fun sessionOk() {
        errStreak = 0
        lastGoodAt = now()
    }

    fun sessionErr() {
        errStreak++
        errTotal++
    }

    /**
     * Kya koi halat apni MUDAT se aage nikal chuki hai?
     * @return wajah (String) ya null = sab waqt ke andar hai
     */
    fun expiredWhy(): String? {
        val t = now()
        if (haal == "BOL_RAHI" && t - since > BOL_EXP_MS)
            return "bolne ki mudat khatam (" + ((t - since) / 1000L) + "s)"
        if (haal == "APP_SUN" && t - since > APP_SUN_EXP_MS)
            return "app ka mic " + ((t - since) / 1000L) + "s se maana ja raha tha"
        if (haal == "SOCH_RAHI" && t - since > SOCH_EXP_MS)
            return "sochne ki mudat khatam (" + ((t - since) / 1000L) + "s)"
        /* heartbeat sirf tab dekha jata hai jab JS ne ek dafa bhi bheja ho
           (warna service ke akele chalte waqt — app band — hum khud ko
           be-wajah murda ilan kar dete) */
        if (lastBeat > 0L && owner == "APP" && t - lastBeat > HB_MS * HB_MISS)
            return "JS ke " + ((t - lastBeat) / 1000L) + "s se heartbeat nahi"
        return null
    }

    /**
     * Expiry lagao: jo halat mudat se aage nikli, usay KHALI karo aur ginti barhao.
     *
     * ⚠️ SULAH (pausedByApp) ke sath EHTIYAT: F05 ka sabaq yaad rakho — ANDHA
     * release mic ki jang shuru karta hai (app ka SUNO chal raha ho aur wake ka
     * pehra usi waqt mic par hamla kar de → error 3/8 + awaaz katna). Is liye
     * sulah sirf TAB azad hoti hai jab app ka mic asal mein KHALI ho (ya app hi
     * na ho); warna intezar barha diya jata hai. Ye wahi guard hai jo
     * WakeWordService ke watchdog mein STALE_PAUSE_MS ke sath laga tha — ab
     * 8s par, yani recovery 45 second ke bajaye ~8 second mein.
     *
     * @return agar khud-sudhaar hua to wajah, warna null
     */
    fun enforceExpiry(): String? {
        val t = now()
        var why: String? = null
        if (haal == "BOL_RAHI" && t - since > BOL_EXP_MS) {
            why = "bolne ki mudat khatam (" + ((t - since) / 1000L) + "s)"
        } else if (haal == "APP_SUN" && t - since > APP_SUN_EXP_MS) {
            why = "app ka mic " + ((t - since) / 1000L) + "s se khula maana ja raha tha"
        } else if (haal == "SOCH_RAHI" && t - since > SOCH_EXP_MS) {
            why = "sochne (turn lock) ki mudat khatam (" + ((t - since) / 1000L) + "s)"
        } else if (lastBeat > 0L && owner == "APP" && t - lastBeat > HB_MS * HB_MISS) {
            why = "JS ke " + ((t - lastBeat) / 1000L) + "s se heartbeat nahi"
        }
        if (why != null) {
            selfFixes++
            lastFixWhy = why
            haal = "KHALI"
            owner = "NONE"
            since = t
        }
        /* 🎛️ J2.3 — baat-cheet mode ki MUDAT bhi safety net hai: JS mar jaye
           (WebView reload / OEM kill) ya darwaza khula reh jaye to wake HAMESHA
           ke liye band na rahe. Heartbeat gayab = JS murda = mode khud khatam. */
        if (talkUntil > 0L) {
            val jsDead = lastBeat > 0L && owner == "APP" && t - lastBeat > HB_MS * HB_MISS
            if (t > talkUntil || jsDead) {
                talkUntil = 0L
                talkSince = 0L
                selfFixes++
                val w = if (jsDead) "baat-cheet khud khatam — JS ke heartbeat gayab"
                        else "baat-cheet ki mudat khatam (" + (TALK_EXP_MS / 1000L) + "s)"
                lastFixWhy = w
                if (why == null) why = w
            }
        }
        if (pausedByApp && pausedAt > 0L && t - pausedAt > PAUSE_EXP_MS) {
            val busy = try { MainActivity.instance?.appMicBusy() ?: false } catch (e: Throwable) { false }
            if (busy) {
                pausedAt = t                       /* intezar barhao — andha release nahi */
            } else {
                pausedByApp = false
                pausedAt = 0L
                selfFixes++
                val w = "sulah khud azad — app ka mic khali"
                lastFixWhy = w
                if (why == null) why = w
            }
        }
        return why
    }

    /** panel ke liye chhota JSON hissa */
    fun json(): String {
        val s = StringBuilder("{")
        s.append("\"haal\":\"").append(haal).append("\"")
        s.append(",\"owner\":\"").append(owner).append("\"")
        s.append(",\"age\":").append(age() / 1000L)
        s.append(",\"pausedByApp\":").append(if (pausedByApp) "true" else "false")
        s.append(",\"pausedFor\":").append(if (pausedByApp) ((now() - pausedAt) / 1000L) else 0L)
        s.append(",\"beats\":").append(beats)
        s.append(",\"beatAge\":").append(if (lastBeat > 0L) ((now() - lastBeat) / 1000L) else -1L)
        s.append(",\"selfFixes\":").append(selfFixes)
        s.append(",\"lastFixWhy\":\"").append(lastFixWhy.replace("\"", "'")).append("\"")
        s.append(",\"errStreak\":").append(errStreak)
        s.append(",\"errTotal\":").append(errTotal)
        s.append(",\"lastGood\":").append(lastGoodAt)
        /* 🎛️ J2.3 — baat-cheet mode ka hisab panel ke liye */
        s.append(",\"talk\":").append(if (talkActive()) "true" else "false")
        s.append(",\"talkLeft\":").append(talkLeft() / 1000L)
        s.append(",\"talkTurns\":").append(talkTurns)
        return s.append("}").toString()
    }
}
