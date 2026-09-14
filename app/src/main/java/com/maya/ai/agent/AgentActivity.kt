package com.maya.ai.agent

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
import android.text.TextWatcher
import android.text.InputType
import android.text.InputFilter
import android.view.MotionEvent
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.maya.ai.BuildConfig

/** Functional local approval pilot, NOT a remote AI or external-device action agent. */
class AgentActivity : AppCompatActivity() {
    private val handler = Handler(Looper.getMainLooper())
    private var foreground = false
    private var applying = false
    private var generation = 0L
    private var dialog: AlertDialog? = null
    private lateinit var plan: EditText
    private lateinit var lab: EditText
    private lateinit var result: TextView
    private lateinit var approve: Button
    private lateinit var run: Button
    private lateinit var stop: Button
    private val engine: ApprovedPlanRunner by lazy {
        ApprovedPlanRunner(object : ApprovedPlanRunner.LabPort {
            override fun available() = foreground && !isFinishing && !isDestroyed
            override fun read() = lab.text.toString()
            override fun write(value: String) {
                applying = true
                try { lab.setText(value) } finally { applying = false }
            }
        }, { SystemClock.elapsedRealtime() }, { delay, task ->
            val pending = Runnable { task() }; check(handler.postDelayed(pending, delay))
            val cancel: () -> Unit = { handler.removeCallbacks(pending) }; cancel
        }, { paint() })
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        fun column() = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; isSaveEnabled = false
            importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
        }
        val shell = column().apply { setPadding(dp(16),dp(10),dp(16),dp(10)); setBackgroundColor(Color.rgb(16,19,27)) }
        val body = column()
        fun label(text: String, size: Float = 15f) = TextView(this).apply {
            this.text = text; textSize = size; setTextColor(Color.WHITE); setPadding(0,dp(8),0,dp(8)); isSaveEnabled = false; body.addView(this)
        }
        fun button(text: String, action: () -> Unit) = Button(this).apply {
            this.text = text; isAllCaps = false; minHeight = dp(48); isSaveEnabled = false; filterTouchesWhenObscured = true
            setOnClickListener { action() }; body.addView(this)
        }
        fun editor(tagName: String, cap: Int) = EditText(this).apply {
            tag = tagName; setTextColor(Color.WHITE); setHintTextColor(Color.LTGRAY); textSize = 16f; minLines = 2; maxLines = 8
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            imeOptions = EditorInfo.IME_FLAG_NO_EXTRACT_UI or EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING
            filters = arrayOf(InputFilter.LengthFilter(cap)); isSaveEnabled = false; importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO
            body.addView(this)
        }
        label("MAYA / AGENT WORKSPACE",22f)
        label("${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE}) · local pilot, not full phone control",13f)
        label("Option 1: edit a plan → approve that exact plan → run its bounded steps. Nothing runs on open, approval alone, or a received message.")
        label("Allowed target: this Maya test workspace ONLY. External apps, Accessibility, screen capture and AI planning are locked/not connected. No new permission or network request.")
        label("1 · Editable plan",18f)
        label("1–6 lines: SET text, EXPECT text, or CLEAR. Text ≤200 characters per step; no blank lines. All operations affect ONLY the field below. Use nonsensitive test text.")
        plan = editor("agent_plan",1800).apply { hint = "SET Salam\nEXPECT Salam\nCLEAR" }
        button("Load local example · no actions") { plan.setText("SET Salam\nEXPECT Salam\nCLEAR") }
        label("2 · Local test field",18f)
        lab = editor("agent_lab",400).apply { hint = "Local field—not another app" }
        approve = button("Review & approve plan") {
            if (!foreground || engine.busy) return@button
            val parsed = parse() ?: return@button
            val source = plan.text.toString(); val initial = lab.text.toString(); val epoch = ++generation
            dialog = AlertDialog.Builder(this).setTitle("Approve this local plan?")
                .setMessage("Target: Maya local test field only. ${parsed.size} steps, one run, approval expires in 60 seconds. Run is a separate button. Changes revoke approval.\n\n$source")
                .setNegativeButton("Cancel",null)
                .setPositiveButton("Approve") { _, _ ->
                    if (foreground && epoch == generation && source == plan.text.toString() && initial == lab.text.toString()) engine.approve(parsed)
                }.create().also { d ->
                    d.setOnDismissListener { if (generation == epoch) generation++ }
                    d.show(); d.getButton(AlertDialog.BUTTON_POSITIVE).filterTouchesWhenObscured = true
                }
        }
        run = button("Run approved local plan") { parse()?.let { engine.start(it) } }
        result = label("",14f).apply { tag = "agent_report"; accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE }
        button("Copy fixed execution report") {
            (getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("Maya local Agent report",engine.report()))
        }
        button("Clear local workspace") { clear() }
        label("Any touch during a run stops it. A mismatch, missing target, failure or 30-second run deadline stops the plan—no retry. Verified steps are recorded without your plan/draft contents.")
        label("Leaving clears plan, approval and test data. This pilot cannot send/delete/install/pay or control another app. Those capabilities need separately reviewed adapters and explicit device permission, not raw model text sent to the old action queue.")
        val scroll = ScrollView(this).apply { isSaveEnabled = false; addView(body) }
        shell.addView(scroll,LinearLayout.LayoutParams(-1,0,1f))
        stop = Button(this).apply {
            text = "STOP AGENT"; isAllCaps = false; minHeight = dp(48); tag = "agent_stop"
            isSaveEnabled = false; filterTouchesWhenObscured = true; setOnClickListener { engine.stop() }
        }
        shell.addView(stop,LinearLayout.LayoutParams(-1,-2)); setContentView(shell)
        val watcher = object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                if (!applying) { generation++; engine.invalidate(); paint() }
            }
            override fun afterTextChanged(s: Editable?) {}
        }
        plan.addTextChangedListener(watcher); lab.addTextChangedListener(watcher); paint()
    }
    private fun parse(): ApprovedPlanRunner.Plan? = try { ApprovedPlanRunner.Plan.parse(plan.text.toString()) }
        catch (_: IllegalArgumentException) { engine.invalidate(); result.text = "Invalid plan. Only 1–6 SET / EXPECT / CLEAR lines for the local lab are accepted."; null }
    private fun paint() {
        if (!::stop.isInitialized) return
        approve.isEnabled = foreground && !engine.busy && plan.text.isNotBlank()
        run.isEnabled = foreground && engine.approved && !engine.busy
        stop.isEnabled = engine.busy || engine.approved
        result.text = engine.report()
    }
    private fun clear() {
        generation++; dialog?.dismiss(); dialog = null; engine.clear()
        if (::plan.isInitialized) plan.setText("")
        if (::lab.isInitialized) { applying = true; try { lab.setText("") } finally { applying = false } }
    }
    override fun onResume() { super.onResume(); foreground = true; paint() }
    override fun onPause() {
        foreground = false; generation++; dialog?.dismiss(); dialog = null; engine.stop(); super.onPause()
    }
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus); if (!hasFocus && engine.busy) engine.stop()
    }
    override fun onStop() { foreground = false; clear(); super.onStop() }
    override fun onDestroy() { foreground = false; clear(); handler.removeCallbacksAndMessages(null); super.onDestroy() }
    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
        if (event.actionMasked == MotionEvent.ACTION_DOWN && engine.busy) engine.stop()
        if (event.flags and (MotionEvent.FLAG_WINDOW_IS_OBSCURED or MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED) != 0) return true
        return super.dispatchTouchEvent(event)
    }
    @Deprecated("Deprecated in Android") override fun onBackPressed() { foreground = false; clear(); finish() }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
