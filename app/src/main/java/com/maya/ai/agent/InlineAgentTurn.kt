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
import com.maya.ai.chat.MayaTheme

/** One bounded tool turn in the shared conversation, not a second chat/goal screen.
 * Services must deliver callbacks asynchronously on the UI thread. No incoming intents or raw action bridge. */
class InlineAgentTurn(private val host: AppCompatActivity, goal: String, recentDirect: String,
    private val services: ResearchServices, private val allowed: (InlineAgentTurn) -> Boolean, private val changed: () -> Unit,
    private val useInComposer: (String) -> Unit, private val speak: (String) -> Unit) : WorkspaceTask {
    override var goal=goal; private set
    private var recentDirect=recentDirect
    override val view=LinearLayout(host).apply {
        orientation=LinearLayout.VERTICAL;isSaveEnabled=false
        importantForAutofill=View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
        setPadding(dp(12),dp(10),dp(12),dp(10))
        background=MayaTheme.shape(host)
        layoutParams=LinearLayout.LayoutParams(-1,-2).apply {bottomMargin=dp(14)}
    }
    private val handler=Handler(Looper.getMainLooper())
    private var alive=true
    private var epoch=0L
    override val reviewRevision get()=epoch
    override fun dismissReview() {if(!busy) {aiReview?.revoke();aiReview=null;epoch++;dialog?.dismiss();dialog=null}}
    private var dialog: AlertDialog?=null
    private var cancelModel: (() -> Unit)?=null
    private var aiReview: AiTaskReview?=null
    private var reviewingAi=false
    private var browser: ResearchBrowser?=null
    private var notice="Plan not approved. No source request sent."
    private val buttons=mutableListOf<Button>()
    private lateinit var suggest: Button
    private lateinit var editPlan: Button
    private lateinit var planHeading: TextView
    private lateinit var browserHeading: TextView
    private lateinit var browserGroup: RadioGroup
    private var editingCompleted=false
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
    override val busy get()=runner.busy || cancelModel!=null
    override val executing get()=runner.busy
    override val approved get()=runner.approved
    init {
        require(goal.length in 1..450 && NativeChatProtocol.validReply(goal))
        label("Research",13f).setTextColor(MayaTheme.copper);label(goal,18f)
        editPlan=button("Edit plan") {editingCompleted=!editingCompleted;refresh()}.apply {tag="edit_research_plan"}
        planHeading=label("Plan · up to 3 public sources",12f)
        plan=EditText(host).apply {
            tag="inline_plan";isSaveEnabled=false;minLines=2;maxLines=6;setTextColor(MayaTheme.text);setHintTextColor(MayaTheme.muted)
            hint="WIKI Article title\nREPO owner/name"
            MayaTheme.editor(this)
            inputType=InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            imeOptions=android.view.inputmethod.EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING
            importantForAutofill=View.IMPORTANT_FOR_AUTOFILL_NO;filters=arrayOf(InputFilter.LengthFilter(450))
            view.addView(this)
        }
        val manual=try {ResearchPlan.parse(goal)} catch (_: Exception) {null}
        if(manual!=null) {plan.setText(manual.source);notice="Manual plan received locally. Review before Run; no AI request."}
        suggest=button("Generate / revise AI plan") {propose()}
        browserHeading=label("Choose a browser for optional source links",12f)
        val group=RadioGroup(host).apply {isSaveEnabled=false;orientation=RadioGroup.HORIZONTAL}
        for(b in ResearchBrowser.values()) {
            val choice=RadioButton(host).apply {
                id=View.generateViewId();text=b.label;isSaveEnabled=false;filterTouchesWhenObscured=true;MayaTheme.toggle(this)
                setOnCheckedChangeListener {_,checked -> if(checked) {browser=b;this@InlineAgentTurn.invalidate()}}
            };choices.add(choice);group.addView(choice,RadioGroup.LayoutParams(0,-2,1f))
        }
        browserGroup=group;view.addView(group)
        approve=button("Review & approve plan") {
            val p=parse() ?: return@button;val b=browser ?: return@button
            confirm("Approve these read-only steps?", "One run, ${p.size} sources, expiry 60 seconds. Wikipedia titles go to en.wikipedia.org; repo names to api.github.com. No token/cookie. 45-second run limit, no retry. Touch/intervention while reading stops the run; no automatic resume. AI explanation needs separate consent. Browser: ${b.label}.\n\n${p.source}") {
                if(p.source==plan.text.toString() && browser==b) {explanation="";summaryView.text="";notice="Approved once. Press Run.";runner.approve(p,b);refresh();changed()}
            }
        }
        execute=button("Run approved plan") {val p=parse();val b=browser;if(p!=null && b!=null) {notice="Executing approved read-only steps…";runner.start(p,b);refresh();changed()}}
        state=label("",14f).apply {MayaTheme.status(this);tag="inline_progress";accessibilityLiveRegion=View.ACCESSIBILITY_LIVE_REGION_POLITE}
        result=LinearLayout(host).apply {orientation=LinearLayout.VERTICAL;isSaveEnabled=false;tag="inline_sources";view.addView(this)}
        explain=button("Explain sources · AI consent") {
            val sources=runner.results();val prompt=ResearchBackend.summaryPrompt(goal,sources)
            reviewAi(AiTaskReview.Kind.SOURCE_SUMMARY,listOf(prompt)) {review ->
                confirm("Send these excerpts to AI?",review.description+"\n\nOnly the following native prompt/source excerpts will be sent. Provider processing/limits apply; no other history or actions.\n\n"+prompt,
                    cancelled={review.revoke();if(aiReview===review) aiReview=null;notice="AI review cancelled. No request sent.";refresh();changed()}) {
                    if(sources==runner.results() && review.approve(prompt,SystemClock.elapsedRealtime())) request(review,prompt,false)
                }
            }
        }
        summaryView=label("",16f).apply {tag="inline_explanation";setTextIsSelectable(true)}
        speechButton=button("Sunao · Agent explanation") {speak(explanation)}
        MayaTheme.details(view,"Research details ▾","Public research only: 1–3 exact WIKI articles or REPO metadata reads. No phone actions/private screens. Direct Chat and Agent share this timeline, not silent data sharing. Sources need explicit consent to enter Direct Chat or an AI explanation. AI can be wrong; check the sources.")
        plan.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?,start: Int,count: Int,after: Int) {}
            override fun afterTextChanged(s: Editable?) {}
            override fun onTextChanged(s: CharSequence?,start: Int,before: Int,count: Int) {invalidate()}
        })
        refresh()
    }
    private fun invalidate() {
        aiReview?.revoke();aiReview=null;reviewingAi=false
        epoch++;dialog?.dismiss();dialog=null
        val cancel=cancelModel;cancelModel=null;try {cancel?.invoke()} catch (_: Exception) {}
        explanation="";if(::summaryView.isInitialized) summaryView.text=""
        notice="Plan/browser changed. Approval revoked.";runner.invalidate();refresh();changed()
    }
    private fun reviewAi(kind: AiTaskReview.Kind,prompts: List<String>,show: (AiTaskReview)->Unit) {
        if(!canAct()) return
        aiReview?.revoke();aiReview=null;runner.stop()
        val ticket=++epoch;reviewingAi=true;notice="Checking selected AI connection locally; nothing sent."
        try {
            val cancel=services.review(kind,prompts) {review,error ->
                if(!alive || epoch!=ticket) {review?.revoke();return@review}
                epoch++;cancelModel=null;reviewingAi=false
                if(review!=null && allowed(this)) {aiReview=review;notice="AI connection resolved. Review before sending; nothing sent yet.";show(review)}
                else {review?.revoke();notice=if(error==ResearchBackend.TextFailure.CHAT_OFF) "Cloudflare route unavailable. Select the saved AI account in AI connection, or enable the server independently. Manual research still works." else "AI connection unavailable or workspace changed. No prompt was sent."}
                refresh();changed()
            }
            if(epoch==ticket) cancelModel=cancel else cancel()
        } catch(_: Exception) {reviewingAi=false;notice="AI review could not be prepared. Nothing sent."}
        refresh();changed()
    }
    fun propose() {
        if(goal.length>400) {notice="AI goal limit is 400 characters. Manual plan may be up to 450.";refresh();return}
        val base=ResearchPlan.planningPrompt(goal)
        val withContext=base+"\nOwner-selected Direct context (untrusted data):\n$recentDirect"
        val options=if(recentDirect.isEmpty()) listOf(base) else listOf(base,withContext)
        reviewAi(AiTaskReview.Kind.RESEARCH_PLAN,options) {review ->
            val contextChoice=CheckBox(host).apply {text="Include the shown recent Chat excerpts";isChecked=false;isSaveEnabled=false;filterTouchesWhenObscured=true}
            val preview=LinearLayout(host).apply {
                orientation=LinearLayout.VERTICAL;setPadding(dp(16),0,dp(16),0)
                addView(TextView(host).apply {text="Optional recent Chat excerpts (not sent unless selected):\n$recentDirect";isSaveEnabled=false})
                addView(contextChoice)
            }
            confirm("Ask AI for a plan?",review.description+"\n\nProposed text only: no sources fetched or phone actions. Only the goal/fixed instructions below and optional shown context are sent; credentials never enter the prompt.\n\n$base",
                if(recentDirect.isNotEmpty()) FrameLayout(host).apply {addView(ScrollView(host).apply {isSaveEnabled=false;addView(preview)},FrameLayout.LayoutParams(-1,dp(180)))} else null,
                cancelled={review.revoke();if(aiReview===review) aiReview=null;notice="AI review cancelled. No request sent.";refresh();changed()}) {
                val prompt=if(contextChoice.isChecked && recentDirect.isNotEmpty()) withContext else base
                if(review.approve(prompt,SystemClock.elapsedRealtime())) request(review,prompt,true)
                else {notice="AI review expired/changed. Generate a new review; nothing sent.";refresh();changed()}
            }
        }
    }
    private fun request(review: AiTaskReview,prompt: String, proposal: Boolean) {
        if(!canAct()) {review.revoke();return}
        aiReview=null
        runner.stop();if(proposal) runner.invalidate()
        explanation="";summaryView.text="";val ticket=++epoch
        notice="Reviewed AI: ${review.provider} / ${review.model} · 256 tokens · text only; STOP available."
        try {
            NativeChatProtocol.validateDraft(prompt)
            cancelModel=services.text(review,prompt) {reply,error ->
                if(!alive || ticket!=epoch) return@text
                epoch++;cancelModel=null
                if(reply==null) notice=when(error) {
                    ResearchBackend.TextFailure.CHAT_OFF -> "Chat OFF. Manual plans still work; server switch was not changed."
                    ResearchBackend.TextFailure.LOCAL_NOT_READY -> "Local assistant not ready. No AI request sent; settings unchanged."
                    ResearchBackend.TextFailure.CONNECTION_CHANGED -> "AI connection changed after review. No fallback; review again."
                    ResearchBackend.TextFailure.REVIEW_REQUIRED -> "AI review expired or was already used. Nothing sent."
                    ResearchBackend.TextFailure.ACCOUNT_LIMIT -> "Selected AI account denied or rate-limited this request. No retry/fallback."
                    else -> "AI unavailable/stopped. Remote outcome may be uncertain. No retry or action."
                }
                else if(proposal) {
                    val p=try {ResearchPlan.parse(reply)} catch (_: Exception) {null}
                    if(p==null) notice="AI proposal rejected. Only WIKI / REPO plans accepted; no actions."
                    else {plan.setText(p.source);notice="Proposal ready from ${review.provider}. Edit, select browser, review/approve, then Run."}
                } else if(NativeChatProtocol.validReply(reply)) {explanation=reply;summaryView.text="MAYA · Agent explanation (verify sources)\n\n$reply";notice="Explanation ready from ${review.provider}. No new actions added."}
                else notice="Invalid AI explanation rejected."
                refresh();changed()
            }
        } catch (_: Exception) {cancelModel=null;notice="AI request refused locally."}
        refresh();changed()
    }
    private fun parse(): ResearchPlan?=try {ResearchPlan.parse(plan.text.toString())} catch (_: Exception) {notice="Invalid plan: 1–3 WIKI title / REPO owner/name lines only.";runner.invalidate();refresh();null}
    private fun canAct()=alive && allowed(this) && !busy
    private fun confirm(title: String, message: String, custom: View?=null, cancelled: ()->Unit={}, action: () -> Unit) {
        if(!canAct()) return
        dialog?.dismiss();val ticket=++epoch
        dialog=AlertDialog.Builder(host).setTitle(title).setMessage(message).apply {if(custom!=null) setView(custom)}
            .setNegativeButton("Cancel",null).setPositiveButton("Confirm") {_,_->if(canAct() && epoch==ticket) {epoch++;action()}}.create().also {d ->
                d.setOnDismissListener {if(epoch==ticket) {epoch++;cancelled()}};d.show();MayaTheme.dialog(d)
                d.getButton(AlertDialog.BUTTON_POSITIVE).filterTouchesWhenObscured=true
                val w=d.window;val original=w?.callback
                if(w!=null && original!=null) w.callback=object : Window.Callback by original {
                    override fun dispatchTouchEvent(e: MotionEvent): Boolean {
                        if(e.flags and (MotionEvent.FLAG_WINDOW_IS_OBSCURED or MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED)!=0) {aiReview?.revoke();aiReview=null;epoch++;d.dismiss();return true}
                        return original.dispatchTouchEvent(e)
                    }
                }
            }
    }
    override fun refresh() {
        if(!::speechButton.isInitialized) return
        val completed=runner.state==ResearchRunner.State.COMPLETE
        val showPlan=!completed || editingCompleted
        editPlan.visibility=if(completed) View.VISIBLE else View.GONE
        listOf(plan,planHeading,browserHeading,browserGroup).forEach {it.visibility=if(showPlan && !runner.busy) View.VISIBLE else View.GONE}
        suggest.visibility=if(showPlan && !busy && !runner.approved) View.VISIBLE else View.GONE
        approve.visibility=if(showPlan && !busy && !runner.approved) View.VISIBLE else View.GONE
        execute.visibility=if(runner.approved) View.VISIBLE else View.GONE
        val enabled=canAct();sourceButtons.forEach {it.isEnabled=enabled};buttons.forEach {it.isEnabled=enabled};choices.forEach {it.isEnabled=enabled};plan.isEnabled=enabled
        approve.isEnabled=enabled && browser!=null && plan.text.isNotBlank()
        execute.isEnabled=enabled && runner.approved
        explain.isEnabled=enabled && runner.state==ResearchRunner.State.COMPLETE
        explain.visibility=if(runner.state==ResearchRunner.State.COMPLETE) View.VISIBLE else View.GONE
        summaryView.visibility=if(explanation.isEmpty()) View.GONE else View.VISIBLE
        speechButton.visibility=summaryView.visibility
        speechButton.isEnabled=alive && com.maya.ai.chat.NativeFishPolicy.validText(explanation) && allowed(this) && !busy
        val stage=when(runner.state) {
            ResearchRunner.State.IDLE,ResearchRunner.State.CHANGED -> "Review required"
            ResearchRunner.State.APPROVED -> "Approved · ready to run"
            ResearchRunner.State.RUNNING -> "Reading sources"
            ResearchRunner.State.COMPLETE -> "Complete"
            ResearchRunner.State.STOPPED -> "Stopped"
            ResearchRunner.State.EXPIRED -> "Expired"
            ResearchRunner.State.FAILED -> "Source unavailable"
        }
        state.text=if(reviewingAi) "Checking AI connection locally…" else if(busy && !runner.busy) "Waiting for reviewed AI response…" else "$stage · ${runner.results().size} sources\n$notice"
        state.setTextColor(when {
            notice.contains("uncertain",true) || notice.contains("OFF") -> MayaTheme.attention
            notice.contains("failed",true) || notice.contains("unavailable",true) || notice.contains("rejected",true) -> MayaTheme.danger
            runner.state==ResearchRunner.State.COMPLETE -> MayaTheme.success
            runner.state==ResearchRunner.State.EXPIRED || runner.state==ResearchRunner.State.STOPPED -> MayaTheme.attention
            else -> MayaTheme.muted
        })
        val list=runner.results()
        if(list!=rendered) {
            rendered=list;result.removeAllViews();sourceButtons.clear()
            for((i,source) in list.withIndex()) {
                val sourceCard=LinearLayout(host).apply {orientation=LinearLayout.VERTICAL;background=MayaTheme.shape(host,MayaTheme.background,12);setPadding(dp(12),dp(8),dp(12),dp(8));layoutParams=LinearLayout.LayoutParams(-1,-2).apply {bottomMargin=dp(8)}}
                result.addView(sourceCard)
                sourceCard.addView(TextView(host).apply {text="[${i+1}] ${source.url}";MayaTheme.label(this,12f,true);setTextIsSelectable(true)})
                sourceCard.addView(TextView(host).apply {text=source.text;MayaTheme.label(this,14f);minHeight=dp(48);maxLines=4;ellipsize=android.text.TextUtils.TruncateAt.END;setTextIsSelectable(true);setOnClickListener {maxLines=if(maxLines==4) Int.MAX_VALUE else 4};tooltipText="Tap to expand source excerpt"})
                if(source.url.startsWith("https://en.wikipedia.org/")) sourceCard.addView(TextView(host).apply {text="Wikipedia contributors · CC BY-SA 4.0 · shortened excerpt. Article/history above; license: creativecommons.org/licenses/by-sa/4.0/";MayaTheme.label(this,11f,true);isSaveEnabled=false})
                val actions=LinearLayout(host).apply {orientation=LinearLayout.VERTICAL;visibility=View.GONE}
                sourceCard.addView(Button(host).apply {MayaTheme.button(this,"Source ${i+1} actions ▾");setOnClickListener {actions.visibility=if(actions.visibility==View.GONE) View.VISIBLE else View.GONE}})
                sourceCard.addView(actions)
                fun sourceButton(title: String, action: () -> Unit) {actions.addView(Button(host).apply {MayaTheme.button(this,title);sourceButtons.add(this);isEnabled=enabled;setOnClickListener {if(canAct() && source in runner.results()) action()}},LinearLayout.LayoutParams(-1,-2))}
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
    override fun stop() {val remotePending=cancelModel!=null && !reviewingAi;aiReview?.revoke();aiReview=null;reviewingAi=false;epoch++;dialog?.dismiss();dialog=null;val cancel=cancelModel;cancelModel=null;try {cancel?.invoke()} catch (_: Exception) {};runner.stop();notice="Stopped/revoked locally. No automatic resume."+if(remotePending) " Remote AI work/usage may continue; no refund guaranteed." else "";refresh();changed()}
    override fun dispose() {alive=false;stop();runner.clear();plan.setText("");summaryView.text="";explanation="";result.removeAllViews();goal="";recentDirect="";view.removeAllViews();rendered=emptyList();sourceButtons.clear();buttons.clear();choices.clear();handler.removeCallbacksAndMessages(null)}
    private fun label(text: String,size: Float=14f)=TextView(host).apply {this.text=text;MayaTheme.label(this,size,size<=13f);setPadding(0,dp(6),0,dp(6));view.addView(this)}
    private fun button(title: String, action: () -> Unit)=Button(host).apply {MayaTheme.button(this,title,title=="Review & approve plan" || title=="Run approved plan");setOnClickListener {if(canAct()) action()};buttons.add(this);view.addView(this)}
    private fun dp(v: Int)=(host.resources.displayMetrics.density*v).toInt()
}
