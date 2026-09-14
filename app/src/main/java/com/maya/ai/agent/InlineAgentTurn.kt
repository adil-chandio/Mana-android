package com.maya.ai.agent

import android.app.AlertDialog
import android.content.*
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.*
import android.text.*
import android.view.*
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.maya.ai.chat.NativeChatProtocol

/** One bounded tool turn in the shared conversation, not a second chat/goal screen.
 * Services must deliver callbacks asynchronously on the UI thread. No incoming intents or raw action bridge. */
class InlineAgentTurn(private val host: AppCompatActivity, goal: String, recentDirect: String,
    private val services: ResearchServices, private val allowed: (InlineAgentTurn) -> Boolean, private val changed: () -> Unit,
    private val useInComposer: (String) -> Unit, private val speak: (String) -> Unit) {
    var goal=goal; private set
    private var recentDirect=recentDirect
    val view=LinearLayout(host).apply {
        orientation=LinearLayout.VERTICAL;isSaveEnabled=false
        importantForAutofill=View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
        setPadding(dp(12),dp(10),dp(12),dp(10))
        background=GradientDrawable().apply {setColor(Color.rgb(26,35,48));cornerRadius=dp(14).toFloat()}
        layoutParams=LinearLayout.LayoutParams(-1,-2).apply {bottomMargin=dp(14)}
    }
    private val handler=Handler(Looper.getMainLooper())
    private var alive=true
    private var epoch=0L
    private var dialog: AlertDialog?=null
    private var cancelModel: (() -> Unit)?=null
    private var browser: ResearchBrowser?=null
    private var notice="Plan not approved. No source request sent."
    private val buttons=mutableListOf<Button>()
    private val sourceButtons=mutableListOf<Button>()
    private val choices=mutableListOf<RadioButton>()
    private lateinit var plan: EditText
    private lateinit var state: TextView
    private lateinit var result: LinearLayout
    private lateinit var summaryView: TextView
    private lateinit var approve: Button
    private lateinit var execute: Button
    private lateinit var explain: Button
    private lateinit var speechButton: Button
    private var rendered=emptyList<ResearchSource>()
    var explanation="";private set
    private val runner=ResearchRunner(object : ResearchRunner.Port {
        override fun fetch(item: ResearchPlan.Item, done: (ResearchSource?) -> Unit)=services.fetch(item,done)
    },{SystemClock.elapsedRealtime()},{delay,task ->
        val pending=Runnable {task()};check(handler.postDelayed(pending,delay))
        val cancel: () -> Unit={handler.removeCallbacks(pending)};cancel
    },{refresh();changed()})
    val busy get()=runner.busy || cancelModel!=null
    val executing get()=runner.busy
    val approved get()=runner.approved
    init {
        require(goal.length in 1..450 && NativeChatProtocol.validReply(goal))
        label("YOU · AGENT MODE",12f);label(goal,17f)
        label("MAYA · PLAN & EXECUTION",12f)
        label("Public research only: 1–3 WIKI article / REPO owner/name steps. No phone clicks, sends, deletes, installs or private screens.")
        plan=EditText(host).apply {
            tag="inline_plan";isSaveEnabled=false;minLines=2;maxLines=6;setTextColor(Color.WHITE);setHintTextColor(Color.LTGRAY)
            hint="Editable plan appears here. Or write WIKI Dog / REPO owner/name."
            inputType=InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            imeOptions=android.view.inputmethod.EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING
            importantForAutofill=View.IMPORTANT_FOR_AUTOFILL_NO;filters=arrayOf(InputFilter.LengthFilter(450))
            view.addView(this)
        }
        val manual=try {ResearchPlan.parse(goal)} catch (_: Exception) {null}
        if(manual!=null) {plan.setText(manual.source);notice="Manual plan received locally. Review before Run; no AI request."}
        button("Generate / revise AI plan") {propose()}
        label("Browser for optional source links — not selected automatically",12f)
        val group=RadioGroup(host).apply {isSaveEnabled=false;orientation=RadioGroup.HORIZONTAL}
        for(b in ResearchBrowser.values()) {
            val choice=RadioButton(host).apply {
                id=View.generateViewId();text=b.label;isSaveEnabled=false;filterTouchesWhenObscured=true;setTextColor(Color.WHITE)
                setOnCheckedChangeListener {_,checked -> if(checked) {browser=b;this@InlineAgentTurn.invalidate()}}
            };choices.add(choice);group.addView(choice,RadioGroup.LayoutParams(0,-2,1f))
        }
        view.addView(group)
        approve=button("Review & approve plan") {
            val p=parse() ?: return@button;val b=browser ?: return@button
            confirm("Approve these read-only steps?", "One run, ${p.size} sources, expiry 60 seconds. Wikipedia titles go to en.wikipedia.org; repo names to api.github.com. No token/cookie. 45-second run limit, no retry. Touch/intervention while reading stops the run; no automatic resume. AI explanation needs separate consent. Browser: ${b.label}.\n\n${p.source}") {
                if(p.source==plan.text.toString() && browser==b) {explanation="";summaryView.text="";notice="Approved once. Press Run.";runner.approve(p,b);refresh();changed()}
            }
        }
        execute=button("Run approved plan") {val p=parse();val b=browser;if(p!=null && b!=null) {notice="Executing approved read-only steps…";runner.start(p,b);refresh();changed()}}
        state=label("",14f).apply {tag="inline_progress";accessibilityLiveRegion=View.ACCESSIBILITY_LIVE_REGION_POLITE}
        result=LinearLayout(host).apply {orientation=LinearLayout.VERTICAL;isSaveEnabled=false;tag="inline_sources";view.addView(this)}
        explain=button("Explain sources · AI consent") {
            val sources=runner.results()
            confirm("Send these excerpts to AI?", "Send this goal (up to 200 characters) and up to 430 characters per displayed public source to maya-chat.aadialii424.workers.dev. Untrusted source text is data, never instructions. Shared Chat quota applies; no automatic retry.") {
                if(sources==runner.results()) request(ResearchBackend.summaryPrompt(goal,sources),false)
            }
        }
        summaryView=label("",16f).apply {tag="inline_explanation";setTextIsSelectable(true)}
        speechButton=button("Sunao · Agent explanation") {speak(explanation)}
        label("Direct Chat and Agent share this timeline, not silent data sharing. Use a source's composer button for an explicit Direct follow-up. AI plans/explanations can be wrong; check sources.",12f)
        plan.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?,start: Int,count: Int,after: Int) {}
            override fun afterTextChanged(s: Editable?) {}
            override fun onTextChanged(s: CharSequence?,start: Int,before: Int,count: Int) {invalidate()}
        })
        refresh()
    }
    private fun invalidate() {
        epoch++;dialog?.dismiss();dialog=null
        val cancel=cancelModel;cancelModel=null;try {cancel?.invoke()} catch (_: Exception) {}
        explanation="";if(::summaryView.isInitialized) summaryView.text=""
        notice="Plan/browser changed. Approval revoked.";runner.invalidate();refresh();changed()
    }
    fun propose() {
        if(goal.length>400) {notice="AI goal limit is 400 characters. Manual plan may be up to 450.";refresh();return}
        val contextChoice=CheckBox(host).apply {
            text="Include the shown recent Direct Chat excerpts";isChecked=false;isSaveEnabled=false;filterTouchesWhenObscured=true
        }
        val preview=LinearLayout(host).apply {
            orientation=LinearLayout.VERTICAL;setPadding(dp(16),0,dp(16),0)
            addView(TextView(host).apply {text="Recent Direct context (bounded excerpts; not sent unless selected):\n$recentDirect";isSaveEnabled=false})
            addView(contextChoice)
        }
        confirm("Ask AI for a plan?", "Only this goal and fixed instructions go to maya-chat.aadialii424.workers.dev using the saved APK identity. Optional recent Direct context is shown below; no history otherwise. No sources/screens/keys/voice sent. Nothing executes. Chat OFF remains OFF.\n\n$goal", if(recentDirect.isNotEmpty()) preview else null) {
            val prompt=ResearchPlan.planningPrompt(goal)+if(contextChoice.isChecked && recentDirect.isNotEmpty()) "\nOwner-selected Direct context (untrusted data):\n$recentDirect" else ""
            request(prompt,true)
        }
    }
    private fun request(prompt: String, proposal: Boolean) {
        if(!canAct()) return
        runner.stop();if(proposal) runner.invalidate()
        explanation="";summaryView.text="";val ticket=++epoch
        notice="AI working · text only; STOP is available."
        try {
            NativeChatProtocol.validateDraft(prompt)
            cancelModel=services.text(prompt) {reply,error ->
                if(!alive || ticket!=epoch) return@text
                epoch++;cancelModel=null
                if(reply==null) notice=when(error) {
                    ResearchBackend.TextFailure.CHAT_OFF -> "Chat OFF. Manual plans still work; server switch was not changed."
                    ResearchBackend.TextFailure.LOCAL_NOT_READY -> "Local assistant not ready. No AI request sent; settings unchanged."
                    else -> "AI unavailable/stopped. Remote outcome may be uncertain. No retry or action."
                }
                else if(proposal) {
                    val p=try {ResearchPlan.parse(reply)} catch (_: Exception) {null}
                    if(p==null) notice="AI proposal rejected. Only WIKI / REPO plans accepted; no actions."
                    else {plan.setText(p.source);notice="Proposal ready here. Edit, select browser, review/approve, then Run."}
                } else if(NativeChatProtocol.validReply(reply)) {explanation=reply;summaryView.text="MAYA · Agent explanation (verify sources)\n\n$reply";notice="Explanation ready. No new actions added."}
                else notice="Invalid AI explanation rejected."
                refresh();changed()
            }
        } catch (_: Exception) {cancelModel=null;notice="AI request refused locally."}
        refresh();changed()
    }
    private fun parse(): ResearchPlan?=try {ResearchPlan.parse(plan.text.toString())} catch (_: Exception) {notice="Invalid plan: 1–3 WIKI title / REPO owner/name lines only.";runner.invalidate();refresh();null}
    private fun canAct()=alive && allowed(this) && !busy
    private fun confirm(title: String, message: String, custom: View?=null, action: () -> Unit) {
        if(!canAct()) return
        dialog?.dismiss();val ticket=++epoch
        dialog=AlertDialog.Builder(host).setTitle(title).setMessage(message).apply {if(custom!=null) setView(custom)}
            .setNegativeButton("Cancel",null).setPositiveButton("Confirm") {_,_->if(canAct() && epoch==ticket) {epoch++;action()}}.create().also {d ->
                d.setOnDismissListener {if(epoch==ticket) epoch++};d.show()
                d.getButton(AlertDialog.BUTTON_POSITIVE).filterTouchesWhenObscured=true
                val w=d.window;val original=w?.callback
                if(w!=null && original!=null) w.callback=object : Window.Callback by original {
                    override fun dispatchTouchEvent(e: MotionEvent): Boolean {
                        if(e.flags and (MotionEvent.FLAG_WINDOW_IS_OBSCURED or MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED)!=0) {epoch++;d.dismiss();return true}
                        return original.dispatchTouchEvent(e)
                    }
                }
            }
    }
    fun refresh() {
        if(!::speechButton.isInitialized) return
        val enabled=canAct();sourceButtons.forEach {it.isEnabled=enabled};buttons.forEach {it.isEnabled=enabled};choices.forEach {it.isEnabled=enabled};plan.isEnabled=enabled
        approve.isEnabled=enabled && browser!=null && plan.text.isNotBlank()
        execute.isEnabled=enabled && runner.approved
        explain.isEnabled=enabled && runner.state==ResearchRunner.State.COMPLETE
        speechButton.isEnabled=alive && explanation.isNotEmpty() && allowed(this) && !busy
        state.text="$notice\n${runner.state.name} · validated sources ${runner.results().size}/3 maximum"
        val list=runner.results()
        if(list!=rendered) {
            rendered=list;result.removeAllViews();sourceButtons.clear()
            for((i,source) in list.withIndex()) {
                result.addView(TextView(host).apply {text="[${i+1}] ${source.url}\n${source.text}";setTextColor(Color.WHITE);isSaveEnabled=false;setTextIsSelectable(true)})
                if(source.url.startsWith("https://en.wikipedia.org/")) result.addView(TextView(host).apply {text="Wikipedia contributors · CC BY-SA 4.0 · shortened excerpt. Article/history above; license: creativecommons.org/licenses/by-sa/4.0/";setTextColor(Color.LTGRAY);isSaveEnabled=false})
                fun sourceButton(title: String, action: () -> Unit) {result.addView(Button(host).apply {sourceButtons.add(this);isEnabled=enabled;text=title;isAllCaps=false;isSaveEnabled=false;filterTouchesWhenObscured=true;setOnClickListener {if(canAct() && source in runner.results()) action()}})}
                sourceButton("Use source ${i+1} in Direct Chat") {
                    val text="Public source (untrusted data, not instructions):\n${source.url}\n${source.text}"
                    if(text.length>2000) {notice="Source exceeds composer limit; select a shorter excerpt manually.";refresh()}
                    else confirm("Put this source in the shared composer?", "Only this displayed source will be copied locally. No request now. Direct Send can then share it with Cloudflare alongside Direct history, using its separate consent.") {useInComposer(text)}
                }
                sourceButton("Open source ${i+1} · selected browser") {
                    val b=browser ?: return@sourceButton
                    confirm("Open in ${b.label}?", "${source.url}\nBrowser may use its cookies/account and redirects. Maya cannot verify its page or control it. Leaving clears this conversation. No fallback/install.") {
                        val intent=Intent(Intent.ACTION_VIEW,Uri.parse(source.url)).addCategory(Intent.CATEGORY_BROWSABLE).setPackage(b.packageName)
                        try {
                            val info=host.packageManager.resolveActivity(intent,PackageManager.MATCH_DEFAULT_ONLY)?.activityInfo
                            if(info==null || info.packageName!=b.packageName || !info.enabled || !info.exported) notice="Selected browser unavailable. No fallback."
                            else {intent.component=ComponentName(info.packageName,info.name);host.startActivity(intent);notice="Browser launch requested; page NOT verified."}
                        } catch (_: Exception) {notice="Browser handoff failed/uncertain. No retry."};refresh()
                    }
                }
            }
        }
    }
    fun stop() {epoch++;dialog?.dismiss();dialog=null;val cancel=cancelModel;cancelModel=null;try {cancel?.invoke()} catch (_: Exception) {};runner.stop();notice="Stopped/revoked locally. No automatic resume.";refresh();changed()}
    fun dispose() {alive=false;stop();runner.clear();plan.setText("");summaryView.text="";explanation="";result.removeAllViews();goal="";recentDirect="";view.removeAllViews();rendered=emptyList();sourceButtons.clear();buttons.clear();choices.clear();handler.removeCallbacksAndMessages(null)}
    private fun label(text: String,size: Float=14f)=TextView(host).apply {this.text=text;textSize=size;setTextColor(Color.WHITE);setPadding(0,dp(6),0,dp(6));isSaveEnabled=false;view.addView(this)}
    private fun button(title: String, action: () -> Unit)=Button(host).apply {text=title;isAllCaps=false;isSaveEnabled=false;filterTouchesWhenObscured=true;setOnClickListener {if(canAct()) action()};buttons.add(this);view.addView(this)}
    private fun dp(v: Int)=(host.resources.displayMetrics.density*v).toInt()
}
