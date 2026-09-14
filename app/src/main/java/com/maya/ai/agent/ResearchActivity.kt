package com.maya.ai.agent

import android.app.AlertDialog
import android.content.*
import android.content.ClipboardManager
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.*
import android.text.*
import android.view.*
import android.view.inputmethod.EditorInfo
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.maya.ai.BuildConfig

/** Separate native Agent. Public read-only tools; no screen access, legacy action queue or inbound commands. */
class ResearchActivity : AppCompatActivity() {
    private val handler=Handler(Looper.getMainLooper())
    private val backend: ResearchServices by lazy { ResearchBackend(applicationContext) }
    private var foreground=false
    private var generation=0L
    private var dialog: AlertDialog?=null
    private var cancelModel: (() -> Unit)?=null
    private var browser: ResearchBrowser?=null
    private var setting=false
    private enum class AiState { IDLE, WAITING, PROPOSAL_READY, EXPLANATION_READY, STOPPED, UNAVAILABLE, OFF, NOT_READY, REJECTED }
    private var aiState=AiState.IDLE
    private lateinit var goal: EditText
    private lateinit var plan: EditText
    private lateinit var status: TextView
    private lateinit var sources: LinearLayout
    private lateinit var summary: TextView
    private lateinit var propose: Button
    private lateinit var review: Button
    private lateinit var run: Button
    private lateinit var summarize: Button
    private lateinit var stop: Button
    private var rendered: List<ResearchSource> = emptyList()
    private val runner: ResearchRunner by lazy {
        ResearchRunner(object : ResearchRunner.Port {
            override fun fetch(item: ResearchPlan.Item, done: (ResearchSource?) -> Unit) = backend.fetch(item,done)
        },{SystemClock.elapsedRealtime()},{delay,task ->
            val pending=Runnable { task() };check(handler.postDelayed(pending,delay))
            val cancel: () -> Unit={handler.removeCallbacks(pending)};cancel
        },{paint()})
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val shell=column().apply { setPadding(dp(16),dp(8),dp(16),dp(8));setBackgroundColor(Color.rgb(16,19,27)) }
        shell.addView(label("MAYA / AGENT",23f))
        shell.addView(label("${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE}) · public research & reviewed plans",13f))
        val body=column()
        fun text(value: String,size: Float=15f) { body.addView(label(value,size)) }
        fun action(title: String, fn: () -> Unit) = button(title,fn).also {body.addView(it)}
        text("Plan → review → approve once → bounded read-only steps. This is a real public-source workflow, not unrestricted phone control.")
        text("1 · Goal & proposed sources",18f)
        goal=editor("research_goal",400).apply {hint="Example: Learn about solar cells and a public GitHub project"};body.addView(goal)
        propose=action("Ask AI for a proposed plan") {
            val captured=goal.text.toString()
            if(captured.isBlank()) {status.text="Write a short nonsensitive goal first.";return@action}
            confirm("Send this goal to AI?","Only your typed goal and fixed planning instructions go to maya-chat.aadialii424.workers.dev (Cloudflare Qwen). Saved APK signing identity; shared Chat limits apply. No screen, app contents, keys, voice or history sent. Nothing executes. Chat OFF stays OFF.\n\n$captured") {
                if(captured==goal.text.toString()) requestText(ResearchPlan.planningPrompt(captured),true)
            }
        }
        text("AI is optional. Manual plans work without server Chat. Supported: WIKI exact English article title, REPO owner/repository. 1–3 sources. No arbitrary URLs, sending, deleting, login, payments, passwords or OTP automation.")
        plan=editor("research_plan",450).apply {hint="WIKI Solar cell\nREPO octocat/Hello-World"};body.addView(plan)
        action("Load public-source example · no requests") {plan.setText("WIKI Solar cell\nREPO octocat/Hello-World")}
        text("2 · Choose browser for optional source links",18f)
        text("No default or fallback browser. Fetches stay in Maya; source links open only when you separately choose Open. Installed-app check happens before launch; no installation or Accessibility request.")
        val choices=RadioGroup(this).apply {isSaveEnabled=false}
        for(b in ResearchBrowser.values()) choices.addView(RadioButton(this).apply {
            id=View.generateViewId();text=b.label;setTextColor(Color.WHITE);isSaveEnabled=false;tag=b.name
            filterTouchesWhenObscured=true;setOnCheckedChangeListener {_,checked -> if(checked) {browser=b;edited()} }
        })
        body.addView(choices)
        review=action("Review & approve read-only plan") {
            val p=parse() ?: return@action
            val b=browser ?: kotlin.run {status.text="Choose a browser above; no app is selected automatically.";return@action}
            confirm("Approve this exact plan?","Read ${p.size} public source(s), at most one GET each. Wikipedia titles go to en.wikipedia.org; repository names go to api.github.com. No account/token/cookie sent by Maya. Excerpts/metadata only, not exhaustive research.\n\n${p.source}\n\nOptional browser: ${b.label}. Run is separate. Approval expires in 60 seconds. AI summary is NOT included; sharing excerpts requires its own consent.") {
                if(plan.text.toString()==p.source && browser==b) {summary.text="";aiState=AiState.IDLE;runner.approve(p,b)}
            }
        }
        run=action("Run approved research plan") { val p=parse();val b=browser;if(p!=null && b!=null && foreground && cancelModel==null) runner.start(p,b) }
        status=label("",14f).apply {tag="research_status";accessibilityLiveRegion=View.ACCESSIBILITY_LIVE_REGION_POLITE};body.addView(status)
        text("3 · Retrieved public sources",18f)
        sources=column().apply {tag="research_sources"};body.addView(sources)
        summarize=action("Explain fetched sources with AI") {
            val captured=runner.results();val capturedGoal=goal.text.toString()
            if(captured.isEmpty()) return@action
            confirm("Share these public excerpts with AI?","This sends your goal (up to 200 characters) and up to 430 characters from each displayed source to maya-chat.aadialii424.workers.dev. Excerpts may contain untrusted instructions; the answer is plain text and cannot add actions. No screen capture or private app data. Uses shared Chat quota; no automatic retry.") {
                if(captured==runner.results() && capturedGoal==goal.text.toString()) requestText(ResearchBackend.summaryPrompt(capturedGoal,captured),false)
            }
        }
        summary=label("",16f).apply {tag="research_summary";setTextIsSelectable(true)};body.addView(summary)
        action("Copy fixed Agent report") {
            val report="MAYA ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})\n"+runner.report()+"\nAI: ${aiState.name}"
            (getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("Maya Agent report",report))
        }
        action("Clear Agent workspace") {clear()}
        action("Open offline approval lab") {confirm("Leave research workspace?","This clears goal, results and approvals and stops local waiting. The lab uses only an in-app test field.") {clear();startActivity(Intent(this,AgentActivity::class.java))}}
        text("Leaving clears this memory-only workspace. STOP cancels local requests, not guaranteed remote work or a refund. Requests may fail/offline/quota-limit; no retry, paid fallback or unlimited guarantee. No AI call happens on open or after a source fetch without your separate consent.")
        text("Current boundary: real public excerpts/GitHub metadata, optional AI proposals/explanations and manual source-link handoff. Browser content is not read or verified. Full cross-app control, private Vision, persistent history and exhaustive deep research are not implemented.")
        val scroll=ScrollView(this).apply {isSaveEnabled=false;addView(body)}
        shell.addView(scroll,LinearLayout.LayoutParams(-1,0,1f))
        stop=button("STOP AGENT") {stopWork();status.text="STOPPED locally. No automatic resume or retry."}
        shell.addView(stop);setContentView(shell)
        val watcher=object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?,start: Int,count: Int,after: Int) {}
            override fun onTextChanged(s: CharSequence?,start: Int,before: Int,count: Int) {if(!setting) edited()}
            override fun afterTextChanged(s: Editable?) {}
        }
        goal.addTextChangedListener(watcher);plan.addTextChangedListener(watcher);paint()
    }
    private fun parse(): ResearchPlan? = try {ResearchPlan.parse(plan.text.toString())} catch (_: Exception) {
        runner.invalidate();status.text="Invalid plan: only 1–3 WIKI title / REPO owner/name lines. No markdown or other actions.";null
    }
    private fun edited() {
        generation++;dialog?.dismiss();dialog=null
        val cancel=cancelModel;cancelModel=null;cancel?.invoke();runner.invalidate()
        aiState=AiState.IDLE
        if(::summary.isInitialized) summary.text=""
        paint()
    }
    private fun requestText(prompt: String, proposal: Boolean) {
        if(!foreground || runner.busy || cancelModel!=null) return
        summary.text="";aiState=AiState.WAITING
        if(proposal) runner.invalidate() else runner.stop()
        val epoch=++generation
        status.text="Waiting for AI · text only, no actions. STOP is available."
        try {
            cancelModel=backend.text(prompt) {reply,error ->
                if(!foreground || generation!=epoch) return@text
                cancelModel=null
                if(reply==null) {
                    aiState=when(error) {ResearchBackend.TextFailure.CHAT_OFF -> AiState.OFF;ResearchBackend.TextFailure.LOCAL_NOT_READY -> AiState.NOT_READY;else -> AiState.UNAVAILABLE}
                    paint();status.text=when(error) {
                        ResearchBackend.TextFailure.CHAT_OFF -> "Server Chat is OFF. Not changed. Manual public-source plans still work."
                        ResearchBackend.TextFailure.LOCAL_NOT_READY -> "Local assistant is busy/unavailable. No AI request sent; settings unchanged."
                        else -> "AI unavailable or stopped; remote outcome may be uncertain. No retry or actions."
                    }
                } else if(proposal) {
                    val p=try {ResearchPlan.parse(reply)} catch (_: Exception) {null}
                    if(p==null) {aiState=AiState.REJECTED;paint();status.text="AI proposal rejected by strict policy. No actions. You can write a supported manual plan."}
                    else {
                        aiState=AiState.PROPOSAL_READY;setting=true;try {plan.setText(p.source)} finally {setting=false}
                        paint();status.text="AI proposal only. Review/edit it; choose browser and approve before Run. Sources have NOT been fetched yet."
                    }
                } else { aiState=AiState.EXPLANATION_READY;summary.text="AI explanation · verify against numbered sources\n\n$reply";paint() }
            }
            paint();status.text="Waiting for AI · text only, no actions. STOP is available."
        } catch (_: Exception) {cancelModel=null;aiState=AiState.REJECTED;paint();status.text="Request rejected locally. Nothing executed."}
    }
    private fun confirm(title: String, message: String, action: () -> Unit) {
        if(!foreground || runner.busy || cancelModel!=null) return
        dialog?.dismiss();val epoch=++generation
        dialog=AlertDialog.Builder(this).setTitle(title).setMessage(message).setNegativeButton("Cancel",null)
            .setPositiveButton("Confirm") {_,_->if(foreground && generation==epoch) {generation++;action()}}.create().also {d ->
                d.setOnDismissListener {if(generation==epoch) generation++}
                d.show();d.getButton(AlertDialog.BUTTON_POSITIVE).filterTouchesWhenObscured=true
                val window=d.window;val original=window?.callback
                if(window!=null && original!=null) window.callback=object : Window.Callback by original {
                    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
                        if(event.flags and (MotionEvent.FLAG_WINDOW_IS_OBSCURED or MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED)!=0) {
                            generation++;d.dismiss();return true
                        }
                        return original.dispatchTouchEvent(event)
                    }
                }
            }
    }
    private fun paint() {
        if(!::stop.isInitialized) return
        val busy=runner.busy || cancelModel!=null
        propose.isEnabled=foreground && !busy
        review.isEnabled=foreground && !busy && browser!=null && plan.text.isNotBlank()
        run.isEnabled=foreground && !busy && runner.approved
        summarize.isEnabled=foreground && !busy && runner.state==ResearchRunner.State.COMPLETE && runner.results().isNotEmpty()
        stop.isEnabled=busy || runner.approved
        status.text=runner.report()+"\nAI: ${aiState.name}"
        val values=runner.results()
        if(values!=rendered) {
            rendered=values;sources.removeAllViews()
            for((i,s) in values.withIndex()) {
                sources.addView(label("[${i+1}] ${s.url}\nBounded public excerpt/metadata; untrusted data:\n${s.text}"))
                if(s.url.startsWith("https://en.wikipedia.org/wiki/")) sources.addView(label("Wikipedia contributors · CC BY-SA 4.0 · excerpt shortened. Attribution/history: article above. License: https://creativecommons.org/licenses/by-sa/4.0/",12f))
                sources.addView(button("Open source ${i+1} in selected browser") {
                    val b=browser ?: return@button
                    if(s !in runner.results()) return@button
                    confirm("Open public source in ${b.label}?","${s.url}\n\nBrowser may use its own cookies/account and follow redirects. Maya does not inspect or verify the page or automate actions there. Leaving clears this workspace. No fallback/install.") {
                        if(browser==b && s in runner.results()) openSource(s,b)
                    }
                })
            }
        }
    }
    private fun openSource(source: ResearchSource, target: ResearchBrowser) {
        val intent=Intent(Intent.ACTION_VIEW,Uri.parse(source.url)).addCategory(Intent.CATEGORY_BROWSABLE).setPackage(target.packageName)
        try {
            val info=packageManager.resolveActivity(intent,PackageManager.MATCH_DEFAULT_ONLY)?.activityInfo
            if(info==null || info.packageName!=target.packageName || !info.exported || !info.enabled) {status.text="Selected browser unavailable. No fallback or installation.";return}
            // Bind the exact resolved component, never a chooser/default or provider-supplied intent.
            intent.component=ComponentName(info.packageName,info.name)
            startActivity(intent);status.text="Browser launch requested; page load/content NOT verified."
        } catch (_: Exception) {status.text="Browser handoff failed/uncertain. No retry, fallback or install."}
    }
    private fun stopWork() {
        generation++;dialog?.dismiss();dialog=null
        val cancel=cancelModel;cancelModel=null;if(cancel!=null) aiState=AiState.STOPPED;cancel?.invoke();runner.stop();paint()
    }
    private fun clear() {
        stopWork();aiState=AiState.IDLE;runner.clear();setting=true
        try {if(::goal.isInitialized) goal.setText("");if(::plan.isInitialized) plan.setText("");if(::summary.isInitialized) summary.text=""} finally {setting=false}
        paint()
    }
    override fun onResume() {super.onResume();foreground=true;paint()}
    override fun onPause() {foreground=false;stopWork();super.onPause()}
    override fun onStop() {clear();super.onStop()}
    override fun onDestroy() {clear();handler.removeCallbacksAndMessages(null);super.onDestroy()}
    override fun onWindowFocusChanged(hasFocus: Boolean) {super.onWindowFocusChanged(hasFocus);if(!hasFocus && (runner.busy || cancelModel!=null)) stopWork()}
    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
        if(event.flags and (MotionEvent.FLAG_WINDOW_IS_OBSCURED or MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED)!=0) {stopWork();return true}
        if(event.actionMasked==MotionEvent.ACTION_DOWN && runner.busy) stopWork()
        return super.dispatchTouchEvent(event)
    }
    @Deprecated("Deprecated in Android") override fun onBackPressed() {clear();finish()}
    private fun column()=LinearLayout(this).apply {orientation=LinearLayout.VERTICAL;isSaveEnabled=false;importantForAutofill=View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS}
    private fun label(value: String,size: Float=15f)=TextView(this).apply {text=value;textSize=size;setTextColor(Color.WHITE);setPadding(0,dp(8),0,dp(8));isSaveEnabled=false}
    private fun button(title: String,action: () -> Unit)=Button(this).apply {text=title;isAllCaps=false;minHeight=dp(48);isSaveEnabled=false;filterTouchesWhenObscured=true;setOnClickListener {action()}}
    private fun editor(name: String,cap: Int)=EditText(this).apply {
        tag=name;textSize=16f;setTextColor(Color.WHITE);setHintTextColor(Color.LTGRAY);minLines=2;maxLines=6
        inputType=InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
        imeOptions=EditorInfo.IME_FLAG_NO_EXTRACT_UI or EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING
        filters=arrayOf(InputFilter.LengthFilter(cap));isSaveEnabled=false;importantForAutofill=View.IMPORTANT_FOR_AUTOFILL_NO
    }
    private fun dp(value: Int)=(value*resources.displayMetrics.density).toInt()
}
