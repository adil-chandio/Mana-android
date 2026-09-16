package com.maya.ai.agent

import android.app.AlertDialog
import android.content.Intent
import android.os.*
import android.provider.Settings
import android.text.*
import android.view.*
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.maya.ai.chat.MayaTheme
import java.util.UUID

/** Native WhatsApp type task. The service receives only an explicitly approved immutable plan. Never SEND. */
class InlineWhatsAppType(private val host: AppCompatActivity,override val goal: String,
    private val services: ResearchServices,private val allowed: (WorkspaceTask)->Boolean,private val changed: ()->Unit): WorkspaceTask {
    override val view=LinearLayout(host).apply {orientation=LinearLayout.VERTICAL;tag="whatsapp_type_task";isSaveEnabled=false;setPadding(12,12,12,12);background=MayaTheme.shape(host)}
    private val handler=Handler(Looper.getMainLooper())
    private var alive=true;private var epoch=0L
    private var dialog: AlertDialog?=null
    private var cancelAi: (()->Unit)?=null
    private var aiReview: AiTaskReview?=null
    private var grant: WhatsAppTypeGrant?=null
    private var approvedPlan: WhatsAppTypePlan?=null
    private var runId: String?=null
    private var handoff=false
    private var detached=false
    private val buttons=mutableListOf<Button>()
    private val status=label("WhatsApp open/type once only. Maya never presses SEND — you review the chat and send it yourself.")
    private val number=EditText(host).apply {hint="923001234567 · digits only, country code + number";isSaveEnabled=false;inputType=InputType.TYPE_CLASS_PHONE;MayaTheme.editor(this,true);filters=arrayOf(InputFilter.LengthFilter(16));view.addView(this)}
    private val editor=EditText(host).apply {tag="whatsapp_message";isSaveEnabled=false;minLines=2;maxLines=5;MayaTheme.editor(this,true);filters=arrayOf(InputFilter.LengthFilter(810));view.addView(this)}
    private lateinit var approve: Button
    private lateinit var run: Button
    override val reviewRevision get()=epoch
    override val busy get()=cancelAi!=null || runId?.let {WhatsAppTypeService.instance?.owned(it)}==true
    override val executing get()=runId?.let {WhatsAppTypeService.instance?.owned(it)}==true
    override val approved get()=grant!=null
    init {
        label("WhatsApp reviewed type · native pilot")
        label(goal)
        val supplied=runCatching {WhatsAppTypePlan.parse(goal)}.getOrNull()
        if(supplied!=null) {number.setText(supplied.digits);editor.setText(supplied.payload)}
        else label("Enter the recipient number and the message yourself, or ask AI to draft the message text only. The number is never sent to AI.")
        button("Propose message text · AI review") {propose()}
        button("Accessibility setup · no auto-run") {
            confirm("Open Android accessibility settings?","Save any unsaved work first: leaving Maya clears its temporary workspace. Enable only Maya reviewed WhatsApp type if you want this feature. The old AutoSend service stays disabled. Returning does not start any task.") {
                host.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            }
        }
        button("STOP notification settings") {
            confirm("Open notification settings?","The persistent STOP notification must be enabled before running. Leaving Maya clears unsaved temporary workspace; no task will auto-start on return.") {
                host.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,host.packageName))
            }
        }
        approve=button("Review WhatsApp message") {
            val plan=parse() ?: return@button
            if(WhatsAppTypeService.instance==null || !WhatsAppTypeService.notificationsReady(host)) {status.text="Enable the reviewed WhatsApp service and its STOP notifications first. Nothing started.";return@button}
            confirm("Type into WhatsApp ${plan.digits}?","Recipient: ${plan.url}. One OPEN, one TYPE, one run, review expires in 60 seconds. Run is separate. WhatsApp will open outside Maya and this approved task may continue there for up to60 seconds. Save any work first: leaving clears Maya temporary chat and other unsaved tasks as usual. Only this approved type plan stays with the service until it ends. Other apps, screen lock, touch, STOP or uncertain verification stop it. The exact text below is typed once into the single message field; an existing draft is never overwritten. Maya NEVER presses SEND — you check the chat and send it yourself. No clicks, other typing, reads, deletes, installs or finance actions.\n\n${plan.payload}") {
                if(parse()?.digest==plan.digest) {grant=WhatsAppTypeGrant.approved(plan,SystemClock.uptimeMillis());approvedPlan=plan;status.text="Approved once · tap Run. Nothing has opened yet.";refresh();val ticket=epoch;handler.postDelayed({if(alive && epoch==ticket && grant!=null) {grant?.revoke();grant=null;approvedPlan=null;status.text="Review expired. Review again before Run.";refresh()}},60000)}
            }
        }
        run=button("Run approved WhatsApp type") {
            val plan=approvedPlan ?: return@button;val permission=grant ?: return@button
            if(parse()?.digest!=plan.digest) {invalidate();return@button}
            grant=null;approvedPlan=null
            val service=WhatsAppTypeService.instance
            if(service==null) {permission.revoke();status.text="WhatsApp service unavailable. Review again after setup.";refresh();return@button}
            val id=UUID.randomUUID().toString().replace("-","");runId=id;handoff=true
            if(!service.start(id,plan,permission)) {handoff=false;runId=null;status.text="Run could not start. No automatic retry."} else status.text="Task handed to WhatsApp. Check the chat, then press SEND yourself. STOP is in the notification."
            refresh();changed()
        }
        button("Show latest WhatsApp report") {status.text=WhatsAppTypeService.lastReport}
        val watcher=object: TextWatcher {
            override fun beforeTextChanged(s: CharSequence?,start: Int,count: Int,after: Int) {}
            override fun onTextChanged(s: CharSequence?,start: Int,before: Int,count: Int) {invalidate()}
            override fun afterTextChanged(s: Editable?) {}
        }
        number.addTextChangedListener(watcher);editor.addTextChangedListener(watcher)
        refresh()
    }
    private fun compose(): String? {
        val digits=number.text.toString().trim()
        if(digits.length !in 7..15 || digits.any {it !in '0'..'9'}) {status.text="Recipient needs 7–15 digits (country code + number), no +, spaces or dashes.";return null}
        val rows=editor.text.toString().split("\n")
        if(rows.size>5 || rows.any {it.isEmpty() || it.length>200}) {status.text="Message needs 1–5 non-empty lines, up to200 characters each. Nothing typed.";return null}
        if(rows.sumOf {it.length}>800) {status.text="Message is over800 characters. Shorten it; nothing typed.";return null}
        return "OPEN https://wa.me/$digits\n"+rows.joinToString("\n") {"TYPE $it"}
    }
    private fun parse(): WhatsAppTypePlan?=runCatching {WhatsAppTypePlan.parse(compose() ?: return null)}.getOrElse {status.text="Invalid WhatsApp plan. 7–15 digits, then 1–5 message lines up to200 characters each. SEND is never automated.";null}
    private fun label(value: String)=TextView(host).apply {text=value;MayaTheme.label(this,14f);setPadding(0,6,0,6);view.addView(this)}
    private fun button(title: String,action: ()->Unit)=Button(host).apply {MayaTheme.button(this,title);setOnClickListener {if(alive && !busy && dialog?.isShowing!=true && allowed(this@InlineWhatsAppType)) action()};view.addView(this);buttons.add(this)}
    private fun confirm(title: String,message: String,action: ()->Unit) {
        if(dialog?.isShowing==true || !alive || busy) return
        val token=++epoch
        dialog=AlertDialog.Builder(host).setTitle(title).setMessage(message).setNegativeButton("Cancel",null)
            .setPositiveButton("Confirm") {_,_->if(alive && epoch==token && allowed(this)) {epoch++;action()}}.create().also {d->
                d.setOnDismissListener {if(epoch==token) {epoch++;aiReview?.revoke();aiReview=null}}
                d.show();MayaTheme.dialog(d);d.getButton(AlertDialog.BUTTON_POSITIVE).filterTouchesWhenObscured=true
                val window=d.window;val callback=window?.callback
                if(window!=null && callback!=null) window.callback=object: Window.Callback by callback {
                    override fun dispatchTouchEvent(event: android.view.MotionEvent): Boolean {
                        if(event.flags and (android.view.MotionEvent.FLAG_WINDOW_IS_OBSCURED or android.view.MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED)!=0) {invalidate();return true}
                        return callback.dispatchTouchEvent(event)
                    }
                }
            }
    }
    private fun propose() {
        if(goal.length>400) {status.text="AI goal limit400. Type the message manually instead.";return}
        val prompt=WhatsAppTypePlan.prompt(goal);val ticket=++epoch
        status.text="Checking AI connection locally…"
        val cancel=services.review(AiTaskReview.Kind.WHATSAPP_MESSAGE,listOf(prompt)) {review,error ->
            if(!alive || epoch!=ticket) {review?.revoke();return@review};epoch++;cancelAi=null
            if(review==null) {status.text="AI unavailable. Manual message editing still works.";refresh();return@review}
            aiReview=review
            confirm("Ask AI to draft the message?","${review.description}\nThe recipient number is NOT sent. This drafts text only; WhatsApp typing needs separate review.\n\n$prompt") {
                if(!review.approve(prompt,SystemClock.elapsedRealtime())) {status.text="AI review expired.";return@confirm}
                aiReview=null;val token=++epoch
                cancelAi=services.text(review,prompt) {reply,_ ->
                    if(!alive || epoch!=token) return@text
                    epoch++;cancelAi=null
                    val rows=(reply ?: "").lines().map {it.trim()}.filter {it.isNotEmpty()}
                    if(rows.size in 1..5 && rows.all {it.length in 1..200 && com.maya.ai.chat.NativeChatProtocol.validReply(it)} && rows.sumOf {it.length}<=800) {
                        editor.setText(rows.joinToString("\n"));status.text="Draft ready. Check the number and text, then Review before any WhatsApp action."
                    }
                    else status.text="No valid message draft returned. Nothing typed."
                    refresh();changed()
                }
                refresh();changed()
            }
            refresh();changed()
        }
        if(epoch==ticket) cancelAi=cancel else cancel()
        refresh();changed()
    }
    private fun invalidate() {epoch++;dialog?.dismiss();dialog=null;grant?.revoke();grant=null;approvedPlan=null;aiReview?.revoke();aiReview=null;cancelAi?.invoke();cancelAi=null;status.text="Number/message changed. Approval revoked; no automatic run.";if(::approve.isInitialized) refresh();changed()}
    override fun dismissReview() {invalidate()}
    override fun refresh() {val enabled=alive && !busy && allowed(this);buttons.forEach {it.isEnabled=enabled};number.isEnabled=enabled;editor.isEnabled=enabled;if(::run.isInitialized) run.isEnabled=enabled && grant!=null}
    override fun stop() {handoff=false;detached=false;runId?.let {WhatsAppTypeService.instance?.stop(it)};runId=null;invalidate()}
    override fun onHostPause() {if(handoff && executing) detached=true else stop()}
    override fun dispose() {
        if(!detached) stop() else {grant?.revoke();aiReview?.revoke();cancelAi?.invoke()}
        alive=false;handler.removeCallbacksAndMessages(null);view.removeAllViews()
    }
}
