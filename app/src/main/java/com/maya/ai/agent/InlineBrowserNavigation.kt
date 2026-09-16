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

/** Native selected-browser task. The service receives only an explicitly approved immutable plan. */
class InlineBrowserNavigation(private val host: AppCompatActivity,override val goal: String,
    private val services: ResearchServices,private val allowed: (WorkspaceTask)->Boolean,private val changed: ()->Unit): WorkspaceTask {
    override val view=LinearLayout(host).apply {orientation=LinearLayout.VERTICAL;tag="browser_navigation_task";isSaveEnabled=false;setPadding(12,12,12,12);background=MayaTheme.shape(host)}
    private val handler=Handler(Looper.getMainLooper())
    private var alive=true;private var epoch=0L
    private var dialog: AlertDialog?=null
    private var cancelAi: (()->Unit)?=null
    private var aiReview: AiTaskReview?=null
    private var grant: BrowserNavigationGrant?=null
    private var approvedPlan: BrowserNavigationPlan?=null
    private var runId: String?=null
    private var handoff=false
    private var detached=false
    private val buttons=mutableListOf<Button>()
    private val status=label("Open/scroll public pages only. No tap, type, send, delete, install or payment control.")
    private val browser=Spinner(host).apply {adapter=ArrayAdapter(host,android.R.layout.simple_spinner_dropdown_item,ResearchBrowser.values().map {it.label});isSaveEnabled=false;view.addView(this)}
    private val editor=EditText(host).apply {tag="navigation_plan";isSaveEnabled=false;minLines=3;maxLines=6;MayaTheme.editor(this,true);filters=arrayOf(InputFilter.LengthFilter(1200));view.addView(this)}
    private lateinit var approve: Button
    private lateinit var run: Button
    override val reviewRevision get()=epoch
    override val busy get()=cancelAi!=null || runId?.let {BrowserNavigationService.instance?.owned(it)}==true
    override val executing get()=runId?.let {BrowserNavigationService.instance?.owned(it)}==true
    override val approved get()=grant!=null
    init {
        label("Selected-app browser navigation · native pilot")
        label(goal)
        if(!goal.startsWith("OPEN ")) label("The editable plan below is a local example, not an AI solution. Edit it or explicitly ask for a proposal before reviewing a run.")
        editor.setText(if(goal.startsWith("OPEN ")) goal else "OPEN https://en.wikipedia.org/wiki/Android\nSCROLL DOWN")
        button("Propose navigation plan · AI review") {propose()}
        button("Accessibility setup · no auto-run") {
            confirm("Open Android accessibility settings?","Save any unsaved work first: leaving Maya clears its temporary workspace. Enable only Maya reviewed browser navigation if you want this feature. The old AutoSend service stays disabled. Returning does not start any task.") {
                host.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            }
        }
        button("STOP notification settings") {
            confirm("Open notification settings?","The persistent STOP notification must be enabled before running. Leaving Maya clears unsaved temporary workspace; no task will auto-start on return.") {
                host.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,host.packageName))
            }
        }
        approve=button("Review browser plan") {
            val plan=parse() ?: return@button
            if(BrowserNavigationService.instance==null || !BrowserNavigationService.notificationsReady(host)) {status.text="Enable the reviewed navigation service and its STOP notifications first. Nothing started.";return@button}
            confirm("Approve ${plan.browser.label} navigation?","Selected app: ${plan.browser.packageName}. ${plan.steps} OPEN/SCROLL steps; one run, review expires in 60 seconds. Run is separate. The browser will open outside Maya and this approved task may continue there for up to60 seconds. Save any work first: leaving clears Maya temporary chat and other unsaved tasks as usual. Only this approved navigation plan stays with the service until it ends. Other apps, screen lock, touch, STOP or uncertain verification stop it. Only address-bar routing metadata/password flags/scrollability are checked locally; no page text or screenshots go to AI. OPEN verification confirms selected browser/origin, not page correctness. No clicks, typing, sends, downloads, installs or finance actions.\n\n${plan.source}") {
                if(parse()?.digest==plan.digest) {grant=BrowserNavigationGrant.approved(plan,SystemClock.uptimeMillis());approvedPlan=plan;status.text="Approved once · tap Run. Nothing has opened yet.";refresh();val ticket=epoch;handler.postDelayed({if(alive && epoch==ticket && grant!=null) {grant?.revoke();grant=null;approvedPlan=null;status.text="Review expired. Review again before Run.";refresh()}},60000)}
            }
        }
        run=button("Run approved browser plan") {
            val plan=approvedPlan ?: return@button;val permission=grant ?: return@button
            if(parse()?.digest!=plan.digest) {invalidate();return@button}
            grant=null;approvedPlan=null
            val service=BrowserNavigationService.instance
            if(service==null) {permission.revoke();status.text="Navigation service unavailable. Review again after setup.";refresh();return@button}
            val id=UUID.randomUUID().toString().replace("-","");runId=id;handoff=true
            if(!service.start(id,plan,permission)) {handoff=false;runId=null;status.text="Run could not start. No automatic retry."} else status.text="Task handed to the selected browser. Use the persistent STOP notification."
            refresh();changed()
        }
        button("Show latest navigation report") {status.text=BrowserNavigationService.lastReport}
        val watcher=object: TextWatcher {
            override fun beforeTextChanged(s: CharSequence?,start: Int,count: Int,after: Int) {}
            override fun onTextChanged(s: CharSequence?,start: Int,before: Int,count: Int) {invalidate()}
            override fun afterTextChanged(s: Editable?) {}
        }
        editor.addTextChangedListener(watcher)
        browser.onItemSelectedListener=object: AdapterView.OnItemSelectedListener {
            override fun onNothingSelected(parent: AdapterView<*>?) {}
            override fun onItemSelected(parent: AdapterView<*>?,v: View?,position: Int,id: Long) {invalidate()}
        }
        refresh()
    }
    private fun selected()=ResearchBrowser.values().getOrElse(browser.selectedItemPosition){ResearchBrowser.CHROME}
    private fun parse(): BrowserNavigationPlan?=runCatching {BrowserNavigationPlan.parse(selected(),editor.text.toString())}.getOrElse {status.text="Invalid plan. First OPEN an approved Wikipedia/Android-docs URL, then up to5 SCROLL DOWN/UP lines. Other actions are not enabled.";null}
    private fun label(value: String)=TextView(host).apply {text=value;MayaTheme.label(this,14f);setPadding(0,6,0,6);view.addView(this)}
    private fun button(title: String,action: ()->Unit)=Button(host).apply {MayaTheme.button(this,title);setOnClickListener {if(alive && !busy && dialog?.isShowing!=true && allowed(this@InlineBrowserNavigation)) action()};view.addView(this);buttons.add(this)}
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
        if(goal.length>400) {status.text="AI goal limit400. Edit the manual plan locally instead.";return}
        val prompt=BrowserNavigationPlan.prompt(goal);val ticket=++epoch
        status.text="Checking AI connection locally…"
        val cancel=services.review(AiTaskReview.Kind.BROWSER_NAVIGATION,listOf(prompt)) {review,error ->
            if(!alive || epoch!=ticket) {review?.revoke();return@review};epoch++;cancelAi=null
            if(review==null) {status.text="AI unavailable. Manual plan editing still works.";refresh();return@review}
            aiReview=review
            confirm("Ask AI for a browser plan?",review.description+"\nNo screen data is sent. This proposes text only; browser execution needs separate review.\n\n$prompt") {
                if(!review.approve(prompt,SystemClock.elapsedRealtime())) {status.text="AI review expired.";return@confirm}
                aiReview=null;val token=++epoch
                cancelAi=services.text(review,prompt) {reply,_ ->
                    if(!alive || epoch!=token) return@text
                    epoch++;cancelAi=null
                    if(reply!=null && runCatching {BrowserNavigationPlan.parse(selected(),reply)}.isSuccess) {editor.setText(reply);status.text="Proposed plan ready. Review it before any browser action."}
                    else status.text="No valid supported plan returned. Nothing opened."
                    refresh();changed()
                }
                refresh();changed()
            }
            refresh();changed()
        }
        if(epoch==ticket) cancelAi=cancel else cancel()
        refresh();changed()
    }
    private fun invalidate() {epoch++;dialog?.dismiss();dialog=null;grant?.revoke();grant=null;approvedPlan=null;aiReview?.revoke();aiReview=null;cancelAi?.invoke();cancelAi=null;status.text="Plan/app changed. Approval revoked; no automatic run.";if(::approve.isInitialized) refresh();changed()}
    override fun dismissReview() {invalidate()}
    override fun refresh() {val enabled=alive && !busy && allowed(this);buttons.forEach {it.isEnabled=enabled};editor.isEnabled=enabled;browser.isEnabled=enabled;if(::run.isInitialized) run.isEnabled=enabled && grant!=null}
    override fun stop() {handoff=false;detached=false;runId?.let {BrowserNavigationService.instance?.stop(it)};runId=null;invalidate()}
    override fun onHostPause() {if(handoff && executing) detached=true else stop()}
    override fun dispose() {
        if(!detached) stop() else {grant?.revoke();aiReview?.revoke();cancelAi?.invoke()}
        alive=false;handler.removeCallbacksAndMessages(null);view.removeAllViews()
    }
}
