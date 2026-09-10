package com.maya.ai

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.accessibilityservice.GestureResultCallback
import android.content.Context
import android.graphics.Path
import android.graphics.Rect
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject

/**
 * MAYA AutoSend 2.0 (Phase 9)
 * WhatsApp/Telegram draft khulte hi khud SEND dabati hai + wapas aa jati hai.
 * Enable: Phone Settings → Accessibility → MAYA AutoSend → ON
 */
class AutoSendService : AccessibilityService() {

    companion object {
        @Volatile
        var instance: AutoSendService? = null

        @JvmStatic
        fun pending(ctx: Context): Boolean {
            return try {
                val t = ctx.getSharedPreferences("maya", Context.MODE_PRIVATE)
                    .getLong("autosend_at", 0L)
                t > 0L && System.currentTimeMillis() - t < 45000L
            } catch (e: Exception) { false }
        }

        @JvmStatic
        fun consume(ctx: Context) {
            try {
                ctx.getSharedPreferences("maya", Context.MODE_PRIVATE)
                    .edit().putLong("autosend_at", 0L).apply()
            } catch (e: Exception) {}
        }
    }

    private val handler = Handler(Looper.getMainLooper())

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onDestroy() {
        instance = null
        super.onDestroy()
    }

    @Volatile var lastDispatchAt = 0L      /* apne gestures ko user-touch na samjhein */

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        /* 🛡️ GUARDRAIL: user ka touch (<1s) -> automation abort. Apne hi
           dispatched gestures (lastDispatchAt) ko user-touch NAHI maante —
           warna Maya khud apne aap ko rok deti. */
        if (event.eventType == AccessibilityEvent.TYPE_TOUCH_INTERACTION_START) {
            val self = SystemClock.elapsedRealtime() - lastDispatchAt < 900
            if (!self) try { MayaAct.onUserTouch() } catch (e: Exception) {}
            return
        }
        val pkg = event.packageName ?: return
        if (pkg != "com.whatsapp" && pkg != "com.whatsapp.w4b" && pkg != "com.telegram.messenger") return
        if (!pending(this)) return
        val root = rootInActiveWindow ?: return
        try {
            if (findAndClick(root)) {
                consume(this)
                handler.post {
                    Toast.makeText(this, "MAYA: bhej diya \u2713", Toast.LENGTH_SHORT).show()
                    try {
                        MainActivity.instance?.evalAsyncPublic("window.__autoSent && window.__autoSent()")
                    } catch (x: Exception) {}
                    handler.postDelayed({
                        try { performGlobalAction(GLOBAL_ACTION_BACK) } catch (x: Exception) {}
                    }, 1200)
                }
            }
        } catch (e: Exception) {}
    }

    private fun findAndClick(root: AccessibilityNodeInfo): Boolean {
        // Layer 1: mashhoor send button IDs
        val ids = listOf(
            "com.whatsapp:id/send",
            "com.whatsapp:id/send_button",
            "com.whatsapp:id/entry_send_button",
            "com.whatsapp.w4b:id/send",
            "com.whatsapp.w4b:id/send_button",
            "org.telegram.messenger:id/btn_send"  // Telegram (kabhi kabhi)
        )
        for (id in ids) {
            try {
                root.findAccessibilityNodeInfosByViewId(id).forEach { n ->
                    if (n.isClickable && clickUp(n)) return true
                }
            } catch (e: Exception) {}
        }
        // Layer 2: text/content-desc multi-language
        for (label in listOf("Send", "send", "Bhejo", "bhejo", "Bhej", "Enviar")) {
            try {
                root.findAccessibilityNodeInfosByText(label).forEach { n ->
                    if (clickUp(n)) return true
                }
            } catch (e: Exception) {}
        }
        return false
    }

    private fun clickUp(node: AccessibilityNodeInfo): Boolean {
        return try {
            var n: AccessibilityNodeInfo? = node
            var up = 0
            while (n != null && up < 5) {
                if (n.isClickable && n.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return true
                n = n.parent
                up++
            }
            false
        } catch (e: Exception) { false }
    }

    /* ═══════════════════════════════════════════════════════════════════
       👁️  NAZAR  —  screen ko parh kar MATN bana dena        (P7a v5.6.0)
       -------------------------------------------------------------------
       Ye hissa screen ko CHHUTA NAHI. Sirf DEKHTA hai.

       Android har app ki screen ka ek "accessibility tree" rakhta hai —
       har button, har matn, har khana. Hum us tree par chalte hain aur
       sirf KAAM KI cheezein nikaalte hain:

         * jo nazar aa rahi ho              (isVisibleToUser)
         * jo dabai ja sake, likhi ja sake, ya scroll ho sake
         * ya jis par koi matn likha ho

       Baqi sab phenk dete hain. Wajah: Chrome ke ek page mein 500+ node
       hote hain, aur poora tree dimaag ko bhejenge to prompt phat jayega
       (CHHED 9 ka sabaq). Is liye yahin, Kotlin mein, chhaan lete hain.
       ═══════════════════════════════════════════════════════════════════ */
    fun dumpScreen(max: Int): String {
        val o = JSONObject()
        val root = try { rootInActiveWindow } catch (e: Exception) { null }
        if (root == null) {
            o.put("ok", false)
            o.put("why", "screen nahi mili \u2014 accessibility band hai ya screen locked hai")
            return o.toString()
        }
        val arr = JSONArray()
        val cap = if (max in 1..200) max else 60
        try { walk(root, arr, 0, cap) } catch (e: Exception) {}
        o.put("ok", true)
        o.put("pkg", (root.packageName ?: "").toString())
        o.put("n", arr.length())
        o.put("items", arr)
        return o.toString()
    }

    /** node ki qism — dimaag ko isi se pata chalta hai ke kya kar sakta hai */
    private fun kindOf(n: AccessibilityNodeInfo): String {
        if (n.isEditable) return "input"
        if (n.isCheckable) return "toggle"
        if (n.isClickable) return "btn"
        if (n.isScrollable) return "scroll"
        return "text"
    }

    private fun walk(n: AccessibilityNodeInfo?, out: JSONArray, depth: Int, cap: Int) {
        if (n == null || out.length() >= cap || depth > 22) return
        try {
            val txt = (n.text ?: "").toString().trim()
            val desc = (n.contentDescription ?: "").toString().trim()
            val hint = try { (n.hintText ?: "").toString().trim() } catch (e: Exception) { "" }
            var label = if (txt.isNotEmpty()) txt else if (desc.isNotEmpty()) desc else hint
            val useful = n.isClickable || n.isEditable || n.isScrollable || n.isCheckable
            var vis = false
            try { vis = n.isVisibleToUser } catch (e: Exception) { vis = true }

            if (vis && (useful || label.isNotEmpty())) {
                val r = Rect()
                n.getBoundsInScreen(r)
                if (r.width() > 4 && r.height() > 4) {
                    if (label.length > 60) label = label.substring(0, 60) + "\u2026"
                    val j = JSONObject()
                    j.put("i", out.length())
                    j.put("t", kindOf(n))
                    j.put("x", label)
                    j.put("cx", r.centerX())
                    j.put("cy", r.centerY())
                    try {
                        val vid = n.viewIdResourceName
                        if (vid != null && vid.contains('/')) j.put("id", vid.substringAfterLast('/'))
                    } catch (e: Exception) {}
                    if (n.isEditable) j.put("e", 1)
                    if (n.isScrollable) j.put("s", 1)
                    if (n.isCheckable) j.put("c", if (n.isChecked) 1 else 0)
                    out.put(j)
                }
            }
            val kids = n.childCount
            for (i in 0 until kids) {
                if (out.length() >= cap) return
                walk(n.getChild(i), out, depth + 1, cap)
            }
        } catch (e: Exception) {}
    }

    /* ═══════════════════════════════════════════════════════════════════
       🖐️ AMAL (Roadmap Phase 1) — MayaAct ke liye VERIFIED device control.
       Har cheez MayaAct ki guards ke baad hi chalti hai. Ye sirf tools hain.
       Gestures hamesha MAIN thread se dispatch hote hain, jawab worker par.
       ═══════════════════════════════════════════════════════════════════ */

    fun currentPkg(): String? = try {
        rootInActiveWindow?.packageName?.toString()
    } catch (e: Exception) { null }

    /** label se node dhoondo (visible, bounds>4). Exact match pehle, phir
     *  clickable/editable, phir area. Blind coordinate tap KABHI nahi —
     *  MayaAct hamesha pehle ye dhoondta hai, phir uske center par tap. */
    fun findByText(text: String, index: Int): Triple<Rect, String, AccessibilityNodeInfo>? {
        if (text.isEmpty()) return null
        val root = try { rootInActiveWindow } catch (e: Exception) { return null } ?: return null
        val wanted = text.lowercase()
        class C(val r: Rect, val label: String, val n: AccessibilityNodeInfo,
                val exact: Boolean, val useful: Boolean, val area: Int)
        val cands = ArrayList<C>()
        try {
            root.findAccessibilityNodeInfosByText(text).forEach { n ->
                try {
                    var vis = true
                    try { vis = n.isVisibleToUser } catch (e: Exception) {}
                    if (!vis) return@forEach
                    val txt = (n.text ?: "").toString().trim()
                    val desc = (n.contentDescription ?: "").toString().trim()
                    val hint = try { (n.hintText ?: "").toString().trim() } catch (e: Exception) { "" }
                    val label = if (txt.isNotEmpty()) txt else if (desc.isNotEmpty()) desc else hint
                    if (label.isEmpty()) return@forEach
                    val r = Rect(); n.getBoundsInScreen(r)
                    if (r.width() <= 4 || r.height() <= 4) return@forEach
                    cands.add(C(r, label, n, label.lowercase() == wanted,
                        n.isClickable || n.isEditable, r.width() * r.height()))
                } catch (e: Exception) {}
            }
        } catch (e: Exception) {}
        if (cands.isEmpty()) return null
        cands.sortWith(compareByDescending<C> { it.exact }.thenByDescending { it.useful }.thenByDescending { it.area })
        val pick = cands[if (index in cands.indices) index else 0]
        return Triple(pick.r, pick.label, pick.n)
    }

    private fun dispatch(x1: Float, y1: Float, x2: Float, y2: Float, ms: Long, cb: (Boolean) -> Unit) {
        handler.post {
            try {
                lastDispatchAt = SystemClock.elapsedRealtime()
                val p = Path().apply { moveTo(x1, y1); lineTo(x2, y2) }
                val g = GestureDescription.Builder()
                    .addStroke(GestureDescription.StrokeDescription(p, 0, ms))
                    .build()
                val sent = dispatchGesture(g, object : GestureResultCallback() {
                    override fun onCompleted(gc: GestureDescription?) { handler.post { cb(true) } }
                    override fun onCancelled(gc: GestureDescription?) { handler.post { cb(false) } }
                }, null)
                if (!sent) handler.post { cb(false) }
            } catch (e: Exception) { handler.post { cb(false) } }
        }
    }

    fun tapAt(x: Float, y: Float, cb: (Boolean) -> Unit) =
        dispatch(x, y, x + 0.5f, y + 0.5f, 40L, cb)

    fun swipe(x1: Double, y1: Double, x2: Double, y2: Double, ms: Long, cb: (Boolean) -> Unit) =
        dispatch(x1.toFloat(), y1.toFloat(), x2.toFloat(), y2.toFloat(), ms, cb)

    fun globalBack(cb: (Boolean) -> Unit) {
        handler.post {
            try { cb(performGlobalAction(GLOBAL_ACTION_BACK)) } catch (e: Exception) { cb(false) }
        }
    }

    /** SET_TEXT — focus + likho. Text KABHI log/report nahi hota. */
    fun typeInto(n: AccessibilityNodeInfo, text: String): Boolean {
        return try {
            n.performAction(AccessibilityNodeInfo.ACTION_FOCUS)
            val b = Bundle()
            b.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
            n.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, b)
        } catch (e: Exception) { false }
    }

    /** screen-signature — tap ke baad badlav saabit karne ke liye */
    fun screenSig(): String {
        return try {
            val root = rootInActiveWindow ?: return ""
            val sb = StringBuilder((root.packageName ?: "").toString())
            var count = 0
            fun walk(n: AccessibilityNodeInfo?) {
                if (n == null || count >= 40) return
                try {
                    val t = (n.text ?: "").toString().trim()
                    if (t.isNotEmpty() && (try { n.isVisibleToUser } catch (e: Exception) { true })) {
                        sb.append('|').append(t.take(18)); count++
                    }
                } catch (e: Exception) {}
                for (i in 0 until n.childCount) walk(n.getChild(i))
            }
            walk(root)
            sb.toString()
        } catch (e: Exception) { "" }
    }

    override fun onInterrupt() {}
}
