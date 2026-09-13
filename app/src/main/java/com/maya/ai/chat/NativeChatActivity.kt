package com.maya.ai.chat

import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.text.Editable
import android.text.InputFilter
import android.text.InputType
import android.text.TextWatcher
import android.view.MotionEvent
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.*
import com.maya.ai.chat.NativeChatReadiness.Reason
import androidx.appcompat.app.AppCompatActivity
import com.maya.ai.BuildConfig
import com.maya.ai.MainActivity
import com.maya.ai.WakeWordService
import java.util.concurrent.SynchronousQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit

/** Native text-only screen. No WebView, voice, device bridge or incoming intent data. */
class NativeChatActivity : AppCompatActivity() {
    companion object {
        private var sharedAccessDiagnostic: NativeAccessDiagnostic? = null
        @Synchronized private fun getAccessDiagnostic(context: Context): NativeAccessDiagnostic {
            return sharedAccessDiagnostic ?: run {
                val prefs = context.applicationContext.getSharedPreferences("maya_access_diagnostic", Context.MODE_PRIVATE)
                NativeAccessDiagnostic(object : NativeAccessDiagnostic.Store {
                    override fun read(): String? = prefs.getString("last_check", null)
                    override fun write(value: String) { prefs.edit().putString("last_check", value).apply() }
                }).also { sharedAccessDiagnostic = it }
            }
        }
        const val OPEN_LINK = "maya-private-chat://open"
        // Shared single worker, no pending queue: an uninterruptible Keystore operation
        // cannot create an unbounded pile of threads/jobs across Activity recreation.
        private val executor = ThreadPoolExecutor(1, 1, 30, TimeUnit.SECONDS, SynchronousQueue()).apply { allowCoreThreadTimeOut(true) }
    }
    private class Job(val kind: String, val turn: NativeChatConversation.Turn?, val started: Long) {
        val operation = NativeChatTransport.Operation { SystemClock.elapsedRealtime() }
        var timeout: Runnable? = null
        var readinessTimeout: Runnable? = null
        var waitingReadiness = false
        var accessTicket: NativeAccessDiagnostic.Ticket? = null
        @Volatile var accessHttp = 0
    }
    private val handler = Handler(Looper.getMainLooper())
    private val session = NativeChatConversation { SystemClock.elapsedRealtime() }
    private val identity = NativeChatIdentity()
    private val transport by lazy { NativeChatTransport() }
    private var active: Job? = null
    private var visible = false
    private var publicText: String? = null
    private lateinit var status: TextView
    private lateinit var readinessResult: TextView
    private lateinit var readinessButton: Button
    private var readinessReason = Reason.NOT_CHECKED
    private lateinit var contextNote: TextView
    private lateinit var history: LinearLayout
    private lateinit var keyText: TextView
    private lateinit var counter: TextView
    private lateinit var draft: EditText
    private lateinit var consent: CheckBox
    private lateinit var send: Button
    private lateinit var stop: Button
    private lateinit var accessStop: Button
    private lateinit var create: Button
    private lateinit var copy: Button
    private lateinit var check: Button
    private lateinit var accessDiagnostic: NativeAccessDiagnostic
    private lateinit var accessResult: TextView
    private lateinit var touchWarning: TextView
    private var obscuredTouchSeen = false
    private var disclosure: AlertDialog? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        accessDiagnostic = getAccessDiagnostic(this)
        readinessReason = try { NativeChatReadiness.restore(getSharedPreferences("maya_readiness_diagnostic", Context.MODE_PRIVATE)
            .getString("reason", null)) } catch (_: Exception) { Reason.NOT_CHECKED }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(18), dp(18), dp(18), dp(30))
            setBackgroundColor(Color.rgb(16, 16, 23)); isSaveEnabled = false
            importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
        }
        fun label(text: String, size: Float = 15f): TextView = labelView(text, size).also { root.addView(it) }
        fun button(text: String, action: () -> Unit): Button = Button(this).apply {
            this.text = text; isAllCaps = false; filterTouchesWhenObscured = true; minHeight = dp(48); isSaveEnabled = false
            setOnClickListener { action() }; root.addView(this)
        }
        label("MAYA · PRIVATE TEXT CHAT", 23f)
        label("Native Chat v1 · ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})")
        label("APK ACCESS · NO AI", 18f)
        accessResult = label(accessDiagnostic.report(), 15f).apply {
            setTextIsSelectable(true); accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        }
        touchWarning = label("", 15f)
        check = button("Check APK access + replay · no AI") { start("check", null) { job ->
            val signed = identity.sign(null); job.operation.check()
            accessStage(job, NativeAccessDiagnostic.Stage.FIRST_REQUEST)
            val first = transport.execute(signed, job.operation)
            job.accessHttp = if (first is NativeChatResponse.Result.Error) first.status else 200
            if (first is NativeChatResponse.Result.Error) first
            else {
                if (first !== NativeChatResponse.Result.Access) throw NativeChatProtocol.Rejected("INVALID_SERVER_RESPONSE")
                job.operation.check()
                accessStage(job, NativeAccessDiagnostic.Stage.REPLAY_REQUEST)
                val second = transport.execute(signed, job.operation)
                job.accessHttp = if (second is NativeChatResponse.Result.Error) second.status else 200
                if (second !is NativeChatResponse.Result.Error || second.status != 409 || second.code != "REPLAY_OR_WINDOW_FULL" || second.remoteUncertain)
                    throw NativeChatProtocol.Rejected("REPLAY_CHECK_FAILED")
                NativeChatResponse.Result.Access
            }
        } }
        accessStop = button("STOP local wait") { stopActive("Stopped locally.") }
        label("Uses your existing saved APK key directly. No need to show/copy it first. This check never creates a key and does not require Chat ON or the message-consent checkbox.")
        button("Copy check report") {
            val report = "MAYA ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})\n" + accessDiagnostic.report() +
                "\nObscured touch blocked: $obscuredTouchSeen"
            (getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("Maya access diagnostic", report))
            status.text = "Fixed diagnostic report copied. Paste it after leaving this screen; no messages, keys or signatures included."
        }
        button("Clear check report") {
            if (active == null) { accessDiagnostic.clear(); showAccessDiagnostic() }
        }
        label("Only the last fixed diagnostic state/code/count/duration is retained locally (best effort). Chat, keys, signatures and server bodies are NOT stored in that report. Backgrounding still clears conversation/consent, not the completed check report.")
        label("Text only. No tools, voice, browsing or phone actions. The original assistant/Fish settings are separate.")
        label("LEAVING THIS SCREEN = NEW CONVERSATION", 17f)
        label("Backgrounding, closing or recreating this screen clears draft, consent and chat. Keep follow-ups here. Your APK key stays in Android Keystore.")
        label("1 · APK identity", 18f)
        label("Creates/shows only this APK's public identity. Server authorization is manual: APK_PUBLIC_JWK. Never replace OWNER_PUBLIC_JWK or copy a browser private key.")
        create = button("Create / show APK public key") {
            confirm("APK signing identity", "Create a separate key if missing, or show the existing PUBLIC key. No network, registration or replacement. Hardware-backed storage is not guaranteed.") {
                start("key", null) { identity.createExplicitly() }
            }
        }
        keyText = label("No public key displayed yet.", 13f).apply { setTextIsSelectable(true) }
        copy = button("Copy PUBLIC key") {
            val text = publicText ?: return@button
            (getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("APK_PUBLIC_JWK", text))
            status.text = "PUBLIC key copied. Add it only to APK_PUBLIC_JWK in the owner's Worker settings. The browser key must stay unchanged."
        }
        label("2 · Conversation", 18f)
        readinessResult = label(readinessReport(), 15f).apply { accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE }
        readinessButton = button("Check local Send readiness · no network") { start("readiness", null) { Unit } }
        button("Copy readiness report") {
            val report = "MAYA ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})\n" + readinessReport()
            (getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("Maya local readiness", report))
            status.text = "Fixed local readiness report copied. No keys, conversation or server details included."
        }
        label("This check sends nothing and changes no settings. Only its last fixed reason code is kept locally. A READY result is historical; Send checks again and signs with the saved key. Showing/copying the public key is not required. A missing key stops locally.")
        contextNote = label("Context: 0 messages. No previous conversation.")
        history = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; isSaveEnabled = false; root.addView(this) }
        counter = label("Your message · 0 / 2,000")
        draft = EditText(this).apply {
            hint = "Write non-sensitive test text…"; setHintTextColor(Color.LTGRAY); setTextColor(Color.WHITE); textSize = 16f
            minLines = 3; maxLines = 8; inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            imeOptions = EditorInfo.IME_FLAG_NO_EXTRACT_UI or EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING
            filters = arrayOf(InputFilter.LengthFilter(2000)); isSaveEnabled = false
            importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO
            contentDescription = "Your private text message. Enter inserts a newline."
            root.addView(this)
        }
        label("2,000 characters/message · 6,000 in context · 12 messages. 5 admitted requests/minute, 50/day shared with browser Chat; no guarantee of free capacity.")
        consent = CheckBox(this).apply {
            text = "I agree to send the current conversation to Cloudflare AI. I have stopped the original assistant/automation and will use non-sensitive text during setup."
            filterTouchesWhenObscured = true; setTextColor(Color.WHITE); isSaveEnabled = false; minHeight = dp(48); root.addView(this)
        }
        send = button("Send message") {
            if (active != null) return@button
            try {
                val turn = session.begin(draft.text.toString(), consent.isChecked)
                start("chat", turn) { job ->
                    val signed = identity.sign(turn.input); job.operation.check()
                    if (signed.body != turn.body) throw NativeChatProtocol.Rejected("INVALID_REQUEST")
                    transport.execute(signed, job.operation) { session.markDispatched(turn) }
                }
            } catch (e: NativeChatProtocol.Rejected) { status.text = errorText(e.code, false); paint() }
        }
        stop = button("STOP local wait") { stopActive("Stopped locally.") }
        button("Clear local chat") {
            confirm("Clear this local chat?", "Remove this screen's draft/history and stop its local wait. This does not delete your key, erase provider records or refund usage.") {
                stopActive("Cleared local chat."); session.clear(); draft.setText(""); consent.isChecked = false; renderHistory(); paint()
            }
        }
        status = label("Ready for setup. No request has been sent. Chat availability is controlled by the owner.").apply {
            accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        }
        label("STOP ends local waiting, not guaranteed remote work. Failed/uncertain turns are excluded from follow-ups. No automatic retries, history storage or message logging.")
        label("Replies are untrusted plain text and may be inaccurate. Never enter passwords, OTPs, provider tokens or private keys.")
        val scroll = ScrollView(this).apply { isSaveEnabled = false; addView(root) }; setContentView(scroll)
        draft.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) { paint() }
            override fun afterTextChanged(s: Editable?) {}
        })
        consent.setOnCheckedChangeListener { _, _ -> paint() }
        paint()
        // Deliberately no key creation, read, check, request or intent parsing on load.
    }
    private fun confirm(title: String, text: String, yes: () -> Unit) {
        if (disclosure?.isShowing == true) return
        disclosure = AlertDialog.Builder(this).setTitle(title).setMessage(text).setNegativeButton("Cancel", null)
            .setPositiveButton("Continue") { _, _ -> yes() }.create().also { it.show(); it.getButton(AlertDialog.BUTTON_POSITIVE).filterTouchesWhenObscured = true }
    }
    private fun start(kind: String, turn: NativeChatConversation.Turn?, work: (Job) -> Any) {
        if (active != null || !visible) { if (turn != null) session.fail(turn); return }
        val job = Job(kind, turn, SystemClock.elapsedRealtime()); active = job
        if (kind == "check") {
            obscuredTouchSeen = false; touchWarning.text = ""
            job.accessTicket = accessDiagnostic.begin(); showAccessDiagnostic()
        }
        status.text = "Working locally / waiting for a bounded result… STOP is available."; paint()
        job.timeout = Runnable { if (active === job) stopActive("Local 20-second deadline expired.", NativeAccessDiagnostic.State.TIMEOUT) }.also { handler.postDelayed(it, NativeChatProtocol.DEADLINE_MS) }
        fun launch(ready: Boolean) {
            if (active !== job || !visible) return
            if (!ready) { finish(job, null, "ASSISTANT_BUSY"); return }
            try { executor.execute {
                try { job.operation.check(); val result = work(job); job.operation.check(); runOnUiThread { finish(job, result, null) } }
                catch (e: NativeChatProtocol.Rejected) { runOnUiThread { finish(job, null, e.code) } }
                catch (_: Exception) { runOnUiThread { finish(job, null, "SERVICE_UNAVAILABLE") } }
            } } catch (_: java.util.concurrent.RejectedExecutionException) { finish(job, null, "BUSY") }
        }
        // Same fresh local gate for Send and the explicit no-network diagnostic.
        if (kind == "chat" || kind == "readiness") inspectReadiness(job) { reason ->
            if (kind == "readiness") finish(job, reason, null)
            else if (reason == Reason.READY) launch(true)
            else finish(job, null, "READINESS_" + reason.name)
        } else launch(true)
    }
    private fun finish(job: Job, result: Any?, error: String?) {
        if (active !== job || !visible) return
        job.timeout?.let { handler.removeCallbacks(it) }; job.readinessTimeout?.let { handler.removeCallbacks(it) }; active = null
        job.accessTicket?.let { ticket ->
            val state = when {
                result === NativeChatResponse.Result.Access && error == null -> NativeAccessDiagnostic.State.PASS
                error == "DEADLINE_EXCEEDED" -> NativeAccessDiagnostic.State.TIMEOUT
                error == "STOPPED_LOCALLY" -> NativeAccessDiagnostic.State.STOPPED
                else -> NativeAccessDiagnostic.State.FAILED
            }
            val code = error ?: (result as? NativeChatResponse.Result.Error)?.code ?: "INVALID_SERVER_RESPONSE"
            accessDiagnostic.finish(ticket, state, code, job.accessHttp, SystemClock.elapsedRealtime() - job.started)
            showAccessDiagnostic()
        }
        val seconds = (SystemClock.elapsedRealtime() - job.started).coerceAtLeast(0) / 1000.0
        try {
            when {
                result is Reason && job.kind == "readiness" -> status.text = result.hint + " Local check only; no network or AI request."
                error != null -> { job.turn?.let { session.fail(it) }; status.text = errorText(error, job.kind == "chat" && job.operation.attempted) }
                result is String && job.kind == "key" -> {
                    publicText = result; keyText.text = "PUBLIC JWK:\n$result\nFingerprint: ${NativeChatProtocol.hash(result.toByteArray(Charsets.UTF_8))}"
                    status.text = "APK identity ready locally. It is NOT automatically registered. Copy only the PUBLIC key into APK_PUBLIC_JWK; keep browser OWNER_PUBLIC_JWK unchanged."
                }
                result is NativeChatResponse.Result.Reply && job.turn != null -> {
                    if (session.complete(job.turn, result.text) == NativeChatConversation.Completion.ACCEPTED) {
                        draft.setText(""); renderHistory(); status.text = "Model response received; it may be inaccurate."
                    } else status.text = "Late result excluded. No automatic resend."
                }
                result === NativeChatResponse.Result.Access && job.kind == "check" ->
                    status.text = "APK signed empty check accepted; exact replay denied. No AI called. This is not a permanent login or proof that Chat is enabled."
                result is NativeChatResponse.Result.Error -> {
                    job.turn?.let { session.fail(it) }
                    status.text = errorText(result.code, job.kind == "chat" && result.remoteUncertain) + (result.diagnostic?.let { " Diagnostic: $it." } ?: "")
                }
                else -> { job.turn?.let { session.fail(it) }; status.text = errorText("INVALID_SERVER_RESPONSE", job.kind == "chat" && job.operation.attempted) }
            }
        } catch (_: Exception) { job.turn?.let { session.fail(it) }; status.text = errorText("INVALID_SERVER_RESPONSE", job.kind == "chat" && job.operation.attempted) }
        if (job.kind == "chat") {
            val duration = String.format(java.util.Locale.US, "%.2f", seconds)
            status.append(if (job.operation.attempted) "\nLocal wait: $duration s (key/signing + network + server; not model-only speed)."
                else "\nLocal pre-dispatch wait: $duration s. No network request sent.")
        }
        paint()
    }
    private fun stopActive(message: String, accessState: NativeAccessDiagnostic.State = NativeAccessDiagnostic.State.STOPPED) {
        val job = active
        if (job != null) {
            job.timeout?.let { handler.removeCallbacks(it) }; job.readinessTimeout?.let { handler.removeCallbacks(it) }; active = null
            if (job.waitingReadiness) { job.waitingReadiness = false; recordReadiness(Reason.CANCELLED) }
            job.operation.cancel(); session.stop()
            job.accessTicket?.let {
                accessDiagnostic.finish(it, accessState,
                    if (accessState == NativeAccessDiagnostic.State.TIMEOUT) "DEADLINE_EXCEEDED" else "STOPPED_LOCALLY",
                    job.accessHttp, SystemClock.elapsedRealtime() - job.started)
                showAccessDiagnostic()
            }
            status.text = message + if (job.kind == "chat" && job.operation.attempted) " Remote work may continue/completed; usage may count. No retry." else " No model dispatch confirmed; no automatic retry."
        } else status.text = message
        paint()
    }
    private fun errorText(code: String, uncertain: Boolean): String {
        if (code.startsWith("READINESS_")) {
            val reason = Reason.values().firstOrNull { it.name == code.removePrefix("READINESS_") } ?: Reason.UNKNOWN
            return "Local Send blocked: ${reason.name}. ${reason.hint} No model request was sent."
        }
        val message = when (code) {
            "KEY_REQUIRED" -> "No APK key. Use Create / show APK public key first."
            "KEYSTORE_UNAVAILABLE", "INVALID_LOCAL_KEY", "SIGNING_FAILED", "INVALID_SIGNATURE_ENCODING" -> "APK key/signing unavailable. No automatic key replacement."
            "SIGNATURE_REQUIRED", "BAD_SIGNATURE", "INVALID_APK_CONFIGURATION" -> "APK access denied or setup invalid. Check APK_PUBLIC_JWK with the owner; never replace the browser key."
            "CHAT_NOT_ENABLED" -> "Chat is OFF or required owner review is incomplete."
            "SETUP_REQUIRED", "INVALID_OWNER_CONFIGURATION" -> "Server setup needs owner attention."
            "CONSENT_REQUIRED" -> "Consent is required before sending conversation text."
            "INVALID_MESSAGES" -> "Enter nonempty text up to 2,000 characters."
            "CONTEXT_LIMIT", "BODY_TOO_LARGE" -> "Conversation limit reached. Nothing was silently trimmed. Clear explicitly to begin again."
            "REQUEST_LIMIT", "BUDGET_UNAVAILABLE" -> "Request budget unavailable or exhausted. No automatic retry."
            "ASSISTANT_BUSY" -> "Original assistant/wake/voice is active or not ready. Finish/STOP it and turn wake/auto-listen off yourself, then try this screen. Settings were not changed."
            "BUSY" -> "An earlier local operation is still finishing. No request queued."
            "REQUEST_EXPIRED_OR_CLOCK_SKEW" -> "Signature expired or clock differs. Check automatic date/time."
            "REPLAY_CHECK_FAILED" -> "Expected access/replay result not confirmed. Do not enable AI."
            "STOPPED_LOCALLY", "DEADLINE_EXCEEDED" -> "Local wait stopped or timed out."
            else -> "No usable result. No automatic retry or raw server details displayed."
        }
        return message + if (uncertain) " Remote work may have completed/continue; usage may count." else " This operation did not confirm a model dispatch."
    }
    private fun renderHistory() {
        history.removeAllViews()
        session.messages().forEach { message -> history.addView(labelView((if (message.role == "user") "You\n" else "Maya · model response\n") + message.content).apply {
            setPadding(dp(12), dp(12), dp(12), dp(12)); setTextIsSelectable(true)
        }) }
        contextNote.text = "Context: ${session.messages().size} messages. " + if (session.messages().isEmpty()) "New conversation; no earlier messages." else "Follow-up ready; stay on this screen."
    }
    private fun paint() {
        if (!::send.isInitialized) return
        val busy = active != null
        send.isEnabled = !busy && consent.isChecked && draft.text.toString().isNotBlank()
        readinessButton.isEnabled = !busy
        accessStop.isEnabled = busy; stop.isEnabled = busy; create.isEnabled = !busy; copy.isEnabled = !busy && publicText != null; check.isEnabled = !busy
        draft.isEnabled = !busy; consent.isEnabled = !busy
        counter.text = "Your message · ${draft.text.length} / 2,000"
    }
    private fun readinessReport() = "Last local readiness: ${readinessReason.name}\n${readinessReason.hint}\nThis result is not a server/AI test. Send always rechecks."
    private fun recordReadiness(reason: Reason) {
        readinessReason = reason
        try { getSharedPreferences("maya_readiness_diagnostic", Context.MODE_PRIVATE).edit().putString("reason", reason.name).apply() } catch (_: Exception) {}
        if (::readinessResult.isInitialized) readinessResult.text = readinessReport()
    }
    private fun inspectReadiness(job: Job, complete: (Reason) -> Unit) {
        job.waitingReadiness = true; recordReadiness(Reason.CHECKING)
        fun deliver(reason: Reason) {
            if (active !== job || !visible || !job.waitingReadiness) return
            job.waitingReadiness = false
            job.readinessTimeout?.let { handler.removeCallbacks(it) }
            recordReadiness(reason); complete(reason)
        }
        job.readinessTimeout = Runnable { deliver(Reason.UI_UNRESPONSIVE) }.also { handler.postDelayed(it, 1500) }
        try {
            val native = NativeChatReadiness.runtime(getSharedPreferences("maya", Context.MODE_PRIVATE).getBoolean("wake", false),
                WakeWordService.instance != null, WakeWordService.fishOutputActive, WakeWordService.haal,
                com.maya.ai.MayaAct.hasPendingActions())
            if (native != Reason.READY) deliver(native)
            else MainActivity.instance?.nativeChatReady { deliver(it) } ?: deliver(Reason.READY)
        } catch (_: Exception) { deliver(Reason.UNKNOWN) }
    }
    private fun showAccessDiagnostic() {
        if (::accessResult.isInitialized) accessResult.text = accessDiagnostic.report()
    }
    private fun accessStage(job: Job, stage: NativeAccessDiagnostic.Stage) {
        runOnUiThread {
            if (active === job && visible) { job.accessTicket?.let { accessDiagnostic.stage(it, stage) }; showAccessDiagnostic() }
        }
    }
    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
        val obscured = event.flags and (MotionEvent.FLAG_WINDOW_IS_OBSCURED or MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED) != 0
        if (obscured) {
            if (event.actionMasked == MotionEvent.ACTION_DOWN && ::touchWarning.isInitialized) {
                obscuredTouchSeen = true
                touchWarning.text = "Touch blocked by Android's overlay protection. Hide floating windows/screen filters, then tap again. This blocked touch sent no request."
            }
            return true // Keep protection; do not silently bypass an obscured confirmation.
        }
        return super.dispatchTouchEvent(event)
    }
    private fun labelView(value: String, size: Float = 15f) = TextView(this).apply {
        text = value; textSize = size; setTextColor(Color.rgb(231, 229, 241)); setPadding(0, dp(8), 0, dp(8)); isSaveEnabled = false
    }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    override fun onResume() { super.onResume(); visible = true; showAccessDiagnostic() }
    override fun onStop() {
        visible = false; disclosure?.dismiss(); disclosure = null
        stopActive("This screen was left; local chat was cleared.", NativeAccessDiagnostic.State.LEFT_SCREEN); session.clear(); draft.setText(""); consent.isChecked = false; renderHistory()
        super.onStop()
    }
    override fun onDestroy() { active?.operation?.cancel(); handler.removeCallbacksAndMessages(null); super.onDestroy() }
    @Deprecated("Deprecated in Android") override fun onBackPressed() {
        if (draft.text.isNotEmpty() || session.messages().isNotEmpty() || active != null)
            confirm("Leave private Chat?", "Leaving clears this local conversation and stops local waiting. It does not erase provider records or refund usage.") { finish() }
        else finish()
    }
}
