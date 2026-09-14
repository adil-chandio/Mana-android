package com.maya.ai

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import org.json.JSONArray
import org.json.JSONObject
import java.util.ArrayDeque

/**
 * MAYA ACT (Roadmap Phase 1) — safety engine + bounded action queue.
 *
 * HARD RULES (CLAUDE.md "Automation Safety & Stability Guardrails"):
 *  - Maya acts ONLY on explicit voice commands that reach the maya_act tool.
 *    Nothing here ever schedules, retries on its own, or runs when idle.
 *  - Banking/UPI/finance apps: NEVER controlled (hard block list below).
 *  - Password/OTP/card fields: never read, typed, or logged (isPassword +
 *    label heuristics -> refuse).
 *  - Verify target node text on screen BEFORE any tap. No blind coordinates.
 *  - Per-action timeout 5s; max 3 verified attempts per chain; screen-unchanged
 *    -> STOP and report (never retry infinitely).
 *  - Global rate limit: max 10 actions / 60s.
 *  - User touch (<1s ago) -> abort and wait. Never fight the user's input.
 *  - Kill-switch: persistent notification button "STOP MAYA AUTOMATION" ->
 *    killAll(): queue cleared, current action aborted, 60s re-arm cooldown.
 *  - Idle = queue empty = no notification, no worker wakeups, zero battery.
 *  - All work runs on a private HandlerThread (never the UI thread).
 *  - Actions arrive ONLY via MainActivity.mayaAct bridge (explicit tool call).
 *    Maya's own speech can never become an action (different code path).
 */
object MayaAct {

    /* ═══ ═══ SAFETY CONSTANTS ═══ ═══ */

    /** Banking / UPI / finance — NEVER controlled (exact package prefixes). */
    val BLOCKED_PKGS = setOf(
        "com.google.android.apps.nbu.paisa.user",   // Google Pay
        "net.one97.paytm", "com.phonepe.app",
        "com.paypal.android.p2pmobile", "com.squareup.cash",
        "com.chime.android", "com.bankofamerica.BofA",
        "com.chase.sig.android", "com.wellsfargomobile.wellsfargomobile",
        "com.usbank.mobilebanking", "com.capitalone.CapitalOneMobile",
        "com.citibank.mobile.citiuae", "com.hbl.android", "com.meebank.net" 
        /* heuristic catch-all below also blocks any pkg containing bank/upi */
    )

    /** Sensitive field heuristics — never read, never type, never log. */
    val SENSITIVE_LABELS = listOf(
        "password", "passwd", "passcode", "otp", "one time", "cvv", "cvc",
        "credit card", "debit card", "card number", "expiry", "secure pin", "pin "
    )

    const val MAX_PER_MINUTE = 10
    const val MAX_ATTEMPTS = 3
    const val ACTION_TIMEOUT_MS = 5000L
    const val TOUCH_GRACE_MS = 1000L
    const val KILL_COOLDOWN_MS = 60000L

    /* ═══ ═══ STATE ═══ ═══ */

    private val worker = HandlerThread("maya-act").apply { start() }
    private val h = Handler(worker.looper)
    private val ui = Handler(android.os.Looper.getMainLooper())

    private val queue = ArrayDeque<JSONObject>()
    @Volatile private var executing = false
    @Volatile private var lastTouchAt = 0L
    @Volatile private var killedAt = 0L
    private val rate = ArrayDeque<Long>()
    private val attempts = java.util.concurrent.ConcurrentHashMap<String, Int>()
    @Volatile var lastReport: JSONObject? = null
        private set

    /* ═══ ═══ PUBLIC API (bridge) ═══ ═══ */

    /** MainActivity.mayaAct(json) -> status JSON. NEVER throws. */
    fun enqueue(ctx: Context, json: JSONObject): String {
        val out = JSONObject()
        try {
            if (killedCooldownActive()) {
                out.put("ok", false)
                out.put("why", "kill-switch laga hua hai — kuch der baad naya hukm do")
                return out.toString()
            }
            val action = json.optString("action", "")
            if (action != "tap" && action != "type" && action != "swipe" && action != "back") {
                out.put("ok", false)
                out.put("why", "namaloom action '" + action + "' — sirf tap/type/swipe/back")
                return out.toString()
            }
            /* vague command refusal: tap/type NEED a find label (no blind taps) */
            if ((action == "tap" || action == "type") &&
                json.optString("find", "").trim().isEmpty()
            ) {
                out.put("ok", false)
                out.put("why", "kis par? screen par us cheez ka NAAM do (verify-before-tap)")
                return out.toString()
            }
            synchronized(rate) {
                val now = SystemClock.elapsedRealtime()
                while (rate.isNotEmpty() && now - rate.first() > 60000) rate.removeFirst()
                if (rate.size >= MAX_PER_MINUTE) {
                    out.put("ok", false)
                    out.put("why", "rate limit — 1 minute mein max " + MAX_PER_MINUTE + " actions")
                    return out.toString()
                }
                rate.addLast(now)
            }
            json.put("_chain", json.optString("chain", action + ":" + json.optString("find", "")))
            synchronized(queue) { queue.addLast(json) }
            out.put("ok", true)
            out.put("queued", queue.size)
            out.put("note", "STOP MAYA AUTOMATION notification se foran band")
            if (!executing) drain(ctx.applicationContext)
            return out.toString()
        } catch (e: Exception) {
            out.put("ok", false)
            out.put("why", e.message ?: "enqueue masla")
            return out.toString()
        }
    }

    /** Kill-switch: STOP button / "ruk jao". Instant, unconditional. */
    fun killAll(ctx: Context) {
        killedAt = SystemClock.elapsedRealtime()
        synchronized(queue) { queue.clear() }
        attempts.clear()
        executing = false
        try {
            val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.cancel(NOTIF_ID)
        } catch (e: Exception) {}
        report(ctx, killJson("STOP — sab automation foran band, 60s cooldown"))
    }

    /** Read-only native Chat readiness; does not stop, enqueue or authorize actions. */
    fun hasPendingActions(): Boolean = executing || synchronized(queue) { queue.isNotEmpty() }

    /** MainActivity.mayaStatus() */
    fun status(): String {
        val o = JSONObject()
        try {
            synchronized(queue) { o.put("queued", queue.size) }
            o.put("executing", executing)
            o.put("killedCooldown", killedCooldownActive())
            o.put("rateUsed", synchronized(rate) { rate.size })
            o.put("lastTouchAgoMs", if (lastTouchAt == 0L) -1 else SystemClock.elapsedRealtime() - lastTouchAt)
            lastReport?.let { o.put("last", it) }
        } catch (e: Exception) {}
        return o.toString()
    }

    /** AutoSendService: user ne screen chhua -> fight nahi karte. */
    fun onUserTouch() {
        lastTouchAt = SystemClock.elapsedRealtime()
        if (executing) {
            synchronized(queue) { queue.clear() }
            executing = false
            lastReport = JSONObject("{\"aborted\":\"aap ka touch — automation ruk gayi\"}")
        }
    }

    /* ═══ ═══ WORKER ═══ ═══ */

    private fun drain(appCtx: Context) {
        executing = true
        showStopNotif(appCtx)
        h.post { step(appCtx) }
    }

    private fun step(appCtx: Context) {
        val next: JSONObject? = synchronized(queue) { if (queue.isEmpty()) null else queue.removeFirst() }
        if (next == null) {
            executing = false
            hideStopNotif(appCtx)
            return
        }
        if (killedCooldownActive()) { executing = false; hideStopNotif(appCtx); return }

        val svc = AutoSendService.instance
        if (svc == null) {
            executing = false
            report(appCtx, killJson("accessibility band — pehle Settings mein MAYA AutoSend ON karo"))
            return
        }
        /* touch grace — user ne abhi haath lagaya to hum nahi lagate */
        if (lastTouchAt != 0L && SystemClock.elapsedRealtime() - lastTouchAt < TOUCH_GRACE_MS) {
            synchronized(queue) { queue.clear() }
            executing = false
            hideStopNotif(appCtx)
            report(appCtx, killJson("aap ka touch — ruk gayi, naya hukm do"))
            return
        }

        val action = next.optString("action", "")
        val chain = next.optString("_chain", action)
        val tried = (attempts[chain] ?: 0)

        /* PER-ACTION TIMEOUT watchdog */
        val timedOut = Runnable {
            if (!executing) return@Runnable
            bumpAttempt(chain)
            synchronized(queue) { queue.clear() }
            executing = false
            hideStopNotif(appCtx)
            report(appCtx, killJson("timeout 5s — '" + action + "' atka, chain band"))
        }
        h.postDelayed(timedOut, ACTION_TIMEOUT_MS)

        try {
            /* target package guard — current foreground app */
            val pkg = svc.currentPkg() ?: ""
            if (isBlockedPkg(pkg)) {
                h.removeCallbacks(timedOut)
                synchronized(queue) { queue.clear() }
                executing = false
                hideStopNotif(appCtx)
                report(appCtx, killJson("REFUSED — " + pkg + " finance/banking app hai, Maya isay kabhi nahi chhooti"))
                return
            }

            when (action) {
                "back" -> {
                    svc.globalBack { ok ->
                        h.removeCallbacks(timedOut)
                        finishAction(appCtx, next, chain, ok, ok, "back")
                    }
                }
                "swipe" -> {
                    /* scroll/swipe: navigation move, activation nahi — coords OK,
                       magar phir bhi timeout + attempts bounded. */
                    val x1 = next.optDouble("x1", 0.0)
                    val y1 = next.optDouble("y1", 0.0)
                    val x2 = next.optDouble("x2", 0.0)
                    val y2 = next.optDouble("y2", 0.0)
                    val ms = next.optLong("ms", 300L).coerceIn(120L, 900L)
                    svc.swipe(x1, y1, x2, y2, ms) { ok ->
                        h.removeCallbacks(timedOut)
                        finishAction(appCtx, next, chain, ok, ok, "swipe")
                    }
                }
                "tap" -> {
                    /* VERIFY BEFORE TAP: node ko screen par dhoondo — blind tap hargiz nahi */
                    val find = next.optString("find", "").trim()
                    val idx = next.optInt("index", 0)
                    val node = svc.findByText(find, idx)
                    if (node == null) {
                        h.removeCallbacks(timedOut)
                        handleMiss(appCtx, next, chain, tried, "'" + find + "' screen par NAHI mila")
                        return
                    }
                    val label = node.second
                    val sigBefore = svc.screenSig()
                    if (isSensitiveLabel(label)) {
                        h.removeCallbacks(timedOut)
                        synchronized(queue) { queue.clear() }
                        executing = false
                        hideStopNotif(appCtx)
                        report(appCtx, killJson("REFUSED — '" + label + "' sensitive field hai (password/OTP/card qanoon)"))
                        return
                    }
                    svc.tapAt(node.first.centerX().toFloat(), node.first.centerY().toFloat()) { ok ->
                        h.removeCallbacks(timedOut)
                        /* screen verify: kuch badla? (before/after signature) */
                        val changed = svc.screenSig() != sigBefore
                        finishAction(appCtx, next, chain, ok, changed, "tap:" + label)
                    }
                }
                "type" -> {
                    val find = next.optString("find", "").trim()
                    val text = next.optString("text", "")
                    val node = svc.findByText(find, next.optInt("index", 0))
                    if (node == null) {
                        h.removeCallbacks(timedOut)
                        handleMiss(appCtx, next, chain, tried, "field '" + find + "' nahi mila")
                        return
                    }
                    if (node.second.let { it.isNotEmpty() && isSensitiveLabel(it) }) {
                        h.removeCallbacks(timedOut)
                        synchronized(queue) { queue.clear() }
                        executing = false
                        hideStopNotif(appCtx)
                        report(appCtx, killJson("REFUSED — sensitive field mein type mana hai"))
                        return
                    }
                    /* NOTE: typed text KABHI report/log nahi hota — sirf field label */
                    val ok = svc.typeInto(node.third, text)
                    h.removeCallbacks(timedOut)
                    finishAction(appCtx, next, chain, ok, ok, "type:" + node.second)
                }
                else -> {
                    h.removeCallbacks(timedOut)
                    executing = false
                    hideStopNotif(appCtx)
                }
            }
        } catch (e: Exception) {
            h.removeCallbacks(timedOut)
            executing = false
            hideStopNotif(appCtx)
            report(appCtx, killJson("masla: " + (e.message ?: "?")))
        }
    }

    /** node nahi mila -> max 3 attempts warna STOP + report (never infinite) */
    private fun handleMiss(appCtx: Context, act: JSONObject, chain: String, tried: Int, why: String) {
        if (tried + 1 >= MAX_ATTEMPTS) {
            attempts.remove(chain)
            synchronized(queue) { queue.clear() }
            executing = false
            hideStopNotif(appCtx)
            report(appCtx, killJson("STOP — " + why + " (" + MAX_ATTEMPTS + " koshish). Aap dekh kar batao"))
        } else {
            bumpAttempt(chain)
            /* same action dobara queue ke aage — warna ye koshish gum ho jati */
            synchronized(queue) { queue.addFirst(act) }
            h.postDelayed({ step(appCtx) }, 700)   /* verified retry, bounded */
        }
    }

    private fun finishAction(appCtx: Context, act: JSONObject, chain: String, done: Boolean, changed: Boolean, what: String) {
        if (done && changed) {
            attempts.remove(chain)
            h.post { step(appCtx) }              /* agla (queue khali ho to idle) */
            report(appCtx, actJson("ho gaya: " + what))
        } else if (done && !changed) {
            handleMiss(appCtx, act, chain, attempts[chain] ?: 0, "tap ke baad screen NAHI badli")
        } else {
            handleMiss(appCtx, act, chain, attempts[chain] ?: 0, "action nakaam")
        }
    }

    /* ═══ ═══ GUARDS ═══ ═══ */

    private fun isBlockedPkg(pkg: String): Boolean {
        val p = pkg.lowercase()
        if (BLOCKED_PKGS.any { p.startsWith(it) }) return true
        return p.contains("bank") || p.contains("upi") || p == "net.one97.paytm"
    }

    private fun isSensitiveLabel(label: String): Boolean {
        val l = label.lowercase()
        return SENSITIVE_LABELS.any { l.contains(it) }
    }

    private fun killedCooldownActive(): Boolean =
        killedAt != 0L && SystemClock.elapsedRealtime() - killedAt < KILL_COOLDOWN_MS

    private fun bumpAttempt(chain: String) { attempts[chain] = (attempts[chain] ?: 0) + 1 }

    /* ═══ ═══ REPORT + NOTIF ═══ ═══ */

    private fun killJson(why: String): JSONObject =
        JSONObject().put("ok", false).put("stopped", true).put("why", why)

    private fun actJson(what: String): JSONObject =
        JSONObject().put("ok", true).put("what", what)

    /** text/type ka MATN kabhi report nahi hota — sirf kya hua */
    private fun report(ctx: Context, o: JSONObject) {
        lastReport = o
        try {
            MainActivity.instance?.evalAsyncPublic(
                "window.__mayaActDone && window.__mayaActDone('" + o.toString().replace("'", "\\'") + "')"
            )
        } catch (e: Exception) {}
        try {
            android.util.Log.i("MayaAct", o.toString())
        } catch (e: Exception) {}
    }

    private const val NOTIF_ID = 3003
    private const val CHANNEL_ID = "maya_act"

    /** Persistent STOP notification — SIRF queue chalte waqt. Idle = nahi. */
    private fun showStopNotif(ctx: Context) {
        try {
            val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                nm.createNotificationChannel(
                    NotificationChannel(CHANNEL_ID, "MAYA Automation", NotificationManager.IMPORTANCE_LOW)
                )
            }
            val pi = PendingIntent.getBroadcast(
                ctx, 3002, Intent(ctx, MayaStopReceiver::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val n: Notification = androidx.core.app.NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_delete)
                .setContentTitle("MAYA automation chal rahi hai")
                .setContentText("Foran rokne ke liye dabao")
                .setOngoing(true)
                .setPriority(androidx.core.app.NotificationCompat.PRIORITY_LOW)
                .addAction(0, "STOP MAYA AUTOMATION", pi)
                .build()
            nm.notify(NOTIF_ID, n)
        } catch (e: Exception) {}
    }

    private fun hideStopNotif(ctx: Context) {
        try {
            (ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(NOTIF_ID)
        } catch (e: Exception) {}
    }
}

/** Kill-switch receiver — notification button yahan aata hai. */
class MayaStopReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        try { MayaAct.killAll(context) } catch (e: Exception) {}
    }
}
